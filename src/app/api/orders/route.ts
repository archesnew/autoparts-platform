import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { orderService } from "@/lib/server/order-service";
import type { OrderStatus, PaymentStatus, FulfillmentStatus, DeliveryStatus } from "@prisma/client";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("orders.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const status = (searchParams.get("status") || undefined) as OrderStatus | undefined;
  const paymentStatus = (searchParams.get("paymentStatus") || undefined) as PaymentStatus | undefined;
  const fulfillmentStatus = (searchParams.get("fulfillmentStatus") || undefined) as FulfillmentStatus | undefined;
  const deliveryStatus = (searchParams.get("deliveryStatus") || undefined) as DeliveryStatus | undefined;
  const queue = (searchParams.get("queue") || undefined) as any;
  const country = searchParams.get("country") ?? undefined;
  const managerId = searchParams.get("managerId") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10) || 50;

  try {
    // Ensure demo orders exist if empty on initial visit
    await orderService.seedDemoOrdersIfEmpty().catch(() => {});

    const result = await orderService.listOrders(
      {
        query,
        status,
        paymentStatus,
        fulfillmentStatus,
        deliveryStatus,
        queue,
        country,
        managerId,
        page,
        pageSize,
      },
      staff
    );

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список заказов";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staff = await authorizeStaffApi("orders.create", request.headers);
  if (staff instanceof Response) return staff;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const { requestId, deliveryDetails, customerComment, internalComment } = body as {
    requestId?: string;
    deliveryDetails?: {
      carrier?: string;
      city?: string;
      address?: string;
      postalCode?: string;
      pickupPointId?: string;
      deliveryMethod?: string;
    };
    customerComment?: string;
    internalComment?: string;
  };

  if (!requestId || typeof requestId !== "string") {
    return Response.json({ error: "Параметр requestId обязателен" }, { status: 400 });
  }

  try {
    const order = await orderService.createOrderFromRequest({
      requestId,
      callerStaff: staff,
      deliveryDetails,
      customerComment,
      internalComment,
    });

    return Response.json({ success: true, order }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания заказа";
    return Response.json({ error: message }, { status: 400 });
  }
}
