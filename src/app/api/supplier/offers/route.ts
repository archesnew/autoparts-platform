import "server-only";

import { authorizeSupplierApi } from "@/lib/server/supplier-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";
import type { OfferCondition, OfferStatus } from "@prisma/client";

export async function GET(request: Request) {
  const authRes = await authorizeSupplierApi(request.headers);
  if (authRes instanceof Response) return authRes;

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || undefined;
  const status = (url.searchParams.get("status") as OfferStatus) || undefined;
  const condition = (url.searchParams.get("condition") as OfferCondition) || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") || "25", 10);

  try {
    const result = await supplierPortalService.getOffers(authRes.supplierId, {
      query,
      status,
      condition,
      page,
      pageSize,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения предложений";
    return Response.json({ error: message }, { status: 500 });
  }
}
