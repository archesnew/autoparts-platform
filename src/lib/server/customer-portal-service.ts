import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { normalizePhone } from "@/lib/customer-model";
import { formatMinorUnits } from "@/lib/financial-config";
import { Prisma } from "@prisma/client";
import { orderService } from "./order-service";

export class CustomerServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "CustomerServiceError";
  }
}

export type VehicleInput = {
  make: string;
  model: string;
  generation?: string;
  year?: number;
  bodyType?: string;
  modification?: string;
  vin?: string;
  engine?: string;
  colorName?: string;
  colorCode?: string;
  colorHex?: string;
  isDefault?: boolean;
  vehicleMakeId?: string;
  vehicleModelId?: string;
  vehicleGenerationId?: string;
  vehicleModificationId?: string;
};

export type AddressInput = {
  recipientName: string;
  phone: string;
  country?: string;
  region?: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode?: string;
  isDefault?: boolean;
  comment?: string;
};

export type CreateCustomerRequestItemInput = {
  description: string;
  requestedPartNumber?: string;
  quantity?: number;
  conditionPreference?: string;
  compatibilityNotes?: string;
  photos?: string[];
};

export type CreateCustomerRequestInput = {
  vehicleId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleVin?: string;
  customerComment?: string;
  items: CreateCustomerRequestItemInput[];
};

export class CustomerPortalService {
  /**
   * Register a new customer user and link / create Customer record in PostgreSQL
   */
  async register(params: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new CustomerServiceError(400, "Укажите корректный адрес электронной почты");
    }

    if (!params.password || params.password.length < 12) {
      throw new CustomerServiceError(400, "Пароль должен содержать не менее 12 символов");
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      throw new CustomerServiceError(409, "Пользователь с таким email уже зарегистрирован");
    }

    const hashedPassword = await hashPassword(params.password);
    const userId = randomUUID();
    const normPhone = params.phone ? normalizePhone(params.phone) : null;

    return await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          id: userId,
          name: cleanName,
          email: cleanEmail,
          role: "CUSTOMER",
          active: true,
          emailVerified: false,
        },
      });

      // 2. Create Account
      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashedPassword,
        },
      });

      // 3. Find unclaimed Customer record with matching email
      let customer = await tx.customer.findFirst({
        where: {
          userId: null,
          OR: [
            { normalizedEmail: cleanEmail },
            { email: cleanEmail },
          ],
        },
      });

      if (customer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            userId: user.id,
            name: customer.name || cleanName,
            phone: customer.phone || params.phone,
            normalizedPhone: customer.normalizedPhone || normPhone,
          },
        });
      } else {
        customer = await tx.customer.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            normalizedEmail: cleanEmail,
            phone: params.phone || null,
            normalizedPhone: normPhone,
            userId: user.id,
          },
        });
      }

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
      };
    });
  }

  /**
   * Request password reset token
   */
  async requestPasswordReset(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // We do not leak whether user exists for security, but generate token if exists
    if (!user) {
      return { success: true, message: "Если аккаунт существует, ссылка для сброса пароля отправлена." };
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: cleanEmail,
        value: token,
        expiresAt,
      },
    });

    return {
      success: true,
      message: "Ссылка для сброса пароля создана.",
      resetUrl: `/account/reset-password?token=${token}&email=${encodeURIComponent(cleanEmail)}`,
      token,
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(params: { email: string; token: string; newPassword: string }) {
    const cleanEmail = params.email.trim().toLowerCase();
    if (!params.newPassword || params.newPassword.length < 12) {
      throw new CustomerServiceError(400, "Новый пароль должен содержать не менее 12 символов");
    }

    const verification = await prisma.verification.findFirst({
      where: {
        identifier: cleanEmail,
        value: params.token,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      throw new CustomerServiceError(400, "Недействительный или истёкший токен сброса пароля");
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      throw new CustomerServiceError(404, "Пользователь не найден");
    }

    const hashedPassword = await hashPassword(params.newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.account.updateMany({
        where: { userId: user.id, providerId: "credential" },
        data: { password: hashedPassword },
      });

      await tx.verification.delete({
        where: { id: verification.id },
      });
    });

    return { success: true, message: "Пароль успешно обновлён" };
  }

  /**
   * Change password while authenticated
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 12) {
      throw new CustomerServiceError(400, "Новый пароль должен содержать не менее 12 символов");
    }

    const account = await prisma.account.findFirst({
      where: { userId, providerId: "credential" },
    });

    if (!account?.password) {
      throw new CustomerServiceError(400, "Аккаунт не имеет пароля для изменения");
    }

    const isValid = await verifyPassword({ hash: account.password, password: oldPassword });
    if (!isValid) {
      throw new CustomerServiceError(400, "Неверный текущий пароль");
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashedPassword },
    });

    return { success: true, message: "Пароль успешно изменён" };
  }

  /**
   * Update customer profile
   */
  async updateProfile(customerId: string, input: { name?: string; phone?: string; email?: string | null }) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) throw new CustomerServiceError(404, "Профиль покупателя не найден");

    const normPhone = input.phone ? normalizePhone(input.phone) : customer.normalizedPhone;
    const cleanEmail = input.email !== undefined ? (input.email ? input.email.trim().toLowerCase() : null) : customer.email;

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.update({
        where: { id: customerId },
        data: {
          name: input.name !== undefined ? input.name.trim() : customer.name,
          phone: input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : customer.phone,
          normalizedPhone: normPhone,
          email: cleanEmail,
          normalizedEmail: cleanEmail,
        },
      });

      if (customer.userId) {
        await tx.user.update({
          where: { id: customer.userId },
          data: {
            name: c.name,
            email: cleanEmail,
          },
        });
      }

      return c;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // VEHICLES (GARAGE)
  // ---------------------------------------------------------------------------

  async listVehicles(customerId: string) {
    return prisma.customerVehicle.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createVehicle(customerId: string, input: VehicleInput) {
    const cleanVin = input.vin ? input.vin.trim().toUpperCase() : "";
    if (!input.make || !input.model) {
      throw new CustomerServiceError(400, "Укажите марку и модель автомобиля");
    }

    if (cleanVin && (cleanVin.length < 5 || cleanVin.length > 25)) {
      throw new CustomerServiceError(400, "Укажите корректный VIN-номер");
    }

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerVehicle.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      // Auto-resolve relational foreign keys if not explicitly supplied
      let makeId = input.vehicleMakeId;
      let modelId = input.vehicleModelId;
      const genId = input.vehicleGenerationId;
      const modId = input.vehicleModificationId;

      if (!makeId) {
        const foundMake = await tx.vehicleMake.findFirst({
          where: {
            OR: [
              { name: { equals: input.make.trim(), mode: "insensitive" } },
              { aliases: { some: { alias: { equals: input.make.trim().toLowerCase() } } } },
            ],
          },
          select: { id: true },
        });
        if (foundMake) makeId = foundMake.id;
      }

      if (makeId && !modelId) {
        const foundModel = await tx.vehicleModel.findFirst({
          where: {
            makeId,
            OR: [
              { name: { equals: input.model.trim(), mode: "insensitive" } },
              { aliases: { some: { alias: { equals: input.model.trim().toLowerCase() } } } },
            ],
          },
          select: { id: true },
        });
        if (foundModel) modelId = foundModel.id;
      }

      return tx.customerVehicle.create({
        data: {
          customerId,
          make: input.make.trim(),
          model: input.model.trim(),
          generation: input.generation?.trim() || null,
          year: input.year ? Number(input.year) : null,
          bodyType: input.bodyType?.trim() || null,
          modification: input.modification?.trim() || null,
          vin: cleanVin,
          engine: input.engine?.trim() || null,
          colorName: input.colorName?.trim() || null,
          colorCode: input.colorCode?.trim() || null,
          colorHex: input.colorHex?.trim() || null,
          isDefault: Boolean(input.isDefault),
          vehicleMakeId: makeId || null,
          vehicleModelId: modelId || null,
          vehicleGenerationId: genId || null,
          vehicleModificationId: modId || null,
        },
      });
    });
  }

  async updateVehicle(customerId: string, vehicleId: string, input: Partial<VehicleInput>) {
    const existing = await prisma.customerVehicle.findFirst({
      where: { id: vehicleId, customerId },
    });

    if (!existing) throw new CustomerServiceError(404, "Автомобиль не найден");

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerVehicle.updateMany({
          where: { customerId, id: { not: vehicleId } },
          data: { isDefault: false },
        });
      }

      return tx.customerVehicle.update({
        where: { id: vehicleId },
        data: {
          make: input.make ? input.make.trim() : undefined,
          model: input.model ? input.model.trim() : undefined,
          generation: input.generation !== undefined ? input.generation?.trim() || null : undefined,
          year: input.year !== undefined ? (input.year ? Number(input.year) : null) : undefined,
          bodyType: input.bodyType !== undefined ? input.bodyType?.trim() || null : undefined,
          modification: input.modification !== undefined ? input.modification?.trim() || null : undefined,
          vin: input.vin ? input.vin.trim().toUpperCase() : undefined,
          engine: input.engine !== undefined ? input.engine?.trim() || null : undefined,
          colorName: input.colorName !== undefined ? input.colorName?.trim() || null : undefined,
          colorCode: input.colorCode !== undefined ? input.colorCode?.trim() || null : undefined,
          colorHex: input.colorHex !== undefined ? input.colorHex?.trim() || null : undefined,
          isDefault: input.isDefault !== undefined ? Boolean(input.isDefault) : undefined,
        },
      });
    });
  }

  async deleteVehicle(customerId: string, vehicleId: string) {
    const existing = await prisma.customerVehicle.findFirst({
      where: { id: vehicleId, customerId },
    });

    if (!existing) throw new CustomerServiceError(404, "Автомобиль не найден");

    await prisma.customerVehicle.delete({
      where: { id: vehicleId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // ADDRESSES
  // ---------------------------------------------------------------------------

  async listAddresses(customerId: string) {
    return prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(customerId: string, input: AddressInput) {
    if (!input.recipientName || !input.phone || !input.city || !input.street || !input.house) {
      throw new CustomerServiceError(400, "Заполните обязательные поля адреса доставки");
    }

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: {
          customerId,
          recipientName: input.recipientName.trim(),
          phone: input.phone.trim(),
          country: input.country?.trim() || "Россия",
          region: input.region?.trim() || null,
          city: input.city.trim(),
          street: input.street.trim(),
          house: input.house.trim(),
          apartment: input.apartment?.trim() || null,
          postalCode: input.postalCode?.trim() || null,
          isDefault: Boolean(input.isDefault),
          comment: input.comment?.trim() || null,
        },
      });
    });
  }

  async updateAddress(customerId: string, addressId: string, input: Partial<AddressInput>) {
    const existing = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) throw new CustomerServiceError(404, "Адрес не найден");

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data: {
          recipientName: input.recipientName ? input.recipientName.trim() : undefined,
          phone: input.phone ? input.phone.trim() : undefined,
          country: input.country ? input.country.trim() : undefined,
          region: input.region !== undefined ? (input.region?.trim() || null) : undefined,
          city: input.city ? input.city.trim() : undefined,
          street: input.street ? input.street.trim() : undefined,
          house: input.house ? input.house.trim() : undefined,
          apartment: input.apartment !== undefined ? input.apartment?.trim() || null : undefined,
          postalCode: input.postalCode !== undefined ? input.postalCode?.trim() || null : undefined,
          isDefault: input.isDefault !== undefined ? Boolean(input.isDefault) : undefined,
          comment: input.comment !== undefined ? input.comment?.trim() || null : undefined,
        },
      });
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const existing = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });

    if (!existing) throw new CustomerServiceError(404, "Адрес не найден");

    await prisma.customerAddress.delete({
      where: { id: addressId },
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // REQUESTS (ЗАЯВКИ)
  // ---------------------------------------------------------------------------

  async listRequests(customerId: string) {
    const requests = await prisma.request.findMany({
      where: { customerId },
      include: {
        items: {
          select: {
            id: true,
            description: true,
            requestedPartNumber: true,
            quantity: true,
            conditionPreference: true,
          },
        },
        offers: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            snapshot: true,
            responseStatus: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requests.map((req) => {
      const latestOffer = req.offers[0];
      const snapshot = (latestOffer?.snapshot as any) || null;
      const totalRubMinor = snapshot?.totalRubMinor || null;

      return {
        id: req.id,
        number: req.number,
        status: req.status,
        createdAt: req.createdAt.toISOString(),
        vehicleMake: req.vehicleMake,
        vehicleModel: req.vehicleModel,
        vehicleYear: req.vehicleYear,
        vehicleVin: req.vehicleVin,
        itemsCount: req.items.length,
        itemsSummary: req.items.map((i) => i.description).join(", "),
        hasOffer: Boolean(latestOffer && (req.customerOfferStatus === "FORMED" || req.customerOfferStatus === "SENT" || req.customerOfferStatus === "VIEWED")),
        offerVersion: latestOffer?.version || null,
        offerTotalRub: totalRubMinor ? formatMinorUnits(totalRubMinor, "RUB") : null,
        customerOfferStatus: req.customerOfferStatus,
        customerResponseStatus: req.customerResponseStatus,
      };
    });
  }

  async getRequestById(customerId: string, requestIdOrNumber: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestIdOrNumber);

    const req = await prisma.request.findFirst({
      where: {
        AND: [
          isUuid ? { id: requestIdOrNumber } : { number: requestIdOrNumber },
          { customerId },
        ],
      },
      include: {
        items: {
          select: {
            id: true,
            description: true,
            requestedPartNumber: true,
            quantity: true,
            conditionPreference: true,
            compatibilityNotes: true,
            photos: true,
          },
        },
        offers: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            snapshot: true,
            responseStatus: true,
            status: true,
            createdAt: true,
          },
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        activityEvents: {
          orderBy: { occurredAt: "asc" },
          select: {
            id: true,
            action: true,
            details: true,
            occurredAt: true,
          },
        },
      },
    });

    if (!req) throw new CustomerServiceError(404, "Заявка не найдена");

    const latestOffer = req.offers[0];
    const snapshot = (latestOffer?.snapshot as any) || null;

    // Sanitize offer snapshot: ONLY include public customer lines and total.
    // Strip financeLines completely!
    let customerOffer = null;
    if (snapshot && (req.customerOfferStatus === "FORMED" || req.customerOfferStatus === "SENT" || req.customerOfferStatus === "VIEWED")) {
      customerOffer = {
        version: snapshot.version || latestOffer?.version,
        comment: snapshot.comment || "",
        totalRubMinor: snapshot.totalRubMinor,
        totalRubFormatted: snapshot.totalRubMinor ? formatMinorUnits(snapshot.totalRubMinor, "RUB") : "0 ₽",
        sharedLogisticsRubMinor: snapshot.sharedLogisticsRubMinor,
        lines: Array.isArray(snapshot.lines)
          ? snapshot.lines.map((l: any) => ({
              itemId: l.itemId,
              name: l.name,
              quantity: l.quantity,
              condition: l.condition,
              deliveryDays: l.deliveryDays,
              totalRubMinor: l.totalRubMinor,
              totalRubFormatted: formatMinorUnits(l.totalRubMinor, "RUB"),
            }))
          : [],
      };
    }

    return {
      id: req.id,
      number: req.number,
      status: req.status,
      createdAt: req.createdAt.toISOString(),
      customerComment: req.customerComment,
      vehicle: {
        make: req.vehicleMake,
        model: req.vehicleModel,
        year: req.vehicleYear,
        vin: req.vehicleVin,
      },
      items: req.items,
      customerOffer,
      customerOfferStatus: req.customerOfferStatus,
      customerResponseStatus: req.customerResponseStatus,
      linkedOrder: req.orders[0] || null,
      timeline: req.activityEvents.map((e) => ({
        id: e.id,
        action: e.action,
        text: (e.details as any)?.text || e.action,
        at: e.occurredAt.toISOString(),
      })),
    };
  }

  async createRequest(customerId: string, input: CreateCustomerRequestInput) {
    if (!input.items || input.items.length === 0) {
      throw new CustomerServiceError(400, "Добавьте хотя бы одну запрашиваемую деталь");
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) throw new CustomerServiceError(404, "Покупатель не найден");

    // If vehicleId passed, fill car info from garage
    let make = input.vehicleMake?.trim() || "";
    let model = input.vehicleModel?.trim() || "";
    let year = input.vehicleYear?.trim() || "";
    let vin = input.vehicleVin?.trim().toUpperCase() || "";

    if (input.vehicleId) {
      const vehicle = await prisma.customerVehicle.findFirst({
        where: { id: input.vehicleId, customerId },
      });
      if (vehicle) {
        make = vehicle.make;
        model = vehicle.model;
        year = vehicle.year ? String(vehicle.year) : "";
        vin = vehicle.vin;
      }
    }

    // Generate request number
    const count = await prisma.request.count();
    const reqNumber = `ZP-2026-${String(count + 150).padStart(4, "0")}`;

    const newRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.request.create({
        data: {
          number: reqNumber,
          customerId,
          status: "NEW",
          priority: "NORMAL",
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          customerEmailSnapshot: customer.email,
          customerComment: input.customerComment?.trim() || null,
          vehicleMake: make || null,
          vehicleModel: model || null,
          vehicleYear: year || null,
          vehicleVin: vin || null,
          items: {
            create: input.items.map((item) => ({
              description: item.description.trim(),
              requestedPartNumber: item.requestedPartNumber?.trim() || null,
              quantity: Math.max(1, Number(item.quantity) || 1),
              conditionPreference: item.conditionPreference?.trim() || "Любая",
              compatibilityNotes: item.compatibilityNotes?.trim() || null,
              photos: item.photos && item.photos.length > 0 ? item.photos : Prisma.JsonNull,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Log event
      await tx.activityLog.create({
        data: {
          entityType: "REQUEST",
          entityId: created.id,
          action: "Заявка создана покупателем в личном кабинете",
          details: { who: customer.name, number: created.number },
        },
      });

      return created;
    });

    return newRequest;
  }

  async respondToOffer(customerId: string, requestId: string, response: "ACCEPTED" | "REJECTED" | "NEEDS_CLARIFICATION", comment?: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);

    const req = await prisma.request.findFirst({
      where: {
        AND: [
          isUuid ? { id: requestId } : { number: requestId },
          { customerId },
        ],
      },
      include: {
        offers: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!req) throw new CustomerServiceError(404, "Заявка не найдена");

    const latestOffer = req.offers[0];
    if (!latestOffer) {
      throw new CustomerServiceError(400, "По данной заявке нет сформированного предложения");
    }

    const actionText =
      response === "ACCEPTED"
        ? "Покупатель подтвердил и принял коммерческое предложение"
        : response === "REJECTED"
        ? `Покупатель отклонил предложение${comment ? `: ${comment}` : ""}`
        : `Покупатель запросил уточнение${comment ? `: ${comment}` : ""}`;

    const newStatus = response === "ACCEPTED" ? "CONFIRMED" : response === "REJECTED" ? "CANCELLED" : req.status;

    await prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: req.id },
        data: {
          customerResponseStatus: response,
          status: newStatus,
        },
      });

      await tx.customerOffer.update({
        where: { id: latestOffer.id },
        data: {
          responseStatus: response,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: "REQUEST",
          entityId: req.id,
          action: actionText,
          details: { who: "Покупатель", response, comment },
        },
      });
    });

    let createdOrder: any = null;
    if (response === "ACCEPTED") {
      try {
        createdOrder = await orderService.createOrderFromRequest({
          requestId: req.id,
          customerComment: comment,
        });
      } catch (err) {
        console.error("Order creation from accepted offer error:", err);
      }
    }

    return {
      success: true,
      status: newStatus,
      responseStatus: response,
      orderId: createdOrder?.id || null,
      orderNumber: createdOrder?.orderNumber || null,
    };
  }

  // ---------------------------------------------------------------------------
  // ORDERS (ЗАКАЗЫ)
  // ---------------------------------------------------------------------------

  async listOrders(customerId: string) {
    const orders = await prisma.order.findMany({
      where: { customerId },
      include: {
        items: {
          select: {
            id: true,
            nameOnPurchase: true,
            requestedPartNumber: true,
            quantity: true,
            salePrice: true,
            totalAmount: true,
          },
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((ord) => ({
      id: ord.id,
      orderNumber: ord.orderNumber,
      status: ord.status,
      paymentStatus: ord.paymentStatus,
      deliveryStatus: ord.deliveryStatus,
      grandTotal: ord.grandTotal.toString(),
      grandTotalFormatted: `${Number(ord.grandTotal).toLocaleString("ru-RU")} ₽`,
      currency: ord.currency,
      createdAt: ord.createdAt.toISOString(),
      itemsCount: ord.items.length,
      itemsSummary: ord.items.map((i) => i.nameOnPurchase).join(", "),
      trackingNumber: ord.shipments[0]?.trackingNumber || null,
      carrier: ord.shipments[0]?.carrier || null,
    }));
  }

  async getOrderById(customerId: string, orderIdOrNumber: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);

    const ord = await prisma.order.findFirst({
      where: {
        AND: [
          isUuid ? { id: orderIdOrNumber } : { orderNumber: orderIdOrNumber },
          { customerId },
        ],
      },
      include: {
        items: {
          select: {
            id: true,
            nameOnPurchase: true,
            requestedPartNumber: true,
            condition: true,
            quantity: true,
            salePrice: true,
            totalAmount: true,
            product: {
              select: {
                brand: true,
              },
            },
            // STRICTLY NO supplierId, purchasePrice, markup, grossProfit!
          },
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            status: true,
            city: true,
            address: true,
            postalCode: true,
            pickupPointId: true,
            dispatchedAt: true,
            deliveredAt: true,
          },
        },
        documents: {
          select: {
            id: true,
            documentType: true,
            documentNumber: true,
            fileUrl: true,
            createdAt: true,
          },
        },
        messages: {
          where: { isInternal: false }, // Only client-facing communications!
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderType: true,
            message: true,
            attachments: true,
            authorName: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ord) throw new CustomerServiceError(404, "Заказ не найден");

    return {
      id: ord.id,
      orderNumber: ord.orderNumber,
      requestId: ord.requestId,
      status: ord.status,
      paymentStatus: ord.paymentStatus,
      deliveryStatus: ord.deliveryStatus,
      subtotal: ord.subtotal.toString(),
      logisticsTotal: ord.logisticsTotal.toString(),
      discountTotal: ord.discountTotal.toString(),
      grandTotal: ord.grandTotal.toString(),
      grandTotalFormatted: `${Number(ord.grandTotal).toLocaleString("ru-RU")} ₽`,
      currency: ord.currency,
      customerComment: ord.customerComment,
      createdAt: ord.createdAt.toISOString(),
      items: ord.items.map((i) => ({
        id: i.id,
        partName: i.nameOnPurchase,
        brand: i.product?.brand || "—",
        partNumber: i.requestedPartNumber || "",
        condition: i.condition,
        quantity: i.quantity,
        salePrice: i.salePrice.toString(),
        totalAmount: i.totalAmount.toString(),
      })),
      shipments: ord.shipments,
      documents: ord.documents,
      messages: ord.messages,
    };
  }

  // ---------------------------------------------------------------------------
  // DOCUMENTS & MESSAGES
  // ---------------------------------------------------------------------------

  async listDocuments(customerId: string) {
    return prisma.orderDocument.findMany({
      where: {
        order: { customerId },
      },
      select: {
        id: true,
        orderId: true,
        documentType: true,
        documentNumber: true,
        fileUrl: true,
        createdAt: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getDocumentById(customerId: string, documentId: string) {
    const doc = await prisma.orderDocument.findFirst({
      where: {
        id: documentId,
        order: { customerId },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            customerId: true,
          },
        },
      },
    });

    if (!doc) throw new CustomerServiceError(404, "Документ не найден");
    return doc;
  }

  async listOrderMessages(customerId: string, orderId: string) {
    const ord = await prisma.order.findFirst({
      where: { id: orderId, customerId },
    });

    if (!ord) throw new CustomerServiceError(404, "Заказ не найден");

    return prisma.orderMessage.findMany({
      where: {
        orderId,
        isInternal: false,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendOrderMessage(customerId: string, orderId: string, message: string, attachments?: any) {
    const ord = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: { customer: true },
    });

    if (!ord) throw new CustomerServiceError(404, "Заказ не найден");
    if (!message || !message.trim()) {
      throw new CustomerServiceError(400, "Сообщение не может быть пустым");
    }

    return prisma.orderMessage.create({
      data: {
        orderId,
        senderType: "CUSTOMER",
        isInternal: false,
        message: message.trim(),
        authorName: ord.customer.name,
        attachments: attachments || Prisma.JsonNull,
      },
    });
  }
}

export const customerPortalService = new CustomerPortalService();
