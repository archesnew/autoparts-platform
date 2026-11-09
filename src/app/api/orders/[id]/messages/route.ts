import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { orderService } from "@/lib/server/order-service";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("orders.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await props.params;

  try {
    const order = await orderService.getOrder(id, staff);
    if (!order) {
      return Response.json({ error: "Заказ не найден" }, { status: 404 });
    }
    return Response.json({ messages: order.messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения сообщений";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("orders.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await props.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const { message, isInternal, senderType, attachments } = body as {
    message?: string;
    isInternal?: boolean;
    senderType?: "STAFF" | "CUSTOMER";
    attachments?: any;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Текст сообщения не может быть пустым" }, { status: 400 });
  }

  try {
    const updatedOrder = await orderService.addMessage(
      id,
      {
        message: message.trim(),
        isInternal,
        senderType,
        attachments,
      },
      staff
    );

    return Response.json({ success: true, order: updatedOrder }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка добавления сообщения";
    return Response.json({ error: message }, { status: 400 });
  }
}
