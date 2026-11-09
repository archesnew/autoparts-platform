import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("employees.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;

  try {
    const member = await staffManagementService.getStaffMember(id, staff);
    return Response.json({ staff: member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Сотрудник не найден";
    return Response.json({ error: message }, { status: 404 });
  }
}

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

  try {
    const updated = await staffManagementService.updateStaffMember(id, body, staff);
    return Response.json({ success: true, staff: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления данных сотрудника";
    return Response.json({ error: message }, { status: 400 });
  }
}
