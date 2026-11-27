/**
 * Runs the expanded ZAPTUT Vehicle Database import (zaptut-regional + VehiclesDB CC-BY 4.0 +
 * MeterApp open public registries + manufacturer-verified regional models) against PostgreSQL.
 *
 * Usage: node scripts/import-expanded-vehicles.mjs
 */

import { PrismaClient } from "@prisma/client";
import { runExpandedVehicleImport } from "../src/lib/server/vehicle-database/expanded-import.ts";

const prisma = new PrismaClient({ log: ["warn", "error"] });

async function main() {
  const stats = await runExpandedVehicleImport(prisma);
  const [makesCount, modelsCount, gensCount, yearsCount, enginesCount, modsCount, aliasesCount, sourcesCount] =
    await Promise.all([
      prisma.vehicleMake.count(),
      prisma.vehicleModel.count(),
      prisma.vehicleGeneration.count(),
      prisma.vehicleYear.count(),
      prisma.vehicleEngine.count(),
      prisma.vehicleModification.count(),
      prisma.vehicleAlias.count(),
      prisma.vehicleSourceRecord.count(),
    ]);

  console.log("=== EXPANDED VEHICLE IMPORT COMPLETE ===");
  console.log("Batch run stats:", stats);
  console.log("Final PostgreSQL totals:", {
    makes: makesCount,
    models: modelsCount,
    generations: gensCount,
    years: yearsCount,
    engines: enginesCount,
    modifications: modsCount,
    aliases: aliasesCount,
    sourceRecords: sourcesCount,
  });
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
