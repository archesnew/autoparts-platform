import { prisma } from "./db.ts";
import { orderRepository } from "./order-repository.ts";
import { Prisma } from "@prisma/client";
import type {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  DeliveryStatus,
  OrderDocumentType,
} from "@prisma/client";
import type { StaffContext } from "./staff-session.ts";
import type {
  OrderDto,
  OrderItemDto,
  PaymentDto,
  ShipmentDto,
  OrderDocumentDto,
  OrderMessageDto,
  OrderListQuery,
} from "./order-types.ts";
import { initialFinancialConfig } from "../financial-config.ts";
import { randomUUID } from "node:crypto";
import { notificationService } from "./notification-service.ts";

export type { OrderDto, OrderItemDto, PaymentDto, ShipmentDto, OrderDocumentDto, OrderMessageDto };

function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function toOrderDto(
  order: any,
  callerStaff?: StaffContext | null
): OrderDto {
  const isSuperAdmin = callerStaff?.role === "SUPER_ADMIN";
  const canReadPurchase = isSuperAdmin || Boolean(callerStaff?.permissions?.includes("quotes.purchase.read"));
  const isLogistics = callerStaff?.role === "LOGISTICS";
  const canReadInternal = !isLogistics;

  const items: OrderItemDto[] = (order.items ?? []).map((item: any) => {
    const purchase = Number(item.purchasePrice);
    const sale = Number(item.salePrice);
    const profit = Number(item.grossProfit);
    const margin = sale > 0 ? ((profit / sale) * 100).toFixed(2) : "0.00";

    const dto: OrderItemDto = {
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      requestedPartNumber: item.requestedPartNumber,
      nameOnPurchase: item.nameOnPurchase,
      quantity: item.quantity,
      condition: item.condition,
      supplierOfferId: isLogistics ? undefined : item.supplierOfferId,
      supplierId: isLogistics ? undefined : item.supplierId,
      supplierName: isLogistics ? undefined : item.supplier?.name,
      supplierCountry: item.supplier?.countryCode,
      salePrice: isLogistics ? "0.00" : item.salePrice.toString(),
      totalAmount: isLogistics ? "0.00" : item.totalAmount.toString(),
    };

    if (canReadPurchase) {
      dto.purchasePrice = item.purchasePrice.toString();
      dto.purchaseCurrency = item.purchaseCurrency;
      dto.fxRate = item.fxRate;
      dto.supplierLogisticsCost = item.supplierLogisticsCost.toString();
      dto.markup = item.markup.toString();
      dto.grossProfit = item.grossProfit.toString();
      dto.marginPercent = margin;
      dto.financialSnapshot = item.financialSnapshot;
    }

    return dto;
  });

  const payments: PaymentDto[] = (order.payments ?? []).map((p: any) => ({
    id: p.id,
    orderId: p.orderId,
    amount: p.amount.toString(),
    currency: p.currency,
    paymentMethod: p.paymentMethod,
    status: p.status,
    externalPaymentId: p.externalPaymentId,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    notes: canReadInternal ? p.notes : null,
    history: p.history,
    createdAt: p.createdAt.toISOString(),
  }));

  const shipments: ShipmentDto[] = (order.shipments ?? []).map((s: any) => ({
    id: s.id,
    orderId: s.orderId,
    carrier: s.carrier,
    tariff: s.tariff,
    deliveryMethod: s.deliveryMethod,
    city: s.city,
    address: s.address,
    postalCode: s.postalCode,
    pickupPointId: s.pickupPointId,
    trackingNumber: s.trackingNumber,
    cost: s.cost.toString(),
    estimatedDays: s.estimatedDays,
    status: s.status,
    trackingHistory: s.trackingHistory,
    dispatchedAt: s.dispatchedAt ? s.dispatchedAt.toISOString() : null,
    deliveredAt: s.deliveredAt ? s.deliveredAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  }));

  const documents: OrderDocumentDto[] = (order.documents ?? []).map((d: any) => ({
    id: d.id,
    orderId: d.orderId,
    documentType: d.documentType,
    documentNumber: d.documentNumber,
    fileUrl: d.fileUrl,
    contentJson: d.contentJson,
    version: d.version,
    createdAt: d.createdAt.toISOString(),
  }));

  const messages: OrderMessageDto[] = (order.messages ?? [])
    .filter((m: any) => canReadInternal || !m.isInternal)
    .map((m: any) => ({
      id: m.id,
      orderId: m.orderId,
      senderType: m.senderType,
      isInternal: m.isInternal,
      message: m.message,
      attachments: m.attachments,
      authorName: m.authorName,
      createdAt: m.createdAt.toISOString(),
    }));

  const events = (order.activityEvents ?? []).map((evt: any) => ({
    at: formatDateRu(evt.occurredAt),
    text: `${evt.action}${evt.details?.note ? `: ${evt.details.note}` : ""}`,
    who: evt.actor?.name ?? "Система",
  }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    requestId: order.requestId,
    requestNumber: order.request?.number,
    customerId: order.customerId,
    customerName: order.customer.name,
    customerPhone: isLogistics ? null : order.customer.phone,
    customerEmail: isLogistics ? null : order.customer.email,
    assignedManagerId: order.assignedManagerId,
    assignedManagerName: order.assignedManager?.name,
    source: order.source,
    country: order.country,
    currency: order.currency,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    deliveryStatus: order.deliveryStatus,
    subtotal: isLogistics ? "0.00" : order.subtotal.toString(),
    logisticsTotal: isLogistics ? "0.00" : order.logisticsTotal.toString(),
    discountTotal: isLogistics ? "0.00" : order.discountTotal.toString(),
    taxTotal: isLogistics ? "0.00" : order.taxTotal.toString(),
    grandTotal: isLogistics ? "0.00" : order.grandTotal.toString(),
    customerComment: isLogistics ? null : order.customerComment,
    internalComment: canReadInternal ? order.internalComment : null,
    rejectionReason: order.rejectionReason,
    logisticsInstructions: order.logisticsInstructions,
    financialSnapshot: canReadPurchase ? order.financialSnapshot : undefined,
    items,
    payments: isLogistics ? [] : payments,
    shipments,
    documents,
    messages,
    events,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
  };
}

export const orderService = {
  async listOrders(query: OrderListQuery, callerStaff?: StaffContext | null) {
    const [{ orders, total, page, pageSize }, queues] = await Promise.all([
      orderRepository.findOrders(query),
      orderRepository.getQueueCounts(),
    ]);

    return {
      orders: orders.map((o) => toOrderDto(o, callerStaff)),
      total,
      page,
      pageSize,
      queues,
    };
  },

  async getOrder(idOrNumber: string, callerStaff?: StaffContext | null) {
    const order = await orderRepository.findOrderById(idOrNumber);
    if (!order) return null;
    return toOrderDto(order, callerStaff);
  },

  async createOrderFromRequest(args: {
    requestId: string;
    callerStaff?: StaffContext | null;
    deliveryDetails?: {
      carrier?: string;
      city?: string;
      address?: string;
      postalCode?: string;
      pickupPointId?: string;
      deliveryMethod?: string;
    };
    customerComment?: string;
    internalComment?: string;
  }) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.requestId);
    const request = await prisma.request.findFirst({
      where: isUuid ? { id: args.requestId } : { number: args.requestId },
      include: {
        customer: true,
        assignedManager: true,
        items: {
          include: {
            supplierQuotes: {
              include: { supplier: true },
            },
          },
        },
        offers: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!request) {
      throw new Error(`Заявка ${args.requestId} не найдена.`);
    }

    // Idempotency: check if an order already exists for this request
    const existingOrder = await orderRepository.findOrderByRequestId(request.id);
    if (existingOrder) {
      return this.getOrder(existingOrder.id, args.callerStaff);
    }

    const latestOffer = request.offers[0];
    const snapshot = (latestOffer?.snapshot as any) ?? null;

    // Next order number
    const count = await prisma.order.count();
    const orderNumber = `ORD-2026-${String(count + 1).padStart(4, "0")}`;
    const orderId = randomUUID();

    let subtotalRub = 0;
    let logisticsTotalRub = 0;

    const orderItemsData: Array<Omit<Prisma.OrderItemCreateManyOrderInput, "orderId">> = [];

    // Map items from snapshot or selected quotes
    for (const item of request.items) {
      // Find matching snapshot line or selected quote
      const snapshotLine = snapshot?.financeLines?.find((l: any) => l.itemId === item.id);
      const selectedQuote = item.supplierQuotes.find((q) => q.status === "SELECTED") ?? item.supplierQuotes[0];

      const qty = item.quantity || 1;
      let purchasePrice = selectedQuote ? Number(selectedQuote.purchasePrice ?? 0) : 0;
      let purchaseCurrency = selectedQuote?.currency ?? "RUB";
      let fxRate = snapshotLine?.fxRate ?? "1";
      if (purchaseCurrency === "USD" && fxRate === "1") fxRate = initialFinancialConfig.rubPerCurrencyUnit.USD;
      if (purchaseCurrency === "EUR" && fxRate === "1") fxRate = initialFinancialConfig.rubPerCurrencyUnit.EUR;
      if (purchaseCurrency === "BYN" && fxRate === "1") fxRate = initialFinancialConfig.rubPerCurrencyUnit.BYN;

      const rateNum = Number(fxRate) || 1;
      const unitPurchaseRub = purchasePrice * rateNum;

      // Apply official tariff rules:
      // Russia 28% min 300 RUB
      // Belarus 28% min 300 RUB
      // Poland 55% min 1700 RUB
      const countryCode = (selectedQuote?.supplier?.countryCode ?? "RU").toUpperCase();
      const isPoland = countryCode === "PL" || countryCode.includes("ПОЛЬШ");
      const markupRate = isPoland ? 0.55 : 0.28;
      const minMarkupRub = isPoland ? 1700 : 300;

      const unitPercentMarkupRub = unitPurchaseRub * markupRate;
      const unitAppliedMarkupRub = Math.max(unitPercentMarkupRub, minMarkupRub);
      const unitSalePriceRub = unitPurchaseRub + unitAppliedMarkupRub;

      const lineTotalSaleRub = unitSalePriceRub * qty;
      const linePurchaseTotalRub = unitPurchaseRub * qty;
      const lineProfitRub = lineTotalSaleRub - linePurchaseTotalRub;

      subtotalRub += lineTotalSaleRub;

      const lineLogisticsRub = selectedQuote ? Number(selectedQuote.deliveryCost ?? 0) * rateNum : 0;
      logisticsTotalRub += lineLogisticsRub;

      const itemId = randomUUID();

      orderItemsData.push({
        id: itemId,
        productId: null,
        requestedPartNumber: item.requestedPartNumber,
        nameOnPurchase: item.description,
        quantity: qty,
        condition: selectedQuote?.condition ?? "USED_GOOD",
        supplierOfferId: null,
        supplierId: selectedQuote?.supplierId ?? null,
        purchasePrice: new Prisma.Decimal(purchasePrice),
        purchaseCurrency,
        fxRate,
        supplierLogisticsCost: new Prisma.Decimal(lineLogisticsRub),
        markup: new Prisma.Decimal(unitAppliedMarkupRub * qty),
        salePrice: new Prisma.Decimal(unitSalePriceRub),
        totalAmount: new Prisma.Decimal(lineTotalSaleRub),
        grossProfit: new Prisma.Decimal(lineProfitRub),
        financialSnapshot: snapshotLine ?? {
          unitPurchaseRub,
          unitAppliedMarkupRub,
          unitSalePriceRub,
          markupRate,
          minMarkupRub,
        },
      });
    }

    if (snapshot?.sharedLogisticsRubMinor) {
      logisticsTotalRub += Number(snapshot.sharedLogisticsRubMinor) / 100;
    }

    const grandTotalRub = subtotalRub + logisticsTotalRub;

    const shipmentId = randomUUID();

    const orderData: Prisma.OrderCreateInput = {
      id: orderId,
      orderNumber,
      request: { connect: { id: request.id } },
      customer: { connect: { id: request.customer.id } },
      ...(request.assignedManager ? { assignedManager: { connect: { id: request.assignedManager.id } } } : {}),
      source: "CRM",
      country: request.customer.name.includes("Беларусь") ? "Беларусь" : "Россия",
      currency: "RUB",
      status: "NEW",
      paymentStatus: "PENDING",
      fulfillmentStatus: "UNFULFILLED",
      deliveryStatus: "PENDING",
      subtotal: new Prisma.Decimal(subtotalRub),
      logisticsTotal: new Prisma.Decimal(logisticsTotalRub),
      discountTotal: new Prisma.Decimal(0),
      taxTotal: new Prisma.Decimal(0),
      grandTotal: new Prisma.Decimal(grandTotalRub),
      customerComment: args.customerComment ?? request.customerComment,
      internalComment: args.internalComment ?? request.internalNote,
      financialSnapshot: snapshot ?? { subtotalRub, logisticsTotalRub, grandTotalRub },
      confirmedAt: new Date(),
    };

    const initialShipment: Omit<Prisma.ShipmentCreateManyOrderInput, "orderId"> = {
      id: shipmentId,
      carrier: args.deliveryDetails?.carrier ?? "CDEK",
      tariff: "Склад-ПВЗ",
      deliveryMethod: args.deliveryDetails?.deliveryMethod ?? "PICKUP_POINT",
      city: args.deliveryDetails?.city ?? "Москва",
      address: args.deliveryDetails?.address ?? "Центральный пункт выдачи",
      postalCode: args.deliveryDetails?.postalCode ?? "101000",
      pickupPointId: args.deliveryDetails?.pickupPointId ?? "MSK1",
      cost: new Prisma.Decimal(logisticsTotalRub),
      status: "PENDING",
      trackingHistory: [
        {
          at: new Date().toISOString(),
          status: "PENDING",
          description: "Заказ оформлен, ожидает комплектации и передачи в доставку",
        },
      ],
    };

    const created = await orderRepository.createOrderInTransaction({
      order: orderData,
      items: orderItemsData,
      shipment: initialShipment,
      activityLog: {
        actorId: args.callerStaff?.userId,
        action: `Заказ ${orderNumber} создан из заявки ${request.number}`,
        details: {
          requestId: request.id,
          requestNumber: request.number,
          orderNumber,
          grandTotal: grandTotalRub,
        },
      },
    });

    // Update request status to CONFIRMED
    await prisma.request.update({
      where: { id: request.id },
      data: {
        status: "CONFIRMED",
        customerResponseStatus: "ACCEPTED",
      },
    });

    // Create a default invoice document
    await orderRepository.createDocument(orderId, {
      id: randomUUID(),
      documentType: "INVOICE",
      documentNumber: `СЧ-${orderNumber}`,
      version: 1,
      createdById: args.callerStaff?.userId,
      contentJson: {
        orderNumber,
        invoiceDate: formatDateRu(new Date()),
        customer: request.customer.name,
        phone: request.customer.phone,
        email: request.customer.email,
        subtotal: subtotalRub,
        logisticsTotal: logisticsTotalRub,
        grandTotal: grandTotalRub,
        items: orderItemsData.map((item) => ({
          name: item.nameOnPurchase,
          oem: item.requestedPartNumber,
          quantity: item.quantity,
          salePrice: Number(item.salePrice),
          totalAmount: Number(item.totalAmount),
        })),
      },
    });

    // Create initial internal message
    await orderRepository.createMessage(orderId, {
      id: randomUUID(),
      senderType: "STAFF",
      isInternal: true,
      message: `Заказ ${orderNumber} сформирован на основании согласованного предложения заявки ${request.number}. Сумма: ${grandTotalRub.toLocaleString("ru-RU")} ₽.`,
      authorName: args.callerStaff?.name ?? "Система",
    });

    return this.getOrder(created!.id, args.callerStaff);
  },

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    callerStaff?: StaffContext | null,
    reason?: string
  ) {
    const existing = await orderRepository.findOrderById(orderId);
    if (!existing) throw new Error("Заказ не найден");

    const data: Prisma.OrderUpdateInput = { status };
    if (status === "CANCELLED") {
      data.rejectionReason = reason ?? "Отменено менеджером";
    }
    if (status === "COMPLETED") {
      data.completedAt = new Date();
    }

    await orderRepository.updateOrder(existing.id, data, {
      actorId: callerStaff?.userId,
      action: `Статус заказа изменён: ${status}`,
      details: { previousStatus: existing.status, nextStatus: status, reason },
    });

    return this.getOrder(existing.id, callerStaff);
  },

  async recordPayment(
    orderId: string,
    input: {
      amount: number | string;
      paymentMethod: string;
      externalPaymentId?: string;
      notes?: string;
    },
    callerStaff?: StaffContext | null
  ) {
    const existing = await orderRepository.findOrderById(orderId);
    if (!existing) throw new Error("Заказ не найден");

    const paymentId = randomUUID();
    const amountDec = new Prisma.Decimal(input.amount);

    await orderRepository.createPayment(
      existing.id,
      {
        id: paymentId,
        amount: amountDec,
        currency: existing.currency,
        paymentMethod: input.paymentMethod,
        status: "PAID",
        externalPaymentId: input.externalPaymentId,
        paidAt: new Date(),
        notes: input.notes,
        history: [
          {
            at: new Date().toISOString(),
            status: "PAID",
            amount: input.amount,
            method: input.paymentMethod,
          },
        ],
      },
      {
        actorId: callerStaff?.userId,
        action: `Поступила оплата: ${input.amount} ${existing.currency} (${input.paymentMethod})`,
        details: { amount: input.amount, method: input.paymentMethod },
      }
    );

    notificationService.notifyPaymentConfirmed(existing.id, existing.customerId, existing.orderNumber).catch(console.error);

    return this.getOrder(existing.id, callerStaff);
  },

  async updateShipment(
    orderId: string,
    input: {
      carrier?: string;
      trackingNumber?: string;
      status?: DeliveryStatus;
      city?: string;
      address?: string;
      estimatedDays?: number;
      cost?: number | string;
    },
    callerStaff?: StaffContext | null
  ) {
    const existing = await orderRepository.findOrderById(orderId);
    if (!existing) throw new Error("Заказ не найден");

    const shipment = existing.shipments[0];
    if (!shipment) throw new Error("Отправление для заказа не найдено");

    const data: Prisma.ShipmentUpdateInput = {};
    if (input.carrier) data.carrier = input.carrier;
    if (input.trackingNumber) data.trackingNumber = input.trackingNumber;
    if (input.status) {
      data.status = input.status;
      if (input.status === "IN_TRANSIT") data.dispatchedAt = new Date();
      if (input.status === "DELIVERED") data.deliveredAt = new Date();
    }
    if (input.city) data.city = input.city;
    if (input.address) data.address = input.address;
    if (input.estimatedDays !== undefined) data.estimatedDays = input.estimatedDays;
    if (input.cost !== undefined) data.cost = new Prisma.Decimal(input.cost);

    await orderRepository.updateShipment(shipment.id, data, {
      actorId: callerStaff?.userId,
      action: `Обновлены параметры отправления: ${input.status ?? shipment.status} (трек: ${input.trackingNumber ?? shipment.trackingNumber ?? "не указан"})`,
      details: input,
    });

    // Update order delivery status
    if (input.status) {
      let nextOrderStatus = existing.status;
      if (input.status === "IN_TRANSIT" && (existing.status === "PAID" || existing.status === "READY_FOR_SHIPMENT")) {
        nextOrderStatus = "SHIPPED";
      } else if (input.status === "DELIVERED") {
        nextOrderStatus = "DELIVERED";
      }

      await prisma.order.update({
        where: { id: existing.id },
        data: {
          deliveryStatus: input.status,
          status: nextOrderStatus,
        },
      });
    }

    if (input.trackingNumber) {
      notificationService.notifyShipmentDispatched(
        existing.id,
        existing.customerId,
        existing.orderNumber,
        input.trackingNumber,
        input.carrier || shipment.carrier || "СДЭК"
      ).catch(console.error);
    }

    return this.getOrder(existing.id, callerStaff);
  },

  async addDocument(
    orderId: string,
    input: {
      documentType: OrderDocumentType;
      documentNumber?: string;
      fileUrl?: string;
      contentJson?: any;
    },
    callerStaff?: StaffContext | null
  ) {
    const existing = await orderRepository.findOrderById(orderId);
    if (!existing) throw new Error("Заказ не найден");

    const docCount = existing.documents.length;
    const documentNumber = input.documentNumber ?? `${input.documentType}-${existing.orderNumber}-v${docCount + 1}`;
    const docId = randomUUID();

    await orderRepository.createDocument(existing.id, {
      id: docId,
      documentType: input.documentType,
      documentNumber,
      fileUrl: input.fileUrl,
      contentJson: input.contentJson,
      version: docCount + 1,
      createdById: callerStaff?.userId,
    });

    return this.getOrder(existing.id, callerStaff);
  },

  async addMessage(
    orderId: string,
    input: {
      message: string;
      isInternal?: boolean;
      senderType?: "STAFF" | "CUSTOMER";
      attachments?: any;
    },
    callerStaff?: StaffContext | null
  ) {
    const existing = await orderRepository.findOrderById(orderId);
    if (!existing) throw new Error("Заказ не найден");

    const msgId = randomUUID();

    await orderRepository.createMessage(existing.id, {
      id: msgId,
      message: input.message,
      isInternal: input.isInternal ?? true,
      senderType: input.senderType ?? "STAFF",
      authorName: callerStaff?.name ?? "Менеджер",
      attachments: input.attachments,
    });

    return this.getOrder(existing.id, callerStaff);
  },

  async seedDemoOrdersIfEmpty() {
    const count = await prisma.order.count();
    if (count > 0) return;

    // Check if requests exist to create demo orders from
    const req146 = await prisma.request.findUnique({ where: { number: "ZP-2026-0146" } });
    const req147 = await prisma.request.findUnique({ where: { number: "ZP-2026-0147" } });
    const req148 = await prisma.request.findUnique({ where: { number: "ZP-2026-0148" } });

    if (req146) {
      const order = await this.createOrderFromRequest({
        requestId: req146.id,
        deliveryDetails: {
          carrier: "CDEK",
          city: "Санкт-Петербург",
          address: "Невский пр-т, д. 45, ПВЗ 12",
          pickupPointId: "SPB12",
        },
      });

      if (order) {
        // Record payment for 146
        await this.recordPayment(order.id, {
          amount: Number(order.grandTotal),
          paymentMethod: "BANK_TRANSFER",
          externalPaymentId: "PAY-BANK-146",
          notes: "Оплата по безналичному расчёту поступила полностью",
        });

        // Set tracking and shipment in transit
        await this.updateShipment(order.id, {
          carrier: "CDEK",
          trackingNumber: "1548902146",
          status: "IN_TRANSIT",
          estimatedDays: 3,
        });
      }
    }

    if (req147) {
      await this.createOrderFromRequest({
        requestId: req147.id,
        deliveryDetails: {
          carrier: "CDEK",
          city: "Минск",
          address: "ул. Притыцкого, д. 29",
          pickupPointId: "MSQ04",
        },
        internalComment: "Ожидаем подтверждения оплаты от юрлица",
      });
    }

    if (req148) {
      await this.createOrderFromRequest({
        requestId: req148.id,
        deliveryDetails: {
          carrier: "CDEK",
          city: "Москва",
          address: "Ленинградский пр-т, д. 15",
          pickupPointId: "MSK08",
        },
        customerComment: "Прошу доставить в будний день с 10:00 до 18:00",
      });
    }
  },
};
