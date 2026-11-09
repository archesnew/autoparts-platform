import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { importService } from "@/lib/server/import/import-service";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("quotes.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get("supplierId") ?? undefined;

  try {
    const jobs = await importService.listJobs(supplierId);
    return Response.json({ ok: true, jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения истории импортов";
    return Response.json({ error: message }, { status: 500 });
  }
}
