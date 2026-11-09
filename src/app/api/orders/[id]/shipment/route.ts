import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { orderService } from "@/lib/server/order-service";
import type { DeliveryStatus } from "@prisma/client";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  // Allow if staff has orders.shipment.manage OR shipments.update
  let staff = await authorizeStaffApi("orders.shipment.manage", request.headers);
  if (staff instanceof Response) {
    staff = await authorizeStaffApi("shipments.update", request.headers);
    if (staff instanceof Response) return staff;
  }

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

  const { carrier, trackingNumber, status, city, address, estimatedDays, cost } = body as {
    carrier?: string;
    trackingNumber?: string;
    status?: DeliveryStatus;
    city?: string;
    address?: string;
    estimatedDays?: number;
    cost?: number | string;
  };

  try {
    const updatedOrder = await orderService.updateShipment(
      id,
      {
        carrier,
        trackingNumber,
        status,
        city,
        address,
        estimatedDays,
        cost,
      },
      staff
    );

    return Response.json({ success: true, order: updatedOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления отправления";
    return Response.json({ error: message }, { status: 400 });
  }
}
