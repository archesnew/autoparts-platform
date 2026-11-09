import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function POST(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const body = await req.json();

    if (!body?.oldPassword || !body?.newPassword) {
      return NextResponse.json({ error: "Укажите текущий и новый пароль" }, { status: 400 });
    }

    const result = await customerPortalService.changePassword(
      customer.userId,
      body.oldPassword,
      body.newPassword
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка изменения пароля" }, { status: 500 });
  }
}
