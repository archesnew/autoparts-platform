import { NextRequest, NextResponse } from "next/server";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";
import { auth } from "@/lib/server/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await customerPortalService.register(body);

    // Create session directly so customer is signed in immediately
    let sessionCookieHeaders: Headers | undefined;
    try {
      const signInRes = await auth.api.signInEmail({
        body: { email: body.email.trim().toLowerCase(), password: body.password },
        asResponse: true,
      });
      sessionCookieHeaders = signInRes.headers;
    } catch {
      // Fallback: registration succeeded, user can sign in
    }

    const response = NextResponse.json({ success: true, ...result }, { status: 201 });
    if (sessionCookieHeaders) {
      const cookies = sessionCookieHeaders.getSetCookie();
      for (const cookie of cookies) {
        response.headers.append("set-cookie", cookie);
      }
    }

    return response;
  } catch (error) {
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Внутренняя ошибка регистрации" }, { status: 500 });
  }
}
