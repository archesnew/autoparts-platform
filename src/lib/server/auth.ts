import "server-only";

import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/server/db";

const authSecret = process.env.BETTER_AUTH_SECRET;
if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set to a random secret of at least 32 characters.");
}

const authUrl = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000";

export const auth = betterAuth({
  appName: "ZAPTUT.PRO",
  baseURL: authUrl,
  secret: authSecret,
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  trustedOrigins: [
    authUrl,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const body = ctx.body as { email?: unknown } | undefined;
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email) return;
      const user = await prisma.user.findUnique({ where: { email }, select: { active: true } });
      if (!user?.active) throw new APIError("UNAUTHORIZED", { message: "Invalid credentials" });
    }),
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, input: false, defaultValue: "MANAGER" },
      active: { type: "boolean", required: true, input: false, defaultValue: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: false,
  },
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "zaptut",
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
