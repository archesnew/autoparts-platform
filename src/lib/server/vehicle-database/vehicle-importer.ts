import "server-only";

import { prisma } from "@/lib/server/db";
import { VEHICLE_DATA_SOURCES } from "./sources";
import {
  VEHICLE_BODY_TYPES,
  RAW_VEHICLE_MAKES,
  RAW_VEHICLE_MODELS,
  RAW_VEHICLE_GENERATIONS,
  RAW_VEHICLE_ENGINES,
  RAW_VEHICLE_MODIFICATIONS,
} from "./registry-data";
import type { ImportStats } from "./types";

export class VehicleImporterService {
  /**
   * Run idempotent import of the entire vehicle dataset into PostgreSQL.
   */
  async importAll(): Promise<ImportStats> {
    const startTime = Date.now();
    let duplicatesResolved = 0;
    let sourceRecordsCount = 0;
    let aliasesCount = 0;

    console.log("--> Starting ZAPTUT Global Vehicle Database Import...");

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

    // 3. Vehicle Makes
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

      // Track provenance
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

      // Make Aliases
      const allAliases = new Set<string>();
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

    // 4. Vehicle Models
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

      // Track provenance
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

      // Model Aliases
      const modelAliases = new Set<string>();
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

    // 5. Vehicle Generations & Years
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

      // Track provenance
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

      // Years
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

    // 6. Vehicle Engines
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

      // Track provenance
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

    // 7. Vehicle Modifications
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

      // Track provenance
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

    // 8. Update records count on VehicleDataSource
    for (const src of VEHICLE_DATA_SOURCES) {
      const count = await prisma.vehicleSourceRecord.count({
        where: { sourceId: src.id },
      });
      await prisma.vehicleDataSource.update({
        where: { id: src.id },
        data: { recordsCount: count },
      });
    }

    // 9. Reconcile existing CustomerVehicle records with the new relational database
    const linkedCustomerVehicles = await this.reconcileExistingCustomerVehicles();

    const durationMs = Date.now() - startTime;

    const stats: ImportStats = {
      dataSources: VEHICLE_DATA_SOURCES.length,
      makes: RAW_VEHICLE_MAKES.length,
      models: RAW_VEHICLE_MODELS.length,
      generations: RAW_VEHICLE_GENERATIONS.length,
      years: yearsCount,
      engines: RAW_VEHICLE_ENGINES.length,
      modifications: RAW_VEHICLE_MODIFICATIONS.length,
      aliases: aliasesCount,
      sourceRecords: sourceRecordsCount,
      linkedCustomerVehicles,
      duplicatesResolved,
      durationMs,
    };

    console.log("--> ZAPTUT Global Vehicle Database Import Complete:", stats);
    return stats;
  }

  /**
   * Safely link existing CustomerVehicle rows to normalized VehicleMake / Model / Generation
   * without modifying or losing any customer text fields or VIN.
   */
  async reconcileExistingCustomerVehicles(): Promise<number> {
    let linked = 0;
    const customerVehicles = await prisma.customerVehicle.findMany();

    for (const cv of customerVehicles) {
      if (cv.vehicleMakeId && cv.vehicleModelId) {
        continue; // Already linked
      }

      // Try matching Make
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

      // Try matching Model
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

      // Try matching Generation if present
      let matchedGenerationId: string | null = null;
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
        if (matchedGen) matchedGenerationId = matchedGen.id;
      }

      // Link safely in DB
      await prisma.customerVehicle.update({
        where: { id: cv.id },
        data: {
          vehicleMakeId: matchedMake.id,
          vehicleModelId: matchedModel?.id || null,
          vehicleGenerationId: matchedGenerationId,
        },
      });
      linked++;
    }

    return linked;
  }
}

export const vehicleImporterService = new VehicleImporterService();
