import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { VEHICLE_DATA_SOURCES } from "../src/lib/server/vehicle-database/sources.ts";
import { VEHICLE_BODY_TYPES, RAW_VEHICLE_MAKES } from "../src/lib/server/vehicle-database/makes-data.ts";
import { RAW_VEHICLE_MODELS } from "../src/lib/server/vehicle-database/models-data.ts";
import { RAW_VEHICLE_GENERATIONS } from "../src/lib/server/vehicle-database/generations-data.ts";
import { RAW_VEHICLE_ENGINES } from "../src/lib/server/vehicle-database/engines-data.ts";
import { RAW_VEHICLE_MODIFICATIONS } from "../src/lib/server/vehicle-database/modifications-data.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("=== FAST BATCH VEHICLE DATABASE SEED TO NEON ===");
  const t0 = Date.now();

  // 1. Sources
  await prisma.vehicleDataSource.createMany({
    data: VEHICLE_DATA_SOURCES.map((src) => ({
      id: src.id,
      name: src.name,
      version: src.version,
      license: src.license,
      licenseUrl: src.licenseUrl,
      homepage: src.homepage,
      description: src.description,
      lastImportAt: new Date(),
    })),
    skipDuplicates: true,
  });
  console.log("✓ Sources synced");

  // 2. Body Types
  await prisma.vehicleBodyType.createMany({
    data: VEHICLE_BODY_TYPES.map((bt) => ({
      code: bt.code,
      name: bt.name,
      nameRu: bt.nameRu,
    })),
    skipDuplicates: true,
  });
  console.log("✓ Body types synced:", VEHICLE_BODY_TYPES.length);

  // 3. Makes
  await prisma.vehicleMake.createMany({
    data: RAW_VEHICLE_MAKES.map((mk) => ({
      id: mk.id,
      name: mk.name,
      nameRu: mk.nameRu,
      country: mk.country,
      isPopular: Boolean(mk.isPopular),
      category: mk.category || "PASSENGER",
      completenessStatus: mk.completenessStatus || "STANDARD",
      primarySourceId: mk.sourceId,
    })),
    skipDuplicates: true,
  });
  console.log("✓ Makes synced:", RAW_VEHICLE_MAKES.length);

  // 4. Models
  await prisma.vehicleModel.createMany({
    data: RAW_VEHICLE_MODELS.map((mo) => ({
      id: mo.id,
      makeId: mo.makeId,
      name: mo.name,
      nameRu: mo.nameRu,
      yearFrom: mo.yearFrom ?? null,
      yearTo: mo.yearTo ?? null,
      isPopular: Boolean(mo.isPopular),
      category: mo.category || "CAR",
      completenessStatus: mo.completenessStatus || "STANDARD",
      primarySourceId: mo.sourceId,
    })),
    skipDuplicates: true,
  });
  console.log("✓ Models synced:", RAW_VEHICLE_MODELS.length);

  // 5. Generations & Years
  await prisma.vehicleGeneration.createMany({
    data: RAW_VEHICLE_GENERATIONS.map((gen) => ({
      id: gen.id,
      modelId: gen.modelId,
      name: gen.name,
      shortName: gen.shortName ?? null,
      code: gen.code ?? null,
      yearFrom: gen.yearStart,
      yearTo: gen.yearEnd ?? null,
      isRestyling: Boolean(gen.isRestyling),
      defaultBodyType: gen.defaultBodyType ?? null,
      completenessStatus: gen.completenessStatus || "STANDARD",
    })),
    skipDuplicates: true,
  });
  console.log("✓ Generations synced:", RAW_VEHICLE_GENERATIONS.length);

  const yearRows = [];
  for (const gen of RAW_VEHICLE_GENERATIONS) {
    const start = gen.yearStart;
    const end = gen.yearEnd ?? 2026;
    for (let y = start; y <= end; y++) {
      yearRows.push({ generationId: gen.id, year: y });
    }
  }
  await prisma.vehicleYear.createMany({ data: yearRows, skipDuplicates: true });
  console.log("✓ Years synced:", yearRows.length);

  // 6. Engines
  await prisma.vehicleEngine.createMany({
    data: RAW_VEHICLE_ENGINES.map((eng) => ({
      id: eng.id,
      generationId: eng.generationId,
      name: eng.name,
      code: eng.code ?? null,
      fuelType: eng.fuelType ?? "PETROL",
      displacementCc: eng.displacementCc ?? null,
      powerHp: eng.powerHp ?? null,
      powerKw: eng.powerKw ?? null,
    })),
    skipDuplicates: true,
  });
  console.log("✓ Engines synced:", RAW_VEHICLE_ENGINES.length);

  // 7. Modifications
  await prisma.vehicleModification.createMany({
    data: RAW_VEHICLE_MODIFICATIONS.map((mod) => ({
      id: mod.id,
      generationId: mod.generationId,
      engineId: mod.engineId ?? null,
      name: mod.name,
      bodyType: mod.bodyType ?? "SEDAN",
      transmission: mod.transmission ?? null,
      drivetrain: mod.drivetrain ?? null,
      yearFrom: mod.yearFrom ?? null,
      yearTo: mod.yearTo ?? null,
      completenessStatus: mod.completenessStatus || "STANDARD",
    })),
    skipDuplicates: true,
  });
  console.log("✓ Modifications synced:", RAW_VEHICLE_MODIFICATIONS.length);

  // 8. Aliases (make & model)
  const existingAliases = await prisma.vehicleAlias.findMany({
    select: { targetType: true, makeId: true, modelId: true, alias: true },
  });
  const aliasKeys = new Set(existingAliases.map((a) => `${a.targetType}:${a.makeId || a.modelId}:${a.alias}`));
  const aliasRows = [];

  for (const mk of RAW_VEHICLE_MAKES) {
    for (const a of mk.aliases || []) {
      const normalized = a.trim().toLowerCase();
      const key = `MAKE:${mk.id}:${normalized}`;
      if (!aliasKeys.has(key)) {
        aliasKeys.add(key);
        aliasRows.push({
          targetType: "MAKE",
          makeId: mk.id,
          alias: normalized,
          rawText: a.trim(),
        });
      }
    }
  }

  for (const mo of RAW_VEHICLE_MODELS) {
    for (const a of mo.aliases || []) {
      const normalized = a.trim().toLowerCase();
      const key = `MODEL:${mo.id}:${normalized}`;
      if (!aliasKeys.has(key)) {
        aliasKeys.add(key);
        aliasRows.push({
          targetType: "MODEL",
          modelId: mo.id,
          alias: normalized,
          rawText: a.trim(),
        });
      }
    }
  }

  if (aliasRows.length > 0) {
    await prisma.vehicleAlias.createMany({ data: aliasRows, skipDuplicates: true });
  }
  console.log("✓ New Aliases synced:", aliasRows.length);

  console.log(`=== DONE in ${((Date.now() - t0) / 1000).toFixed(2)}s ===`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
