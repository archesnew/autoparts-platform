/**
 * ZAPTUT Vehicle Database Expansion — VehiclesDB CC-BY 4.0
 *
 * Attribution (required by CC-BY 4.0):
 *   Vehicle data by VehiclesDB (vehiclesdb.com), CC BY 4.0.
 *   Built from official public registers — see vehiclesdb.com/attribution.
 *
 * Sources used: catalog/car/makes.json, catalog/car/models.json,
 *   catalog/van/makes.json, catalog/van/models.json
 *   from https://github.com/vehiclesdb/vehiclesdb (version 2026.11.4)
 *
 * Run: node scripts/seed-vehiclesdb-expanded.mjs
 */

import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Load data — prefer local scratch cache, fallback to fetch
// ---------------------------------------------------------------------------
const SCRATCH =
  "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6\\scratch\\vdb_audit";

function loadJson(scratchFile, remoteUrl) {
  try {
    return JSON.parse(readFileSync(join(SCRATCH, scratchFile), "utf8"));
  } catch {
    throw new Error(`Missing local file ${scratchFile}. Run audit first.`);
  }
}

const carMakes = loadJson("vdb-car-makes.json");
const carModels = loadJson("vdb-car-models.json");
const vanMakes = loadJson("vdb-van-makes.json");
const vanModels = loadJson("vdb-van-models.json");

// ---------------------------------------------------------------------------
// Country of origin lookup (ISO code or VehiclesDB make id → display name)
// ---------------------------------------------------------------------------
const MAKE_COUNTRY = {
  toyota: "Япония", honda: "Япония", nissan: "Япония", mazda: "Япония",
  mitsubishi: "Япония", subaru: "Япония", suzuki: "Япония", lexus: "Япония",
  daihatsu: "Япония", isuzu: "Япония", infiniti: "Япония", acura: "Япония",
  bmw: "Германия", volkswagen: "Германия", mercedes_benz: "Германия",
  "mercedes-benz": "Германия", audi: "Германия", opel: "Германия",
  porsche: "Германия", mini: "Германия",
  ford: "США", chevrolet: "США", gmc: "США", dodge: "США", jeep: "США",
  cadillac: "США", lincoln: "США", tesla: "США", ram: "США", chrysler: "США",
  hyundai: "Южная Корея", kia: "Южная Корея", genesis: "Южная Корея",
  peugeot: "Франция", renault: "Франция", citroen: "Франция",
  "ds-automobiles": "Франция", ds: "Франция", alpine: "Франция",
  fiat: "Италия", alfa: "Италия", "alfa-romeo": "Италия", ferrari: "Италия",
  lamborghini: "Италия", maserati: "Италия", lancia: "Италия", abarth: "Италия",
  volvo: "Швеция", saab: "Швеция",
  skoda: "Чехия", seat: "Испания", cupra: "Испания",
  dacia: "Румыния",
  byd: "Китай", geely: "Китай", haval: "Китай", chery: "Китай",
  "great-wall": "Китай", mg: "Китай", changan: "Китай", omoda: "Китай",
  exeed: "Китай", jaecoo: "Китай", zeekr: "Китай", xpeng: "Китай",
  nio: "Китай", "li-auto": "Китай", voyah: "Китай", tank: "Китай",
  "lynk-co": "Китай", "lynk": "Китай", gac: "Китай", baojun: "Китай",
  wuling: "Китай", "hong-qi": "Китай", baic: "Китай", "jac": "Китай",
  lada: "Россия", gaz: "Россия", uaz: "Россия", moskvich: "Россия",
  belgee: "Беларусь",
  land_rover: "Великобритания", "land-rover": "Великобритания",
  jaguar: "Великобритания", aston_martin: "Великобритания",
  "aston-martin": "Великобритания", bentley: "Великобритания",
  rolls_royce: "Великобритания", "rolls-royce": "Великобритания",
  vauxhall: "Великобритания",
  bugatti: "Франция",
  mclaren: "Великобритания",
};

// ---------------------------------------------------------------------------
// Body type mapping  VehiclesDB → ZAPTUT body code
// ---------------------------------------------------------------------------
const BODY_MAP = {
  sedan: "SEDAN", saloon: "SEDAN",
  hatchback: "HATCHBACK",
  "suv": "SUV", crossover: "SUV", "off-road": "SUV",
  wagon: "WAGON", estate: "WAGON", "station-wagon": "WAGON",
  liftback: "LIFTBACK", fastback: "LIFTBACK",
  coupe: "COUPE",
  convertible: "CABRIO", cabriolet: "CABRIO", roadster: "CABRIO",
  minivan: "MINIVAN", mpv: "MINIVAN",
  pickup: "PICKUP", "pickup-truck": "PICKUP",
  van: "VAN", "cargo-van": "VAN",
};

function mapBodyType(bodyTypes) {
  if (!bodyTypes || bodyTypes.length === 0) return null;
  for (const bt of bodyTypes) {
    const code = BODY_MAP[bt];
    if (code) return code;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Category mapping for model
// ---------------------------------------------------------------------------
function mapCategory(bodyTypes, kind) {
  if (kind === "van") return "LCV";
  if (!bodyTypes || bodyTypes.length === 0) return "CAR";
  if (bodyTypes.some(b => ["suv", "crossover", "off-road"].includes(b))) return "SUV";
  if (bodyTypes.some(b => ["pickup", "pickup-truck"].includes(b))) return "PICKUP";
  if (bodyTypes.some(b => ["van", "cargo-van", "minivan", "mpv"].includes(b))) return "LCV";
  return "CAR";
}

// ---------------------------------------------------------------------------
// Popularity
// ---------------------------------------------------------------------------
function isPopular(popularity) {
  if (!popularity) return false;
  const gd = popularity.global_decile;
  const md = popularity.mass_decile;
  return gd <= 4 || md <= 2;
}

// ---------------------------------------------------------------------------
// Slug → ZAPTUT id helper (replace "/" with "-", strip special chars)
// ---------------------------------------------------------------------------
function modelId(vdbId) {
  return vdbId.replace("/", "-").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
}

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------
const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  const t0 = Date.now();
  console.log("=== ZAPTUT Vehicle DB Expansion — VehiclesDB CC-BY 4.0 ===\n");

  // -------------------------------------------------------------------------
  // 1. Upsert VehicleDataSource record for vehiclesdb
  // -------------------------------------------------------------------------
  await prisma.vehicleDataSource.upsert({
    where: { id: "vehiclesdb" },
    create: {
      id: "vehiclesdb",
      name: "VehiclesDB International Automotive Catalog",
      version: "2026.11.4",
      license: "CC-BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      homepage: "https://vehiclesdb.com",
      description:
        'Vehicle data by VehiclesDB (vehiclesdb.com), CC BY 4.0. ' +
        'Built from official public registers (UK DfT/DVLA OGL v3, NL RDW public domain, ' +
        'DE KBA DL-DE/BY-2.0, ES DGT, FI Traficom CC-BY 4.0, etc.). ' +
        'See https://vehiclesdb.com/attribution for all upstream notices.',
    },
    update: { version: "2026.11.4", lastImportAt: new Date() },
  });

  // -------------------------------------------------------------------------
  // 2. Build combined make list (car + van, deduplicated by id)
  // -------------------------------------------------------------------------
  const allVdbMakes = new Map();
  for (const m of carMakes) allVdbMakes.set(m.id, { ...m, kind: "car" });
  for (const m of vanMakes) {
    if (!allVdbMakes.has(m.id)) allVdbMakes.set(m.id, { ...m, kind: "van" });
  }

  // Batch upsert makes — skipDuplicates keeps existing ZAPTUT regional data intact
  const makeBatch = [...allVdbMakes.values()].map((m) => ({
    id: m.id,
    name: m.name,
    nameRu: null, // existing zaptut-regional records keep their nameRu
    country: MAKE_COUNTRY[m.id] || null,
    isPopular: false,
    category: m.kind === "van" ? "COMMERCIAL" : "PASSENGER",
    completenessStatus: "BASIC",
    primarySourceId: "vehiclesdb",
  }));

  const makesResult = await prisma.vehicleMake.createMany({
    data: makeBatch,
    skipDuplicates: true,
  });
  console.log(`Makes: added ${makesResult.count} new (${makeBatch.length} total from VehiclesDB, skipping existing)`);

  // -------------------------------------------------------------------------
  // 3. Build combined model list (car + van, deduplicated)
  // -------------------------------------------------------------------------
  const allVdbModels = [];
  const seenModelIds = new Set();
  for (const m of carModels) {
    const id = modelId(m.id);
    if (!seenModelIds.has(id)) { seenModelIds.add(id); allVdbModels.push({ ...m, _kind: "car" }); }
  }
  for (const m of vanModels) {
    const id = modelId(m.id);
    if (!seenModelIds.has(id)) { seenModelIds.add(id); allVdbModels.push({ ...m, _kind: "van" }); }
  }

  // Filter to only models whose make exists in DB (avoid FK violation)
  const existingMakeIds = new Set(
    (await prisma.vehicleMake.findMany({ select: { id: true } })).map((r) => r.id)
  );

  const modelBatch = allVdbModels
    .filter((m) => existingMakeIds.has(m.make_id))
    .map((m) => ({
      id: modelId(m.id),
      makeId: m.make_id,
      name: m.name,
      nameRu: null,
      yearFrom: m.registration_years?.first ?? null,
      yearTo: m.registration_years?.last ?? null,
      isPopular: isPopular(m.popularity),
      category: mapCategory(m.body_types, m._kind),
      completenessStatus: "BASIC",
      primarySourceId: "vehiclesdb",
    }));

  // Batch insert in chunks of 500
  let modelsAdded = 0;
  const CHUNK = 500;
  for (let i = 0; i < modelBatch.length; i += CHUNK) {
    const slice = modelBatch.slice(i, i + CHUNK);
    const r = await prisma.vehicleModel.createMany({ data: slice, skipDuplicates: true });
    modelsAdded += r.count;
    process.stdout.write(`\rModels: inserted ${modelsAdded}/${modelBatch.length}...`);
  }
  console.log(`\nModels: added ${modelsAdded} new (${modelBatch.length} eligible from VehiclesDB)`);

  // -------------------------------------------------------------------------
  // 4. Update isPopular flag for well-known makes from VehiclesDB
  // -------------------------------------------------------------------------
  const popularMakeIds = [...allVdbMakes.values()]
    .filter((m) => {
      const p = m.popularity;
      return p && (p.global_decile <= 4 || p.mass_decile <= 3);
    })
    .map((m) => m.id);

  if (popularMakeIds.length > 0) {
    await prisma.vehicleMake.updateMany({
      where: { id: { in: popularMakeIds } },
      data: { isPopular: true },
    });
    console.log(`Marked ${popularMakeIds.length} makes as popular`);
  }

  // -------------------------------------------------------------------------
  // 5. Verify final counts
  // -------------------------------------------------------------------------
  const [makesTotal, modelsTotal] = await Promise.all([
    prisma.vehicleMake.count(),
    prisma.vehicleModel.count(),
  ]);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ Done in ${elapsed}s`);
  console.log(`  Total makes in DB:  ${makesTotal}`);
  console.log(`  Total models in DB: ${modelsTotal}`);
  console.log(`\nAttribution notice (CC-BY 4.0 required):`);
  console.log(`  Vehicle data by VehiclesDB — vehiclesdb.com`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
