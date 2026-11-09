import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { importService } from "@/lib/server/import/import-service";

export async function POST(request: Request) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const forcedFormat = formData.get("forcedFormat") as "YML" | "XML" | "CSV" | "XLSX" | null;
    const source = (formData.get("source") as string) || "RU_DISMANTLE";
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // CRITICAL: supplierId is strictly the authenticated supplier's ID!
    const result = await importService.stageImportJob({
      supplierId: authRes.supplierId,
      fileName: file.name,
      buffer,
      forcedFormat: forcedFormat || undefined,
      source,
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
