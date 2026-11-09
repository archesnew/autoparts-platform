export type SmsCountry = "RU" | "BY" | "PL" | "OTHER";

export type SmsErrorCode =
  | "SMS_NOT_CONFIGURED"
  | "RATE_LIMIT_COOLDOWN"
  | "RATE_LIMIT_HOURLY"
  | "RATE_LIMIT_IP"
  | "INVALID_PHONE"
  | "PROVIDER_ERROR";

export type SmsSendInput = {
  to: string; // E.164 phone number
  text: string;
  otp: string;
  country: SmsCountry;
};

export type SmsSendResult =
  | {
      success: true;
      messageId: string;
      provider: string;
    }
  | {
      success: false;
      errorCode: SmsErrorCode;
      errorMessage: string;
      retryAfterSeconds?: number;
    };

export interface SmsProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}
