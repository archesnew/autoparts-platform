import "server-only";

import { prisma } from "@/lib/server/db";

export class VehicleQueryService {
  /**
   * Search and list vehicle makes with pagination, popularity sort, and alias search.
   */
  async listMakes(params?: {
    search?: string;
    isPopularOnly?: boolean;
    category?: string;
    limit?: number;
    offset?: number;
  }) {
    const search = params?.search?.trim().toLowerCase();
    const limit = Math.min(params?.limit || 100, 200);
    const offset = params?.offset || 0;

    const where: Record<string, unknown> = {};

    if (params?.isPopularOnly) {
      where.isPopular = true;
    }
    if (params?.category) {
      where.category = params.category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameRu: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [makes, total] = await Promise.all([
      prisma.vehicleMake.findMany({
        where,
        orderBy: [{ isPopular: "desc" }, { name: "asc" }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          nameRu: true,
          country: true,
          isPopular: true,
          category: true,
          completenessStatus: true,
          _count: { select: { models: true } },
        },
      }),
      prisma.vehicleMake.count({ where }),
    ]);

    return {
      makes: makes.map((m) => ({
        id: m.id,
        name: m.name,
        nameRu: m.nameRu,
        country: m.country,
        isPopular: m.isPopular,
        category: m.category,
        completenessStatus: m.completenessStatus,
        modelsCount: m._count.models,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * List models for a specific make with search and popularity.
   */
  async listModels(makeId: string, params?: { search?: string; limit?: number; offset?: number }) {
    const search = params?.search?.trim().toLowerCase();
    const limit = Math.min(params?.limit || 150, 250);
    const offset = params?.offset || 0;

    const where: Record<string, unknown> = { makeId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameRu: { contains: search, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [models, total] = await Promise.all([
      prisma.vehicleModel.findMany({
        where,
        orderBy: [{ isPopular: "desc" }, { name: "asc" }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          makeId: true,
          name: true,
          nameRu: true,
          yearFrom: true,
          yearTo: true,
          isPopular: true,
          category: true,
          completenessStatus: true,
          _count: { select: { generations: true } },
        },
      }),
      prisma.vehicleModel.count({ where }),
    ]);

    return {
      models: models.map((mo) => ({
        id: mo.id,
        makeId: mo.makeId,
        name: mo.name,
        nameRu: mo.nameRu,
        yearFrom: mo.yearFrom,
        yearTo: mo.yearTo,
        isPopular: mo.isPopular,
        category: mo.category,
        completenessStatus: mo.completenessStatus,
        generationsCount: mo._count.generations,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * List generations for a model.
   */
  async listGenerations(modelId: string, search?: string) {
    const where: Record<string, unknown> = { modelId };
    if (search?.trim()) {
      const s = search.trim().toLowerCase();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { shortName: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
      ];
    }

    const generations = await prisma.vehicleGeneration.findMany({
      where,
      orderBy: [{ yearFrom: "desc" }, { isRestyling: "desc" }],
      select: {
        id: true,
        modelId: true,
        name: true,
        shortName: true,
        code: true,
        yearFrom: true,
        yearTo: true,
        isRestyling: true,
        defaultBodyType: true,
        completenessStatus: true,
        years: { select: { year: true }, orderBy: { year: "desc" } },
        _count: { select: { engines: true, modifications: true } },
      },
    });

    return generations.map((g) => ({
      id: g.id,
      modelId: g.modelId,
      name: g.name,
      shortName: g.shortName,
      code: g.code,
      yearStart: g.yearFrom,
      yearEnd: g.yearTo,
      isRestyling: g.isRestyling,
      defaultBodyType: g.defaultBodyType,
      years: g.years.map((y) => y.year),
      completenessStatus: g.completenessStatus,
      enginesCount: g._count.engines,
      modificationsCount: g._count.modifications,
    }));
  }

  /**
   * List available years for a generation.
   */
  async listYears(generationId: string): Promise<number[]> {
    const records = await prisma.vehicleYear.findMany({
      where: { generationId },
      orderBy: { year: "desc" },
      select: { year: true },
    });
    return records.map((r) => r.year);
  }

  /**
   * List available body types for a generation (or all body types).
   */
  async listBodyTypes(generationId?: string): Promise<string[]> {
    if (generationId) {
      const [gen, mods] = await Promise.all([
        prisma.vehicleGeneration.findUnique({
          where: { id: generationId },
          select: { defaultBodyType: true },
        }),
        prisma.vehicleModification.findMany({
          where: { generationId },
          select: { bodyType: true },
          distinct: ["bodyType"],
        }),
      ]);
      const set = new Set<string>();
      if (gen?.defaultBodyType) set.add(gen.defaultBodyType);
      for (const m of mods) {
        if (m.bodyType) set.add(m.bodyType);
      }
      if (set.size > 0) return Array.from(set);
    }
    const all = await prisma.vehicleBodyType.findMany({ select: { code: true } });
    return all.map((b) => b.code);
  }

  /**
   * List engines for a generation.
   */
  async listEngines(generationId: string, search?: string) {
    const where: Record<string, unknown> = { generationId };
    if (search?.trim()) {
      const s = search.trim().toLowerCase();
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { code: { contains: s, mode: "insensitive" } },
      ];
    }

    return prisma.vehicleEngine.findMany({
      where,
      orderBy: { displacementCc: "asc" },
      select: {
        id: true,
        generationId: true,
        name: true,
        code: true,
        fuelType: true,
        displacementCc: true,
        powerHp: true,
        powerKw: true,
      },
    });
  }

  /**
   * List modifications for a generation (optionally filtered by engine).
   */
  async listModifications(generationId: string, engineId?: string, search?: string) {
    const where: Record<string, unknown> = { generationId };
    if (engineId) {
      where.engineId = engineId;
    }
    if (search?.trim()) {
      const s = search.trim().toLowerCase();
      where.name = { contains: s, mode: "insensitive" };
    }

    return prisma.vehicleModification.findMany({
      where,
      orderBy: [{ yearFrom: "desc" }, { name: "asc" }],
      select: {
        id: true,
        generationId: true,
        engineId: true,
        name: true,
        bodyType: true,
        transmission: true,
        drivetrain: true,
        yearFrom: true,
        yearTo: true,
        completenessStatus: true,
        engine: {
          select: {
            id: true,
            name: true,
            code: true,
            fuelType: true,
            powerHp: true,
          },
        },
      },
    });
  }

  /**
   * Comprehensive database overview for CRM staff.
   */
  async getOverviewStats() {
    const [
      sources,
      makesCount,
      modelsCount,
      generationsCount,
      enginesCount,
      modificationsCount,
      aliasesCount,
      sourceRecordsCount,
      bodyTypes,
      completenessBreakdown,
    ] = await Promise.all([
      prisma.vehicleDataSource.findMany({
        orderBy: { lastImportAt: "desc" },
      }),
      prisma.vehicleMake.count(),
      prisma.vehicleModel.count(),
      prisma.vehicleGeneration.count(),
      prisma.vehicleEngine.count(),
      prisma.vehicleModification.count(),
      prisma.vehicleAlias.count(),
      prisma.vehicleSourceRecord.count(),
      prisma.vehicleBodyType.findMany({ orderBy: { code: "asc" } }),
      prisma.vehicleMake.groupBy({
        by: ["completenessStatus"],
        _count: { id: true },
      }),
    ]);

    return {
      sources,
      counts: {
        makes: makesCount,
        models: modelsCount,
        generations: generationsCount,
        engines: enginesCount,
        modifications: modificationsCount,
        aliases: aliasesCount,
        sourceRecords: sourceRecordsCount,
        bodyTypes: bodyTypes.length,
      },
      bodyTypes,
      completenessBreakdown: completenessBreakdown.map((c) => ({
        status: c.completenessStatus,
        count: c._count.id,
      })),
    };
  }
}

export const vehicleQueryService = new VehicleQueryService();
