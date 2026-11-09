import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("suppliers.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await props.params;

  try {
    const result = await supplierPortalService.suspendAllOffers(id);
    return Response.json({
      ok: true,
      updatedCount: result.updatedCount,
      message: `Все активные предложения поставщика (${result.updatedCount}) успешно приостановлены`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка приостановки предложений";
    return Response.json({ error: message }, { status: 500 });
  }
}
