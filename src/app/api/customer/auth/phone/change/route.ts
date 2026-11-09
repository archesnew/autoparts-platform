import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext } from "@/lib/server/customer-session";
import { customerPhoneAuthService } from "@/lib/server/customer-phone-auth-service";

export async function POST(req: NextRequest) {
  try {
    const customer = await requireCustomerContext();
    const body = await req.json().catch(() => ({}));
    const newPhone = typeof body.newPhone === "string" ? body.newPhone.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!newPhone || !code) {
      return NextResponse.json(
        { error: "Укажите новый номер телефона и код подтверждения." },
        { status: 400 }
      );
    }

    const result = await customerPhoneAuthService.changePhone({
      userId: customer.userId,
      rawNewPhone: newPhone,
      code,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      newPhone: result.newPhone,
    });
  } catch (err: any) {
    if (err?.name === "CustomerAuthorizationError") {
      return NextResponse.json({ error: "Требуется авторизация покупателя" }, { status: 401 });
    }
    console.error("CHANGE_PHONE_ROUTE_ERROR:", err);
    return NextResponse.json(
      { error: "Ошибка смены номера телефона" },
      { status: 500 }
    );
  }
}
