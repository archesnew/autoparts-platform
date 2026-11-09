import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { VEHICLE_DATA_SOURCES } from "../src/lib/server/vehicle-database/sources.ts";
import {
  VEHICLE_BODY_TYPES,
  RAW_VEHICLE_MAKES,
  RAW_VEHICLE_MODELS,
  RAW_VEHICLE_GENERATIONS,
  RAW_VEHICLE_ENGINES,
  RAW_VEHICLE_MODIFICATIONS,
} from "../src/lib/server/vehicle-database/registry-data.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================================");
  console.log(" ZAPTUT.PRO — GLOBAL VEHICLE DATABASE IMPORTER");
  console.log("==================================================================\n");

  const startTime = Date.now();
  let duplicatesResolved = 0;
  let sourceRecordsCount = 0;
  let aliasesCount = 0;

  // 1. Data Sources
  console.log("1. Importing Vehicle Data Sources...");
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
    console.log(`   [SRC] ${src.id} (${src.license}) - ${src.name}`);
  }

  // 2. Body Types
  console.log("\n2. Importing Vehicle Body Types...");
  for (const bt of VEHICLE_BODY_TYPES) {
    await prisma.vehicleBodyType.upsert({
      where: { code: bt.code },
      create: {
        code: bt.code,
        name: bt.name,
        nameRu: bt.nameRu,
      },
      update: {
        name: bt.name,
        nameRu: bt.nameRu,
      },
    });
  }
  console.log(`   [OK] ${VEHICLE_BODY_TYPES.length} body types registered.`);

  // 3. Vehicle Makes
  console.log(`\n3. Importing ${RAW_VEHICLE_MAKES.length} Vehicle Makes...`);
  for (const mk of RAW_VEHICLE_MAKES) {
    await prisma.vehicleMake.upsert({
      where: { id: mk.id },
      create: {
        id: mk.id,
        name: mk.name,
        nameRu: mk.nameRu,
        country: mk.country,
        isPopular: Boolean(mk.isPopular),
        category: mk.category || "PASSENGER",
        completenessStatus: mk.completenessStatus || "STANDARD",
        primarySourceId: mk.sourceId,
      },
      update: {
        name: mk.name,
        nameRu: mk.nameRu,
        country: mk.country,
        isPopular: Boolean(mk.isPopular),
        category: mk.category || "PASSENGER",
        completenessStatus: mk.completenessStatus || "STANDARD",
        primarySourceId: mk.sourceId,
      },
    });

    await prisma.vehicleSourceRecord.upsert({
      where: {
        sourceId_entityType_entityId: {
          sourceId: mk.sourceId,
          entityType: "MAKE",
          entityId: mk.id,
        },
      },
      create: {
        sourceId: mk.sourceId,
        entityType: "MAKE",
        entityId: mk.id,
        sourceData: { name: mk.name, country: mk.country },
      },
      update: {
        sourceData: { name: mk.name, country: mk.country },
        importedAt: new Date(),
      },
    });
    sourceRecordsCount++;

    // Aliases
    const allAliases = new Set();
    allAliases.add(mk.name.toLowerCase());
    if (mk.nameRu) allAliases.add(mk.nameRu.toLowerCase());
    if (mk.aliases) {
      for (const a of mk.aliases) allAliases.add(a.toLowerCase().trim());
    }

    for (const alias of allAliases) {
      const existing = await prisma.vehicleAlias.findFirst({
        where: { alias, targetType: "MAKE", makeId: mk.id },
      });
      if (!existing) {
        await prisma.vehicleAlias.create({
          data: {
            alias,
            rawText: alias,
            targetType: "MAKE",
            makeId: mk.id,
          },
        });
        aliasesCount++;
      } else {
        duplicatesResolved++;
      }
    }
  }
  console.log(`   [OK] ${RAW_VEHICLE_MAKES.length} makes synced.`);

  // 4. Vehicle Models
  console.log(`\n4. Importing ${RAW_VEHICLE_MODELS.length} Vehicle Models...`);
  for (const mo of RAW_VEHICLE_MODELS) {
    await prisma.vehicleModel.upsert({
      where: { id: mo.id },
      create: {
        id: mo.id,
        makeId: mo.makeId,
        name: mo.name,
        nameRu: mo.nameRu,
        yearFrom: mo.yearFrom,
        yearTo: mo.yearTo,
        isPopular: Boolean(mo.isPopular),
        category: mo.category || "CAR",
        completenessStatus: mo.completenessStatus || "STANDARD",
        primarySourceId: mo.sourceId,
      },
      update: {
        makeId: mo.makeId,
        name: mo.name,
        nameRu: mo.nameRu,
        yearFrom: mo.yearFrom,
        yearTo: mo.yearTo,
        isPopular: Boolean(mo.isPopular),
        category: mo.category || "CAR",
        completenessStatus: mo.completenessStatus || "STANDARD",
        primarySourceId: mo.sourceId,
      },
    });

    await prisma.vehicleSourceRecord.upsert({
      where: {
        sourceId_entityType_entityId: {
          sourceId: mo.sourceId,
          entityType: "MODEL",
          entityId: mo.id,
        },
      },
      create: {
        sourceId: mo.sourceId,
        entityType: "MODEL",
        entityId: mo.id,
        sourceData: { name: mo.name, makeId: mo.makeId },
      },
      update: {
        sourceData: { name: mo.name, makeId: mo.makeId },
        importedAt: new Date(),
      },
    });
    sourceRecordsCount++;

    // Aliases
    const modelAliases = new Set();
    modelAliases.add(mo.name.toLowerCase());
    if (mo.nameRu) modelAliases.add(mo.nameRu.toLowerCase());
    if (mo.aliases) {
      for (const a of mo.aliases) modelAliases.add(a.toLowerCase().trim());
    }

    for (const alias of modelAliases) {
      const existing = await prisma.vehicleAlias.findFirst({
        where: { alias, targetType: "MODEL", modelId: mo.id },
      });
      if (!existing) {
        await prisma.vehicleAlias.create({
          data: {
            alias,
            rawText: alias,
            targetType: "MODEL",
            modelId: mo.id,
          },
        });
        aliasesCount++;
      } else {
        duplicatesResolved++;
      }
    }
  }
  console.log(`   [OK] ${RAW_VEHICLE_MODELS.length} models synced.`);

  // 5. Vehicle Generations & Years
  console.log(`\n5. Importing ${RAW_VEHICLE_GENERATIONS.length} Vehicle Generations...`);
  let yearsCount = 0;
  for (const gen of RAW_VEHICLE_GENERATIONS) {
    await prisma.vehicleGeneration.upsert({
      where: { id: gen.id },
      create: {
        id: gen.id,
        modelId: gen.modelId,
        name: gen.name,
        shortName: gen.shortName,
        code: gen.code,
        yearFrom: gen.yearStart,
        yearTo: gen.yearEnd,
        isRestyling: Boolean(gen.isRestyling),
        defaultBodyType: gen.defaultBodyType || "SUV",
        completenessStatus: gen.completenessStatus || "STANDARD",
      },
      update: {
        modelId: gen.modelId,
        name: gen.name,
        shortName: gen.shortName,
        code: gen.code,
        yearFrom: gen.yearStart,
        yearTo: gen.yearEnd,
        isRestyling: Boolean(gen.isRestyling),
        defaultBodyType: gen.defaultBodyType || "SUV",
        completenessStatus: gen.completenessStatus || "STANDARD",
      },
    });

    await prisma.vehicleSourceRecord.upsert({
      where: {
        sourceId_entityType_entityId: {
          sourceId: gen.sourceId,
          entityType: "GENERATION",
          entityId: gen.id,
        },
      },
      create: {
        sourceId: gen.sourceId,
        entityType: "GENERATION",
        entityId: gen.id,
        sourceData: { name: gen.name, code: gen.code },
      },
      update: {
        sourceData: { name: gen.name, code: gen.code },
        importedAt: new Date(),
      },
    });
    sourceRecordsCount++;

    const years = gen.years && gen.years.length > 0 ? gen.years : [gen.yearStart];
    for (const y of years) {
      await prisma.vehicleYear.upsert({
        where: {
          generationId_year: {
            generationId: gen.id,
            year: y,
          },
        },
        create: {
          generationId: gen.id,
          year: y,
        },
        update: {},
      });
      yearsCount++;
    }
  }
  console.log(`   [OK] ${RAW_VEHICLE_GENERATIONS.length} generations & ${yearsCount} model years synced.`);

  // 6. Vehicle Engines
  console.log(`\n6. Importing ${RAW_VEHICLE_ENGINES.length} Vehicle Engines...`);
  for (const eng of RAW_VEHICLE_ENGINES) {
    await prisma.vehicleEngine.upsert({
      where: { id: eng.id },
      create: {
        id: eng.id,
        generationId: eng.generationId,
        name: eng.name,
        code: eng.code,
        fuelType: eng.fuelType || "PETROL",
        displacementCc: eng.displacementCc,
        powerHp: eng.powerHp,
        powerKw: eng.powerKw,
      },
      update: {
        generationId: eng.generationId,
        name: eng.name,
        code: eng.code,
        fuelType: eng.fuelType || "PETROL",
        displacementCc: eng.displacementCc,
        powerHp: eng.powerHp,
        powerKw: eng.powerKw,
      },
    });

    await prisma.vehicleSourceRecord.upsert({
      where: {
        sourceId_entityType_entityId: {
          sourceId: eng.sourceId,
          entityType: "ENGINE",
          entityId: eng.id,
        },
      },
      create: {
        sourceId: eng.sourceId,
        entityType: "ENGINE",
        entityId: eng.id,
        sourceData: { name: eng.name, code: eng.code },
      },
      update: {
        sourceData: { name: eng.name, code: eng.code },
        importedAt: new Date(),
      },
    });
    sourceRecordsCount++;
  }
  console.log(`   [OK] ${RAW_VEHICLE_ENGINES.length} engines synced.`);

  // 7. Vehicle Modifications
  console.log(`\n7. Importing ${RAW_VEHICLE_MODIFICATIONS.length} Vehicle Modifications...`);
  for (const mod of RAW_VEHICLE_MODIFICATIONS) {
    await prisma.vehicleModification.upsert({
      where: { id: mod.id },
      create: {
        id: mod.id,
        generationId: mod.generationId,
        engineId: mod.engineId,
        name: mod.name,
        bodyType: mod.bodyType,
        transmission: mod.transmission,
        drivetrain: mod.drivetrain,
        yearFrom: mod.yearFrom,
        yearTo: mod.yearTo,
        completenessStatus: mod.completenessStatus || "STANDARD",
      },
      update: {
        generationId: mod.generationId,
        engineId: mod.engineId,
        name: mod.name,
        bodyType: mod.bodyType,
        transmission: mod.transmission,
        drivetrain: mod.drivetrain,
        yearFrom: mod.yearFrom,
        yearTo: mod.yearTo,
        completenessStatus: mod.completenessStatus || "STANDARD",
      },
    });

    await prisma.vehicleSourceRecord.upsert({
      where: {
        sourceId_entityType_entityId: {
          sourceId: mod.sourceId,
          entityType: "MODIFICATION",
          entityId: mod.id,
        },
      },
      create: {
        sourceId: mod.sourceId,
        entityType: "MODIFICATION",
        entityId: mod.id,
        sourceData: { name: mod.name, transmission: mod.transmission },
      },
      update: {
        sourceData: { name: mod.name, transmission: mod.transmission },
        importedAt: new Date(),
      },
    });
    sourceRecordsCount++;
  }
  console.log(`   [OK] ${RAW_VEHICLE_MODIFICATIONS.length} modifications synced.`);

  // 8. Reconcile existing CustomerVehicle records non-destructively
  console.log("\n8. Reconciling existing CustomerVehicle records with database taxonomy...");
  let linkedCustomerVehicles = 0;
  const customerVehicles = await prisma.customerVehicle.findMany();

  for (const cv of customerVehicles) {
    const makeClean = cv.make.trim().toLowerCase();
    const matchedMake = await prisma.vehicleMake.findFirst({
      where: {
        OR: [
          { name: { equals: cv.make.trim(), mode: "insensitive" } },
          { nameRu: { equals: cv.make.trim(), mode: "insensitive" } },
          { id: makeClean },
          { aliases: { some: { alias: makeClean } } },
        ],
      },
    });

    if (!matchedMake) continue;

    const modelClean = cv.model.trim().toLowerCase();
    const matchedModel = await prisma.vehicleModel.findFirst({
      where: {
        makeId: matchedMake.id,
        OR: [
          { name: { equals: cv.model.trim(), mode: "insensitive" } },
          { nameRu: { equals: cv.model.trim(), mode: "insensitive" } },
          { aliases: { some: { alias: modelClean } } },
        ],
      },
    });

    let matchedGenId = null;
    if (matchedModel && cv.generation) {
      const genClean = cv.generation.trim().toLowerCase();
      const matchedGen = await prisma.vehicleGeneration.findFirst({
        where: {
          modelId: matchedModel.id,
          OR: [
            { name: { contains: genClean, mode: "insensitive" } },
            { shortName: { contains: genClean, mode: "insensitive" } },
            { code: { equals: genClean, mode: "insensitive" } },
          ],
        },
      });
      if (matchedGen) matchedGenId = matchedGen.id;
    }

    await prisma.customerVehicle.update({
      where: { id: cv.id },
      data: {
        vehicleMakeId: matchedMake.id,
        vehicleModelId: matchedModel?.id || null,
        vehicleGenerationId: matchedGenId,
      },
    });
    linkedCustomerVehicles++;
    console.log(`   [LINKED] CustomerVehicle ${cv.id} (${cv.make} ${cv.model}) -> ${matchedMake.id}/${matchedModel?.id || '?'}`);
  }

  // 9. Update source recordsCount
  for (const src of VEHICLE_DATA_SOURCES) {
    const count = await prisma.vehicleSourceRecord.count({
      where: { sourceId: src.id },
    });
    await prisma.vehicleDataSource.update({
      where: { id: src.id },
      data: { recordsCount: count },
    });
  }

  const durationMs = Date.now() - startTime;
  console.log("\n==================================================================");
  console.log(" IMPORT SUMMARY:");
  console.log(` - Data Sources: ${VEHICLE_DATA_SOURCES.length}`);
  console.log(` - Vehicle Makes: ${RAW_VEHICLE_MAKES.length}`);
  console.log(` - Vehicle Models: ${RAW_VEHICLE_MODELS.length}`);
  console.log(` - Vehicle Generations: ${RAW_VEHICLE_GENERATIONS.length}`);
  console.log(` - Model Years Linked: ${yearsCount}`);
  console.log(` - Vehicle Engines: ${RAW_VEHICLE_ENGINES.length}`);
  console.log(` - Vehicle Modifications: ${RAW_VEHICLE_MODIFICATIONS.length}`);
  console.log(` - Search Aliases Indexed: ${aliasesCount}`);
  console.log(` - Source Provenance Records: ${sourceRecordsCount}`);
  console.log(` - Reconciled Customer Vehicles: ${linkedCustomerVehicles}`);
  console.log(` - Duplicates Resolved: ${duplicatesResolved}`);
  console.log(` - Elapsed Time: ${(durationMs / 1000).toFixed(2)}s`);
  console.log("==================================================================\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("IMPORT ERROR:", e);
  await prisma.$disconnect();
  process.exit(1);
});
