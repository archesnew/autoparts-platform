import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const { id } = await context.params;
    const body = await req.json();

    const updated = await customerPortalService.updateVehicle(customer.customerId, id, body);
    return NextResponse.json({ success: true, vehicle: updated });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка обновления автомобиля" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const { id } = await context.params;

    const result = await customerPortalService.deleteVehicle(customer.customerId, id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка удаления автомобиля" }, { status: 500 });
  }
}
