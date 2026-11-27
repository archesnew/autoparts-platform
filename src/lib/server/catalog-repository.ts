import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import type { Product, SupplierOffer, Supplier } from "@prisma/client";
import { prisma } from "./db.ts";
import type { CatalogSearchFilters } from "./catalog-types.ts";
import { analyzeSearchQuery, scoreProductRelevance } from "./catalog-search-normalizer.ts";

export type ProductWithOffers = Product & {
  offers: (SupplierOffer & {
    supplier: Pick<Supplier, "id" | "name" | "countryCode">;
  })[];
};

export class PrismaCatalogRepository {
  private readonly db: PrismaClient | Prisma.TransactionClient;

  constructor(db: PrismaClient | Prisma.TransactionClient = prisma) {
    this.db = db;
  }

  async search(filters: CatalogSearchFilters): Promise<{ products: ProductWithOffers[]; total: number }> {
    const q = filters.query?.trim();
    const conditions: Prisma.ProductWhereInput[] = [];

    let analysis: ReturnType<typeof analyzeSearchQuery> | null = null;

    if (q) {
      analysis = analyzeSearchQuery(q);
      const orClauses: Prisma.ProductWhereInput[] = [];

      for (const variant of analysis.queryVariants) {
        orClauses.push(
          { primaryOem: { contains: variant, mode: "insensitive" } },
          { oemCodes: { has: variant.toUpperCase() } },
          { altArticles: { has: variant.toUpperCase() } },
          { canonicalName: { contains: variant, mode: "insensitive" } },
          { brand: { contains: variant, mode: "insensitive" } },
          { description: { contains: variant, mode: "insensitive" } },
          {
            offers: {
              some: {
                OR: [
                  { rawArticle: { contains: variant, mode: "insensitive" } },
                  { originalTitle: { contains: variant, mode: "insensitive" } },
                ],
              },
            },
          }
        );
      }

      for (const b of analysis.brandHints) {
        orClauses.push({ brand: { equals: b, mode: "insensitive" } });
      }

      for (const c of analysis.categoryHints) {
        orClauses.push({ category: { equals: c } });
      }

      conditions.push({ OR: orClauses });
    }

    if (filters.category) {
      conditions.push({ category: { equals: filters.category } });
    }

    if (filters.brand) {
      conditions.push({ brand: { equals: filters.brand, mode: "insensitive" } });
    }

    if (filters.availability === "IN_STOCK") {
      conditions.push({
        status: { not: "ARCHIVED_SOLD" },
        offers: {
          some: {
            status: { in: ["IN_STOCK", "ON_REQUEST"] },
          },
        },
      });
    } else if (filters.availability === "ARCHIVED_SOLD") {
      conditions.push({
        OR: [
          { status: "ARCHIVED_SOLD" },
          { offers: { some: { status: "ARCHIVED_SOLD" } } },
        ],
      });
    }

    // Filter by supplier country (RU, BY, PL)
    if (filters.country) {
      const code =
        filters.country === "Россия" || filters.country === "RU"
          ? "RU"
          : filters.country === "Беларусь" || filters.country === "BY"
          ? "BY"
          : filters.country === "Польша" || filters.country === "PL"
          ? "PL"
          : filters.country;

      conditions.push({
        offers: {
          some: {
            supplier: { countryCode: code },
          },
        },
      });
    }

    // Filter by condition (Новая / БУ / NEW / USED)
    if (filters.condition) {
      const cond =
        filters.condition === "Новая" || filters.condition === "NEW"
          ? "NEW"
          : "USED";
      conditions.push({
        offers: {
          some: {
            condition: cond,
          },
        },
      });
    }

    // Apply vehicle compatibility filtering ONLY when fitmentOnly (CONFIRMED mode) is explicitly enabled
    const hasVehicleFilter = Boolean(filters.fitmentOnly) && Boolean(filters.make || filters.model || filters.year);

    const where: Prisma.ProductWhereInput = conditions.length ? { AND: conditions } : {};

    const [products, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: {
          offers: {
            include: {
              supplier: {
                select: { id: true, name: true, countryCode: true },
              },
            },
            orderBy: [{ status: "asc" }, { purchasePrice: "asc" }],
          },
          ...(hasVehicleFilter
            ? {
                fitments: {
                  include: {
                    make: { select: { name: true, nameRu: true } },
                    model: { select: { name: true, nameRu: true } },
                    generation: { select: { name: true, shortName: true } },
                  },
                },
              }
            : {}),
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: hasVehicleFilter ? 0 : (filters.skip ?? 0),
        take: hasVehicleFilter ? 250 : (filters.take ?? 50),
      }),
      this.db.product.count({ where }),
    ]);

    let sortedProducts = products as ProductWithOffers[];

    if (hasVehicleFilter) {
      const targetMake = filters.make?.trim().toLowerCase();
      const targetModel = filters.model?.trim().toLowerCase();
      const targetYear = filters.year ? parseInt(filters.year, 10) : null;

      sortedProducts = sortedProducts.filter((prod: any) => {
        const apps = Array.isArray(prod.applicability) ? prod.applicability : [];
        const fitments = Array.isArray(prod.fitments) ? prod.fitments : [];

        // CONFIRMED compatibility via structured Product.applicability
        const matchesApp = apps.some((a: any) => {
          const makeOk = !targetMake || (a.make && String(a.make).toLowerCase() === targetMake);
          const modelOk = !targetModel || (a.model && String(a.model).toLowerCase().includes(targetModel));
          const yearOk =
            !targetYear ||
            (a.yearFrom && a.yearTo
              ? targetYear >= Number(a.yearFrom) && targetYear <= Number(a.yearTo)
              : a.year
              ? String(a.year).includes(String(targetYear))
              : true);
          return makeOk && modelOk && yearOk;
        });

        // CONFIRMED compatibility via ProductFitment relational records
        const matchesFitment = fitments.some((f: any) => {
          if (f.isUniversal) return true;
          const fMake = (f.make?.name || "").toLowerCase();
          const fModel = (f.model?.name || "").toLowerCase();
          const makeOk = !targetMake || fMake === targetMake;
          const modelOk = !targetModel || fModel.includes(targetModel);
          const yearOk =
            !targetYear ||
            (f.yearFrom && f.yearTo
              ? targetYear >= Number(f.yearFrom) && targetYear <= Number(f.yearTo)
              : true);
          return makeOk && modelOk && yearOk;
        });

        return matchesApp || matchesFitment;
      });
    }

    const filteredTotal = hasVehicleFilter ? sortedProducts.length : total;
    if (hasVehicleFilter) {
      const start = filters.skip ?? 0;
      const count = filters.take ?? 50;
      sortedProducts = sortedProducts.slice(start, start + count);
    }

    if (analysis) {
      const targetAnalysis = analysis;
      const scored = sortedProducts.map((p) => ({
        product: p,
        score: scoreProductRelevance(p, targetAnalysis),
      }));
      scored.sort((a, b) => b.score - a.score);
      sortedProducts = scored.map((s) => s.product);
    }

    return {
      products: sortedProducts,
      total: filteredTotal,
    };
  }

  async findById(id: string): Promise<ProductWithOffers | null> {
    const product = await this.db.product.findUnique({
      where: { id },
      include: {
        offers: {
          include: {
            supplier: {
              select: { id: true, name: true, countryCode: true },
            },
          },
          orderBy: [{ status: "asc" }, { purchasePrice: "asc" }],
        },
      },
    });
    return product as ProductWithOffers | null;
  }

  async findByPrimaryOem(primaryOem: string): Promise<ProductWithOffers | null> {
    const product = await this.db.product.findFirst({
      where: {
        OR: [
          { primaryOem: { equals: primaryOem, mode: "insensitive" } },
          { oemCodes: { has: primaryOem.toUpperCase() } },
        ],
      },
      include: {
        offers: {
          include: {
            supplier: {
              select: { id: true, name: true, countryCode: true },
            },
          },
        },
      },
    });
    return product as ProductWithOffers | null;
  }

  async createProduct(data: Prisma.ProductCreateInput): Promise<ProductWithOffers> {
    const created = await this.db.product.create({
      data,
      include: {
        offers: {
          include: {
            supplier: {
              select: { id: true, name: true, countryCode: true },
            },
          },
        },
      },
    });
    return created as ProductWithOffers;
  }

  async updateProduct(id: string, data: Prisma.ProductUpdateInput): Promise<ProductWithOffers> {
    const updated = await this.db.product.update({
      where: { id },
      data,
      include: {
        offers: {
          include: {
            supplier: {
              select: { id: true, name: true, countryCode: true },
            },
          },
        },
      },
    });
    return updated as ProductWithOffers;
  }

  async archiveProduct(id: string): Promise<ProductWithOffers> {
    // Perpetual memory: product status -> ARCHIVED_SOLD, offers -> ARCHIVED_SOLD
    const updated = await this.db.product.update({
      where: { id },
      data: {
        status: "ARCHIVED_SOLD",
        offers: {
          updateMany: {
            where: { status: { not: "ARCHIVED_SOLD" } },
            data: { status: "ARCHIVED_SOLD" },
          },
        },
      },
      include: {
        offers: {
          include: {
            supplier: {
              select: { id: true, name: true, countryCode: true },
            },
          },
        },
      },
    });
    return updated as ProductWithOffers;
  }

  async createOffer(data: Prisma.SupplierOfferCreateInput): Promise<SupplierOffer> {
    return this.db.supplierOffer.create({ data });
  }

  async archiveOffer(id: string): Promise<SupplierOffer> {
    const offer = await this.db.supplierOffer.update({
      where: { id },
      data: { status: "ARCHIVED_SOLD" },
    });

    // Check if the parent product has any remaining active offers
    const remainingActive = await this.db.supplierOffer.count({
      where: {
        productId: offer.productId,
        status: { in: ["IN_STOCK", "ON_REQUEST"] },
      },
    });

    if (remainingActive === 0) {
      await this.db.product.update({
        where: { id: offer.productId },
        data: { status: "ARCHIVED_SOLD" },
      });
    }

    return offer;
  }
}

export const catalogRepository = new PrismaCatalogRepository();
