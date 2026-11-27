import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { prisma } from "@/lib/server/db";
import { notificationService } from "@/lib/server/notification-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const comment = typeof body?.comment === "string" ? body.comment.trim() : "";

    const order = await prisma.order.findFirst({
      where: { id, customerId: customer.customerId },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        assignedManagerId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ error: "Заказ уже оплачен" }, { status: 400 });
    }

    const messageText = comment
      ? `Покупатель сообщил об оплате: ${comment}`
      : "Покупатель сообщил об отправке оплаты по выставленным реквизитам";

    // 1. Log activity and message
    await prisma.$transaction([
      prisma.activityLog.create({
        data: {
          entityType: "ORDER",
          entityId: order.id,
          orderId: order.id,
          action: "Покупатель сообщил об отправке платежа",
          details: { comment },
        },
      }),
      prisma.orderMessage.create({
        data: {
          orderId: order.id,
          senderType: "CUSTOMER",
          authorName: "Покупатель",
          message: messageText,
          isInternal: false,
        },
      }),
    ]);

    // 2. Notify manager / superadmin
    await notificationService.notifyPaymentSubmitted(
      order.id,
      order.orderNumber,
      order.assignedManagerId
    );

    return NextResponse.json({
      success: true,
      message: "Сообщение об оплате принято. Персональный менеджер проверит поступление средств и подтвердит оплату заказа.",
    });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка при отправке подтверждения оплаты" }, { status: 500 });
  }
}
