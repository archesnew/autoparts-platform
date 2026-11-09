import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { importService } from "@/lib/server/import/import-service";

export async function GET(request: Request) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  try {
    // Strictly list jobs belonging to the authenticated supplier
    const jobs = await importService.listJobs(authRes.supplierId);
    return Response.json({ ok: true, jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения истории импортов";
    return Response.json({ error: message }, { status: 500 });
  }
}
