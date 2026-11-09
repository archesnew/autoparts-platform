import type { SmsProvider, SmsSendInput, SmsSendResult } from "./types";

/**
 * Fallback / International SMS Provider (for Belarus +375, Poland +48, and international numbers)
 */
export class FallbackGatewaySmsProvider implements SmsProvider {
  readonly name = "FallbackInternationalGateway";

  private apiKey: string | null;
  private endpoint: string | null;

  constructor() {
    this.apiKey = process.env.SMS_FALLBACK_API_KEY || null;
    this.endpoint = process.env.SMS_FALLBACK_URL || null;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.endpoint);
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        errorCode: "SMS_NOT_CONFIGURED",
        errorMessage: "Резервный международный SMS-провайдер не настроен.",
      };
    }

    try {
      const res = await fetch(this.endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          to: input.to,
          message: input.text,
          sender: "ZAPTUT",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          success: false,
          errorCode: "PROVIDER_ERROR",
          errorMessage: data?.error || `Резервный шлюз вернул ошибку ${res.status}`,
        };
      }

      return {
        success: true,
        messageId: data?.id || `intl-sms-${Date.now()}`,
        provider: this.name,
      };
    } catch (err) {
      return {
        success: false,
        errorCode: "PROVIDER_ERROR",
        errorMessage: err instanceof Error ? err.message : "Ошибка обращения к резервному SMS-шлюзу",
      };
    }
  }
}

export const fallbackGatewaySmsProvider = new FallbackGatewaySmsProvider();
