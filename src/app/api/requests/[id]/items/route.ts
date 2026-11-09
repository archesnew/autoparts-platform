import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import { addRequestItem, toItemDto, type RequestItemInput } from "@/lib/server/request-service";

export async function POST(
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
    const itemInput = body as RequestItemInput;
    const created = await addRequestItem(requestRepository, id, itemInput, staff.userId);
    return Response.json({ item: toItemDto(created) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось добавить позицию";
    return Response.json({ error: message }, { status: 400 });
  }
}
