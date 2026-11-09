import { detectCountryFromE164, isValidE164 } from "@/lib/phone-utils";
import type { SmsCountry, SmsProvider, SmsSendResult } from "./types";
import { mockSmsProvider } from "./mock-provider";
import { russianGatewaySmsProvider } from "./russian-gateway-provider";
import { fallbackGatewaySmsProvider } from "./fallback-gateway-provider";

export type RateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: "COOLDOWN" | "HOURLY_PHONE" | "HOURLY_IP" };

type PhoneRateRecord = {
  lastSentAt: number;
  hourlyRequests: number[];
};

type IpRateRecord = {
  hourlyRequests: number[];
};

export class SmsService {
  private primaryRuProvider: SmsProvider = russianGatewaySmsProvider;
  private fallbackProvider: SmsProvider = fallbackGatewaySmsProvider;
  private mockProvider = mockSmsProvider;

  // In-memory rate limiting state
  private phoneRateMap = new Map<string, PhoneRateRecord>();
  private ipRateMap = new Map<string, IpRateRecord>();

  /**
   * Resets rate limits (useful in tests)
   */
  resetRateLimits() {
    this.phoneRateMap.clear();
    this.ipRateMap.clear();
  }

  /**
   * Enforces 60-second cooldown and hourly limits per phone and per IP
   */
  checkRateLimit(phone: string, ip?: string | null): RateLimitCheckResult {
    const now = Date.now();

    // 1. Phone rate limit
    let pRecord = this.phoneRateMap.get(phone);
    if (!pRecord) {
      pRecord = { lastSentAt: 0, hourlyRequests: [] };
      this.phoneRateMap.set(phone, pRecord);
    }

    // Cooldown check: 60 seconds
    const diffSeconds = Math.floor((now - pRecord.lastSentAt) / 1000);
    if (diffSeconds < 60 && pRecord.lastSentAt > 0) {
      return {
        allowed: false,
        retryAfterSeconds: 60 - diffSeconds,
        reason: "COOLDOWN",
      };
    }

    // Hourly limit: max 5 requests per hour
    const oneHourAgo = now - 60 * 60 * 1000;
    pRecord.hourlyRequests = pRecord.hourlyRequests.filter((t) => t > oneHourAgo);
    if (pRecord.hourlyRequests.length >= 5) {
      const oldest = pRecord.hourlyRequests[0];
      const retryAfter = Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfter),
        reason: "HOURLY_PHONE",
      };
    }

    // 2. IP rate limit (if provided)
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      let ipRecord = this.ipRateMap.get(ip);
      if (!ipRecord) {
        ipRecord = { hourlyRequests: [] };
        this.ipRateMap.set(ip, ipRecord);
      }
      ipRecord.hourlyRequests = ipRecord.hourlyRequests.filter((t) => t > oneHourAgo);
      if (ipRecord.hourlyRequests.length >= 15) {
        const oldest = ipRecord.hourlyRequests[0];
        const retryAfter = Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, retryAfter),
          reason: "HOURLY_IP",
        };
      }
    }

    return { allowed: true };
  }

  private recordSend(phone: string, ip?: string | null) {
    const now = Date.now();
    let pRecord = this.phoneRateMap.get(phone);
    if (!pRecord) {
      pRecord = { lastSentAt: 0, hourlyRequests: [] };
      this.phoneRateMap.set(phone, pRecord);
    }
    pRecord.lastSentAt = now;
    pRecord.hourlyRequests.push(now);

    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      let ipRecord = this.ipRateMap.get(ip);
      if (!ipRecord) {
        ipRecord = { hourlyRequests: [] };
        this.ipRateMap.set(ip, ipRecord);
      }
      ipRecord.hourlyRequests.push(now);
    }
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

    // Rate limit check
    const rateCheck = this.checkRateLimit(to, ip);
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

    // Determine target provider
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

    // In dev / test or when SMS_PROVIDER=mock, allow designated test adapter
    if (!providerToUse && isDevOrTest) {
      providerToUse = this.mockProvider;
    }

    // In production, if provider credentials are not set, return explicit SMS_NOT_CONFIGURED error
    if (!providerToUse) {
      return {
        success: false,
        errorCode: "SMS_NOT_CONFIGURED",
        errorMessage: "SMS_NOT_CONFIGURED: Провайдер SMS-уведомлений для данного региона не настроен в системе.",
      };
    }

    // Execute send
    let result = await providerToUse.send({
      to,
      text,
      otp: code,
      country,
    });

    // If primary failed and fallback is configured and different, try fallback
    if (!result.success && providerToUse !== this.fallbackProvider && this.fallbackProvider.isConfigured()) {
      result = await this.fallbackProvider.send({
        to,
        text,
        otp: code,
        country,
      });
    }

    if (result.success) {
      this.recordSend(to, ip);
    }

    return result;
  }

  getMockStore() {
    return this.mockProvider;
  }
}

export const smsService = new SmsService();
