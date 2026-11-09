import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import { toTaskDto, toggleTask } from "@/lib/server/request-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("requests.update", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;
  try {
    const updated = await toggleTask(requestRepository, id, staff.userId);
    return Response.json({ task: toTaskDto(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить задачу";
    return Response.json({ error: message }, { status: 400 });
  }
}
