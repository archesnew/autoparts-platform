import "server-only";

import { prisma } from "./db";

export type CreateNotificationInput = {
  eventKey?: string;
  recipientType: "CUSTOMER" | "STAFF";
  customerId?: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  entityType?: "REQUEST" | "ORDER" | "OFFER";
  entityId?: string;
};

export class NotificationService {
  /**
   * Creates an idempotent notification. If eventKey already exists, skips duplicate insertion.
   */
  async create(input: CreateNotificationInput) {
    if (input.eventKey) {
      const existing = await prisma.notification.findUnique({
        where: { eventKey: input.eventKey },
      });
      if (existing) return existing;
    }

    return prisma.notification.create({
      data: {
        eventKey: input.eventKey,
        recipientType: input.recipientType,
        customerId: input.customerId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  }

  /**
   * Customer notifications
   */
  async getCustomerNotifications(customerId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: {
        recipientType: "CUSTOMER",
        customerId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getCustomerUnreadCount(customerId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        recipientType: "CUSTOMER",
        customerId,
        readAt: null,
      },
    });
  }

  async markCustomerAsRead(customerId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientType: "CUSTOMER",
        customerId,
      },
      data: { readAt: new Date() },
    });
  }

  async markAllCustomerAsRead(customerId: string) {
    return prisma.notification.updateMany({
      where: {
        recipientType: "CUSTOMER",
        customerId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Staff notifications
   */
  async getStaffNotifications(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: {
        recipientType: "STAFF",
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getStaffUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        recipientType: "STAFF",
        userId,
        readAt: null,
      },
    });
  }

  async markStaffAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientType: "STAFF",
        userId,
      },
      data: { readAt: new Date() },
    });
  }

  async markAllStaffAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        recipientType: "STAFF",
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Helper event dispatches
   */
  async notifyRequestCreated(requestId: string, customerId: string, requestNumber: string) {
    // 1. Notify customer
    await this.create({
      eventKey: `request_created_cust_${requestId}`,
      recipientType: "CUSTOMER",
      customerId,
      type: "REQUEST_CREATED",
      title: "Заявка успешно зарегистрирована",
      message: `Ваша заявка №${requestNumber} принята. Специалист ZAPTUT.PRO проверяет совместимость и готовит расчет предложений.`,
      link: `/account/requests/${requestId}`,
      entityType: "REQUEST",
      entityId: requestId,
    });

    // 2. Notify super admin / staff
    const admins = await prisma.user.findMany({
      where: { active: true, role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
      take: 5,
    });

    for (const admin of admins) {
      await this.create({
        eventKey: `request_created_staff_${admin.id}_${requestId}`,
        recipientType: "STAFF",
        userId: admin.id,
        type: "NEW_REQUEST",
        title: `Новая заявка №${requestNumber}`,
        message: `Поступила новая клиентская заявка. Требуется подбор предложений и формирование оффера.`,
        link: `/admin/requests`,
        entityType: "REQUEST",
        entityId: requestId,
      });
    }
  }

  async notifyOfferReady(offerId: string, customerId: string, requestNumber: string, requestId: string) {
    await this.create({
      eventKey: `offer_ready_${offerId}`,
      recipientType: "CUSTOMER",
      customerId,
      type: "OFFER_READY",
      title: "Предложение готово к согласованию",
      message: `По заявке №${requestNumber} сформировано персональное предложение с вариантами цен и доставки.`,
      link: `/account/requests/${requestId}`,
      entityType: "OFFER",
      entityId: offerId,
    });
  }

  async notifyOfferAccepted(orderId: string, customerId: string, orderNumber: string, assignedManagerId?: string | null) {
    // 1. Customer
    await this.create({
      eventKey: `order_created_cust_${orderId}`,
      recipientType: "CUSTOMER",
      customerId,
      type: "ORDER_CREATED",
      title: `Заказ №${orderNumber} сформирован`,
      message: `Предложение принято. Заказ передан в обработку и ожидает согласования оплаты.`,
      link: `/account/orders/${orderId}`,
      entityType: "ORDER",
      entityId: orderId,
    });

    // 2. Assigned manager or admins
    const targetUserIds = assignedManagerId
      ? [assignedManagerId]
      : (await prisma.user.findMany({ where: { active: true, role: "SUPER_ADMIN" }, select: { id: true } })).map((u) => u.id);

    for (const uId of targetUserIds) {
      await this.create({
        eventKey: `order_created_staff_${uId}_${orderId}`,
        recipientType: "STAFF",
        userId: uId,
        type: "ORDER_CREATED",
        title: `Покупатель принял предложение! Заказ №${orderNumber}`,
        message: `Создан заказ №${orderNumber}. Перейдите в карточку для выставления инструкции по оплате.`,
        link: `/admin/orders`,
        entityType: "ORDER",
        entityId: orderId,
      });
    }
  }

  async notifyPaymentInstruction(orderId: string, customerId: string, orderNumber: string, amountRub: number) {
    await this.create({
      eventKey: `payment_instr_${orderId}_${Date.now()}`,
      recipientType: "CUSTOMER",
      customerId,
      type: "PAYMENT_INSTRUCTIONS",
      title: "Выставлены реквизиты для оплаты",
      message: `По заказу №${orderNumber} выставлена инструкция на сумму ${amountRub.toLocaleString("ru-RU")} ₽. Ознакомьтесь в деталях заказа.`,
      link: `/account/orders/${orderId}`,
      entityType: "ORDER",
      entityId: orderId,
    });
  }

  async notifyPaymentSubmitted(orderId: string, orderNumber: string, assignedManagerId?: string | null) {
    const targetUserIds = assignedManagerId
      ? [assignedManagerId]
      : (await prisma.user.findMany({ where: { active: true, role: "SUPER_ADMIN" }, select: { id: true } })).map((u) => u.id);

    for (const uId of targetUserIds) {
      await this.create({
        eventKey: `payment_sub_${uId}_${orderId}_${Date.now()}`,
        recipientType: "STAFF",
        userId: uId,
        type: "PAYMENT_SUBMITTED",
        title: `Покупатель сообщил об оплате: Заказ №${orderNumber}`,
        message: `Клиент подтвердил отправку перевода. Проверьте поступление и подтвердите оплату в CRM.`,
        link: `/admin/orders`,
        entityType: "ORDER",
        entityId: orderId,
      });
    }
  }

  async notifyPaymentConfirmed(orderId: string, customerId: string, orderNumber: string) {
    await this.create({
      eventKey: `payment_conf_${orderId}`,
      recipientType: "CUSTOMER",
      customerId,
      type: "PAYMENT_CONFIRMED",
      title: "Оплата подтверждена!",
      message: `Оплата по заказу №${orderNumber} зачислена. Заказ передан в комплектацию и подготовку к отправке.`,
      link: `/account/orders/${orderId}`,
      entityType: "ORDER",
      entityId: orderId,
    });
  }

  async notifyShipmentDispatched(orderId: string, customerId: string, orderNumber: string, trackingNumber: string, carrierName: string) {
    await this.create({
      eventKey: `shipment_${orderId}_${trackingNumber}`,
      recipientType: "CUSTOMER",
      customerId,
      type: "SHIPMENT_DISPATCHED",
      title: "Заказ передан в доставку",
      message: `Заказ №${orderNumber} отправлен службой ${carrierName}. Трек-номер для отслеживания: ${trackingNumber}.`,
      link: `/account/orders/${orderId}`,
      entityType: "ORDER",
      entityId: orderId,
    });
  }
}

export const notificationService = new NotificationService();
