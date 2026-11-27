import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { notificationService } from "@/lib/server/notification-service";

export async function POST(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const body = await req.json().catch(() => ({}));
    const { notificationId, all } = body as { notificationId?: string; all?: boolean };

    if (all) {
      await notificationService.markAllCustomerAsRead(customer.customerId);
    } else if (notificationId) {
      await notificationService.markCustomerAsRead(customer.customerId, notificationId);
    }

    const unreadCount = await notificationService.getCustomerUnreadCount(customer.customerId);
    return NextResponse.json({ success: true, unreadCount });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка обновления статуса уведомлений" }, { status: 500 });
  }
}
