import "server-only";

import { createHmac } from "node:crypto";

export type PaymentSessionRequest = {
  orderId: string;
  orderNumber: string;
  amountRub: number;
  customerPhone?: string | null;
  customerEmail?: string | null;
  returnUrl: string;
  description: string;
};

export type PaymentSessionResult = {
  sessionId: string;
  paymentUrl?: string;
  status: "PENDING" | "PAID" | "FAILED";
  manualInstructions?: string;
};

export type WebhookProcessResult = {
  success: boolean;
  orderId?: string;
  externalPaymentId?: string;
  status: "PAID" | "FAILED" | "PENDING";
  amount?: number;
};

export interface PaymentProvider {
  readonly code: string;
  readonly name: string;
  createSession(request: PaymentSessionRequest): Promise<PaymentSessionResult>;
  getStatus(externalPaymentId: string): Promise<"PENDING" | "PAID" | "FAILED">;
  verifyWebhook(rawPayload: string, signature: string): boolean;
  processWebhook(payload: Record<string, unknown>): Promise<WebhookProcessResult>;
}

/**
 * Manual bank transfer / invoicing provider (active for Staging & manual orders)
 */
export class ManualPaymentAdapter implements PaymentProvider {
  readonly code = "MANUAL_BANK_TRANSFER";
  readonly name = "Банковский перевод по согласованию";

  async createSession(request: PaymentSessionRequest): Promise<PaymentSessionResult> {
    return {
      sessionId: `manual_${request.orderId}_${Date.now()}`,
      status: "PENDING",
      manualInstructions: `Оплата заказа №${request.orderNumber} на сумму ${request.amountRub.toLocaleString("ru-RU")} ₽. Реквизиты и порядок перевода согласуются персональным менеджером.`,
    };
  }

  async getStatus(_externalPaymentId: string): Promise<"PENDING" | "PAID" | "FAILED"> {
    return "PENDING";
  }

  verifyWebhook(_rawPayload: string, _signature: string): boolean {
    return false;
  }

  async processWebhook(_payload: Record<string, unknown>): Promise<WebhookProcessResult> {
    return { success: false, status: "PENDING" };
  }
}

/**
 * Prepared architecture adapter for YooKassa / Russian Acquiring
 * Requires merchant account, shopId and secretKey when approved for commercial launch.
 */
export class YooKassaPaymentAdapter implements PaymentProvider {
  readonly code = "YOOKASSA";
  readonly name = "ЮKassa (Интернет-эквайринг, СБП, карты)";

  private readonly shopId: string | null;
  private readonly secretKey: string | null;

  constructor() {
    this.shopId = process.env.YOOKASSA_SHOP_ID || null;
    this.secretKey = process.env.YOOKASSA_SECRET_KEY || null;
  }

  isConfigured(): boolean {
    return Boolean(this.shopId && this.secretKey);
  }

  async createSession(request: PaymentSessionRequest): Promise<PaymentSessionResult> {
    if (!this.isConfigured()) {
      throw new Error("Платёжный шлюз ЮKassa не настроен в окружении (отсутствуют YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)");
    }
    // Future commercial API integration with idempotence key
    return {
      sessionId: `yk_${request.orderId}`,
      status: "PENDING",
    };
  }

  async getStatus(_externalPaymentId: string): Promise<"PENDING" | "PAID" | "FAILED"> {
    if (!this.isConfigured()) return "PENDING";
    return "PENDING";
  }

  verifyWebhook(rawPayload: string, signature: string): boolean {
    if (!this.secretKey) return false;
    const computed = createHmac("sha256", this.secretKey).update(rawPayload).digest("hex");
    return computed === signature;
  }

  async processWebhook(payload: Record<string, unknown>): Promise<WebhookProcessResult> {
    const event = payload.event as string | undefined;
    const object = payload.object as Record<string, unknown> | undefined;

    if (event === "payment.succeeded" && object) {
      const orderId = (object.metadata as Record<string, string>)?.orderId;
      const amount = Number((object.amount as Record<string, string>)?.value || 0);
      return {
        success: true,
        orderId,
        externalPaymentId: String(object.id || ""),
        status: "PAID",
        amount,
      };
    }

    return { success: false, status: "PENDING" };
  }
}

export const paymentRegistry = {
  manual: new ManualPaymentAdapter(),
  yookassa: new YooKassaPaymentAdapter(),
};
