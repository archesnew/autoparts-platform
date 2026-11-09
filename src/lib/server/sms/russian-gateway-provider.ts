import type { SmsProvider, SmsSendInput, SmsSendResult } from "./types";

/**
 * Primary Russian SMS Gateway Provider (for +7 mobile operators)
 * Ready for integration with SMS.ru, SMS Aero, Stream Telecom, or SMSC.
 */
export class RussianGatewaySmsProvider implements SmsProvider {
  readonly name = "RussianGateway (SMS.ru / SMS Aero / SMSC)";

  private apiKey: string | null;
  private apiLogin: string | null;
  private senderName: string | null;

  constructor() {
    this.apiKey = process.env.SMS_RU_API_KEY || process.env.SMS_AERO_API_KEY || process.env.SMS_GATEWAY_API_KEY || null;
    this.apiLogin = process.env.SMS_RU_LOGIN || process.env.SMS_GATEWAY_LOGIN || null;
    this.senderName = process.env.SMS_SENDER_NAME || "ZAPTUT";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorCode: "SMS_NOT_CONFIGURED",
        errorMessage: "Основной SMS-провайдер для России не настроен (отсутствуют API ключи в окружении).",
      };
    }

    try {
      // Prepared gateway endpoint integration (e.g. SMS.ru / SMS Aero)
      const endpoint = process.env.SMS_GATEWAY_URL || "https://sms.ru/sms/send";
      const params = new URLSearchParams({
        api_id: this.apiKey!,
        to: input.to,
        msg: input.text,
        json: "1",
        from: this.senderName || "ZAPTUT",
      });

      const res = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.status !== "OK" && data.status_code !== 100)) {
        return {
          success: false,
          errorCode: "PROVIDER_ERROR",
          errorMessage: data?.status_text || `Ошибка отправки через SMS шлюз (код ${res.status})`,
        };
      }

      return {
        success: true,
        messageId: String(data?.sms?.[input.to]?.sms_id || `ru-sms-${Date.now()}`),
        provider: this.name,
      };
    } catch (err) {
      return {
        success: false,
        errorCode: "PROVIDER_ERROR",
        errorMessage: err instanceof Error ? err.message : "Сетевая ошибка при обращении к SMS-шлюзу",
      };
    }
  }
}

export const russianGatewaySmsProvider = new RussianGatewaySmsProvider();
