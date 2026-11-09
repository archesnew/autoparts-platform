import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const { id } = await context.params;
    const body = await req.json();

    if (!body?.response || !["ACCEPTED", "REJECTED", "NEEDS_CLARIFICATION"].includes(body.response)) {
      return NextResponse.json({ error: "Недопустимый статус ответа (ACCEPTED, REJECTED, NEEDS_CLARIFICATION)" }, { status: 400 });
    }

    const result = await customerPortalService.respondToOffer(
      customer.customerId,
      id,
      body.response,
      body.comment
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка сохранения ответа на предложение" }, { status: 500 });
  }
}
