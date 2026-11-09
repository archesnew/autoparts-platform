import { NextRequest, NextResponse } from "next/server";
import { customerPhoneAuthService } from "@/lib/server/customer-phone-auth-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!rawPhone || !code) {
      return NextResponse.json(
        { error: "Укажите номер телефона и код подтверждения." },
        { status: 400 }
      );
    }

    const result = await customerPhoneAuthService.verifyOtp({
      rawPhone,
      code,
    });

    if (!result.success) {
      const status =
        result.error === "MAX_ATTEMPTS_EXCEEDED"
          ? 429
          : result.error === "EXPIRED_OR_NOT_FOUND"
            ? 410
            : result.error === "USER_INACTIVE" || result.error === "ROLE_MISMATCH"
              ? 403
              : 400;

      return NextResponse.json(
        {
          error: result.message,
          code: result.error,
          remainingAttempts: result.remainingAttempts,
        },
        { status }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      customerId: result.customerId,
    });

    // Attach session cookies from Better Auth
    if (result.sessionCookieHeaders) {
      const cookies = result.sessionCookieHeaders.getSetCookie();
      for (const cookie of cookies) {
        response.headers.append("set-cookie", cookie);
      }
    }

    return response;
  } catch (err) {
    console.error("VERIFY_OTP_ROUTE_ERROR:", err);
    return NextResponse.json(
      { error: "Внутренняя ошибка проверки кода." },
      { status: 500 }
    );
  }
}
