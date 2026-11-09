import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { SupplierRepository, SupplierInquiryStatus } from "@/lib/server/supplier-service";

type Db = PrismaClient | Prisma.TransactionClient;

class PrismaSupplierRepository implements SupplierRepository {
  private readonly db: Db;
  private readonly root?: PrismaClient;

  constructor(db: Db, root?: PrismaClient) {
    this.db = db;
    this.root = root;
  }

  async searchSuppliers(input: Parameters<SupplierRepository["searchSuppliers"]>[0]) {
    const OR: Prisma.SupplierWhereInput[] = [];
    if (input.query) {
      OR.push(
        { name: { contains: input.query, mode: "insensitive" } },
        { countryCode: { contains: input.query, mode: "insensitive" } },
        { contactName: { contains: input.query, mode: "insensitive" } },
        { email: { contains: input.query, mode: "insensitive" } },
        { specialization: { contains: input.query, mode: "insensitive" } },
      );
    }
    const where: Prisma.SupplierWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.countryCode ? { countryCode: input.countryCode } : {}),
      ...(OR.length ? { OR } : {}),
    };
    const [suppliers, total] = await Promise.all([
      this.db.supplier.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: input.skip,
        take: input.take,
        include: { _count: { select: { inquiries: true, quotes: true } } },
      }),
      this.db.supplier.count({ where }),
    ]);
    return { suppliers, total };
  }

  async findSupplier(id: string) {
    return this.db.supplier.findUnique({ where: { id }, include: { inquiries: true, quotes: true } });
  }

  async createSupplier(data: Parameters<SupplierRepository["createSupplier"]>[0]) {
    return this.db.supplier.create({ data });
  }

  async updateSupplier(id: string, data: Partial<Parameters<SupplierRepository["createSupplier"]>[0]>) {
    return this.db.supplier.update({ where: { id }, data });
  }

  async findRequestItem(id: string) {
    return this.db.requestItem.findUnique({ where: { id }, select: { id: true, requestId: true } });
  }

  async findInquiry(id: string) {
    return this.db.supplierInquiry.findUnique({
      where: { id },
      select: { id: true, requestItemId: true, supplierId: true, status: true, requestItem: { select: { requestId: true } } },
    }).then(inquiry => inquiry ? {
      id: inquiry.id, requestItemId: inquiry.requestItemId, supplierId: inquiry.supplierId,
      status: inquiry.status, requestId: inquiry.requestItem.requestId,
    } : null);
  }

  async findQuote(id: string) {
    const quote = await this.db.supplierQuote.findUnique({
      where: { id },
      include: { requestItem: { select: { requestId: true } } },
    });
    return quote ? { ...quote, purchasePrice: quote.purchasePrice?.toString() ?? null, deliveryCost: quote.deliveryCost?.toString() ?? null, requestId: quote.requestItem.requestId } : null;
  }

  async createInquiry(data: { requestItemId: string; supplierId: string; responseDueAt: Date | null; internalComment: string | null }) {
    return this.db.supplierInquiry.create({
      data: {
        requestItem: { connect: { id: data.requestItemId } },
        supplier: { connect: { id: data.supplierId } },
        responseDueAt: data.responseDueAt,
        internalComment: data.internalComment,
        status: "DRAFT",
      },
      include: { requestItem: { select: { requestId: true } } },
    });
  }

  async updateInquiry(id: string, data: { status: SupplierInquiryStatus; sentAt?: Date; respondedAt?: Date }) {
    return this.db.supplierInquiry.update({ where: { id }, data });
  }

  async createQuote(data: Parameters<SupplierRepository["createQuote"]>[0]) {
    const { requestItemId, supplierId, inquiryId, ...fields } = data;
    return this.db.supplierQuote.create({
      data: {
        ...fields,
        requestItem: { connect: { id: requestItemId } },
        supplier: { connect: { id: supplierId } },
        ...(inquiryId ? { inquiry: { connect: { id: inquiryId } } } : {}),
      },
      include: { requestItem: { select: { requestId: true } }, supplier: true },
    });
  }

  async updateQuote(id: string, data: Partial<Parameters<SupplierRepository["createQuote"]>[0]>) {
    const { requestItemId: _requestItemId, supplierId: _supplierId, inquiryId, ...fields } = data;
    return this.db.supplierQuote.update({
      where: { id },
      data: {
        ...fields,
        ...(inquiryId === undefined ? {} : inquiryId === null ? { inquiry: { disconnect: true } } : { inquiry: { connect: { id: inquiryId } } }),
      },
      include: { requestItem: { select: { requestId: true } }, supplier: true },
    });
  }

  async recordActivity(entityId: string, entityType: string, action: string, requestId: string | null, fields: string[]) {
    await this.db.activityLog.create({
      data: {
        entityType,
        entityId,
        action,
        ...(requestId ? { requestId } : {}),
        details: { fields } as Prisma.InputJsonValue,
      },
    });
  }

  async transaction<T>(work: (repository: SupplierRepository) => Promise<T>): Promise<T> {
    if (!this.root) throw new Error("Nested supplier transactions are not supported");
    return this.root.$transaction<T>(
      (transaction): Promise<T> => work(new PrismaSupplierRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export const supplierRepository: SupplierRepository = new PrismaSupplierRepository(prisma, prisma);
