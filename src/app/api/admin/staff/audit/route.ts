import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("employees.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? undefined;

  try {
    const logs = await staffManagementService.getStaffAuditHistory(userId, staff);
    return Response.json({ logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить историю действий";
    return Response.json({ error: message }, { status: 500 });
  }
}
