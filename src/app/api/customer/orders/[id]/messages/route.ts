import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const { id } = await context.params;

    const messages = await customerPortalService.listOrderMessages(customer.customerId, id);
    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка загрузки сообщений" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const { id } = await context.params;
    const body = await req.json();

    const created = await customerPortalService.sendOrderMessage(
      customer.customerId,
      id,
      body.message,
      body.attachments
    );
    return NextResponse.json({ success: true, message: created }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка отправки сообщения" }, { status: 500 });
  }
}
