import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { orderService } from "@/lib/server/order-service";
import type { OrderDocumentType } from "@prisma/client";

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
    return Response.json({ documents: order.documents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка получения документов";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
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

  const { documentType, documentNumber, fileUrl, contentJson } = body as {
    documentType?: OrderDocumentType;
    documentNumber?: string;
    fileUrl?: string;
    contentJson?: any;
  };

  if (!documentType) {
    return Response.json({ error: "Укажите тип документа" }, { status: 400 });
  }

  try {
    const updatedOrder = await orderService.addDocument(
      id,
      {
        documentType,
        documentNumber,
        fileUrl,
        contentJson,
      },
      staff
    );

    return Response.json({ success: true, order: updatedOrder }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка создания документа";
    return Response.json({ error: message }, { status: 400 });
  }
}
