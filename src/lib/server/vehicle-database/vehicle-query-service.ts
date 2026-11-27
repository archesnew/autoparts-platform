import "server-only";

import { prisma } from "@/lib/server/db";

const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translitRuToLat(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => RU_TO_LAT[ch] ?? ch)
    .join("");
}

function translitVariants(input: string): string[] {
  const lower = input.toLowerCase();
  const base = translitRuToLat(lower);
  const softJ = translitRuToLat(lower.replace(/дж/g, "j"));
  const variants = new Set<string>([lower]);
  if (base && base !== lower) variants.add(base);
  if (softJ && softJ !== lower) variants.add(softJ);
  return Array.from(variants);
}

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
    const rawSearch = params?.search?.trim() || "";
    const search = rawSearch.toLowerCase();
    const limit = Math.min(params?.limit || 600, 1000);
    const offset = params?.offset || 0;

    const where: Record<string, unknown> = {};

    if (params?.isPopularOnly) {
      where.isPopular = true;
    }
    if (params?.category) {
      where.category = params.category;
    } else {
      // Exclude motorcycles, buses, and heavy-duty trucks from passenger/LCV selector by default
      where.category = { in: ["PASSENGER", "COMMERCIAL"] };
    }

    if (search) {
      const terms = translitVariants(search);
      const firstWord = search.split(/\s+/)[0];
      if (firstWord && firstWord !== search) {
        for (const v of translitVariants(firstWord)) {
          if (!terms.includes(v)) terms.push(v);
        }
      }

      where.OR = terms.flatMap((t) => [
        { name: { contains: t, mode: "insensitive" } },
        { nameRu: { contains: t, mode: "insensitive" } },
        { id: { contains: t, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: t, mode: "insensitive" } } } },
      ]);
    }

    const [makes, total] = await Promise.all([
      prisma.vehicleMake.findMany({
        where,
        orderBy: [{ isPopular: "desc" }, { popularityScore: "asc" }, { name: "asc" }],
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
          aliases: { select: { alias: true } },
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
        aliases: m.aliases.map((a) => a.alias),
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
    const limit = Math.min(params?.limit || 2000, 2500);
    const offset = params?.offset || 0;

    const where: Record<string, unknown> = {
      makeId,
      category: { in: ["CAR", "SUV", "LCV", "PICKUP", "VAN"] },
    };

    if (search) {
      const terms = translitVariants(search);

      where.OR = terms.flatMap((t) => [
        { name: { contains: t, mode: "insensitive" } },
        { nameRu: { contains: t, mode: "insensitive" } },
        { aliases: { some: { alias: { contains: t, mode: "insensitive" } } } },
      ]);
    }

    const [models, total] = await Promise.all([
      prisma.vehicleModel.findMany({
        where,
        orderBy: [{ isPopular: "desc" }, { popularityScore: "asc" }, { name: "asc" }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          makeId: true,
          name: true,
          nameRu: true,
          yearFrom: true,
          yearTo: true,
          yearSemantics: true,
          bodyTypes: true,
          isPopular: true,
          category: true,
          completenessStatus: true,
          aliases: { select: { alias: true } },
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
        yearSemantics: mo.yearSemantics,
        bodyTypes: mo.bodyTypes,
        isPopular: mo.isPopular,
        category: mo.category,
        completenessStatus: mo.completenessStatus,
        aliases: mo.aliases.map((a) => a.alias),
        generationsCount: mo._count.generations,
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Combined multi-token search for "Toyota Camry", "Тойота Камри", "Киа Спортейдж", "Лада Веста", etc.
   */
  async searchCombinedVehicles(rawQuery: string, limit = 15) {
    const clean = rawQuery.trim().toLowerCase();
    if (clean.length < 2) return [];

    // Keep numeric single-character tokens like "3" in "BYD Atto 3" or "Mazda 3"
    const tokens = clean.split(/\s+/).filter((t) => t.length >= 2 || /\d/.test(t));
    if (tokens.length === 0) return [];

    const expandedTokens = tokens.map((t) => translitVariants(t));

    const andClauses = expandedTokens.map((variants) => ({
      OR: variants.flatMap((v) => [
        { name: { contains: v, mode: "insensitive" as const } },
        { nameRu: { contains: v, mode: "insensitive" as const } },
        { aliases: { some: { alias: { contains: v, mode: "insensitive" as const } } } },
        { make: { name: { contains: v, mode: "insensitive" as const } } },
        { make: { nameRu: { contains: v, mode: "insensitive" as const } } },
        { make: { aliases: { some: { alias: { contains: v, mode: "insensitive" as const } } } } },
      ]),
    }));

    const models = await prisma.vehicleModel.findMany({
      where: {
        category: { in: ["CAR", "SUV", "LCV", "PICKUP", "VAN"] },
        AND: andClauses,
      },
      orderBy: [
        { isPopular: "desc" },
        { popularityScore: "asc" },
        { make: { isPopular: "desc" } },
        { name: "asc" },
      ],
      take: Math.max(limit * 4, 60),
      select: {
        id: true,
        name: true,
        nameRu: true,
        yearFrom: true,
        yearTo: true,
        yearSemantics: true,
        bodyTypes: true,
        isPopular: true,
        popularityScore: true,
        make: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            country: true,
          },
        },
      },
    });

    const queryVariants = translitVariants(clean);
    const tailQuery = tokens.length > 1 ? translitVariants(tokens.slice(1).join(" ")) : queryVariants;

    const scored = models.map((m) => {
      const fullName = `${m.make.name} ${m.name}`.toLowerCase();
      const modelLower = m.name.toLowerCase();
      let score = m.isPopular ? 20 : 0;
      if (m.popularityScore !== null) score += Math.max(0, 20 - Math.floor(m.popularityScore / 20));
      if (queryVariants.some((qv) => fullName === qv || modelLower === qv)) score += 200;
      else if (tailQuery.some((tq) => modelLower === tq)) score += 160;
      else if (queryVariants.some((qv) => fullName.startsWith(qv))) score += 100;
      else if (tailQuery.some((tq) => modelLower.startsWith(tq))) score += 80;
      // Slightly prefer shorter base model names (e.g. "Atto 3" over "Atto 3 Evo")
      score -= Math.min(30, modelLower.length);
      return { m, score };
    });

    scored.sort((a, b) => b.score - a.score || a.m.name.localeCompare(b.m.name));

    return scored.slice(0, limit).map(({ m }) => ({
      makeId: m.make.id,
      makeName: m.make.name,
      makeNameRu: m.make.nameRu,
      country: m.make.country,
      modelId: m.id,
      modelName: m.name,
      modelNameRu: m.nameRu,
      yearFrom: m.yearFrom,
      yearTo: m.yearTo,
      yearSemantics: m.yearSemantics,
      bodyTypes: m.bodyTypes,
    }));
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
   * List available years and body types directly for a model that has no generations yet.
   */
  async listModelLevelOptions(modelId: string): Promise<{
    years: number[];
    yearSemantics: string | null;
    bodyTypes: string[];
  }> {
    const model = await prisma.vehicleModel.findUnique({
      where: { id: modelId },
      select: {
        yearFrom: true,
        yearTo: true,
        yearSemantics: true,
        bodyTypes: true,
      },
    });
    if (!model) return { years: [], yearSemantics: null, bodyTypes: [] };

    const years: number[] = [];
    if (model.yearFrom) {
      const end = model.yearTo && model.yearTo >= model.yearFrom ? model.yearTo : new Date().getFullYear();
      const clampedStart = Math.max(model.yearFrom, 1950);
      const clampedEnd = Math.min(end, 2027);
      for (let y = clampedEnd; y >= clampedStart; y--) {
        years.push(y);
      }
    }

    let bodyTypes = model.bodyTypes || [];
    if (bodyTypes.length === 0) {
      const all = await prisma.vehicleBodyType.findMany({ select: { code: true } });
      bodyTypes = all.map((b) => b.code);
    }

    return {
      years,
      yearSemantics: model.yearSemantics || null,
      bodyTypes,
    };
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
