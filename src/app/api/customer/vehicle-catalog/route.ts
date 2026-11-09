import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { vehicleQueryService } from "@/lib/server/vehicle-database/vehicle-query-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const step = searchParams.get("step") || searchParams.get("type") || "makes";
    const query = searchParams.get("query") || searchParams.get("search") || undefined;
    const makeId = searchParams.get("makeId") || undefined;
    const modelId = searchParams.get("modelId") || undefined;
    const generationId = searchParams.get("generationId") || undefined;
    const engineId = searchParams.get("engineId") || undefined;
    const isPopularOnly = searchParams.get("popular") === "true";
    const category = searchParams.get("category") || undefined;

    switch (step) {
      case "makes": {
        const result = await vehicleQueryService.listMakes({
          search: query,
          isPopularOnly: isPopularOnly ? true : undefined,
          category,
          limit: 100,
        });
        return NextResponse.json({
          makes: result.makes,
          total: result.total,
        });
      }

      case "models": {
        if (!makeId) {
          return NextResponse.json({ error: "Параметр makeId обязателен" }, { status: 400 });
        }
        const result = await vehicleQueryService.listModels(makeId, {
          search: query,
          limit: 150,
        });
        return NextResponse.json({
          models: result.models,
          total: result.total,
        });
      }

      case "generations": {
        if (!modelId) {
          return NextResponse.json({ error: "Параметр modelId обязателен" }, { status: 400 });
        }
        const generations = await vehicleQueryService.listGenerations(modelId, query);
        return NextResponse.json({ generations });
      }

      case "years": {
        if (!generationId) {
          return NextResponse.json({ error: "Параметр generationId обязателен" }, { status: 400 });
        }
        const years = await vehicleQueryService.listYears(generationId);
        return NextResponse.json({ years });
      }

      case "bodyTypes": {
        const bodyTypes = await vehicleQueryService.listBodyTypes(generationId);
        return NextResponse.json({ bodyTypes });
      }

      case "engines": {
        if (!generationId) {
          return NextResponse.json({ error: "Параметр generationId обязателен" }, { status: 400 });
        }
        const engines = await vehicleQueryService.listEngines(generationId, query);
        return NextResponse.json({ engines });
      }

      case "modifications": {
        if (!generationId) {
          return NextResponse.json({ error: "Параметр generationId обязателен" }, { status: 400 });
        }
        const modifications = await vehicleQueryService.listModifications(generationId, engineId, query);
        return NextResponse.json({ modifications });
      }

      case "options": {
        if (!generationId) {
          return NextResponse.json({ error: "Параметр generationId обязателен" }, { status: 400 });
        }
        const [years, bodyTypes, engines, modifications] = await Promise.all([
          vehicleQueryService.listYears(generationId),
          vehicleQueryService.listBodyTypes(generationId),
          vehicleQueryService.listEngines(generationId, query),
          vehicleQueryService.listModifications(generationId, engineId, query),
        ]);
        return NextResponse.json({
          years,
          bodyTypes,
          engines,
          modifications,
        });
      }

      default:
        return NextResponse.json({ error: "Неизвестный шаг справочника" }, { status: 400 });
    }
  } catch (error) {
    console.error("VEHICLE_CATALOG_API_ERROR:", error);
    return NextResponse.json({ error: "Ошибка загрузки справочника автомобилей" }, { status: 500 });
  }
}
