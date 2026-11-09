import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function GET(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const requests = await customerPortalService.listRequests(customer.customerId);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка загрузки списка заявок" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const body = await req.json();

    const created = await customerPortalService.createRequest(customer.customerId, body);
    return NextResponse.json({ success: true, request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка создания заявки" }, { status: 500 });
  }
}
