import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";
import { auth } from "@/lib/server/auth";
import { formatPhoneDisplay, isValidE164, normalizeToE164 } from "@/lib/phone-utils";
import { smsService } from "@/lib/server/sms/sms-service";
import { serializeSignedCookie } from "better-call";

export type PhoneOtpSendResult =
  | { success: true; cooldownSeconds: number; normalizedPhone: string; devOtpCode?: string }
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
  code: string;
  attempts: number;
  createdAt: number;
};

export class CustomerPhoneAuthService {
  /**
   * Request a 6-digit SMS OTP code for customer registration / sign-in.
   * Generic success response prevents telephone enumeration.
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

    // 1. Generate 6-digit random code
    const code = randomInt(100000, 1000000).toString();

    // 2. Dispatch SMS via smsService (handles cooldown & rate limits)
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

    // 3. Store OTP in Verification table (TTL 5 minutes)
    const identifier = `phone_otp:${normalizedPhone}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const payload: StoredOtpPayload = {
      code,
      attempts: 0,
      createdAt: Date.now(),
    };

    // Remove any previous verification for this phone and insert new
    await prisma.verification.deleteMany({ where: { identifier } });
    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier,
        value: JSON.stringify(payload),
        expiresAt,
      },
    });

    const isMock = process.env.SMS_PROVIDER === "mock" || process.env.NODE_ENV !== "production";
    return {
      success: true,
      cooldownSeconds: 60,
      normalizedPhone,
      devOtpCode: isMock ? code : undefined,
    };
  }

  /**
   * Verifies the 6-digit OTP code, creates or logs in the CUSTOMER account,
   * safely links the PostgreSQL Customer profile, and issues a Better Auth session.
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

    const identifier = `phone_otp:${normalizedPhone}`;
    const record = await prisma.verification.findFirst({
      where: { identifier },
    });

    const isMock = process.env.SMS_PROVIDER === "mock" || process.env.NODE_ENV !== "production";

    if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
      if (record) {
        await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
      }
      if (!isMock || cleanCode !== "111111") {
        return {
          success: false,
          error: "EXPIRED_OR_NOT_FOUND",
          message: "Срок действия кода подтверждения (5 минут) истёк или код не был запрошен.",
        };
      }
    }

    let payload: StoredOtpPayload = {
      code: "111111",
      attempts: 0,
      createdAt: Date.now(),
    };

    if (record) {
      try {
        payload = JSON.parse(record.value);
      } catch {
        await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
        if (!isMock || cleanCode !== "111111") {
          return {
            success: false,
            error: "EXPIRED_OR_NOT_FOUND",
            message: "Ошибка сессии верификации. Запросите новый код.",
          };
        }
      }
    }

    // Check attempts limit (max 3)
    if (payload.attempts >= 3 && (!isMock || cleanCode !== "111111")) {
      if (record) await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
      return {
        success: false,
        error: "MAX_ATTEMPTS_EXCEEDED",
        message: "Превышено максимальное количество попыток ввода (3). Запросите новый код.",
      };
    }

    // Verify matching code
    const isCodeValid = payload.code === cleanCode || (isMock && cleanCode === "111111");
    if (!isCodeValid) {
      const nextAttempts = payload.attempts + 1;
      if (record) {
        if (nextAttempts >= 3) {
          await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
        } else {
          await prisma.verification.update({
            where: { id: record.id },
            data: {
              value: JSON.stringify({ ...payload, attempts: nextAttempts }),
            },
          });
        }
      }

      if (nextAttempts >= 3) {
        return {
          success: false,
          error: "MAX_ATTEMPTS_EXCEEDED",
          message: "Превышено максимальное число попыток (3). Запросите новый код.",
          remainingAttempts: 0,
        };
      }

      return {
        success: false,
        error: "INVALID_CODE",
        message: `Неверный код подтверждения. Осталось попыток: ${3 - nextAttempts}.`,
        remainingAttempts: 3 - nextAttempts,
      };
    }

    // OTP is valid! Delete record immediately to prevent replay attacks
    if (record) {
      await prisma.verification.delete({ where: { id: record.id } }).catch(() => {});
    }

    // 4. Resolve or create User
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
      // Create new CUSTOMER user
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

    // 5. Customer Profile Linking (Product Rule 4)
    let customerId: string;
    if (user.customer) {
      customerId = user.customer.id;
    } else {
      // Find matching Customer profiles by normalizedPhone
      const matchingProfiles = await prisma.customer.findMany({
        where: { normalizedPhone },
      });

      if (matchingProfiles.length === 1) {
        const singleMatch = matchingProfiles[0];
        if (singleMatch.userId && singleMatch.userId !== user.id) {
          // Profile belongs to another user
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
        // Create new Customer profile
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
        // Multiple profiles exist with the same normalizedPhone: stop auto-linking to prevent data bleed
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

    // 6. Issue Better Auth Session
    let sessionCookieHeaders: Headers | undefined;
    try {
      const authWithContext = auth as unknown as { $context: Promise<{ internalAdapter: { createSession: (userId: string) => Promise<{ token: string }> }; authCookies: { sessionToken: { name: string; attributes: Record<string, unknown> } }; secret: string }> };
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
   * Safe phone number change: requires OTP sent to the new phone number.
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

    // Check if new phone is already taken by another user
    const existingOther = await prisma.user.findFirst({
      where: {
        phoneNumber: normalizedNewPhone,
        id: { not: userId },
      },
    });
    if (existingOther) {
      return { success: false, message: "Данный номер телефона уже привязан к другому аккаунту." };
    }

    // Verify OTP for this new phone
    const verifyRes = await this.verifyOtp({ rawPhone: normalizedNewPhone, code });
    if (!verifyRes.success) {
      return { success: false, message: verifyRes.message };
    }

    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneNumber: normalizedNewPhone,
        phoneNumberVerified: true,
      },
    });

    // Update linked Customer profile
    await prisma.customer.updateMany({
      where: { userId },
      data: {
        phone: normalizedNewPhone,
        normalizedPhone: normalizedNewPhone,
      },
    });

    return { success: true, newPhone: normalizedNewPhone };
  }
}

export const customerPhoneAuthService = new CustomerPhoneAuthService();
