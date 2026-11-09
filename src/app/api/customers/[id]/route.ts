import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { customerRepository } from "@/lib/server/customer-repository";
import {
  getCustomer,
  toCustomerDto,
  updateCustomer,
  type CustomerFields,
} from "@/lib/server/customer-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const staff = await authorizeStaffApi("customers.read", request.headers);
  if (staff instanceof Response) return staff;

  const { id } = await params;

  try {
    const customer = await getCustomer(customerRepository, id);
    return Response.json({ customer: toCustomerDto(customer, staff) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Клиент не найден";
    const status = message.includes("Некорректный ID") ? 400 : 404;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const staff = await authorizeStaffApi("customers.update", request.headers);
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

  const payload = body as Record<string, unknown>;

  try {
    const fields: CustomerFields = {
      name: typeof payload.name === "string" ? payload.name : "",
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      internalNote: typeof payload.internalNote === "string" ? payload.internalNote : undefined,
    };
    const updated = await updateCustomer(customerRepository, id, fields);
    return Response.json({ customer: toCustomerDto(updated, staff) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить клиента";
    const status = message.includes("Клиент не найден") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
