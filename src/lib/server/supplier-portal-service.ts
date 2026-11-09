import "server-only";

import { prisma } from "./db.ts";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import type { OfferCondition, OfferStatus, SupplierUserRole, SupplierUserStatus } from "@prisma/client";

export type SupplierOfferListItem = {
  id: string;
  productId: string;
  canonicalName: string;
  primaryOem: string;
  brand: string;
  category: string;
  photos: string[];
  originalTitle: string;
  rawArticle: string | null;
  purchasePrice: number | null;
  currency: string;
  quantity: number;
  condition: OfferCondition;
  status: OfferStatus;
  deliveryTerms: string | null;
  deliveryDays: number | null;
  sourceUrl: string | null;
  lastSeenAt: string;
  updatedAt: string;
};

export type SupplierDashboardMetrics = {
  activeOffersCount: number;
  outOfStockOffersCount: number;
  archivedOffersCount: number;
  totalProductsCount: number;
  latestJobs: {
    id: string;
    fileName: string;
    fileFormat: string;
    status: string;
    totalRows: number;
    validRows: number;
    errorRows: number;
    duplicateRows: number;
    createdAt: string;
  }[];
  priceFreshness: {
    freshOffersCount: number; // updated/seen within 7 days
    staleOffersCount: number; // older than 7 days
    freshPercentage: number;
  };
};

export class SupplierPortalService {
  /**
   * Dashboard KPI metrics for a specific supplier
   */
  async getDashboardMetrics(supplierId: string): Promise<SupplierDashboardMetrics> {
    const [activeOffersCount, outOfStockOffersCount, archivedOffersCount, allOffers] =
      await Promise.all([
        prisma.supplierOffer.count({
          where: { supplierId, status: { in: ["IN_STOCK", "ON_REQUEST"] } },
        }),
        prisma.supplierOffer.count({
          where: { supplierId, status: "OUT_OF_STOCK" },
        }),
        prisma.supplierOffer.count({
          where: { supplierId, status: "ARCHIVED_SOLD" },
        }),
        prisma.supplierOffer.findMany({
          where: { supplierId },
          select: { productId: true, lastSeenAt: true },
        }),
      ]);

    // Unique products
    const uniqueProductIds = new Set(allOffers.map((o) => o.productId));

    // Freshness calculation (within 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let freshCount = 0;
    let staleCount = 0;
    for (const o of allOffers) {
      if (new Date(o.lastSeenAt) >= sevenDaysAgo) freshCount++;
      else staleCount++;
    }
    const totalOffers = allOffers.length;
    const freshPercentage = totalOffers > 0 ? Math.round((freshCount / totalOffers) * 100) : 100;

    // Latest import jobs
    const jobs = await prisma.importJob.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        fileName: true,
        fileFormat: true,
        status: true,
        totalRows: true,
        validRows: true,
        errorRows: true,
        duplicateRows: true,
        createdAt: true,
      },
    });

    return {
      activeOffersCount,
      outOfStockOffersCount,
      archivedOffersCount,
      totalProductsCount: uniqueProductIds.size,
      latestJobs: jobs.map((j) => ({
        ...j,
        createdAt: j.createdAt.toISOString(),
      })),
      priceFreshness: {
        freshOffersCount: freshCount,
        staleOffersCount: staleCount,
        freshPercentage,
      },
    };
  }

  /**
   * Get paginated offers strictly scoped to supplierId
   */
  async getOffers(
    supplierId: string,
    params: {
      query?: string;
      status?: OfferStatus | "";
      condition?: OfferCondition | "";
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ items: SupplierOfferListItem[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: any = { supplierId };

    if (params.status) {
      where.status = params.status;
    }

    if (params.condition) {
      where.condition = params.condition;
    }

    if (params.query) {
      const q = params.query.trim();
      const cleanOem = q.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      where.OR = [
        { rawArticle: { contains: q, mode: "insensitive" } },
        { externalId: { contains: q, mode: "insensitive" } },
        { originalTitle: { contains: q, mode: "insensitive" } },
        { product: { primaryOem: { contains: cleanOem || q, mode: "insensitive" } } },
        { product: { canonicalName: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, offers] = await Promise.all([
      prisma.supplierOffer.count({ where }),
      prisma.supplierOffer.findMany({
        where,
        include: {
          product: {
            select: {
              canonicalName: true,
              primaryOem: true,
              brand: true,
              category: true,
              photos: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: offers.map((o) => ({
        id: o.id,
        productId: o.productId,
        canonicalName: o.product.canonicalName,
        primaryOem: o.product.primaryOem,
        brand: o.product.brand,
        category: o.product.category,
        photos: o.product.photos,
        originalTitle: o.originalTitle,
        rawArticle: o.rawArticle,
        purchasePrice: o.purchasePrice ? Number(o.purchasePrice) : null,
        currency: o.currency,
        quantity: o.quantity,
        condition: o.condition,
        status: o.status,
        deliveryTerms: o.deliveryTerms,
        deliveryDays: o.deliveryDays,
        sourceUrl: o.sourceUrl,
        lastSeenAt: o.lastSeenAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Update an offer strictly scoped to supplierId
   */
  async updateOffer(
    supplierId: string,
    offerId: string,
    data: {
      purchasePrice?: number;
      currency?: string;
      quantity?: number;
      condition?: OfferCondition;
      status?: OfferStatus;
      deliveryTerms?: string;
      deliveryDays?: number;
    }
  ): Promise<SupplierOfferListItem> {
    const existing = await prisma.supplierOffer.findFirst({
      where: { id: offerId, supplierId },
      include: { product: true },
    });

    if (!existing) {
      throw new Error("Предложение не найдено или принадлежит другому поставщику");
    }

    const updateData: any = {
      updatedAt: new Date(),
      lastSeenAt: new Date(),
    };

    if (typeof data.purchasePrice === "number" && !isNaN(data.purchasePrice)) {
      if (data.purchasePrice < 0) throw new Error("Цена не может быть отрицательной");
      updateData.purchasePrice = data.purchasePrice;
    }

    if (data.currency) {
      updateData.currency = data.currency.toUpperCase();
    }

    if (typeof data.quantity === "number") {
      updateData.quantity = Math.max(0, data.quantity);
      if (updateData.quantity === 0 && !data.status) {
        updateData.status = "OUT_OF_STOCK";
      }
    }

    if (data.condition) {
      updateData.condition = data.condition;
    }

    if (data.status) {
      updateData.status = data.status;
    }

    if (typeof data.deliveryTerms === "string") {
      updateData.deliveryTerms = data.deliveryTerms.trim();
    }

    if (typeof data.deliveryDays === "number") {
      updateData.deliveryDays = Math.max(0, data.deliveryDays);
    }

    const updated = await prisma.supplierOffer.update({
      where: { id: offerId },
      data: updateData,
      include: {
        product: {
          select: {
            canonicalName: true,
            primaryOem: true,
            brand: true,
            category: true,
            photos: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      productId: updated.productId,
      canonicalName: updated.product.canonicalName,
      primaryOem: updated.product.primaryOem,
      brand: updated.product.brand,
      category: updated.product.category,
      photos: updated.product.photos,
      originalTitle: updated.originalTitle,
      rawArticle: updated.rawArticle,
      purchasePrice: updated.purchasePrice ? Number(updated.purchasePrice) : null,
      currency: updated.currency,
      quantity: updated.quantity,
      condition: updated.condition,
      status: updated.status,
      deliveryTerms: updated.deliveryTerms,
      deliveryDays: updated.deliveryDays,
      sourceUrl: updated.sourceUrl,
      lastSeenAt: updated.lastSeenAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Suspend all offers of a supplier (without deleting products)
   */
  async suspendAllOffers(supplierId: string): Promise<{ updatedCount: number }> {
    const res = await prisma.supplierOffer.updateMany({
      where: {
        supplierId,
        status: { in: ["IN_STOCK", "ON_REQUEST"] },
      },
      data: {
        status: "OUT_OF_STOCK",
        updatedAt: new Date(),
      },
    });

    return { updatedCount: res.count };
  }

  /**
   * Get supplier profile
   */
  async getProfile(supplierId: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        legalName: true,
        innOrVat: true,
        countryCode: true,
        city: true,
        warehouseAddress: true,
        contactName: true,
        phone: true,
        email: true,
        specialization: true,
        terms: true,
        deliveryMethods: true,
        pickupAvailable: true,
        orderProcessingDays: true,
        supportedCurrencies: true,
        status: true,
      },
    });

    if (!supplier) throw new Error("Поставщик не найден");
    return supplier;
  }

  /**
   * Update supplier profile
   */
  async updateProfile(
    supplierId: string,
    data: {
      name?: string;
      legalName?: string;
      innOrVat?: string;
      city?: string;
      warehouseAddress?: string;
      contactName?: string;
      phone?: string;
      email?: string;
      specialization?: string;
      terms?: string;
      deliveryMethods?: string[];
      pickupAvailable?: boolean;
      orderProcessingDays?: number;
      supportedCurrencies?: string[];
    }
  ) {
    const updateData: any = {};
    if (data.name) updateData.name = data.name.trim();
    if (typeof data.legalName === "string") updateData.legalName = data.legalName.trim();
    if (typeof data.innOrVat === "string") updateData.innOrVat = data.innOrVat.trim();
    if (typeof data.city === "string") updateData.city = data.city.trim();
    if (typeof data.warehouseAddress === "string") updateData.warehouseAddress = data.warehouseAddress.trim();
    if (typeof data.contactName === "string") updateData.contactName = data.contactName.trim();
    if (typeof data.phone === "string") updateData.phone = data.phone.trim();
    if (typeof data.email === "string") updateData.email = data.email.trim();
    if (typeof data.specialization === "string") updateData.specialization = data.specialization.trim();
    if (typeof data.terms === "string") updateData.terms = data.terms.trim();
    if (Array.isArray(data.deliveryMethods)) updateData.deliveryMethods = data.deliveryMethods;
    if (typeof data.pickupAvailable === "boolean") updateData.pickupAvailable = data.pickupAvailable;
    if (typeof data.orderProcessingDays === "number") updateData.orderProcessingDays = Math.max(1, data.orderProcessingDays);
    if (Array.isArray(data.supportedCurrencies) && data.supportedCurrencies.length > 0) {
      updateData.supportedCurrencies = data.supportedCurrencies;
    }

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Create a direct user account for a supplier
   */
  async createSupplierUser(params: {
    supplierId: string;
    name: string;
    email: string;
    password: string;
    role?: SupplierUserRole;
  }): Promise<{ id: string; userId: string; email: string; name: string; role: string }> {
    const { supplierId, name, email, password, role = "MANAGER" } = params;
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      throw new Error(`Пользователь с email ${cleanEmail} уже зарегистрирован`);
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new Error("Поставщик не найден");
    }

    const hashedPassword = await hashPassword(password);
    const userId = randomUUID();
    const supplierUserId = randomUUID();

    // Create User, Account, and SupplierUser in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          name: name.trim(),
          email: cleanEmail,
          role: "SUPPLIER",
          active: true,
          emailVerified: true,
        },
      });

      await tx.account.create({
        data: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashedPassword,
        },
      });

      await tx.supplierUser.create({
        data: {
          id: supplierUserId,
          supplierId,
          userId,
          role,
          status: "ACTIVE",
        },
      });
    });

    return {
      id: supplierUserId,
      userId,
      email: cleanEmail,
      name: name.trim(),
      role,
    };
  }

  /**
   * List users belonging to a supplier
   */
  async listSupplierUsers(supplierId: string) {
    const users = await prisma.supplierUser.findMany({
      where: { supplierId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return users.map((su) => ({
      id: su.id,
      userId: su.userId,
      name: su.user.name,
      email: su.user.email,
      role: su.role,
      status: su.status,
      userActive: su.user.active,
      createdAt: su.createdAt.toISOString(),
    }));
  }

  /**
   * Toggle supplier user status (ACTIVE / SUSPENDED)
   */
  async setSupplierUserStatus(
    supplierId: string,
    supplierUserId: string,
    status: SupplierUserStatus
  ) {
    const member = await prisma.supplierUser.findFirst({
      where: { id: supplierUserId, supplierId },
    });
    if (!member) throw new Error("Пользователь поставщика не найден");

    const updated = await prisma.supplierUser.update({
      where: { id: supplierUserId },
      data: { status },
    });

    // Also update User.active
    await prisma.user.update({
      where: { id: member.userId },
      data: { active: status === "ACTIVE" },
    });

    return updated;
  }

  /**
   * Create an invitation for a supplier user
   */
  async createInvitation(params: {
    supplierId: string;
    email: string;
    role?: SupplierUserRole;
    invitedById?: string;
  }) {
    const { supplierId, email, role = "MANAGER", invitedById } = params;
    const cleanEmail = email.trim().toLowerCase();

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) throw new Error("Поставщик не найден");

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.supplierInvitation.create({
      data: {
        supplierId,
        email: cleanEmail,
        role,
        token,
        status: "PENDING",
        invitedById,
        expiresAt,
      },
    });

    return invitation;
  }

  /**
   * Accept an invitation and create supplier user account
   */
  async acceptInvitation(params: {
    token: string;
    name: string;
    password: string;
  }) {
    const { token, name, password } = params;

    const invitation = await prisma.supplierInvitation.findUnique({
      where: { token },
      include: { supplier: true },
    });

    if (!invitation) throw new Error("Приглашение не найдено");
    if (invitation.status !== "PENDING") throw new Error("Приглашение уже использовано или отозвано");
    if (new Date() > invitation.expiresAt) {
      await prisma.supplierInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new Error("Срок действия приглашения истёк");
    }

    const created = await this.createSupplierUser({
      supplierId: invitation.supplierId,
      name,
      email: invitation.email,
      password,
      role: invitation.role,
    });

    await prisma.supplierInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    return created;
  }
}

export const supplierPortalService = new SupplierPortalService();
