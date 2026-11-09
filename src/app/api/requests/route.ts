import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import {
  createRequest,
  listRequests,
  migrateDemoRequests,
  toRequestDto,
  type RequestFields,
  type RequestStatus,
} from "@/lib/server/request-service";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("requests.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const status = (searchParams.get("status") || undefined) as RequestStatus | undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const manager = searchParams.get("manager") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10) || 50;

  try {
    const result = await listRequests(
      requestRepository,
      { query, status, priority, manager, sort, page, pageSize },
      staff,
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список заявок";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  // Batch migration from localStorage
  if (payload.action === "migrate") {
    const staff = await authorizeStaffApi("requests.update", request.headers);
    if (staff instanceof Response) return staff;

    if (!Array.isArray(payload.requests)) {
      return Response.json({ error: "Массив requests обязателен для миграции" }, { status: 400 });
    }

    try {
      const result = await migrateDemoRequests(
        requestRepository,
        {
          requests: payload.requests as any[],
          quotes: Array.isArray(payload.quotes) ? (payload.quotes as any[]) : [],
          tasks: Array.isArray(payload.tasks) ? (payload.tasks as any[]) : [],
        },
        staff.userId,
      );
      return Response.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка миграции заявок";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  // Single request creation
  const staff = await authorizeStaffApi("requests.create", request.headers);
  if (staff instanceof Response) return staff;

  try {
    const fields = payload as unknown as RequestFields;
    const created = await createRequest(requestRepository, fields, staff.userId);
    return Response.json({ request: toRequestDto(created, staff) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать заявку";
    return Response.json({ error: message }, { status: 400 });
  }
}
