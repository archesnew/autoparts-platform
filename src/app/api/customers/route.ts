import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { customerRepository } from "@/lib/server/customer-repository";
import {
  createCustomer,
  migrateDemoCustomers,
  searchCustomers,
  toCustomerDto,
  type CustomerFields,
} from "@/lib/server/customer-service";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("customers.read", request.headers);
  if (staff instanceof Response) return staff;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = parseInt(searchParams.get("pageSize") ?? "25", 10) || 25;

  try {
    const result = await searchCustomers(customerRepository, query, page, pageSize);
    return Response.json({
      customers: result.customers.map((c) => toCustomerDto(c, staff)),
      total: result.total,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список клиентов";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staff = await authorizeStaffApi("customers.update", request.headers);
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

  const payload = body as Record<string, unknown>;

  // Check if batch migration requested
  if (payload.action === "migrate") {
    if (!Array.isArray(payload.customers)) {
      return Response.json({ error: "Массив customers обязателен для миграции" }, { status: 400 });
    }
    try {
      const demoCustomers = payload.customers as Array<CustomerFields & { id: string }>;
      const result = await migrateDemoCustomers(customerRepository, demoCustomers);
      return Response.json({
        success: true,
        idMap: result.idMap,
        customers: result.customers.map((c) => toCustomerDto(c, staff)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка миграции клиентов";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  // Single customer creation
  try {
    const fields: CustomerFields & { id?: string } = {
      name: typeof payload.name === "string" ? payload.name : "",
      phone: typeof payload.phone === "string" ? payload.phone : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      internalNote: typeof payload.internalNote === "string" ? payload.internalNote : undefined,
      id: typeof payload.id === "string" ? payload.id : undefined,
    };
    const customer = await createCustomer(customerRepository, fields);
    return Response.json({ customer: toCustomerDto(customer, staff) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось создать клиента";
    return Response.json({ error: message }, { status: 400 });
  }
}
