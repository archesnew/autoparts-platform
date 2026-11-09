import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { importService } from "@/lib/server/import/import-service";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  const { id } = await props.params;
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

  try {
    const details = await importService.getJobDetails(id, page, pageSize);
    if (!details) {
      return Response.json({ error: "Задание импорта не найдено" }, { status: 404 });
    }

    // Horizontal access prevention: ensure job belongs to this supplier!
    if (details.job.supplierId !== authRes.supplierId) {
      return Response.json({ error: "Доступ к заданию запрещён" }, { status: 403 });
    }

    return Response.json({ ok: true, ...details });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения информации о задании";
    return Response.json({ error: message }, { status: 500 });
  }
}
