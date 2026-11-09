import "server-only";

import { prisma } from "@/lib/server/db";

export interface CreateFitmentInput {
  productId: string;
  makeId: string;
  modelId?: string;
  generationId?: string;
  modificationId?: string;
  yearFrom?: number;
  yearTo?: number;
  notes?: string;
  position?: string;
  isUniversal?: boolean;
}

export class FitmentService {
  /**
   * Link a product (spare part) to specific vehicle taxonomy nodes.
   */
  async addFitment(input: CreateFitmentInput) {
    if (!input.productId || !input.makeId) {
      throw new Error("Product ID and Make ID are required for fitment");
    }

    return prisma.productFitment.create({
      data: {
        productId: input.productId,
        makeId: input.makeId,
        modelId: input.modelId || null,
        generationId: input.generationId || null,
        modificationId: input.modificationId || null,
        yearFrom: input.yearFrom || null,
        yearTo: input.yearTo || null,
        notes: input.notes?.trim() || null,
        position: input.position?.trim() || null,
        isUniversal: Boolean(input.isUniversal),
      },
    });
  }

  /**
   * Query parts that fit a specific vehicle.
   */
  async findPartsForVehicle(params: {
    makeId: string;
    modelId?: string;
    generationId?: string;
    modificationId?: string;
    year?: number;
    categoryId?: string;
    limit?: number;
  }) {
    const limit = Math.min(params.limit || 50, 100);

    const fitments = await prisma.productFitment.findMany({
      where: {
        makeId: params.makeId,
        OR: [
          { isUniversal: true },
          {
            AND: [
              params.modelId ? { OR: [{ modelId: null }, { modelId: params.modelId }] } : {},
              params.generationId ? { OR: [{ generationId: null }, { generationId: params.generationId }] } : {},
              params.modificationId ? { OR: [{ modificationId: null }, { modificationId: params.modificationId }] } : {},
              params.year
                ? {
                    AND: [
                      { OR: [{ yearFrom: null }, { yearFrom: { lte: params.year } }] },
                      { OR: [{ yearTo: null }, { yearTo: { gte: params.year } }] },
                    ],
                  }
                : {},
            ],
          },
        ],
      },
      include: {
        product: {
          include: {
            offers: {
              where: { status: "IN_STOCK" },
              take: 3,
            },
          },
        },
      },
      take: limit,
    });

    return fitments.map((f) => ({
      fitmentId: f.id,
      notes: f.notes,
      position: f.position,
      product: f.product,
    }));
  }

  /**
   * List all vehicle fitments for a specific product.
   */
  async getProductFitments(productId: string) {
    return prisma.productFitment.findMany({
      where: { productId },
      include: {
        make: { select: { id: true, name: true, nameRu: true } },
        model: { select: { id: true, name: true, nameRu: true } },
        generation: { select: { id: true, name: true, shortName: true, code: true } },
        modification: { select: { id: true, name: true } },
      },
      orderBy: [{ make: { name: "asc" } }, { model: { name: "asc" } }],
    });
  }
}

export const fitmentService = new FitmentService();
