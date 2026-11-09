import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { importService } from "@/lib/server/import/import-service";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("quotes.manage", request.headers);
  if (staff instanceof Response) return staff;

  const params = await props.params;
  const { id } = params;

  try {
    const body = await request.json().catch(() => ({}));
    const isFullFeed = Boolean(body.isFullFeed);
    const archiveMissing = Boolean(body.archiveMissing);

    const result = await importService.commitImportJob(id, {
      isFullFeed,
      archiveMissing,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка применения импорта в каталог";
    return Response.json({ error: message }, { status: 500 });
  }
}
