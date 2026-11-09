import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { orderService } from "@/lib/server/order-service";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("orders.payment.manage", request.headers);
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

  const { amount, paymentMethod, externalPaymentId, notes } = body as {
    amount?: number | string;
    paymentMethod?: string;
    externalPaymentId?: string;
    notes?: string;
  };

  if (!amount || Number(amount) <= 0) {
    return Response.json({ error: "Сумма платежа должна быть больше 0" }, { status: 400 });
  }

  if (!paymentMethod) {
    return Response.json({ error: "Укажите способ оплаты" }, { status: 400 });
  }

  try {
    const updatedOrder = await orderService.recordPayment(
      id,
      {
        amount,
        paymentMethod,
        externalPaymentId,
        notes,
      },
      staff
    );

    return Response.json({ success: true, order: updatedOrder }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка регистрации оплаты";
    return Response.json({ error: message }, { status: 400 });
  }
}
