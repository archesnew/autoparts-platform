import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import { deleteRequestItem, toItemDto, updateRequestItem, type RequestItemInput } from "@/lib/server/request-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const staff = await authorizeStaffApi("requests.update", request.headers);
  if (staff instanceof Response) return staff;

  const { id, itemId } = await params;
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
    const patch = body as Partial<RequestItemInput>;
    const updated = await updateRequestItem(requestRepository, id, itemId, patch, staff.userId);
    return Response.json({ item: toItemDto(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить позицию";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const staff = await authorizeStaffApi("requests.update", request.headers);
  if (staff instanceof Response) return staff;

  const { id, itemId } = await params;
  try {
    await deleteRequestItem(requestRepository, id, itemId, staff.userId);
    return Response.json({ success: true, id: itemId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить позицию";
    return Response.json({ error: message }, { status: 400 });
  }
}
