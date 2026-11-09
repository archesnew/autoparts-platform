import { NextRequest, NextResponse } from "next/server";
import { customerPhoneAuthService } from "@/lib/server/customer-phone-auth-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!rawPhone) {
      return NextResponse.json(
        { error: "Укажите номер телефона." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const result = await customerPhoneAuthService.sendOtp(rawPhone, ip);

    if (!result.success) {
      const status =
        result.error === "RATE_LIMIT_COOLDOWN" || result.error === "RATE_LIMIT_HOURLY"
          ? 429
          : result.error === "SMS_NOT_CONFIGURED"
            ? 503
            : 400;

      return NextResponse.json(
        {
          error: result.message,
          code: result.error,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      cooldownSeconds: result.cooldownSeconds,
      normalizedPhone: result.normalizedPhone,
      devOtpCode: "devOtpCode" in result ? result.devOtpCode : undefined,
    });
  } catch (err) {
    console.error("SEND_OTP_ROUTE_ERROR:", err);
    return NextResponse.json(
      { error: "Внутренняя ошибка отправки SMS-кода." },
      { status: 500 }
    );
  }
}
