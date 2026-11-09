import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { importService } from "@/lib/server/import/import-service";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  const { id } = await props.params;

  try {
    const details = await importService.getJobDetails(id, 1, 1);
    if (!details) {
      return Response.json({ error: "Задание импорта не найдено" }, { status: 404 });
    }

    // Horizontal access prevention
    if (details.job.supplierId !== authRes.supplierId) {
      return Response.json({ error: "Доступ к заданию запрещён" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const isFullFeed = Boolean(body.isFullFeed);
    const archiveMissing = Boolean(body.archiveMissing);

    const result = await importService.commitImportJob(id, {
      isFullFeed,
      archiveMissing,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка фиксации данных";
    return Response.json({ error: message }, { status: 500 });
  }
}
