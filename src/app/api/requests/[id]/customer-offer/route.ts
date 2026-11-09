import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { requestRepository } from "@/lib/server/request-repository";
import { saveCustomerOffer } from "@/lib/server/request-service";

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
    const payload = body as {
      comment?: string;
      sharedLogisticsRub?: string;
      snapshot: any;
      status?: any;
      selectedQuoteIds?: string[];
    };
    const offer = await saveCustomerOffer(requestRepository, id, payload, staff.userId);
    return Response.json({ success: true, offer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить предложение покупателю";
    return Response.json({ error: message }, { status: 400 });
  }
}
