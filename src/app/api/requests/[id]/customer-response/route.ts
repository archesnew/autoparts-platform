import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import { setCustomerResponse, type BuyerResponseStatus } from "@/lib/server/request-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("requests.update", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const payload = body as { responseStatus: BuyerResponseStatus };
  if (!payload.responseStatus) {
    return Response.json({ error: "Статус ответа покупателя обязателен" }, { status: 400 });
  }

  try {
    const result = await setCustomerResponse(requestRepository, id, payload.responseStatus, staff.userId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить ответ покупателя";
    return Response.json({ error: message }, { status: 400 });
  }
}
