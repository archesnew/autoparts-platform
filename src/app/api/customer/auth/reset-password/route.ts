import { NextRequest, NextResponse } from "next/server";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.email || !body?.token || !body?.newPassword) {
      return NextResponse.json({ error: "Все поля обязательны для заполнения" }, { status: 400 });
    }
    const result = await customerPortalService.resetPassword(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сброса пароля" }, { status: 500 });
  }
}
