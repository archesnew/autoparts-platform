import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import type { Product, SupplierOffer, Supplier } from "@prisma/client";
import { prisma } from "./db.ts";
import type { CatalogSearchFilters } from "./catalog-types.ts";

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

    if (q) {
      const qLower = q.toLocaleLowerCase("ru-RU");
      conditions.push({
        OR: [
          { primaryOem: { contains: q, mode: "insensitive" } },
          { oemCodes: { has: q.toUpperCase() } },
          { altArticles: { has: q.toUpperCase() } },
          { canonicalName: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          {
            offers: {
              some: {
                OR: [
                  { rawArticle: { contains: q, mode: "insensitive" } },
                  { originalTitle: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      });
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

    // Filter by car make / model / year in applicability json or text
    if (filters.make || filters.model || filters.year) {
      // Applicability is stored as JSON array of { make, model, year, yearFrom, yearTo }
      // For flexibility, we match on applicability JSON or description
      const makeRegex = filters.make ? `(?i)${filters.make}` : null;
      const modelRegex = filters.model ? `(?i)${filters.model}` : null;
      const yearStr = filters.year ? filters.year : null;

      const subConditions: Prisma.ProductWhereInput[] = [];

      if (makeRegex) {
        subConditions.push({
          OR: [
            { canonicalName: { contains: filters.make, mode: "insensitive" } },
            { description: { contains: filters.make, mode: "insensitive" } },
            // Raw JSON path matching can be augmented
          ],
        });
      }
      if (modelRegex) {
        subConditions.push({
          OR: [
            { canonicalName: { contains: filters.model, mode: "insensitive" } },
            { description: { contains: filters.model, mode: "insensitive" } },
          ],
        });
      }
      if (yearStr) {
        subConditions.push({
          OR: [
            { description: { contains: yearStr } },
          ],
        });
      }

      if (subConditions.length) {
        conditions.push({ AND: subConditions });
      }
    }

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
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      this.db.product.count({ where }),
    ]);

    return {
      products: products as ProductWithOffers[],
      total,
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
