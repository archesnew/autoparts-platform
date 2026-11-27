import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session.ts";
import { notificationService } from "@/lib/server/notification-service.ts";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("admin.access", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    const [items, unreadCount] = await Promise.all([
      notificationService.getStaffNotifications(staff.userId, unreadOnly),
      notificationService.getStaffUnreadCount(staff.userId),
    ]);

    return Response.json({ items, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения уведомлений";
    return Response.json({ error: message }, { status: 500 });
  }
}
