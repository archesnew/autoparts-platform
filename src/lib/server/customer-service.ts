import crypto from "node:crypto";
import { normalizeEmail, normalizePhone } from "../customer-model.ts";

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  normalizedEmail: string | null;
  internalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  requests?: Array<{ id: string; number: string; createdAt: Date }>;
  _count?: { requests: number };
};

export type CustomerFields = {
  name: string;
  phone?: string | null;
  email?: string | null;
  internalNote?: string | null;
};

export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  normalizedEmail: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  requestsCount?: number;
  requests?: Array<{ id: string; number: string; createdAt: string }>;
};

export type CustomerRepository = {
  search(input: {
    query: string;
    normalizedPhone: string;
    normalizedEmail: string;
    skip: number;
    take: number;
  }): Promise<{ customers: CustomerRecord[]; total: number }>;
  findById(id: string): Promise<CustomerRecord | null>;
  findByNormalizedContacts(phone: string | null, email: string | null, excludeId?: string): Promise<CustomerRecord[]>;
  create(data: Omit<CustomerRecord, "id" | "createdAt" | "updatedAt" | "requests" | "_count"> & { id?: string }): Promise<CustomerRecord>;
  update(id: string, data: Omit<CustomerRecord, "id" | "createdAt" | "updatedAt" | "requests" | "_count">): Promise<CustomerRecord>;
  recordActivity(customerId: string, action: string, fields: string[]): Promise<void>;
  transaction<T>(work: (repository: CustomerRepository) => Promise<T>): Promise<T>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUSTOMER_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export function toDeterministicUuid(id: string): string {
  if (uuidPattern.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.from(CUSTOMER_UUID_NAMESPACE.replace(/-/g, ""), "hex"))
    .update(id)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // RFC 4122 version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.toString("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function toCustomerDto(
  record: CustomerRecord,
  staff: { role: string; permissions: string[] },
): CustomerDto {
  const isSuperAdmin = staff.role === "SUPER_ADMIN";
  const canReadContacts = isSuperAdmin || staff.permissions.includes("customers.contact.read");
  const canReadInternal = isSuperAdmin || staff.permissions.includes("customers.internal.read");

  return {
    id: record.id,
    name: record.name,
    phone: canReadContacts ? record.phone : null,
    normalizedPhone: canReadContacts ? record.normalizedPhone : null,
    email: canReadContacts ? record.email : null,
    normalizedEmail: canReadContacts ? record.normalizedEmail : null,
    internalNote: canReadInternal ? record.internalNote : null,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : String(record.updatedAt),
    requestsCount: record._count?.requests ?? record.requests?.length,
    requests: record.requests?.map((req) => ({
      id: req.id,
      number: req.number,
      createdAt: req.createdAt instanceof Date ? req.createdAt.toISOString() : String(req.createdAt),
    })),
  };
}

function cleanFields(fields: CustomerFields) {
  const name = fields.name.trim();
  const phone = (fields.phone ?? "").trim();
  const email = (fields.email ?? "").trim();
  const internalNote = (fields.internalNote ?? "").trim();
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  if (!name) throw new Error("Укажите имя клиента");
  if (name.length > 200) throw new Error("Имя клиента не должно превышать 200 символов");
  if (phone && normalizedPhone.length < 7) throw new Error("Укажите корректный номер телефона");
  if (phone.length > 64) throw new Error("Телефон не должен превышать 64 символа");
  if (email && !emailPattern.test(email)) throw new Error("Проверьте формат email");
  if (email.length > 254) throw new Error("Email не должен превышать 254 символа");
  if (internalNote.length > 10000) throw new Error("Внутренняя заметка слишком длинная");

  return {
    name,
    phone: phone || null,
    normalizedPhone: normalizedPhone || null,
    email: email || null,
    normalizedEmail: normalizedEmail || null,
    internalNote: internalNote || null,
  };
}

async function assertNoDuplicate(
  repository: CustomerRepository,
  values: ReturnType<typeof cleanFields>,
  excludeId?: string,
) {
  const candidates = await repository.findByNormalizedContacts(
    values.normalizedPhone,
    values.normalizedEmail,
    excludeId,
  );
  const conflict = candidates.find(candidate =>
    (values.normalizedPhone && candidate.normalizedPhone === values.normalizedPhone) ||
    (values.normalizedEmail && candidate.normalizedEmail === values.normalizedEmail),
  );
  if (conflict) throw new Error("Клиент с таким телефоном или email уже существует; выберите существующий профиль");
}

export function searchCustomers(repository: CustomerRepository, query: string, page = 1, pageSize = 25) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize = Number.isInteger(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 25;
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  return repository.search({
    query: normalizedQuery,
    normalizedPhone: normalizePhone(normalizedQuery),
    normalizedEmail: normalizeEmail(normalizedQuery),
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
}

export async function getCustomer(repository: CustomerRepository, customerId: string) {
  if (!uuidPattern.test(customerId)) throw new Error("Некорректный ID клиента");
  const customer = await repository.findById(customerId);
  if (!customer) throw new Error("Клиент не найден");
  return customer;
}

export async function createCustomer(
  repository: CustomerRepository,
  fields: CustomerFields & { id?: string },
) {
  const values = cleanFields(fields);
  const targetId = fields.id ? toDeterministicUuid(fields.id) : undefined;
  return repository.transaction(async transaction => {
    await assertNoDuplicate(transaction, values);
    const customer = await transaction.create(targetId ? { ...values, id: targetId } : values);
    await transaction.recordActivity(customer.id, "CUSTOMER_CREATED", ["profile"]);
    return customer;
  });
}

export async function migrateDemoCustomers(
  repository: CustomerRepository,
  demoCustomers: Array<CustomerFields & { id: string }>,
) {
  const idMap: Record<string, string> = {};
  const migrated: CustomerRecord[] = [];

  for (const demo of demoCustomers) {
    const targetId = toDeterministicUuid(demo.id);
    const cleaned = cleanFields(demo);

    // 1. Check if customer with this ID already exists
    const existingById = await repository.findById(targetId);
    if (existingById) {
      idMap[demo.id] = existingById.id;
      migrated.push(existingById);
      continue;
    }

    // 2. Check if customer with same normalized contacts already exists
    const existingContacts = await repository.findByNormalizedContacts(
      cleaned.normalizedPhone,
      cleaned.normalizedEmail,
    );
    if (existingContacts.length > 0) {
      const match = existingContacts[0];
      idMap[demo.id] = match.id;
      migrated.push(match);
      continue;
    }

    // 3. Create safely in DB without overwriting newer data
    const created = await repository.transaction(async (tx) => {
      const existingInTx = await tx.findByNormalizedContacts(
        cleaned.normalizedPhone,
        cleaned.normalizedEmail,
      );
      if (existingInTx.length > 0) {
        return existingInTx[0];
      }
      const newCust = await tx.create({ ...cleaned, id: targetId });
      await tx.recordActivity(newCust.id, "CUSTOMER_MIGRATED", ["profile"]);
      return newCust;
    });

    idMap[demo.id] = created.id;
    migrated.push(created);
  }

  return { idMap, customers: migrated };
}

export async function updateCustomer(
  repository: CustomerRepository,
  customerId: string,
  fields: CustomerFields,
) {
  if (!uuidPattern.test(customerId)) throw new Error("Некорректный ID клиента");
  const values = cleanFields(fields);
  return repository.transaction(async transaction => {
    const current = await transaction.findById(customerId);
    if (!current) throw new Error("Клиент не найден");
    await assertNoDuplicate(transaction, values, customerId);
    const changedFields = (Object.keys(values) as Array<keyof typeof values>).filter(key => current[key] !== values[key]);
    if (changedFields.length === 0) return current;
    const updated = await transaction.update(customerId, values);
    await transaction.recordActivity(customerId, "CUSTOMER_UPDATED", changedFields);
    return updated;
  });
}
