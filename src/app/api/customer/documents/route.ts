import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService } from "@/lib/server/customer-portal-service";

export async function GET(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const documents = await customerPortalService.listDocuments(customer.customerId);
    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка загрузки документов" }, { status: 500 });
  }
}
