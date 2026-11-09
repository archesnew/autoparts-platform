import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import {
  selectSupplierQuote,
  toQuoteDto,
  updateSupplierQuote,
  type SupplierQuoteInput,
} from "@/lib/server/request-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  const staff = await authorizeStaffApi("quotes.manage", request.headers);
  if (staff instanceof Response) return staff;

  const { id, quoteId } = await params;
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
    if (payload.action === "select") {
      const selected = await selectSupplierQuote(requestRepository, id, quoteId, staff.userId);
      return Response.json({ quote: toQuoteDto(selected, staff) });
    }

    const patch = payload as Partial<SupplierQuoteInput>;
    const updated = await updateSupplierQuote(requestRepository, id, quoteId, patch, staff.userId);
    return Response.json({ quote: toQuoteDto(updated, staff) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось обновить предложение поставщика";
    return Response.json({ error: message }, { status: 400 });
  }
}
