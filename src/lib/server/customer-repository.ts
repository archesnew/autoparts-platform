import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/server/db";
import type { CustomerRecord, CustomerRepository } from "@/lib/server/customer-service";

type Db = PrismaClient | Prisma.TransactionClient;

class PrismaCustomerRepository implements CustomerRepository {
  private readonly db: Db;
  private readonly root?: PrismaClient;

  constructor(db: Db, root?: PrismaClient) {
    this.db = db;
    this.root = root;
  }

  async search(input: Parameters<CustomerRepository["search"]>[0]) {
    const normalizedQuery = input.query.toLocaleLowerCase("ru-RU");
    const conditions: Prisma.CustomerWhereInput[] = [];
    if (input.query) {
      conditions.push(
        { name: { contains: input.query, mode: "insensitive" } },
        { email: { contains: input.query, mode: "insensitive" } },
        { phone: { contains: input.query } },
        { requests: { some: { number: { contains: input.query, mode: "insensitive" } } } },
      );
      if (input.normalizedEmail) conditions.push({ normalizedEmail: { contains: normalizedQuery } });
      if (input.normalizedPhone) conditions.push({ normalizedPhone: { contains: input.normalizedPhone } });
    }
    const where: Prisma.CustomerWhereInput = conditions.length ? { OR: conditions } : {};
    const [customers, total] = await Promise.all([
      this.db.customer.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: input.skip,
        take: input.take,
        include: { _count: { select: { requests: true } } },
      }),
      this.db.customer.count({ where }),
    ]);
    return { customers: customers as unknown as CustomerRecord[], total };
  }

  async findById(id: string) {
    const customer = await this.db.customer.findUnique({
      where: { id },
      include: { requests: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, createdAt: true } } },
    });
    return customer as CustomerRecord | null;
  }

  async findByNormalizedContacts(phone: string | null, email: string | null, excludeId?: string) {
    const OR: Prisma.CustomerWhereInput[] = [];
    if (phone) OR.push({ normalizedPhone: phone });
    if (email) OR.push({ normalizedEmail: email });
    if (!OR.length) return [];
    const customers = await this.db.customer.findMany({
      where: { ...(excludeId ? { id: { not: excludeId } } : {}), OR },
      select: { id: true, name: true, phone: true, normalizedPhone: true, email: true, normalizedEmail: true, internalNote: true, createdAt: true, updatedAt: true },
    });
    return customers as CustomerRecord[];
  }

  async create(data: Parameters<CustomerRepository["create"]>[0]) {
    return await this.db.customer.create({ data }) as CustomerRecord;
  }

  async update(id: string, data: Parameters<CustomerRepository["update"]>[1]) {
    return await this.db.customer.update({ where: { id }, data }) as CustomerRecord;
  }

  async recordActivity(customerId: string, action: string, fields: string[]) {
    await this.db.activityLog.create({
      data: {
        entityType: "CUSTOMER",
        entityId: customerId,
        action,
        details: { fields },
      },
    });
  }

  async transaction<T>(work: (repository: CustomerRepository) => Promise<T>): Promise<T> {
    if (!this.root) throw new Error("Nested customer transactions are not supported");
    return this.root.$transaction<T>(
      (transaction): Promise<T> => work(new PrismaCustomerRepository(transaction)),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export const customerRepository: CustomerRepository = new PrismaCustomerRepository(prisma, prisma);
