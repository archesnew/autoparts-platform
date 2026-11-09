import { NextRequest, NextResponse } from "next/server";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.email || typeof body.email !== "string") {
      return NextResponse.json({ error: "Укажите email" }, { status: 400 });
    }
    const result = await customerPortalService.requestPasswordReset(body.email);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Внутренняя ошибка запроса сброса" }, { status: 500 });
  }
}
