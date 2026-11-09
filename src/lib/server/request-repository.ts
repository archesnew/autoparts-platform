import "server-only";

import { Prisma, PrismaClient, RequestStatus, SupplierQuoteStatus, CustomerOfferStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type {
  CustomerOfferInput,
  RequestFields,
  RequestItemInput,
  RequestRepository,
  RequestUpdate,
  SupplierQuoteInput,
  TaskInput,
} from "@/lib/server/request-service";

type Db = PrismaClient | Prisma.TransactionClient;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PrismaRequestRepository implements RequestRepository {
  private readonly db: Db;
  private readonly root?: PrismaClient;

  constructor(db: Db, root?: PrismaClient) {
    this.db = db;
    this.root = root;
  }

  async search(input: Parameters<RequestRepository["search"]>[0]) {
    const OR: Prisma.RequestWhereInput[] = [];
    if (input.query) {
      OR.push(
        { number: { contains: input.query, mode: "insensitive" } },
        { customerNameSnapshot: { contains: input.query, mode: "insensitive" } },
        { customerPhoneSnapshot: { contains: input.query } },
        { customerEmailSnapshot: { contains: input.query, mode: "insensitive" } },
        { vehicleMake: { contains: input.query, mode: "insensitive" } },
        { vehicleModel: { contains: input.query, mode: "insensitive" } },
        { vehicleVin: { contains: input.query, mode: "insensitive" } },
        { items: { some: { description: { contains: input.query, mode: "insensitive" } } } },
        { items: { some: { requestedPartNumber: { contains: input.query, mode: "insensitive" } } } },
      );
    }

    const where: Prisma.RequestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority
        ? { priority: input.priority === "Высокий" ? "HIGH" : input.priority === "Обычный" ? "NORMAL" : input.priority }
        : {}),
      ...(input.manager
        ? {
            OR: [
              { managerNameSnapshot: { contains: input.manager, mode: "insensitive" } },
              { assignedManager: { name: { contains: input.manager, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(OR.length ? { OR } : {}),
    };

    let orderBy: Prisma.RequestOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "asc" }];
    if (input.sort === "oldest") {
      orderBy = [{ createdAt: "asc" }, { id: "asc" }];
    }

    const [requests, total] = await Promise.all([
      this.db.request.findMany({
        where,
        orderBy,
        skip: input.skip,
        take: input.take,
        include: {
          customer: true,
          assignedManager: true,
          items: {
            include: {
              supplierInquiries: true,
              supplierQuotes: { include: { supplier: true }, orderBy: { createdAt: "asc" } },
            },
          },
          offers: {
            include: {
              items: { include: { supplierQuote: { include: { supplier: true } } } },
            },
            orderBy: { version: "desc" },
          },
          tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
          activityEvents: { orderBy: { occurredAt: "asc" }, include: { actor: true } },
        },
      }),
      this.db.request.count({ where }),
    ]);

    return { requests, total };
  }

  async findById(idOrNumber: string) {
    const isUuid = uuidPattern.test(idOrNumber);
    const where: Prisma.RequestWhereUniqueInput = isUuid
      ? { id: idOrNumber.toLowerCase() }
      : { number: idOrNumber };

    return this.db.request.findUnique({
      where,
      include: {
        customer: true,
        assignedManager: true,
        items: {
          include: {
            supplierInquiries: true,
            supplierQuotes: { include: { supplier: true }, orderBy: { createdAt: "asc" } },
          },
        },
        offers: {
          include: {
            items: { include: { supplierQuote: { include: { supplier: true } } } },
          },
          orderBy: { version: "desc" },
        },
        tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
        activityEvents: { orderBy: { occurredAt: "asc" }, include: { actor: true } },
      },
    });
  }

  async findCustomerSnapshot(id: string) {
    return this.db.customer.findUnique({
      where: { id },
      select: { id: true, name: true, phone: true, email: true, normalizedPhone: true, normalizedEmail: true },
    });
  }

  async findCustomerByContacts(phone: string | null, email: string | null) {
    const OR: Prisma.CustomerWhereInput[] = [];
    if (phone) OR.push({ normalizedPhone: phone }, { phone });
    if (email) OR.push({ normalizedEmail: email.toLowerCase() }, { email });
    if (!OR.length) return null;
    return this.db.customer.findFirst({ where: { OR } });
  }

  async findSupplier(id: string) {
    return this.db.supplier.findUnique({ where: { id } });
  }

  async listSuppliers() {
    return this.db.supplier.findMany({
      select: { id: true, name: true, countryCode: true, contactName: true, phone: true, email: true },
      orderBy: { name: "asc" },
    });
  }

  async findManager(id: string) {
    return this.db.user.findFirst({ where: { id, active: true }, select: { id: true, name: true } });
  }

  async create(data: RequestFields) {
    const { items, customerId, assignedManagerId, id, createdAt, updatedAt, ...fields } = data;
    return this.db.request.create({
      data: {
        ...(id ? { id } : {}),
        ...fields,
        status: fields.status || "NEW",
        customer: { connect: { id: customerId } },
        ...(assignedManagerId ? { assignedManager: { connect: { id: assignedManagerId } } } : {}),
        items: {
          create: items.map((item) => ({
            ...(item.id ? { id: item.id } : {}),
            description: item.description,
            requestedPartNumber: item.requestedPartNumber || null,
            quantity: item.quantity,
            conditionPreference: item.conditionPreference || null,
            compatibilityNotes: item.compatibilityNotes || null,
          })),
        },
        ...(createdAt ? { createdAt } : {}),
      },
      include: {
        customer: true,
        assignedManager: true,
        items: {
          include: {
            supplierInquiries: true,
            supplierQuotes: { include: { supplier: true } },
          },
        },
      },
    });
  }

  async update(id: string, data: RequestUpdate) {
    const { assignedManagerId, ...fields } = data;
    return this.db.request.update({
      where: { id },
      data: {
        ...fields,
        ...(assignedManagerId === undefined
          ? {}
          : assignedManagerId === null
            ? { assignedManager: { disconnect: true } }
            : { assignedManager: { connect: { id: assignedManagerId } } }),
      },
    });
  }

  async createItem(requestId: string, data: RequestItemInput) {
    return this.db.requestItem.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        requestId,
        description: data.description,
        requestedPartNumber: data.requestedPartNumber || null,
        quantity: data.quantity,
        conditionPreference: data.conditionPreference || null,
        compatibilityNotes: data.compatibilityNotes || null,
      },
    });
  }

  async updateItem(requestId: string, itemId: string, data: Partial<RequestItemInput>) {
    const result = await this.db.requestItem.updateMany({
      where: { id: itemId, requestId },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.requestedPartNumber !== undefined ? { requestedPartNumber: data.requestedPartNumber } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.conditionPreference !== undefined ? { conditionPreference: data.conditionPreference } : {}),
        ...(data.compatibilityNotes !== undefined ? { compatibilityNotes: data.compatibilityNotes } : {}),
      },
    });
    if (result.count !== 1) throw new Error("Позиция не найдена в этой заявке");
    return this.db.requestItem.findUnique({ where: { id: itemId } });
  }

  async deleteItem(requestId: string, itemId: string) {
    const result = await this.db.requestItem.deleteMany({ where: { id: itemId, requestId } });
    if (result.count !== 1) throw new Error("Позиция не найдена в этой заявке");
    return { id: itemId };
  }

  async createQuote(data: SupplierQuoteInput) {
    return this.db.supplierQuote.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        requestItem: { connect: { id: data.requestItemId } },
        supplier: { connect: { id: data.supplierId } },
        partNumber: data.partNumber || null,
        manufacturer: data.manufacturer || null,
        condition: data.condition || null,
        purchasePrice: data.purchasePrice !== null && data.purchasePrice !== undefined ? new Prisma.Decimal(data.purchasePrice.toString()) : null,
        currency: data.currency || "RUB",
        quantityAvailable: data.quantityAvailable ?? null,
        deliveryDays: data.deliveryDays ?? null,
        deliveryCost: data.deliveryCost !== null && data.deliveryCost !== undefined ? new Prisma.Decimal(data.deliveryCost.toString()) : null,
        shippingBasis: data.shippingBasis || "ORDER",
        compatibilityNote: data.compatibilityNote || null,
        sourceUrl: data.sourceUrl || null,
        internalComment: data.internalComment || null,
        status: data.status || "RECEIVED",
      },
      include: { supplier: true },
    });
  }

  async updateQuote(quoteId: string, data: Partial<SupplierQuoteInput>) {
    const updateData: Prisma.SupplierQuoteUpdateInput = {
      ...(data.partNumber !== undefined ? { partNumber: data.partNumber } : {}),
      ...(data.manufacturer !== undefined ? { manufacturer: data.manufacturer } : {}),
      ...(data.condition !== undefined ? { condition: data.condition } : {}),
      ...(data.purchasePrice !== undefined
        ? { purchasePrice: data.purchasePrice !== null ? new Prisma.Decimal(data.purchasePrice.toString()) : null }
        : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.quantityAvailable !== undefined ? { quantityAvailable: data.quantityAvailable } : {}),
      ...(data.deliveryDays !== undefined ? { deliveryDays: data.deliveryDays } : {}),
      ...(data.deliveryCost !== undefined
        ? { deliveryCost: data.deliveryCost !== null ? new Prisma.Decimal(data.deliveryCost.toString()) : null }
        : {}),
      ...(data.shippingBasis !== undefined ? { shippingBasis: data.shippingBasis } : {}),
      ...(data.compatibilityNote !== undefined ? { compatibilityNote: data.compatibilityNote } : {}),
      ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl } : {}),
      ...(data.internalComment !== undefined ? { internalComment: data.internalComment } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    };
    return this.db.supplierQuote.update({
      where: { id: quoteId },
      data: updateData,
      include: { supplier: true },
    });
  }

  async deleteQuote(quoteId: string) {
    return this.db.supplierQuote.delete({ where: { id: quoteId } });
  }

  async createCustomerOffer(data: CustomerOfferInput) {
    return this.db.customerOffer.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        request: { connect: { id: data.requestId } },
        version: data.version ?? 1,
        status: data.status || "DRAFT",
        currency: data.currency || "RUB",
        customerNote: data.customerNote || null,
        sharedLogisticsRub: data.sharedLogisticsRub !== undefined && data.sharedLogisticsRub !== null ? new Prisma.Decimal(data.sharedLogisticsRub.toString()) : null,
        responseStatus: data.responseStatus || "NO_RESPONSE",
        sentAt: data.sentAt ? new Date(data.sentAt) : null,
        snapshot: data.snapshot ?? Prisma.JsonNull,
        items: data.items && data.items.length
          ? {
              create: data.items.map((item) => ({
                ...(item.id ? { id: item.id } : {}),
                requestItem: { connect: { id: item.requestItemId } },
                supplierQuote: { connect: { id: item.supplierQuoteId } },
                quantity: item.quantity,
                customerUnitPrice: new Prisma.Decimal(item.customerUnitPrice.toString()),
                currency: item.currency,
                deliveryDays: item.deliveryDays ?? null,
                conditionSnapshot: item.conditionSnapshot || null,
              })),
            }
          : undefined,
      },
      include: {
        items: { include: { supplierQuote: { include: { supplier: true } } } },
      },
    });
  }

  async updateCustomerOffer(offerId: string, data: Partial<CustomerOfferInput>) {
    return this.db.customerOffer.update({
      where: { id: offerId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.customerNote !== undefined ? { customerNote: data.customerNote } : {}),
        ...(data.sharedLogisticsRub !== undefined
          ? { sharedLogisticsRub: data.sharedLogisticsRub !== null ? new Prisma.Decimal(data.sharedLogisticsRub.toString()) : null }
          : {}),
        ...(data.responseStatus !== undefined ? { responseStatus: data.responseStatus } : {}),
        ...(data.sentAt !== undefined ? { sentAt: data.sentAt ? new Date(data.sentAt) : null } : {}),
        ...(data.snapshot !== undefined ? { snapshot: data.snapshot ?? Prisma.JsonNull } : {}),
      },
      include: {
        items: { include: { supplierQuote: { include: { supplier: true } } } },
      },
    });
  }

  async createTask(data: TaskInput) {
    return this.db.task.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        ...(data.requestId ? { request: { connect: { id: data.requestId } } } : {}),
        ...(data.assigneeId ? { assignee: { connect: { id: data.assigneeId } } } : {}),
        title: data.title,
        description: data.description || null,
        priority: data.priority || "NORMAL",
        category: data.category || null,
        status: data.status || "OPEN",
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
      },
      include: { request: true },
    });
  }

  async updateTask(taskId: string, data: Partial<TaskInput>) {
    return this.db.task.update({
      where: { id: taskId },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
      },
      include: { request: true },
    });
  }

  async listTasks(filter?: { requestId?: string; status?: TaskStatus }) {
    return this.db.task.findMany({
      where: {
        ...(filter?.requestId ? { requestId: filter.requestId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      include: { request: true },
    });
  }

  async recordActivity(
    requestId: string,
    entityType: string,
    entityId: string,
    action: string,
    details?: any,
    occurredAt?: Date,
    actorId?: string,
  ) {
    await this.db.activityLog.create({
      data: {
        ...(requestId ? { request: { connect: { id: requestId } } } : {}),
        entityType,
        entityId,
        action,
        details: (details ?? {}) as Prisma.InputJsonValue,
        occurredAt: occurredAt || new Date(),
        ...(actorId ? { actor: { connect: { id: actorId } } } : {}),
      },
    });
  }

  async transaction<T>(work: (repository: RequestRepository) => Promise<T>): Promise<T> {
    if (!this.root) throw new Error("Nested request transactions are not supported");
    return this.root.$transaction<T>(
      (transaction): Promise<T> => work(new PrismaRequestRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export const requestRepository: RequestRepository = new PrismaRequestRepository(prisma, prisma);
