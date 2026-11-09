import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";

export async function GET(request: Request) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  try {
    const profile = await supplierPortalService.getProfile(authRes.supplierId);
    return Response.json({ ok: true, profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения профиля";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  try {
    const body = await request.json();
    const updated = await supplierPortalService.updateProfile(authRes.supplierId, body);
    return Response.json({ ok: true, profile: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка сохранения профиля";
    return Response.json({ error: message }, { status: 400 });
  }
}
