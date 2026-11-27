import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { notificationService } from "@/lib/server/notification-service.ts";

export async function POST(request: Request) {
  const staff = await authorizeStaffApi("admin.access", request.headers);
  if (staff instanceof Response) return staff;

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId, all } = body as { notificationId?: string; all?: boolean };

    if (all) {
      await notificationService.markAllStaffAsRead(staff.userId);
    } else if (notificationId) {
      await notificationService.markStaffAsRead(staff.userId, notificationId);
    }

    const unreadCount = await notificationService.getStaffUnreadCount(staff.userId);
    return Response.json({ success: true, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления уведомлений";
    return Response.json({ error: message }, { status: 500 });
  }
}
