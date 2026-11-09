import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import { createTask, listTasks, toTaskDto, type TaskInput } from "@/lib/server/request-service";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("requests.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId") ?? undefined;

  try {
    const tasks = await listTasks(requestRepository, { requestId });
    return Response.json({ tasks: tasks.map(toTaskDto) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список задач";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staff = await authorizeStaffApi("requests.update", request.headers);
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

  try {
    const input = body as TaskInput;
    const task = await createTask(requestRepository, input, staff.userId);
    return Response.json({ task: toTaskDto(task) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать задачу";
    return Response.json({ error: message }, { status: 400 });
  }
}
