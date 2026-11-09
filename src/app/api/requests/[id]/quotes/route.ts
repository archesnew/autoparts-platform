import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import {
  createSupplierQuote,
  toQuoteDto,
  type SupplierQuoteInput,
} from "@/lib/server/request-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const staff = await authorizeStaffApi("quotes.manage", request.headers);
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
    const input = body as SupplierQuoteInput;
    const created = await createSupplierQuote(requestRepository, id, input, staff.userId);
    return Response.json({ quote: toQuoteDto(created, staff) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось добавить предложение поставщика";
    return Response.json({ error: message }, { status: 400 });
  }
}
