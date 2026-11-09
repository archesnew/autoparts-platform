import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  const { id } = await props.params;

  try {
    const body = await request.json();
    const updated = await supplierPortalService.updateOffer(
      authRes.supplierId,
      id,
      body
    );
    return Response.json({ ok: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления предложения";
    return Response.json({ error: message }, { status: 400 });
  }
}
