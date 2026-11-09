import { prisma } from "./db.ts";
import type { Prisma, OrderStatus, PaymentStatus, FulfillmentStatus, DeliveryStatus, OrderDocumentType } from "@prisma/client";
import type { OrderListQuery } from "./order-types.ts";

export const orderRepository = {
  async findOrders(query: OrderListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    if (query.fulfillmentStatus) {
      where.fulfillmentStatus = query.fulfillmentStatus;
    }

    if (query.deliveryStatus) {
      where.deliveryStatus = query.deliveryStatus;
    }

    if (query.managerId) {
      where.assignedManagerId = query.managerId;
    }

    if (query.country) {
      where.country = query.country;
    }

    // Queue Presets
    const activeQueue = query.queuePreset || query.queue;
    if (activeQueue) {
      switch (activeQueue) {
        case "new":
          where.status = "NEW";
          break;
        case "pending_payment":
          where.paymentStatus = "PENDING";
          where.status = { not: "CANCELLED" };
          break;
        case "paid":
          where.paymentStatus = "PAID";
          break;
        case "procurement":
          where.fulfillmentStatus = "PROCUREMENT";
          break;
        case "in_fulfillment":
          where.fulfillmentStatus = "PROCESSING";
          break;
        case "ready_shipment":
          where.status = "READY_FOR_SHIPMENT";
          break;
        case "in_transit":
          where.deliveryStatus = "IN_TRANSIT";
          break;
        case "completed":
          where.status = "COMPLETED";
          break;
        case "cancelled":
          where.status = "CANCELLED";
          break;
      }
    }

    const searchTerm = query.search?.trim() || query.query?.trim();
    if (searchTerm) {
      const q = searchTerm;
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { phone: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
        { items: { some: { requestedPartNumber: { contains: q, mode: "insensitive" } } } },
        { items: { some: { nameOnPurchase: { contains: q, mode: "insensitive" } } } },
      ];
    }

    let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: "desc" };
    if (query.sortBy === "oldest") orderBy = { createdAt: "asc" };
    if (query.sortBy === "total") orderBy = { grandTotal: "desc" };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          customer: true,
          assignedManager: true,
          request: true,
          items: {
            include: {
              supplier: true,
              product: true,
            },
          },
          payments: { orderBy: { createdAt: "desc" } },
          shipments: { orderBy: { createdAt: "desc" } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page, pageSize };
  },

  async findOrderById(idOrNumber: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrNumber);
    const where: Prisma.OrderWhereUniqueInput = isUuid
      ? { id: idOrNumber }
      : { orderNumber: idOrNumber };

    return prisma.order.findUnique({
      where,
      include: {
        customer: true,
        assignedManager: true,
        request: true,
        items: {
          include: {
            supplier: true,
            product: true,
            supplierOffer: true,
          },
        },
        payments: { orderBy: { createdAt: "asc" } },
        shipments: { orderBy: { createdAt: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        messages: { orderBy: { createdAt: "asc" } },
        activityEvents: { orderBy: { occurredAt: "desc" } },
      },
    });
  },

  async findOrderByRequestId(requestId: string) {
    return prisma.order.findFirst({
      where: { requestId },
      include: {
        items: true,
      },
    });
  },

  async getQueueCounts() {
    const [
      allOrders,
      newCount,
      pendingPayment,
      paidCount,
      procurement,
      inFulfillment,
      readyShipment,
      inTransit,
      completed,
      cancelled,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "NEW" } }),
      prisma.order.count({ where: { paymentStatus: "PENDING", status: { not: "CANCELLED" } } }),
      prisma.order.count({ where: { paymentStatus: "PAID" } }),
      prisma.order.count({ where: { fulfillmentStatus: "PROCUREMENT" } }),
      prisma.order.count({ where: { fulfillmentStatus: "PROCESSING" } }),
      prisma.order.count({ where: { status: "READY_FOR_SHIPMENT" } }),
      prisma.order.count({ where: { deliveryStatus: "IN_TRANSIT" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
    ]);

    return {
      all: allOrders,
      new: newCount,
      pending_payment: pendingPayment,
      paid: paidCount,
      procurement,
      in_fulfillment: inFulfillment,
      ready_shipment: readyShipment,
      in_transit: inTransit,
      completed,
      cancelled,
    };
  },

  async createOrderInTransaction(args: {
    order: Prisma.OrderCreateInput;
    items: Array<Omit<Prisma.OrderItemCreateManyOrderInput, "orderId">>;
    shipment?: Omit<Prisma.ShipmentCreateManyOrderInput, "orderId">;
    activityLog?: {
      actorId?: string;
      action: string;
      details?: any;
    };
  }) {
    return prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: args.order,
      });

      if (args.items.length > 0) {
        await tx.orderItem.createMany({
          data: args.items.map((item) => ({
            ...item,
            orderId: createdOrder.id,
          })),
        });
      }

      if (args.shipment) {
        await tx.shipment.create({
          data: {
            ...args.shipment,
            orderId: createdOrder.id,
          },
        });
      }

      if (args.activityLog) {
        await tx.activityLog.create({
          data: {
            ...(args.activityLog.actorId ? { actor: { connect: { id: args.activityLog.actorId } } } : {}),
            order: { connect: { id: createdOrder.id } },
            ...(args.order.request?.connect?.id ? { request: { connect: { id: args.order.request.connect.id } } } : {}),
            entityType: "ORDER",
            entityId: createdOrder.id,
            action: args.activityLog.action,
            details: args.activityLog.details ?? {},
          },
        });
      }

      return tx.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          items: true,
          customer: true,
          shipments: true,
        },
      });
    });
  },

  async updateOrder(id: string, data: Prisma.OrderUpdateInput, log?: { actorId?: string; action: string; details?: any }) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data,
      });

      if (log) {
        await tx.activityLog.create({
          data: {
            ...(log.actorId ? { actor: { connect: { id: log.actorId } } } : {}),
            order: { connect: { id } },
            entityType: "ORDER",
            entityId: id,
            action: log.action,
            details: log.details ?? {},
          },
        });
      }

      return updated;
    });
  },

  async createPayment(orderId: string, data: Prisma.PaymentCreateWithoutOrderInput, log?: { actorId?: string; action: string; details?: any }) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          ...data,
          order: { connect: { id: orderId } },
        },
      });

      // Recalculate payment status on the order
      const allPayments = await tx.payment.findMany({
        where: { orderId, status: "PAID" },
      });
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (order) {
        const totalPaid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
        const grandTotal = Number(order.grandTotal);
        let nextPaymentStatus: PaymentStatus = order.paymentStatus;
        if (totalPaid >= grandTotal && grandTotal > 0) {
          nextPaymentStatus = "PAID";
        } else if (totalPaid > 0) {
          nextPaymentStatus = "PARTIALLY_PAID";
        }

        let nextOrderStatus = order.status;
        if (nextPaymentStatus === "PAID" && (order.status === "NEW" || order.status === "PENDING_PAYMENT")) {
          nextOrderStatus = "PAID";
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: nextPaymentStatus,
            status: nextOrderStatus,
            confirmedAt: order.confirmedAt ?? (nextPaymentStatus === "PAID" ? new Date() : null),
          },
        });
      }

      if (log) {
        await tx.activityLog.create({
          data: {
            ...(log.actorId ? { actor: { connect: { id: log.actorId } } } : {}),
            order: { connect: { id: orderId } },
            entityType: "PAYMENT",
            entityId: payment.id,
            action: log.action,
            details: log.details ?? {},
          },
        });
      }

      return payment;
    });
  },

  async createShipment(orderId: string, data: Prisma.ShipmentCreateWithoutOrderInput, log?: { actorId?: string; action: string; details?: any }) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          ...data,
          order: { connect: { id: orderId } },
        },
      });

      if (log) {
        await tx.activityLog.create({
          data: {
            ...(log.actorId ? { actor: { connect: { id: log.actorId } } } : {}),
            order: { connect: { id: orderId } },
            entityType: "SHIPMENT",
            entityId: shipment.id,
            action: log.action,
            details: log.details ?? {},
          },
        });
      }

      return shipment;
    });
  },

  async updateShipment(id: string, data: Prisma.ShipmentUpdateInput, log?: { actorId?: string; action: string; details?: any }) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id },
        data,
      });

      if (log) {
        await tx.activityLog.create({
          data: {
            ...(log.actorId ? { actor: { connect: { id: log.actorId } } } : {}),
            order: { connect: { id: updated.orderId } },
            entityType: "SHIPMENT",
            entityId: id,
            action: log.action,
            details: log.details ?? {},
          },
        });
      }

      return updated;
    });
  },

  async createDocument(orderId: string, data: Prisma.OrderDocumentCreateWithoutOrderInput) {
    return prisma.orderDocument.create({
      data: {
        ...data,
        order: { connect: { id: orderId } },
      },
    });
  },

  async createMessage(orderId: string, data: Prisma.OrderMessageCreateWithoutOrderInput) {
    return prisma.orderMessage.create({
      data: {
        ...data,
        order: { connect: { id: orderId } },
      },
    });
  },
};
