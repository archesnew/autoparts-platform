import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { importService } from "@/lib/server/import/import-service";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("quotes.read", request.headers);
  if (staff instanceof Response) return staff;

  const params = await props.params;
  const { id } = params;

  const { searchParams } = new URL(request.url);
  const skip = parseInt(searchParams.get("skip") ?? "0", 10) || 0;
  const take = parseInt(searchParams.get("take") ?? "50", 10) || 50;

  try {
    const details = await importService.getJobDetails(id, skip, take);
    if (!details) {
      return Response.json({ error: "Задача не найдена" }, { status: 404 });
    }
    return Response.json({ ok: true, ...details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения деталей задачи";
    return Response.json({ error: message }, { status: 500 });
  }
}
