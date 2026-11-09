import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";
import type { SupplierUserStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; userId: string }> }
) {
  const staff = await authorizeStaffApi("suppliers.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id, userId } = await props.params;

  try {
    const body = await request.json();
    const { status } = body as { status: SupplierUserStatus };

    if (!["ACTIVE", "SUSPENDED", "PENDING"].includes(status)) {
      return Response.json({ error: "Недопустимый статус пользователя" }, { status: 400 });
    }

    const updated = await supplierPortalService.setSupplierUserStatus(
      id,
      userId,
      status
    );

    return Response.json({ ok: true, status: updated.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления статуса пользователя";
    return Response.json({ error: message }, { status: 400 });
  }
}
