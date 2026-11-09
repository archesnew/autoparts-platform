import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function GET(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const vehicles = await customerPortalService.listVehicles(customer.customerId);
    return NextResponse.json({ vehicles });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка загрузки гаража" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const body = await req.json();

    const created = await customerPortalService.createVehicle(customer.customerId, body);
    return NextResponse.json({ success: true, vehicle: created }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка добавления автомобиля" }, { status: 500 });
  }
}
