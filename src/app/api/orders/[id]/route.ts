import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { orderService } from "@/lib/server/order-service";
import { prisma } from "@/lib/server/db";
import type { OrderStatus } from "@prisma/client";

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
    return Response.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения заказа";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const staff = await authorizeStaffApi("orders.update", request.headers);
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

  const { status, assignedManagerId, internalComment, logisticsInstructions, rejectionReason } = body as {
    status?: OrderStatus;
    assignedManagerId?: string | null;
    internalComment?: string;
    logisticsInstructions?: string;
    rejectionReason?: string;
  };

  try {
    const existing = await orderService.getOrder(id, staff);
    if (!existing) {
      return Response.json({ error: "Заказ не найден" }, { status: 404 });
    }

    if (status && status !== existing.status) {
      await orderService.updateStatus(existing.id, status, staff, rejectionReason);
    }

    const updates: Record<string, any> = {};
    if (assignedManagerId !== undefined) {
      updates.assignedManagerId = assignedManagerId;
    }
    if (internalComment !== undefined) {
      updates.internalComment = internalComment;
    }
    if (logisticsInstructions !== undefined) {
      updates.logisticsInstructions = logisticsInstructions;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.order.update({
        where: { id: existing.id },
        data: updates,
      });
    }

    const updated = await orderService.getOrder(existing.id, staff);
    return Response.json({ success: true, order: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка обновления заказа";
    return Response.json({ error: message }, { status: 400 });
  }
}
