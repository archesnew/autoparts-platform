import "server-only";

import { prisma } from "@/lib/server/db";
import { runExpandedVehicleImport } from "./expanded-import.ts";
import type { ImportStats } from "./types.ts";

export class VehicleImporterService {
  /**
   * Run idempotent batch import of the expanded multi-source vehicle dataset into PostgreSQL.
   */
  async importAll(): Promise<ImportStats> {
    const startTime = Date.now();
    console.log("--> Starting ZAPTUT Expanded Global Vehicle Database Import...");

    const stats = await runExpandedVehicleImport(prisma);
    const linkedCustomerVehicles = await this.reconcileExistingCustomerVehicles();

    const finalStats: ImportStats = {
      ...stats,
      linkedCustomerVehicles,
      durationMs: Date.now() - startTime,
    };

    console.log("--> ZAPTUT Expanded Global Vehicle Database Import Complete:", finalStats);
    return finalStats;
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
        continue;
      }

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
