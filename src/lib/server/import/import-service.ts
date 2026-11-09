import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../db.ts";
import { parseFeedBuffer } from "./feed-parser.ts";
import { normalizeFeedRow, type NormalizedFeedItem } from "./field-normalizer.ts";
import { ProductMatcher } from "./product-matcher.ts";

export type ImportJobSummary = {
  id: string;
  supplierId: string;
  supplierName: string;
  fileName: string;
  fileFormat: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  newProductsCount: number;
  updatedOffersCount: number;
  status: string;
  errorSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export class ImportService {
  /** Create staged ImportJob and process file into preview */
  async stageImportJob(params: {
    supplierId: string;
    fileName: string;
    buffer: Buffer;
    forcedFormat?: "YML" | "XML" | "CSV" | "XLSX";
    source?: string;
    columnMapping?: Record<string, string>;
  }): Promise<{
    job: ImportJobSummary;
    previewRows: NormalizedFeedItem[];
    detectedHeaders?: string[];
  }> {
    const {
      supplierId,
      fileName,
      buffer,
      forcedFormat,
      source = "RU_DISMANTLE",
      columnMapping,
    } = params;

    let supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, countryCode: true },
    });
    if (!supplier) {
      // Robust fallback: search by name or legacy demo ID
      supplier = await prisma.supplier.findFirst({
        where: {
          OR: [
            { name: { contains: supplierId, mode: "insensitive" } },
            supplierId === "sup-ru-01" ? { name: { contains: "Север" } } : {},
            supplierId === "sup-by-02" ? { name: { contains: "Минск" } } : {},
            supplierId === "sup-pl-03" ? { name: { contains: "Baltic" } } : {},
          ],
        },
        select: { id: true, name: true, countryCode: true },
      });
    }
    if (!supplier) {
      supplier = await prisma.supplier.findFirst({
        select: { id: true, name: true, countryCode: true },
      });
    }
    if (!supplier) {
      throw new Error(`Поставщик с ID '${supplierId}' не найден в базе данных`);
    }

    const resolvedSupplierId = supplier.id;

    // 1. Parse feed
    const parsed = parseFeedBuffer(fileName, buffer, forcedFormat);

    // Extract detected headers from first row
    const detectedHeaders = parsed.rows[0] ? Object.keys(parsed.rows[0]) : [];

    // 2. Create Job in DB
    const job = await prisma.importJob.create({
      data: {
        supplierId: resolvedSupplierId,
        fileName,
        fileFormat: parsed.format,
        fileSize: buffer.length,
        totalRows: parsed.rawRowCount,
        status: "PARSED",
      },
    });

    // 3. Normalize and Match
    const matcher = new ProductMatcher();
    let validCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let newProductsCount = 0;
    let updatedOffersCount = 0;

    const previewList: NormalizedFeedItem[] = [];

    for (let i = 0; i < parsed.rows.length; i++) {
      const raw = parsed.rows[i];
      const normalized = normalizeFeedRow(
        raw,
        resolvedSupplierId,
        source,
        columnMapping
      );
      const match = await matcher.matchRow(normalized, resolvedSupplierId, source);

      const allErrors = [...normalized.validationErrors, ...match.errors];
      const isValid =
        allErrors.length === 0 &&
        match.matchType !== "DUPLICATE_IN_FEED" &&
        match.matchType !== "AMBIGUOUS";

      if (isValid) {
        validCount++;
        if (match.matchType === "NEW_PRODUCT") newProductsCount++;
        else if (match.matchType === "MATCHED_EXISTING") updatedOffersCount++;
      } else {
        if (match.matchType === "DUPLICATE_IN_FEED") duplicateCount++;
        else errorCount++;
      }

      await prisma.importRow.create({
        data: {
          jobId: job.id,
          rowIndex: i + 1,
          externalId: normalized.externalId,
          rawOem: normalized.rawOem,
          normalizedOem: normalized.normalizedOem,
          title: normalized.title || `Позиция #${i + 1}`,
          brand: normalized.brand,
          category: normalized.category,
          price: normalized.price !== null ? new Decimal(normalized.price) : null,
          currency: normalized.currency,
          quantity: normalized.quantity,
          condition: normalized.condition,
          deliveryTerms: normalized.deliveryTerms,
          deliveryDays: normalized.deliveryDays,
          photos: normalized.photos,
          description: normalized.description,
          city: normalized.city,
          sourceUrl: normalized.sourceUrl,
          status: isValid ? "VALID" : "INVALID",
          matchType: match.matchType,
          matchedProductId: match.matchedProductId || null,
          matchedOfferId: match.matchedOfferId || null,
          errors: allErrors,
        },
      });

      if (previewList.length < 50) {
        previewList.push(normalized);
      }
    }

    // 4. Update Job Stats
    const updatedJob = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        validRows: validCount,
        errorRows: errorCount,
        duplicateRows: duplicateCount,
        newProductsCount,
        updatedOffersCount,
        status: "PREVIEW_READY",
      },
    });

    return {
      job: {
        ...updatedJob,
        supplierName: supplier.name,
        createdAt: updatedJob.createdAt.toISOString(),
        updatedAt: updatedJob.updatedAt.toISOString(),
      },
      previewRows: previewList,
      detectedHeaders,
    };
  }

  /** Commit previewed rows into Product & SupplierOffer */
  async commitImportJob(
    jobId: string,
    options?: {
      isFullFeed?: boolean;
      archiveMissing?: boolean;
    }
  ): Promise<{
    success: boolean;
    createdProducts: number;
    createdOffers: number;
    updatedOffers: number;
    archivedOffers: number;
    errorsCount: number;
  }> {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        supplier: true,
        rows: {
          where: { status: "VALID" },
        },
      },
    });

    if (!job) {
      throw new Error("Задача импорта не найдена");
    }
    if (job.status === "COMPLETED") {
      throw new Error("Этот импорт уже был успешно применён к каталогу");
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: "COMMITTING" },
    });

    let createdProducts = 0;
    let createdOffers = 0;
    let updatedOffers = 0;
    let archivedOffers = 0;

    const source =
      job.supplier.countryCode === "BY"
        ? "BY_DISMANTLE"
        : job.supplier.countryCode === "PL"
        ? "PL_ALLEGRO"
        : "RU_DISMANTLE";

    for (const row of job.rows) {
      try {
        let productId = row.matchedProductId;

        // If new product needed:
        if (!productId) {
          const newProduct = await prisma.product.create({
            data: {
              canonicalName: row.title,
              brand: row.brand || "ORIGINAL OEM",
              category: row.category || "Общие детали",
              primaryOem: row.rawOem || row.normalizedOem || "NO-OEM",
              oemCodes: row.normalizedOem ? [row.normalizedOem] : [],
              altArticles: [],
              photos: row.photos.length ? row.photos : ["/brake-rotor.webp"],
              description: row.description || `Поставка от ${job.supplier.name}`,
              status: "ACTIVE",
            },
          });
          productId = newProduct.id;
          createdProducts++;
        }

        // Determine precise status:
        // - null price or missing/zero quantity -> ON_REQUEST (never confirmed in stock!)
        // - quantity > 0 and price != null -> IN_STOCK
        const offerStatus: "IN_STOCK" | "ON_REQUEST" | "OUT_OF_STOCK" =
          row.price === null || row.quantity <= 0
            ? "ON_REQUEST"
            : "IN_STOCK";

        // Upsert SupplierOffer
        if (row.matchedOfferId) {
          // Update existing offer
          await prisma.supplierOffer.update({
            where: { id: row.matchedOfferId },
            data: {
              purchasePrice: row.price,
              currency: row.currency,
              quantity: row.quantity,
              condition: row.condition,
              status: offerStatus,
              deliveryTerms: row.deliveryTerms,
              deliveryDays: row.deliveryDays,
              sourceUrl: row.sourceUrl,
              lastSeenAt: new Date(),
            },
          });
          updatedOffers++;
        } else {
          // Create new offer (or update by unique constraint)
          await prisma.supplierOffer.upsert({
            where: {
              supplierId_source_externalId: {
                supplierId: job.supplierId,
                source,
                externalId: row.externalId || "gen-" + row.id,
              },
            },
            update: {
              purchasePrice: row.price,
              currency: row.currency,
              quantity: row.quantity,
              condition: row.condition,
              status: offerStatus,
              deliveryTerms: row.deliveryTerms,
              deliveryDays: row.deliveryDays,
              sourceUrl: row.sourceUrl,
              lastSeenAt: new Date(),
            },
            create: {
              productId,
              supplierId: job.supplierId,
              source,
              externalId: row.externalId || "gen-" + row.id,
              originalTitle: row.title,
              rawArticle: row.rawOem,
              purchasePrice: row.price,
              currency: row.currency,
              quantity: row.quantity,
              condition: row.condition,
              status: offerStatus,
              deliveryTerms: row.deliveryTerms,
              deliveryDays: row.deliveryDays,
              sourceUrl: row.sourceUrl,
              lastSeenAt: new Date(),
            },
          });
          createdOffers++;
        }
      } catch (err) {
        console.error(`Error committing row ${row.rowIndex}:`, err);
      }
    }

    // Full feed mode: archive missing offers if requested
    if (options?.isFullFeed && options?.archiveMissing) {
      const archiveResult = await prisma.supplierOffer.updateMany({
        where: {
          supplierId: job.supplierId,
          source,
          lastSeenAt: { lt: job.createdAt },
          status: { not: "ARCHIVED_SOLD" },
        },
        data: {
          status: "ARCHIVED_SOLD",
          quantity: 0,
          updatedAt: new Date(),
        },
      });
      archivedOffers = archiveResult.count;
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        newProductsCount: createdProducts,
        updatedOffersCount: updatedOffers + createdOffers,
      },
    });

    return {
      success: true,
      createdProducts,
      createdOffers,
      updatedOffers,
      archivedOffers,
      errorsCount: job.errorRows,
    };
  }

  /** Get job details with paginated rows */
  async getJobDetails(jobId: string, skip = 0, take = 50) {
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        supplier: { select: { id: true, name: true, countryCode: true } },
      },
    });
    if (!job) return null;

    const [rows, totalRowsCount] = await Promise.all([
      prisma.importRow.findMany({
        where: { jobId },
        skip,
        take,
        orderBy: { rowIndex: "asc" },
      }),
      prisma.importRow.count({ where: { jobId } }),
    ]);

    return {
      job: {
        ...job,
        supplierName: job.supplier.name,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
      rows: rows.map((r) => ({
        ...r,
        price: r.price ? r.price.toString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
      totalRowsCount,
    };
  }

  /** Get list of import jobs */
  async listJobs(supplierId?: string, take = 20) {
    const jobs = await prisma.importJob.findMany({
      where: supplierId ? { supplierId } : {},
      include: {
        supplier: { select: { id: true, name: true, countryCode: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return jobs.map((j) => ({
      ...j,
      supplierName: j.supplier.name,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    }));
  }
}

export const importService = new ImportService();
