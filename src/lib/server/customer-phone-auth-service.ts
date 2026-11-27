import "server-only";

import { randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/server/db";
import { auth } from "@/lib/server/auth";
import { formatPhoneDisplay, isValidE164, normalizeToE164 } from "@/lib/phone-utils";
import { smsService } from "@/lib/server/sms/sms-service";
import { sha256Hex } from "@/lib/server/security/rate-limiter";
import { serializeSignedCookie } from "better-call";

export type PhoneOtpSendResult =
  | { success: true; cooldownSeconds: number; normalizedPhone: string }
  | {
      success: false;
      error: "INVALID_PHONE" | "RATE_LIMIT_COOLDOWN" | "RATE_LIMIT_HOURLY" | "SMS_NOT_CONFIGURED" | "SEND_FAILED";
      message: string;
      retryAfterSeconds?: number;
    };

export type PhoneOtpVerifyResult =
  | {
      success: true;
      user: {
        id: string;
        name: string;
        phoneNumber: string;
      };
      customerId: string;
      sessionCookieHeaders?: Headers;
    }
  | {
      success: false;
      error:
        | "INVALID_PHONE"
        | "EXPIRED_OR_NOT_FOUND"
        | "MAX_ATTEMPTS_EXCEEDED"
        | "INVALID_CODE"
        | "USER_INACTIVE"
        | "ROLE_MISMATCH"
        | "CUSTOMER_CONFLICT";
      message: string;
      remainingAttempts?: number;
    };

type StoredOtpPayload = {
  codeHash: string;
  attempts: number;
  createdAt: number;
};

const OTP_MAX_ATTEMPTS = 3;
const OTP_TTL_MS = 5 * 60 * 1000;

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Resolves controlled mock OTP strictly from server-only env vars for designated staging test phones.
 * Never returns any code to clients, never grants access outside explicit allowlist, and only active in mock mode.
 */
function resolveControlledTestOtp(normalizedPhone: string): string | null {
  if (process.env.SMS_PROVIDER !== "mock") return null;

  const rawPhones = process.env.PHONE_AUTH_TEST_PHONES || "";
  const testCode = (process.env.PHONE_AUTH_TEST_OTP_CODE || "").trim();
  if (!rawPhones.trim() || !/^\d{6}$/.test(testCode)) return null;

  const allowedSet = new Set(
    rawPhones
      .split(",")
      .map((p) => normalizeToE164(p.trim()))
      .filter((p): p is string => Boolean(p))
  );

  return allowedSet.has(normalizedPhone) ? testCode : null;
}

export class CustomerPhoneAuthService {
  /**
   * Request a 6-digit SMS OTP code for customer sign-in or phone change.
   * Never returns any OTP code in the public response.
   */
  async sendOtp(rawPhone: string, ip?: string | null): Promise<PhoneOtpSendResult> {
    const normalizedPhone = normalizeToE164(rawPhone);
    if (!normalizedPhone || !isValidE164(normalizedPhone)) {
      return {
        success: false,
        error: "INVALID_PHONE",
        message: "Некорректный номер телефона. Поддерживаются номера России (+7), Беларуси (+375) и Польши (+48).",
      };
    }

    // 1. Generate 6-digit random code (or server-configured code for explicit test allowlist in mock mode)
    const controlledCode = resolveControlledTestOtp(normalizedPhone);
    const code = controlledCode ?? randomInt(100000, 1000000).toString();

    // 2. Dispatch SMS via smsService (atomic PostgreSQL cooldown, IP/phone limits & anti-pumping)
    const smsResult = await smsService.sendOtp({
      to: normalizedPhone,
      code,
      ip,
    });

    if (!smsResult.success) {
      if (smsResult.errorCode === "SMS_NOT_CONFIGURED") {
        return {
          success: false,
          error: "SMS_NOT_CONFIGURED",
          message: "SMS_NOT_CONFIGURED: Провайдер SMS-уведомлений для данного региона не настроен в системе.",
        };
      }
      if (smsResult.errorCode === "RATE_LIMIT_COOLDOWN") {
        return {
          success: false,
          error: "RATE_LIMIT_COOLDOWN",
          message: smsResult.errorMessage,
          retryAfterSeconds: smsResult.retryAfterSeconds,
        };
      }
      if (smsResult.errorCode === "RATE_LIMIT_HOURLY") {
        return {
          success: false,
          error: "RATE_LIMIT_HOURLY",
          message: smsResult.errorMessage,
          retryAfterSeconds: smsResult.retryAfterSeconds,
        };
      }
      return {
        success: false,
        error: "SEND_FAILED",
        message: smsResult.errorMessage || "Не удалось отправить SMS-код. Повторите попытку позже.",
      };
    }

    // 3. Store hashed OTP challenge in Verification table (TTL 5 minutes)
    const identifier = `phone_otp:${normalizedPhone}`;
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const payload: StoredOtpPayload = {
      codeHash: sha256Hex(`${normalizedPhone}:${code}`),
      attempts: 0,
      createdAt: Date.now(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.verification.deleteMany({ where: { identifier } });
      await tx.verification.create({
        data: {
          id: randomUUID(),
          identifier,
          value: JSON.stringify(payload),
          expiresAt,
        },
      });
    });

    return {
      success: true,
      cooldownSeconds: 60,
      normalizedPhone,
    };
  }

  /**
   * Atomically verifies and consumes an issued OTP challenge under a row-level PostgreSQL lock (`FOR UPDATE`).
   * Eliminates replay and parallel brute-force race conditions. Does NOT create users or profiles.
   */
  private async verifyAndConsumeOtpChallenge(
    normalizedPhone: string,
    cleanCode: string
  ): Promise<
    | { ok: true }
    | {
        ok: false;
        error: "EXPIRED_OR_NOT_FOUND" | "MAX_ATTEMPTS_EXCEEDED" | "INVALID_CODE";
        message: string;
        remainingAttempts?: number;
      }
  > {
    const identifier = `phone_otp:${normalizedPhone}`;
    const expectedHash = sha256Hex(`${normalizedPhone}:${cleanCode}`);
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; value: string; expiresAt: Date }>
      >`
        SELECT id, value, "expiresAt"
        FROM verifications
        WHERE identifier = ${identifier}
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `;

      const record = rows[0];
      if (!record || new Date(record.expiresAt).getTime() <= now.getTime()) {
        if (record) {
          await tx.verification.deleteMany({ where: { id: record.id } });
        }
        return {
          ok: false,
          error: "EXPIRED_OR_NOT_FOUND",
          message: "Срок действия кода подтверждения (5 минут) истёк или код не был запрошен.",
        };
      }

      let payload: StoredOtpPayload;
      try {
        payload = JSON.parse(record.value) as StoredOtpPayload;
      } catch {
        await tx.verification.deleteMany({ where: { id: record.id } });
        return {
          ok: false,
          error: "EXPIRED_OR_NOT_FOUND",
          message: "Ошибка сессии верификации. Запросите новый код.",
        };
      }

      if (payload.attempts >= OTP_MAX_ATTEMPTS) {
        await tx.verification.deleteMany({ where: { id: record.id } });
        return {
          ok: false,
          error: "MAX_ATTEMPTS_EXCEEDED",
          message: "Превышено максимальное количество попыток ввода (3). Запросите новый код.",
        };
      }

      const isCodeValid = Boolean(payload.codeHash) && safeEqualHex(payload.codeHash, expectedHash);
      if (!isCodeValid) {
        const nextAttempts = payload.attempts + 1;
        if (nextAttempts >= OTP_MAX_ATTEMPTS) {
          await tx.verification.deleteMany({ where: { id: record.id } });
          return {
            ok: false,
            error: "MAX_ATTEMPTS_EXCEEDED",
            message: "Превышено максимальное число попыток (3). Запросите новый код.",
            remainingAttempts: 0,
          };
        }

        await tx.verification.update({
          where: { id: record.id },
          data: {
            value: JSON.stringify({ ...payload, attempts: nextAttempts }),
          },
        });

        return {
          ok: false,
          error: "INVALID_CODE",
          message: `Неверный код подтверждения. Осталось попыток: ${OTP_MAX_ATTEMPTS - nextAttempts}.`,
          remainingAttempts: OTP_MAX_ATTEMPTS - nextAttempts,
        };
      }

      // Single-use OTP: atomically delete inside the same locked transaction
      const deleted = await tx.verification.deleteMany({ where: { id: record.id } });
      if (deleted.count !== 1) {
        return {
          ok: false,
          error: "EXPIRED_OR_NOT_FOUND",
          message: "Код подтверждения уже использован. Запросите новый код.",
        };
      }

      return { ok: true };
    }, { maxWait: 15000, timeout: 15000 });
  }

  /**
   * Verifies the 6-digit OTP code, creates or logs in the CUSTOMER account,
   * safely links the PostgreSQL Customer profile (strictly by verified phone), and issues a Better Auth session.
   */
  async verifyOtp(params: {
    rawPhone: string;
    code: string;
  }): Promise<PhoneOtpVerifyResult> {
    const { rawPhone, code } = params;
    const normalizedPhone = normalizeToE164(rawPhone);
    if (!normalizedPhone || !isValidE164(normalizedPhone)) {
      return {
        success: false,
        error: "INVALID_PHONE",
        message: "Некорректный формат номера телефона.",
      };
    }

    const cleanCode = code.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      return {
        success: false,
        error: "INVALID_CODE",
        message: "Код подтверждения должен состоять из 6 цифр.",
      };
    }

    const challenge = await this.verifyAndConsumeOtpChallenge(normalizedPhone, cleanCode);
    if (!challenge.ok) {
      return {
        success: false,
        error: challenge.error,
        message: challenge.message,
        remainingAttempts: challenge.remainingAttempts,
      };
    }

    // Check role BEFORE issuing or mutating any non-CUSTOMER account (never allow staff/SUPER_ADMIN OTP login)
    let user = await prisma.user.findFirst({
      where: { phoneNumber: normalizedPhone },
      include: { customer: true },
    });

    if (user) {
      if (!user.active) {
        return {
          success: false,
          error: "USER_INACTIVE",
          message: "Учётная запись покупателя деактивирована.",
        };
      }
      if (user.role !== "CUSTOMER") {
        return {
          success: false,
          error: "ROLE_MISMATCH",
          message: "Данный номер привязан к служебному аккаунту и не может использоваться в личном кабинете покупателя.",
        };
      }
      if (!user.phoneNumberVerified) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phoneNumberVerified: true },
          include: { customer: true },
        });
      }
    } else {
      const defaultName = `Покупатель ${formatPhoneDisplay(normalizedPhone)}`;
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          name: defaultName,
          email: null,
          phoneNumber: normalizedPhone,
          phoneNumberVerified: true,
          role: "CUSTOMER",
          active: true,
          emailVerified: false,
        },
        include: { customer: true },
      });
    }

    // Safe Customer Profile Linking (strictly by verified phone, unambiguous single match only)
    let customerId: string;
    if (user.customer) {
      customerId = user.customer.id;
    } else {
      const matchingProfiles = await prisma.customer.findMany({
        where: { normalizedPhone },
      });

      if (matchingProfiles.length === 1) {
        const singleMatch = matchingProfiles[0];
        if (singleMatch.userId && singleMatch.userId !== user.id) {
          return {
            success: false,
            error: "CUSTOMER_CONFLICT",
            message: "Конфликт профилей покупателя: данный телефон уже связан с другим аккаунтом.",
          };
        }
        const updated = await prisma.customer.update({
          where: { id: singleMatch.id },
          data: { userId: user.id, phone: normalizedPhone },
        });
        customerId = updated.id;
      } else if (matchingProfiles.length === 0) {
        const created = await prisma.customer.create({
          data: {
            name: user.name,
            phone: normalizedPhone,
            normalizedPhone,
            userId: user.id,
          },
        });
        customerId = created.id;
      } else {
        // Multiple profiles share this phone: refuse automatic merge to prevent cross-account data exposure
        const createdConflictCustomer = await prisma.customer.create({
          data: {
            name: user.name,
            phone: normalizedPhone,
            normalizedPhone,
            userId: user.id,
            internalNote: `[AUTO-CONFLICT] Обнаружено ${matchingProfiles.length} существующих профилей с номером ${normalizedPhone}. Автоматическое объединение остановлено.`,
          },
        });
        customerId = createdConflictCustomer.id;
      }
    }

    // Issue Better Auth Session
    let sessionCookieHeaders: Headers | undefined;
    try {
      const authWithContext = auth as unknown as {
        $context: Promise<{
          internalAdapter: { createSession: (userId: string) => Promise<{ token: string }> };
          authCookies: { sessionToken: { name: string; attributes: Record<string, unknown> } };
          secret: string;
        }>;
      };
      const authCtx = await authWithContext.$context;
      const session = await authCtx.internalAdapter.createSession(user.id);
      const cookieConfig = authCtx.authCookies.sessionToken;
      const signedSetCookie = await serializeSignedCookie(
        cookieConfig.name,
        session.token,
        authCtx.secret,
        cookieConfig.attributes
      );
      sessionCookieHeaders = new Headers();
      sessionCookieHeaders.append("set-cookie", signedSetCookie);
    } catch (e) {
      console.error("SESSION_CREATION_ERROR:", e);
    }

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        phoneNumber: normalizedPhone,
      },
      customerId,
      sessionCookieHeaders,
    };
  }

  /**
   * Safe phone number change for an existing CUSTOMER:
   * - Verifies uniqueness against both User and Customer tables before consuming OTP
   * - Consumes OTP strictly without creating any duplicate or orphaned User/Customer records
   * - Updates current User + Customer in a single transaction
   */
  async changePhone(params: {
    userId: string;
    rawNewPhone: string;
    code: string;
  }): Promise<{ success: true; newPhone: string } | { success: false; message: string }> {
    const { userId, rawNewPhone, code } = params;
    const normalizedNewPhone = normalizeToE164(rawNewPhone);
    if (!normalizedNewPhone || !isValidE164(normalizedNewPhone)) {
      return { success: false, message: "Некорректный новый номер телефона." };
    }

    const cleanCode = code.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      return { success: false, message: "Код подтверждения должен состоять из 6 цифр." };
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, phoneNumber: true },
    });
    if (!currentUser || currentUser.role !== "CUSTOMER") {
      return { success: false, message: "Смена номера доступна только для аккаунта покупателя." };
    }

    if (currentUser.phoneNumber === normalizedNewPhone) {
      return { success: false, message: "Указанный номер уже привязан к вашему аккаунту." };
    }

    // Check conflicts across BOTH User and Customer tables (including unlinked userId: null profiles)
    const [existingOtherUser, conflictingCustomer] = await Promise.all([
      prisma.user.findFirst({
        where: {
          phoneNumber: normalizedNewPhone,
          id: { not: userId },
        },
        select: { id: true },
      }),
      prisma.customer.findFirst({
        where: {
          normalizedPhone: normalizedNewPhone,
          OR: [{ userId: null }, { userId: { not: userId } }],
        },
        select: { id: true, userId: true },
      }),
    ]);

    if (existingOtherUser || conflictingCustomer) {
      return { success: false, message: "Данный номер телефона уже используется другим профилем." };
    }

    // Verify and consume OTP for the new phone WITHOUT creating a second User or Customer
    const challenge = await this.verifyAndConsumeOtpChallenge(normalizedNewPhone, cleanCode);
    if (!challenge.ok) {
      return { success: false, message: challenge.message };
    }

    // Re-check uniqueness & atomically update current User and linked Customer
    try {
      await prisma.$transaction(async (tx) => {
        const [conflictUserTx, conflictCustTx] = await Promise.all([
          tx.user.findFirst({
            where: { phoneNumber: normalizedNewPhone, id: { not: userId } },
            select: { id: true },
          }),
          tx.customer.findFirst({
            where: {
              normalizedPhone: normalizedNewPhone,
              OR: [{ userId: null }, { userId: { not: userId } }],
            },
            select: { id: true },
          }),
        ]);
        if (conflictUserTx || conflictCustTx) {
          throw new Error("PHONE_CONFLICT");
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            phoneNumber: normalizedNewPhone,
            phoneNumberVerified: true,
          },
        });

        await tx.customer.updateMany({
          where: { userId },
          data: {
            phone: normalizedNewPhone,
            normalizedPhone: normalizedNewPhone,
          },
        });
      }, { maxWait: 15000, timeout: 15000 });
    } catch (err) {
      if (err instanceof Error && err.message === "PHONE_CONFLICT") {
        return { success: false, message: "Данный номер телефона уже используется другим профилем." };
      }
      throw err;
    }

    return { success: true, newPhone: normalizedNewPhone };
  }
}

export const customerPhoneAuthService = new CustomerPhoneAuthService();
