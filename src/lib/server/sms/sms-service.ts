import "server-only";

import { detectCountryFromE164, isValidE164 } from "@/lib/phone-utils";
import type { SmsCountry, SmsProvider, SmsSendResult } from "./types";
import { mockSmsProvider } from "./mock-provider";
import { russianGatewaySmsProvider } from "./russian-gateway-provider";
import { fallbackGatewaySmsProvider } from "./fallback-gateway-provider";
import {
  clearRateLimitBuckets,
  consumeRateLimitBucket,
  sha256Hex,
} from "@/lib/server/security/rate-limiter";

export type RateLimitCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterSeconds: number;
      reason: "COOLDOWN" | "HOURLY_PHONE" | "HOURLY_IP" | "GLOBAL_PUMPING";
    };

export class SmsService {
  private primaryRuProvider: SmsProvider = russianGatewaySmsProvider;
  private fallbackProvider: SmsProvider = fallbackGatewaySmsProvider;
  private mockProvider = mockSmsProvider;

  /**
   * Resets persisted PostgreSQL OTP rate-limit buckets (intended for automated test isolation only).
   */
  async resetRateLimits(): Promise<void> {
    await clearRateLimitBuckets("otp:");
  }

  /**
   * Atomically enforces cooldown (60s), per-phone hourly limit (5/h),
   * per-IP hourly limit (10/h), and global anti-SMS-pumping threshold (60/min) in PostgreSQL.
   */
  async checkAndConsumeRateLimit(phone: string, ip?: string | null): Promise<RateLimitCheckResult> {
    const phoneHash = sha256Hex(phone);

    // 1. Cooldown check: 1 request per 60 seconds per phone
    const cooldown = await consumeRateLimitBucket({
      key: `otp:cooldown:${phoneHash}`,
      limit: 1,
      windowSeconds: 60,
    });
    if (!cooldown.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: cooldown.retryAfterSeconds,
        reason: "COOLDOWN",
      };
    }

    // 2. Per-phone hourly cap (max 5 requests per hour)
    const phoneHour = await consumeRateLimitBucket({
      key: `otp:hour:phone:${phoneHash}`,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!phoneHour.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: phoneHour.retryAfterSeconds,
        reason: "HOURLY_PHONE",
      };
    }

    // 3. Per-IP hourly cap (also applies to "unknown" to prevent header omission bypass)
    const normalizedIp = ip?.trim() || "unknown";
    const ipLimit = normalizedIp === "unknown" ? 20 : 10;
    const ipHour = await consumeRateLimitBucket({
      key: `otp:hour:ip:${sha256Hex(normalizedIp)}`,
      limit: ipLimit,
      windowSeconds: 3600,
    });
    if (!ipHour.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: ipHour.retryAfterSeconds,
        reason: "HOURLY_IP",
      };
    }

    // 4. Global anti-SMS-pumping circuit breaker (configurable via env, default 60/min)
    const globalPerMinute = Number(process.env.SMS_GLOBAL_LIMIT_PER_MINUTE || 60);
    const globalCheck = await consumeRateLimitBucket({
      key: "otp:global:minute",
      limit: Number.isFinite(globalPerMinute) && globalPerMinute > 0 ? globalPerMinute : 60,
      windowSeconds: 60,
    });
    if (!globalCheck.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: globalCheck.retryAfterSeconds,
        reason: "GLOBAL_PUMPING",
      };
    }

    return { allowed: true };
  }

  /**
   * Main dispatch method for sending one-time SMS verification code.
   */
  async sendOtp(params: {
    to: string; // E.164 phone number
    code: string;
    ip?: string | null;
  }): Promise<SmsSendResult> {
    const { to, code, ip } = params;

    if (!isValidE164(to)) {
      return {
        success: false,
        errorCode: "INVALID_PHONE",
        errorMessage: "Некорректный международный формат номера телефона.",
      };
    }

    // Atomic PostgreSQL rate limit & anti-pumping check BEFORE provider dispatch
    const rateCheck = await this.checkAndConsumeRateLimit(to, ip);
    if (!rateCheck.allowed) {
      const isCooldown = rateCheck.reason === "COOLDOWN";
      return {
        success: false,
        errorCode: isCooldown ? "RATE_LIMIT_COOLDOWN" : "RATE_LIMIT_HOURLY",
        errorMessage: isCooldown
          ? `Повторная отправка возможна через ${rateCheck.retryAfterSeconds} сек.`
          : `Превышен лимит запросов SMS. Попробуйте через ${Math.ceil(rateCheck.retryAfterSeconds / 60)} мин.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    const country = detectCountryFromE164(to) as SmsCountry;
    const text = `ZAPTUT.PRO: Ваш код подтверждения — ${code}. Действует 5 минут. Не сообщайте никому.`;

    const isExplicitMock = process.env.SMS_PROVIDER === "mock";
    const isDevOrTest = process.env.NODE_ENV !== "production" || isExplicitMock;

    let providerToUse: SmsProvider | null = null;

    if (country === "RU") {
      if (this.primaryRuProvider.isConfigured()) {
        providerToUse = this.primaryRuProvider;
      }
    } else {
      if (this.fallbackProvider.isConfigured()) {
        providerToUse = this.fallbackProvider;
      }
    }

    if (!providerToUse && isDevOrTest) {
      providerToUse = this.mockProvider;
    }

    if (!providerToUse) {
      return {
        success: false,
        errorCode: "SMS_NOT_CONFIGURED",
        errorMessage: "SMS_NOT_CONFIGURED: Провайдер SMS-уведомлений для данного региона не настроен в системе.",
      };
    }

    let result = await providerToUse.send({
      to,
      text,
      otp: code,
      country,
    });

    if (!result.success && providerToUse !== this.fallbackProvider && this.fallbackProvider.isConfigured()) {
      result = await this.fallbackProvider.send({
        to,
        text,
        otp: code,
        country,
      });
    }

    return result;
  }

  getMockStore() {
    return this.mockProvider;
  }
}

export const smsService = new SmsService();
