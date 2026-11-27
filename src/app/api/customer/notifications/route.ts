import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { notificationService } from "@/lib/server/notification-service";

export async function GET(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

    const [items, unreadCount] = await Promise.all([
      notificationService.getCustomerNotifications(customer.customerId, unreadOnly),
      notificationService.getCustomerUnreadCount(customer.customerId),
    ]);

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка при получении уведомлений" }, { status: 500 });
  }
}
