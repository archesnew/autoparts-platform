import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { prisma } from "@/lib/server/db";

export async function GET(request: Request) {
  // Check permission: analytics.read or finance.read or admin.access
  let staff = await authorizeStaffApi("analytics.read", request.headers);
  if (staff instanceof Response) {
    staff = await authorizeStaffApi("finance.read", request.headers);
    if (staff instanceof Response) {
      staff = await authorizeStaffApi("admin.access", request.headers);
      if (staff instanceof Response) return staff;
    }
  }

  try {
    const [
      requestsTotal,
      requestsNew,
      requestsConfirmed,
      ordersTotal,
      ordersPaid,
      ordersShipped,
      ordersSumAggregate,
      recentActivity,
    ] = await Promise.all([
      prisma.request.count(),
      prisma.request.count({ where: { status: "NEW" } }),
      prisma.request.count({ where: { status: "CONFIRMED" } }),
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: "PAID" } }),
      prisma.order.count({ where: { deliveryStatus: "IN_TRANSIT" } }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
      }),
      prisma.activityLog.findMany({
        take: 15,
        orderBy: { occurredAt: "desc" },
        select: {
          id: true,
          entityType: true,
          action: true,
          occurredAt: true,
        },
      }),
    ]);

    const totalOrdersRub = Number(ordersSumAggregate._sum.grandTotal || 0);
    const avgOrderValue = ordersTotal > 0 ? Math.round(totalOrdersRub / ordersTotal) : 0;
    const conversionRate = requestsTotal > 0 ? Number(((ordersTotal / requestsTotal) * 100).toFixed(1)) : 0;

    return Response.json({
      metrics: {
        requestsTotal,
        requestsNew,
        requestsConfirmed,
        ordersTotal,
        ordersPaid,
        ordersShipped,
        totalOrdersRub,
        totalOrdersRubFormatted: `${totalOrdersRub.toLocaleString("ru-RU")} ₽`,
        avgOrderValue,
        avgOrderValueFormatted: `${avgOrderValue.toLocaleString("ru-RU")} ₽`,
        conversionRate,
      },
      recentActivity,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка загрузки аналитики";
    return Response.json({ error: message }, { status: 500 });
  }
}
