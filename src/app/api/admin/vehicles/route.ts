import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { vehicleQueryService } from "@/lib/server/vehicle-database/vehicle-query-service";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("admin.access", request.headers);
  if (staff instanceof Response) return staff;

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "stats";
    const query = searchParams.get("query") || undefined;

    if (view === "stats") {
      const stats = await vehicleQueryService.getOverviewStats();
      return Response.json(stats);
    }

    if (view === "makes") {
      const result = await vehicleQueryService.listMakes({
        search: query,
        limit: 100,
      });
      return Response.json(result);
    }

    return Response.json({ error: "Неизвестный параметр view" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения данных базы автомобилей";
    return Response.json({ error: message }, { status: 500 });
  }
}
