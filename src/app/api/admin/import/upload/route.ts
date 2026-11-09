import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { importService } from "@/lib/server/import/import-service";

export async function POST(request: Request) {
  const staff = await authorizeStaffApi("quotes.manage", request.headers);
  if (staff instanceof Response) return staff;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const supplierId = formData.get("supplierId");
    const forcedFormat = formData.get("forcedFormat") as "YML" | "XML" | "CSV" | "XLSX" | null;
    const source = formData.get("source") as string | null;
    const rawMapping = formData.get("columnMapping");
    let columnMapping: Record<string, string> | undefined = undefined;
    if (typeof rawMapping === "string") {
      try {
        columnMapping = JSON.parse(rawMapping);
      } catch {}
    }

    if (!file || !(file instanceof File)) {
      return Response.json({ error: "Файл не прикреплён" }, { status: 400 });
    }
    if (!supplierId || typeof supplierId !== "string") {
      return Response.json({ error: "Поставщик не выбран" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await importService.stageImportJob({
      supplierId,
      fileName: file.name,
      buffer,
      forcedFormat: forcedFormat || undefined,
      source: source || undefined,
      columnMapping,
    });

    return Response.json({
      ok: true,
      job: result.job,
      previewRows: result.previewRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка при загрузке фида";
    return Response.json({ error: message }, { status: 500 });
  }
}
