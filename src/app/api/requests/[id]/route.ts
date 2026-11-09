import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import {
  getRequest,
  toRequestDto,
  updateRequest,
  type RequestUpdate,
} from "@/lib/server/request-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("requests.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;
  try {
    const data = await getRequest(requestRepository, id, staff);
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Заявка не найдена";
    return Response.json({ error: message }, { status: 404 });
  }
}

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

  try {
    const patch = body as RequestUpdate;
    const updated = await updateRequest(requestRepository, id, patch, staff.userId);
    return Response.json({ request: toRequestDto(updated, staff) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить заявку";
    return Response.json({ error: message }, { status: 400 });
  }
}
