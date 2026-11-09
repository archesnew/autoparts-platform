import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";

export async function GET(request: Request) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  try {
    const metrics = await supplierPortalService.getDashboardMetrics(authRes.supplierId);
    return Response.json({
      ok: true,
      supplier: {
        id: authRes.supplierId,
        name: authRes.supplierName,
        countryCode: authRes.supplierCountryCode,
        status: authRes.supplierStatus,
      },
      user: {
        id: authRes.userId,
        name: authRes.name,
        email: authRes.email,
        role: authRes.role,
      },
      metrics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения сводки";
    return Response.json({ error: message }, { status: 500 });
  }
}
