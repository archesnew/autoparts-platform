import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("employees.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const role = searchParams.get("role") ?? undefined;
  const activeParam = searchParams.get("active");
  const active = activeParam !== null ? activeParam === "true" : undefined;

  try {
    const list = await staffManagementService.listStaff(
      { query, role, active },
      staff,
    );
    return Response.json({ staff: list });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список сотрудников";
    return Response.json({ error: message }, { status: 500 });
  }
}
