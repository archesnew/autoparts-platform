import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("employees.read", request.headers);
  if (staff instanceof Response) return staff;

  try {
    const list = await staffManagementService.listAllPermissions();
    return Response.json({ permissions: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список разрешений";
    return Response.json({ error: message }, { status: 500 });
  }
}
