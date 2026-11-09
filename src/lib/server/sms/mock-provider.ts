import type { SmsProvider, SmsSendInput, SmsSendResult } from "./types";

type SentMessage = {
  to: string;
  otp: string;
  text: string;
  sentAt: Date;
  messageId: string;
};

class MockSmsProvider implements SmsProvider {
  readonly name = "MockSmsProvider (Development & Test)";
  private messages: Map<string, SentMessage[]> = new Map();

  isConfigured(): boolean {
    return true;
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const messageId = `mock-sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: SentMessage = {
      to: input.to,
      otp: input.otp,
      text: input.text,
      sentAt: new Date(),
      messageId,
    };

    const existing = this.messages.get(input.to) || [];
    existing.push(record);
    this.messages.set(input.to, existing);

    // In non-production, log cleanly without leaking outside local dev
    if (process.env.NODE_ENV !== "production") {
      console.log(`[TEST/DEV SMS ADAPTER] Sent OTP to ${input.to}: code = ${input.otp}`);
    }

    return {
      success: true,
      messageId,
      provider: this.name,
    };
  }

  getLatestOtp(phone: string): string | null {
    const list = this.messages.get(phone);
    if (!list || list.length === 0) return null;
    return list[list.length - 1].otp;
  }

  getAllForPhone(phone: string): SentMessage[] {
    return this.messages.get(phone) || [];
  }

  clear() {
    this.messages.clear();
  }
}

export const mockSmsProvider = new MockSmsProvider();
