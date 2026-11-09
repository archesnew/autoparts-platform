import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("employees.manage", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;

  try {
    await staffManagementService.revokeInvitation(id, staff);
    return Response.json({ success: true, message: "Приглашение успешно отозвано" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка отзыва приглашения";
    return Response.json({ error: message }, { status: 400 });
  }
}
