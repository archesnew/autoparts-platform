import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { VEHICLE_DATA_SOURCES } from "./sources.ts";
import {
  VEHICLE_BODY_TYPES,
  RAW_VEHICLE_MAKES,
  RAW_VEHICLE_MODELS,
  RAW_VEHICLE_GENERATIONS,
  RAW_VEHICLE_ENGINES,
  RAW_VEHICLE_MODIFICATIONS,
} from "./registry-data.ts";
import {
  INTERNATIONAL_MAKE_RU,
  VERIFIED_REGIONAL_MAKES,
  VERIFIED_REGIONAL_MODELS,
  VERIFIED_REGIONAL_GENERATIONS,
  VERIFIED_REGIONAL_ENGINES,
} from "./verified-regional-extra.ts";
import type { ImportStats } from "./types.ts";

const MAKE_COUNTRY_DEFAULT: Record<string, string> = {
  toyota: "Япония", honda: "Япония", nissan: "Япония", mazda: "Япония",
  mitsubishi: "Япония", subaru: "Япония", suzuki: "Япония", lexus: "Япония",
  daihatsu: "Япония", isuzu: "Япония", infiniti: "Япония", acura: "Япония", datsun: "Япония",
  bmw: "Германия", volkswagen: "Германия", "mercedes-benz": "Германия", audi: "Германия",
  opel: "Германия", porsche: "Германия", mini: "Германия", smart: "Германия",
  ford: "США", chevrolet: "США", gmc: "США", dodge: "США", jeep: "США",
  cadillac: "США", lincoln: "США", tesla: "США", ram: "США", chrysler: "США",
  buick: "США", pontiac: "США", mercury: "США", hummer: "США", rivian: "США", lucid: "США",
  hyundai: "Южная Корея", kia: "Южная Корея", genesis: "Южная Корея", ssangyong: "Южная Корея", daewoo: "Южная Корея",
  peugeot: "Франция", renault: "Франция", citroen: "Франция", ds: "Франция", alpine: "Франция", bugatti: "Франция",
  fiat: "Италия", "alfa-romeo": "Италия", ferrari: "Италия", lamborghini: "Италия", maserati: "Италия", lancia: "Италия", abarth: "Италия", iveco: "Италия",
  volvo: "Швеция", saab: "Швеция", polestar: "Швеция",
  skoda: "Чехия", seat: "Испания", cupra: "Испания", dacia: "Румыния",
  byd: "Китай", geely: "Китай", haval: "Китай", chery: "Китай", "great-wall": "Китай",
  mg: "Китай", changan: "Китай", omoda: "Китай", exeed: "Китай", jaecoo: "Китай",
  zeekr: "Китай", xpeng: "Китай", nio: "Китай", "li-auto": "Китай", lixiang: "Китай",
  voyah: "Китай", tank: "Китай", "lynk-and-co": "Китай", gac: "Китай", baojun: "Китай",
  wuling: "Китай", hongqi: "Китай", baic: "Китай", jac: "Китай", jetour: "Китай", kaiyi: "Китай", lifan: "Китай",
  lada: "Россия", gaz: "Россия", uaz: "Россия", moskvich: "Россия", belgee: "Беларусь",
  "land-rover": "Великобритания", jaguar: "Великобритания", "aston-martin": "Великобритания",
  bentley: "Великобритания", "rolls-royce": "Великобритания", vauxhall: "Великобритания", mclaren: "Великобритания",
  zaz: "Украина", ravon: "Узбекистан",
};

const VDB_BODY_MAP: Record<string, string> = {
  sedan: "SEDAN", saloon: "SEDAN",
  hatchback: "HATCHBACK",
  suv: "SUV", crossover: "SUV", "off-road": "SUV",
  wagon: "WAGON", estate: "WAGON", "station-wagon": "WAGON",
  liftback: "LIFTBACK", fastback: "LIFTBACK",
  coupe: "COUPE",
  convertible: "CABRIO", cabriolet: "CABRIO", roadster: "CABRIO",
  minivan: "MINIVAN", mpv: "MINIVAN",
  pickup: "PICKUP", "pickup-truck": "PICKUP",
  van: "VAN", "cargo-van": "VAN",
};

const METERAPP_ALLOWED_EXTRA_MAKES = new Set([
  "uaz", "gaz", "datsun", "daewoo", "ravon", "scion", "mercury", "pontiac",
  "oldsmobile", "saturn", "plymouth", "hummer", "polestar", "rivian", "lucid",
  "fisker", "zaz", "ram", "gmc", "chrysler", "lincoln", "buick", "cadillac",
  "acura", "infiniti", "lexus", "genesis", "omoda", "jaecoo", "voyah", "zeekr",
  "geely", "byd", "chery", "haval", "changan", "li-auto", "tank", "wuling", "baojun",
]);

const NOISY_METER_MODEL_RX =
  /(-u\d|u9\b|k6\b|speed\b|kampeer|\bauto\b|luxury\b|deluxe\b|comfort\b|noble\b|pure\b|stationcar|\b\d\.\d[li]\b|hdif\b|tdi\b|tfsi\b|phev\b|hev\b|cng\b|lpg\b|4x4\b|4wd\b|awd\b|fwd\b|rwd\b|manual\b|cvt\b|dct\b|dsg\b|commercial\b|crew\s*cab|double\s*cab|single\s*cab|\btruck\b|\bchassis\b|\bbus\b|coaster|tractor)/i;

const HEAVY_MAKES_BLOCKLIST = new Set([
  "daf", "scania", "man", "peterbilt", "kenworth", "freightliner", "mack", "western-star",
  "international", "navistar", "kamaz", "ural", "maz", "belaz", "liebherr", "hino",
]);

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeMakeIdAlias(makeId: string): string {
  if (makeId === "lixiang") return "li-auto";
  if (makeId === "lynk-co") return "lynk-and-co";
  if (makeId === "lada-vaz" || makeId === "avtovaz") return "lada";
  return makeId;
}

function mapVdbBodyTypes(list: string[] | undefined): string[] {
  if (!list || list.length === 0) return [];
  const res = new Set<string>();
  for (const raw of list) {
    const mapped = VDB_BODY_MAP[raw.toLowerCase()];
    if (mapped) res.add(mapped);
  }
  return Array.from(res);
}

async function createManyChunked<T>(
  fn: (chunk: T[]) => Promise<{ count: number }>,
  items: T[],
  chunkSize = 500
): Promise<number> {
  let count = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const res = await fn(items.slice(i, i + chunkSize));
    count += res.count;
  }
  return count;
}

export async function runExpandedVehicleImport(prisma: PrismaClient): Promise<ImportStats> {
  const startTime = Date.now();
  const snapDir = join(process.cwd(), "data", "vehicle-snapshots");
  const vdbPath = join(snapDir, "vehiclesdb-snapshot.json");
  const meterPath = join(snapDir, "meterapp-snapshot.json");

  // 1. Data Sources
  for (const src of VEHICLE_DATA_SOURCES) {
    await prisma.vehicleDataSource.upsert({
      where: { id: src.id },
      create: {
        id: src.id,
        name: src.name,
        version: src.version,
        license: src.license,
        licenseUrl: src.licenseUrl,
        homepage: src.homepage,
        description: src.description,
        lastImportAt: new Date(),
      },
      update: {
        name: src.name,
        version: src.version,
        license: src.license,
        licenseUrl: src.licenseUrl,
        homepage: src.homepage,
        description: src.description,
        lastImportAt: new Date(),
      },
    });
  }

  // 2. Body Types
  await prisma.vehicleBodyType.createMany({
    data: VEHICLE_BODY_TYPES,
    skipDuplicates: true,
  });

  // 3. Gather Layer 1 (zaptut-regional + manufacturer-verified)
  const regionalMakes = [...RAW_VEHICLE_MAKES, ...VERIFIED_REGIONAL_MAKES];
  const regionalModels = [...RAW_VEHICLE_MODELS, ...VERIFIED_REGIONAL_MODELS];
  const regionalGens = [...RAW_VEHICLE_GENERATIONS, ...VERIFIED_REGIONAL_GENERATIONS];
  const regionalEngines = [...RAW_VEHICLE_ENGINES, ...VERIFIED_REGIONAL_ENGINES];

  const makeRecords = new Map<string, {
    id: string;
    name: string;
    nameRu: string | null;
    country: string | null;
    isPopular: boolean;
    popularityScore: number;
    category: string;
    completenessStatus: "FULL" | "STANDARD" | "BASIC" | "PARTIAL";
    primarySourceId: string;
  }>();

  const makeAliases = new Map<string, Set<string>>(); // makeId -> aliases
  const modelRecords = new Map<string, {
    id: string;
    makeId: string;
    name: string;
    nameRu: string | null;
    yearFrom: number | null;
    yearTo: number | null;
    yearSemantics: string | null;
    bodyTypes: string[];
    isPopular: boolean;
    popularityScore: number;
    category: string;
    completenessStatus: "FULL" | "STANDARD" | "BASIC" | "PARTIAL";
    primarySourceId: string;
  }>();
  const modelKeyToId = new Map<string, string>(); // norm(makeId)|norm(modelName) -> id
  const modelAliases = new Map<string, Set<string>>();
  const sourceRecords: Array<{
    sourceId: string;
    entityType: string;
    entityId: string;
    sourceExternalId?: string;
    sourceData: object;
  }> = [];

  function addMakeAlias(makeId: string, alias: string | null | undefined) {
    if (!alias) return;
    const clean = alias.trim().toLowerCase();
    if (!clean) return;
    if (!makeAliases.has(makeId)) makeAliases.set(makeId, new Set());
    makeAliases.get(makeId)!.add(clean);
  }

  function addModelAlias(modelId: string, alias: string | null | undefined) {
    if (!alias) return;
    const clean = alias.trim().toLowerCase();
    if (!clean) return;
    if (!modelAliases.has(modelId)) modelAliases.set(modelId, new Set());
    modelAliases.get(modelId)!.add(clean);
  }

  // Register Layer 1 Makes
  regionalMakes.forEach((mk, idx) => {
    makeRecords.set(mk.id, {
      id: mk.id,
      name: mk.name,
      nameRu: mk.nameRu || INTERNATIONAL_MAKE_RU[mk.id]?.nameRu || null,
      country: mk.country || MAKE_COUNTRY_DEFAULT[mk.id] || null,
      isPopular: Boolean(mk.isPopular),
      popularityScore: mk.isPopular ? idx + 1 : 50 + idx,
      category: mk.category || "PASSENGER",
      completenessStatus: mk.completenessStatus || "STANDARD",
      primarySourceId: mk.sourceId,
    });
    addMakeAlias(mk.id, mk.name);
    addMakeAlias(mk.id, mk.nameRu);
    for (const a of mk.aliases || []) addMakeAlias(mk.id, a);
    sourceRecords.push({
      sourceId: mk.sourceId,
      entityType: "MAKE",
      entityId: mk.id,
      sourceData: { name: mk.name, country: mk.country || null },
    });
  });

  // Register Layer 1 Models
  regionalModels.forEach((mo, idx) => {
    const mkId = normalizeMakeIdAlias(mo.makeId);
    modelRecords.set(mo.id, {
      id: mo.id,
      makeId: mkId,
      name: mo.name,
      nameRu: mo.nameRu || null,
      yearFrom: mo.yearFrom ?? null,
      yearTo: mo.yearTo ?? null,
      yearSemantics: "PRODUCTION_YEAR",
      bodyTypes: mo.category === "SUV" ? ["SUV"] : [],
      isPopular: Boolean(mo.isPopular),
      popularityScore: mo.isPopular ? idx + 1 : 100 + idx,
      category: mo.category || "CAR",
      completenessStatus: mo.completenessStatus || "STANDARD",
      primarySourceId: mo.sourceId,
    });
    modelKeyToId.set(`${normKey(mkId)}|${normKey(mo.name)}`, mo.id);
    if (mo.nameRu) modelKeyToId.set(`${normKey(mkId)}|${normKey(mo.nameRu)}`, mo.id);
    addModelAlias(mo.id, mo.name);
    addModelAlias(mo.id, mo.nameRu);
    for (const a of mo.aliases || []) {
      addModelAlias(mo.id, a);
      modelKeyToId.set(`${normKey(mkId)}|${normKey(a)}`, mo.id);
    }
    sourceRecords.push({
      sourceId: mo.sourceId,
      entityType: "MODEL",
      entityId: mo.id,
      sourceData: { name: mo.name, makeId: mkId, yearSemantics: "PRODUCTION_YEAR" },
    });
  });

  // 4. Layer 2: VehiclesDB (car + van, CC-BY 4.0)
  if (existsSync(vdbPath)) {
    const vdb = JSON.parse(readFileSync(vdbPath, "utf8")) as {
      makes: Array<{
        id: string;
        name: string;
        kinds: string[];
        countries?: string[];
        popularity?: { global_decile?: number; mass_decile?: number; by_country?: { ua?: { decile?: number } } } | null;
      }>;
      models: Array<{
        id: string;
        makeId: string;
        slug: string;
        name: string;
        kind: "car" | "van";
        bodyTypes?: string[];
        regions?: string[];
        countries?: string[];
        yearFrom: number | null;
        yearTo: number | null;
        yearSemantics: string | null;
        popularityDecile: number | null;
        uaDecile: number | null;
        formerIds?: string[];
        sources?: string[];
      }>;
    };

    for (const mk of vdb.makes) {
      const canonicalMakeId = normalizeMakeIdAlias(mk.id);
      if (HEAVY_MAKES_BLOCKLIST.has(canonicalMakeId)) continue;

      const decile = mk.popularity?.mass_decile ?? mk.popularity?.global_decile ?? null;
      const uaDecile = mk.popularity?.by_country?.ua?.decile ?? null;
      const ruMeta = INTERNATIONAL_MAKE_RU[canonicalMakeId];

      const existing = makeRecords.get(canonicalMakeId);
      if (existing) {
        // Enrich popularity score if missing, never downgrade zaptut-regional completeness
        if (decile !== null && existing.popularityScore > 40) {
          existing.popularityScore = decile * 10;
        }
        if (uaDecile !== null && uaDecile <= 3) existing.isPopular = true;
        addMakeAlias(canonicalMakeId, mk.name);
      } else {
        const pop = Boolean(
          ruMeta?.isPopular ||
            (uaDecile !== null && uaDecile <= 2) ||
            (decile !== null && decile <= 2)
        );
        makeRecords.set(canonicalMakeId, {
          id: canonicalMakeId,
          name: mk.name,
          nameRu: ruMeta?.nameRu || null,
          country: ruMeta?.country || MAKE_COUNTRY_DEFAULT[canonicalMakeId] || null,
          isPopular: pop,
          popularityScore: decile !== null ? decile * 10 + 50 : 500,
          category: mk.kinds.includes("car") ? "PASSENGER" : "COMMERCIAL",
          completenessStatus: "BASIC",
          primarySourceId: "vehiclesdb",
        });
        addMakeAlias(canonicalMakeId, mk.name);
        addMakeAlias(canonicalMakeId, ruMeta?.nameRu);
        for (const a of ruMeta?.aliases || []) addMakeAlias(canonicalMakeId, a);
      }

      sourceRecords.push({
        sourceId: "vehiclesdb",
        entityType: "MAKE",
        entityId: canonicalMakeId,
        sourceExternalId: mk.id,
        sourceData: { name: mk.name, kinds: mk.kinds, countriesCount: mk.countries?.length || 0 },
      });
    }

    for (const mo of vdb.models) {
      const canonicalMakeId = normalizeMakeIdAlias(mo.makeId);
      if (!makeRecords.has(canonicalMakeId)) continue;

      const dedupeKey = `${normKey(canonicalMakeId)}|${normKey(mo.name)}`;
      const existingId = modelKeyToId.get(dedupeKey);
      const mappedBodies = mapVdbBodyTypes(mo.bodyTypes);

      if (existingId) {
        // Enrich bodyTypes / yearFrom if regional entry lacked them
        const ex = modelRecords.get(existingId);
        if (ex) {
          if (ex.bodyTypes.length === 0 && mappedBodies.length > 0) ex.bodyTypes = mappedBodies;
          if (!ex.yearFrom && mo.yearFrom) {
            ex.yearFrom = mo.yearFrom;
            ex.yearTo = mo.yearTo;
            ex.yearSemantics = mo.yearSemantics || "REGISTRATION_YEAR";
          }
        }
        sourceRecords.push({
          sourceId: "vehiclesdb",
          entityType: "MODEL",
          entityId: existingId,
          sourceExternalId: mo.id,
          sourceData: { name: mo.name, sources: mo.sources || [], registrationYears: [mo.yearFrom, mo.yearTo] },
        });
        continue;
      }

      const id = `${canonicalMakeId}-${mo.slug}`.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      if (modelRecords.has(id)) continue;

      const decile = mo.popularityDecile ?? 8;
      const isPop = Boolean((mo.uaDecile !== null && mo.uaDecile <= 2) || decile <= 2);
      const category =
        mo.kind === "van"
          ? "LCV"
          : mappedBodies.includes("PICKUP")
          ? "PICKUP"
          : mappedBodies.includes("SUV")
          ? "SUV"
          : "CAR";

      modelRecords.set(id, {
        id,
        makeId: canonicalMakeId,
        name: mo.name,
        nameRu: null,
        yearFrom: mo.yearFrom,
        yearTo: mo.yearTo,
        yearSemantics: mo.yearFrom ? mo.yearSemantics || "REGISTRATION_YEAR" : null,
        bodyTypes: mappedBodies,
        isPopular: isPop,
        popularityScore: (mo.uaDecile ?? decile) * 15 + 100,
        category,
        completenessStatus: mo.yearFrom ? "BASIC" : "PARTIAL",
        primarySourceId: "vehiclesdb",
      });
      modelKeyToId.set(dedupeKey, id);
      addModelAlias(id, mo.name);
      for (const fId of mo.formerIds || []) {
        const lastPart = fId.split("/").pop()?.replace(/-/g, " ");
        if (lastPart) addModelAlias(id, lastPart);
      }

      sourceRecords.push({
        sourceId: "vehiclesdb",
        entityType: "MODEL",
        entityId: id,
        sourceExternalId: mo.id,
        sourceData: {
          name: mo.name,
          kind: mo.kind,
          bodyTypes: mo.bodyTypes || [],
          regions: mo.regions || [],
          sources: mo.sources || [],
          yearSemantics: mo.yearSemantics,
        },
      });
    }
  }

  // 5. Layer 3: MeterApp Vehicle DB (ISC + verified registers)
  if (existsSync(meterPath)) {
    const meter = JSON.parse(readFileSync(meterPath, "utf8")) as {
      makes: Array<{ id: string; name: string }>;
      models: Array<{
        makeId: string;
        makeName: string;
        slug: string;
        name: string;
        category: string;
        yearFrom: number;
        yearTo: number;
        yearSemantics: string;
        sources: string[];
      }>;
    };

    for (const mk of meter.makes) {
      const canonicalMakeId = normalizeMakeIdAlias(mk.id);
      if (HEAVY_MAKES_BLOCKLIST.has(canonicalMakeId)) continue;
      if (!makeRecords.has(canonicalMakeId) && !METERAPP_ALLOWED_EXTRA_MAKES.has(canonicalMakeId)) {
        continue;
      }
      if (!makeRecords.has(canonicalMakeId)) {
        const ruMeta = INTERNATIONAL_MAKE_RU[canonicalMakeId];
        makeRecords.set(canonicalMakeId, {
          id: canonicalMakeId,
          name: mk.name,
          nameRu: ruMeta?.nameRu || null,
          country: ruMeta?.country || MAKE_COUNTRY_DEFAULT[canonicalMakeId] || null,
          isPopular: Boolean(ruMeta?.isPopular),
          popularityScore: ruMeta?.isPopular ? 80 : 400,
          category: canonicalMakeId === "gaz" ? "COMMERCIAL" : "PASSENGER",
          completenessStatus: "BASIC",
          primarySourceId: "meterapp",
        });
        addMakeAlias(canonicalMakeId, mk.name);
        addMakeAlias(canonicalMakeId, ruMeta?.nameRu);
        for (const a of ruMeta?.aliases || []) addMakeAlias(canonicalMakeId, a);
        sourceRecords.push({
          sourceId: "meterapp",
          entityType: "MAKE",
          entityId: canonicalMakeId,
          sourceExternalId: mk.id,
          sourceData: { name: mk.name },
        });
      }
    }

    for (const mo of meter.models) {
      const canonicalMakeId = normalizeMakeIdAlias(mo.makeId);
      if (!makeRecords.has(canonicalMakeId)) continue;

      const dedupeKey = `${normKey(canonicalMakeId)}|${normKey(mo.name)}`;
      const existingId = modelKeyToId.get(dedupeKey);
      if (existingId) {
        const ex = modelRecords.get(existingId);
        // Enrich missing year range from MeterApp without overriding higher-priority PRODUCTION_YEAR
        if (ex && !ex.yearFrom && mo.yearFrom) {
          ex.yearFrom = mo.yearFrom;
          ex.yearTo = mo.yearTo;
          ex.yearSemantics = mo.yearSemantics;
          if (ex.completenessStatus === "PARTIAL") ex.completenessStatus = "BASIC";
        }
        continue;
      }

      if (NOISY_METER_MODEL_RX.test(mo.name) || mo.name.length > 28) continue;
      const nonNoise = mo.sources.filter(
        (s) => s !== "rdw-nl-vehicle-register" && s !== "uk-dft-vehicle-licensing"
      );
      if (nonNoise.length === 0 && mo.sources.length < 2) continue;

      const id = `${canonicalMakeId}-${mo.slug}`.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
      if (modelRecords.has(id)) continue;

      modelRecords.set(id, {
        id,
        makeId: canonicalMakeId,
        name: mo.name,
        nameRu: null,
        yearFrom: mo.yearFrom,
        yearTo: mo.yearTo,
        yearSemantics: mo.yearSemantics,
        bodyTypes: mo.category === "LCV" ? ["VAN"] : [],
        isPopular: false,
        popularityScore: 350,
        category: mo.category || "CAR",
        completenessStatus: "BASIC",
        primarySourceId: "meterapp",
      });
      modelKeyToId.set(dedupeKey, id);
      addModelAlias(id, mo.name);
      sourceRecords.push({
        sourceId: "meterapp",
        entityType: "MODEL",
        entityId: id,
        sourceExternalId: `${mo.makeId}/${mo.slug}`,
        sourceData: {
          name: mo.name,
          yearFrom: mo.yearFrom,
          yearTo: mo.yearTo,
          yearSemantics: mo.yearSemantics,
          meterSources: mo.sources,
        },
      });
    }
  }

  // 6. Persist Makes & Models safely (keep existing IDs intact, update popularity/bodyTypes/yearSemantics cleanly)
  const makeList = [...makeRecords.values()];
  await createManyChunked(
    (data) => prisma.vehicleMake.createMany({ data, skipDuplicates: true }),
    makeList,
    500
  );

  // Sync updated popularity / Russian names for key makes
  const popularMakeIds = makeList.filter((m) => m.isPopular).map((m) => m.id);
  if (popularMakeIds.length > 0) {
    await prisma.vehicleMake.updateMany({
      where: { id: { in: popularMakeIds } },
      data: { isPopular: true },
    });
  }

  const modelList = [...modelRecords.values()];
  await createManyChunked(
    (data) => prisma.vehicleModel.createMany({ data, skipDuplicates: true }),
    modelList,
    500
  );

  // Backfill yearSemantics & popularity metadata for pre-existing Layer 1 entries if null
  await prisma.vehicleMake.updateMany({
    where: { primarySourceId: "zaptut-regional", popularityScore: null },
    data: { popularityScore: 10 },
  });
  await prisma.vehicleModel.updateMany({
    where: { primarySourceId: "zaptut-regional", yearSemantics: null },
    data: { yearSemantics: "PRODUCTION_YEAR", popularityScore: 20 },
  });
  await prisma.vehicleGeneration.updateMany({
    where: { yearSemantics: null },
    data: { yearSemantics: "PRODUCTION_YEAR" },
  });

  // 7. Generations, Years, Engines, Modifications (detailed Layer 1 records)
  await createManyChunked(
    (data) =>
      prisma.vehicleGeneration.createMany({
        data: data.map((g) => ({
          id: g.id,
          modelId: g.modelId,
          name: g.name,
          shortName: g.shortName,
          code: g.code,
          yearFrom: g.yearStart,
          yearTo: g.yearEnd,
          yearSemantics: "PRODUCTION_YEAR",
          isRestyling: Boolean(g.isRestyling),
          defaultBodyType: g.defaultBodyType || "SUV",
          completenessStatus: g.completenessStatus || "STANDARD",
        })),
        skipDuplicates: true,
      }),
    regionalGens,
    250
  );

  const yearRows: Array<{ generationId: string; year: number }> = [];
  for (const g of regionalGens) {
    for (const y of g.years && g.years.length > 0 ? g.years : [g.yearStart]) {
      yearRows.push({ generationId: g.id, year: y });
    }
  }
  await createManyChunked(
    (data) => prisma.vehicleYear.createMany({ data, skipDuplicates: true }),
    yearRows,
    500
  );

  await createManyChunked(
    (data) =>
      prisma.vehicleEngine.createMany({
        data: data.map((e) => ({
          id: e.id,
          generationId: e.generationId,
          name: e.name,
          code: e.code,
          fuelType: e.fuelType || "PETROL",
          displacementCc: e.displacementCc,
          powerHp: e.powerHp,
          powerKw: e.powerKw,
        })),
        skipDuplicates: true,
      }),
    regionalEngines,
    250
  );

  await createManyChunked(
    (data) =>
      prisma.vehicleModification.createMany({
        data: data.map((m) => ({
          id: m.id,
          generationId: m.generationId,
          engineId: m.engineId,
          name: m.name,
          bodyType: m.bodyType,
          transmission: m.transmission,
          drivetrain: m.drivetrain,
          yearFrom: m.yearFrom,
          yearTo: m.yearTo,
          completenessStatus: m.completenessStatus || "STANDARD",
        })),
        skipDuplicates: true,
      }),
    RAW_VEHICLE_MODIFICATIONS,
    250
  );

  // 8. Idempotent Aliases
  const existingAliases = await prisma.vehicleAlias.findMany({
    select: { alias: true, targetType: true, makeId: true, modelId: true },
  });
  const existingAliasKeys = new Set(
    existingAliases.map((a) => `${a.targetType}|${a.makeId || a.modelId || ""}|${a.alias}`)
  );

  const aliasToInsert: Array<{
    alias: string;
    rawText: string;
    targetType: "MAKE" | "MODEL";
    makeId?: string;
    modelId?: string;
  }> = [];

  for (const [makeId, set] of makeAliases.entries()) {
    for (const alias of set) {
      const k = `MAKE|${makeId}|${alias}`;
      if (!existingAliasKeys.has(k)) {
        existingAliasKeys.add(k);
        aliasToInsert.push({ alias, rawText: alias, targetType: "MAKE", makeId });
      }
    }
  }
  for (const [modelId, set] of modelAliases.entries()) {
    for (const alias of set) {
      const k = `MODEL|${modelId}|${alias}`;
      if (!existingAliasKeys.has(k)) {
        existingAliasKeys.add(k);
        aliasToInsert.push({ alias, rawText: alias, targetType: "MODEL", modelId });
      }
    }
  }
  const insertedAliases = await createManyChunked(
    (data) => prisma.vehicleAlias.createMany({ data }),
    aliasToInsert,
    1000
  );

  // 9. Deduplicated Provenance Source Records
  const uniqueSourceMap = new Map<string, typeof sourceRecords[number]>();
  for (const r of sourceRecords) {
    uniqueSourceMap.set(`${r.sourceId}|${r.entityType}|${r.entityId}`, r);
  }
  const insertedSources = await createManyChunked(
    (data) => prisma.vehicleSourceRecord.createMany({ data, skipDuplicates: true }),
    [...uniqueSourceMap.values()],
    500
  );

  // Update VehicleDataSource counts
  for (const src of VEHICLE_DATA_SOURCES) {
    const count = await prisma.vehicleSourceRecord.count({ where: { sourceId: src.id } });
    await prisma.vehicleDataSource.update({
      where: { id: src.id },
      data: { recordsCount: count },
    });
  }

  return {
    dataSources: VEHICLE_DATA_SOURCES.length,
    makes: makeList.length,
    models: modelList.length,
    generations: regionalGens.length,
    years: yearRows.length,
    engines: regionalEngines.length,
    modifications: RAW_VEHICLE_MODIFICATIONS.length,
    aliases: insertedAliases,
    sourceRecords: insertedSources,
    linkedCustomerVehicles: 0,
    duplicatesResolved: 0,
    durationMs: Date.now() - startTime,
  };
}
