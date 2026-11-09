import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function GET(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const addresses = await customerPortalService.listAddresses(customer.customerId);
    return NextResponse.json({ addresses });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка загрузки адресов" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const body = await req.json();

    const created = await customerPortalService.createAddress(customer.customerId, body);
    return NextResponse.json({ success: true, address: created }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка создания адреса" }, { status: 500 });
  }
}
