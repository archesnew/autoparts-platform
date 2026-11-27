import { NextRequest, NextResponse } from "next/server";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";
import { extractTrustedClientIp } from "@/lib/server/security/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.email || typeof body.email !== "string") {
      return NextResponse.json({ error: "Укажите email" }, { status: 400 });
    }
    const ip = extractTrustedClientIp(req.headers);
    const result = await customerPortalService.requestPasswordReset(body.email, ip);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Внутренняя ошибка запроса сброса" }, { status: 500 });
  }
}
