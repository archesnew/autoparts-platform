import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("employees.manage", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (typeof body.active !== "boolean") {
    return Response.json({ error: "Поле active (boolean) обязательно" }, { status: 400 });
  }

  try {
    const result = await staffManagementService.setStaffActiveStatus(id, body.active, staff);
    return Response.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка изменения статуса";
    return Response.json({ error: message }, { status: 400 });
  }
}
