export type Customer = {
  id: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  email: string;
  normalizedEmail: string;
  createdAt: string;
  updatedAt: string;
  internalNote: string;
};

export type CustomerRequest = {
  id: string;
  customerId?: string;
  customer: string;
  phone: string;
  email: string;
  events?: Array<{ at: string; text: string; who: string }>;
};

export const CUSTOMERS_STORAGE_KEY = "zaptut.crm.demo.customers.v1";

export type CustomerRegistryEntry<T extends CustomerRequest> = {
  customer: Customer;
  requests: T[];
};

/** Builds one registry row per persisted customer profile, never per request. */
export function buildCustomerRegistry<T extends CustomerRequest>(
  customers: Customer[],
  requests: T[],
): CustomerRegistryEntry<T>[] {
  const uniqueCustomers = [...new Map(customers.map(customer => [customer.id, customer])).values()];
  return uniqueCustomers.map(customer => ({
    customer,
    requests: requests.filter(request => request.customerId === customer.id),
  }));
}

/** Filters unique customer profiles by profile fields or any linked request snapshot. */
export function searchCustomerRegistry<T extends CustomerRequest & { make?: string; model?: string; year?: string }>(
  entries: CustomerRegistryEntry<T>[],
  query: string,
): CustomerRegistryEntry<T>[] {
  const normalizedQuery = query.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
  if (!normalizedQuery) return entries;
  const phoneQuery = normalizePhone(query);
  return entries.filter(({ customer, requests }) => {
    const profileFields = [customer.name, customer.email].join(" ").toLocaleLowerCase("ru-RU");
    const profilePhone = normalizePhone(customer.phone);
    if (profileFields.includes(normalizedQuery) || (phoneQuery && profilePhone.includes(phoneQuery))) return true;
    return requests.some(request => {
      const requestFields = [request.id, request.make, request.model, request.year]
        .filter(Boolean).join(" ").toLocaleLowerCase("ru-RU");
      return requestFields.includes(normalizedQuery);
    });
  });
}

export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Treat the common Russian domestic 8-prefix and international +7 as one number.
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return digits;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export type CustomerProfileFields = Pick<Customer, "name" | "phone" | "email" | "internalNote">;

/** Updates one canonical profile without touching linked request snapshots. */
export function updateCustomerProfile(
  customers: Customer[],
  customerId: string,
  fields: CustomerProfileFields,
  now = new Date().toISOString(),
): Customer[] {
  const current = customers.find(customer => customer.id === customerId);
  if (!current) throw new Error("Профиль клиента не найден");

  const name = fields.name.trim();
  const phone = fields.phone.trim();
  const email = fields.email.trim();
  const internalNote = fields.internalNote.trim();
  if (!name) throw new Error("Укажите имя клиента");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Проверьте формат email");

  const normalizedPhone = normalizePhone(phone);
  if (phone && normalizedPhone.length < 7) throw new Error("Укажите корректный номер телефона");
  const normalizedEmail = normalizeEmail(email);
  const conflict = customers.find(customer => customer.id !== customerId && (
    (normalizedPhone && normalizePhone(customer.phone) === normalizedPhone) ||
    (normalizedEmail && normalizeEmail(customer.email) === normalizedEmail)
  ));
  if (conflict) {
    const phoneConflict = Boolean(normalizedPhone && normalizePhone(conflict.phone) === normalizedPhone);
    throw new Error(phoneConflict
      ? `Этот телефон уже указан у другого профиля: ${conflict.name}`
      : `Этот email уже указан у другого профиля: ${conflict.name}`);
  }

  return customers.map(customer => customer.id === customerId ? {
    ...customer,
    name,
    phone,
    normalizedPhone,
    email,
    normalizedEmail,
    internalNote,
    updatedAt: now,
  } : customer);
}

export function normalizeCustomers(value: unknown): Customer[] | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { version?: unknown; customers?: unknown };
  if (raw.version !== 1 || !Array.isArray(raw.customers)) return null;
  const valid = raw.customers.filter((entry): entry is Customer => {
    if (!entry || typeof entry !== "object") return false;
    const customer = entry as Partial<Customer>;
    return typeof customer.id === "string" && customer.id.length > 0 &&
      typeof customer.name === "string" && typeof customer.phone === "string" &&
      typeof customer.normalizedPhone === "string" && typeof customer.email === "string" &&
      typeof customer.normalizedEmail === "string" && typeof customer.createdAt === "string" &&
      typeof customer.updatedAt === "string" && typeof customer.internalNote === "string";
  });
  // Recompute indexes from canonical contact fields so stale stored normalized values
  // cannot prevent a new request from matching the existing profile.
  return [...new Map(valid.map(customer => [customer.id, {
    ...customer,
    normalizedPhone: normalizePhone(customer.phone),
    normalizedEmail: normalizeEmail(customer.email),
  }])).values()];
}

function stableId(key: string): string {
  // FNV-1a produces a repeatable ID without exposing a phone number or email in storage keys.
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `cust-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function identityKey(request: CustomerRequest): string | null {
  const phone = normalizePhone(request.phone ?? "");
  if (phone) return `phone:${phone}`;
  const email = normalizeEmail(request.email ?? "");
  return email ? `email:${email}` : null;
}

function makeCustomer(request: CustomerRequest, id: string, now: string): Customer {
  const phone = request.phone ?? "";
  const email = request.email ?? "";
  return {
    id,
    name: (request.customer ?? "").trim(),
    phone,
    normalizedPhone: normalizePhone(phone),
    email,
    normalizedEmail: normalizeEmail(email),
    createdAt: now,
    updatedAt: now,
    internalNote: "",
  };
}

/** Links legacy request rows to profiles; existing links always win, making migration repeatable. */
export function migrateCustomerLinks<T extends CustomerRequest>(
  requests: T[],
  existingCustomers: Customer[],
  now = new Date().toISOString(),
): { requests: Array<T & { customerId: string }>; customers: Customer[] } {
  const customers = [...existingCustomers];
  const byId = new Map(customers.map(customer => [customer.id, customer]));
  const phoneIndex = new Map<string, Customer[]>();
  const emailIndex = new Map<string, Customer[]>();
  for (const customer of customers) {
    const normalizedPhone = normalizePhone(customer.phone);
    const normalizedEmail = normalizeEmail(customer.email);
    if (normalizedPhone) phoneIndex.set(normalizedPhone, [...(phoneIndex.get(normalizedPhone) ?? []), customer]);
    if (normalizedEmail) emailIndex.set(normalizedEmail, [...(emailIndex.get(normalizedEmail) ?? []), customer]);
  }

  const pending = new Map<string, T[]>();
  const links = new Map<string, string>();
  for (const request of requests) {
    if (request.customerId && byId.has(request.customerId)) {
      links.set(request.id, request.customerId);
      continue;
    }

    const phone = normalizePhone(request.phone ?? "");
    const email = normalizeEmail(request.email ?? "");
    const candidates = phone ? phoneIndex.get(phone) ?? [] : email ? emailIndex.get(email) ?? [] : [];
    if (candidates.length === 1) {
      links.set(request.id, candidates[0].id);
      continue;
    }
    // Multiple saved profiles match: do not choose one automatically. Isolate each legacy row.
    const key = candidates.length > 1 ? `ambiguous:${request.id}` : identityKey(request);
    if (!key) {
      const id = `cust-${stableId(`request:${request.id}`).slice(5)}`;
      const customer = makeCustomer(request, id, now);
      customers.push(customer);
      byId.set(id, customer);
      links.set(request.id, id);
      continue;
    }
    pending.set(key, [...(pending.get(key) ?? []), request]);
  }

  for (const [key, group] of pending) {
    const existingId = stableId(key);
    let customer = byId.get(existingId);
    if (!customer) {
      customer = makeCustomer(group[0], existingId, now);
      customers.push(customer);
      byId.set(existingId, customer);
      const phone = customer.normalizedPhone;
      const email = customer.normalizedEmail;
      if (phone) phoneIndex.set(phone, [...(phoneIndex.get(phone) ?? []), customer]);
      if (email) emailIndex.set(email, [...(emailIndex.get(email) ?? []), customer]);
    }
    for (const request of group) links.set(request.id, customer.id);
  }

  return {
    requests: requests.map(request => ({ ...request, customerId: links.get(request.id) ?? request.customerId ?? stableId(`request:${request.id}`) })),
    customers: [...new Map(customers.map(customer => [customer.id, customer])).values()],
  };
}

export type CustomerMergeResult<T extends CustomerRequest> = {
  requests: T[];
  customers: Customer[];
  changed: boolean;
  reassignedRequestIds: string[];
};

/** Explicit, pure merge operation. It never accesses browser storage or runs at startup. */
export function mergeDuplicateCustomer<T extends CustomerRequest>(
  requests: T[],
  customers: Customer[],
  canonicalCustomerId: string,
  duplicateCustomerId: string,
  now = new Date().toISOString(),
): CustomerMergeResult<T> {
  if (canonicalCustomerId === duplicateCustomerId) throw new Error("Нельзя объединить профиль с самим собой");
  const canonical = customers.find(customer => customer.id === canonicalCustomerId);
  if (!canonical) throw new Error(`Основной профиль не найден: ${canonicalCustomerId}`);
  const duplicate = customers.find(customer => customer.id === duplicateCustomerId);
  const referencedRequests = requests.filter(request => request.customerId === duplicateCustomerId);

  // Repeated application after a successful merge is an idempotent no-op.
  if (!duplicate && referencedRequests.length === 0) {
    return { requests, customers, changed: false, reassignedRequestIds: [] };
  }
  if (!duplicate) throw new Error("Профиль-дубль отсутствует, но на него ещё ссылаются заявки");

  const canonicalPhone = normalizePhone(canonical.phone);
  const duplicatePhone = normalizePhone(duplicate.phone);
  if (!canonicalPhone || canonicalPhone !== duplicatePhone) {
    throw new Error("Объединение отменено: нормализованные телефоны профилей не совпадают");
  }

  const mergedProfileNote = `Объединён профиль ${duplicate.id}; прежние данные: имя «${duplicate.name}», телефон «${duplicate.phone}», email «${duplicate.email}».`;
  const noteParts = [canonical.internalNote.trim(), duplicate.internalNote.trim(), mergedProfileNote].filter(Boolean);
  const uniqueNotes = [...new Set(noteParts)];
  const mergedCanonical: Customer = {
    ...canonical,
    email: canonical.email || duplicate.email,
    normalizedEmail: normalizeEmail(canonical.email || duplicate.email),
    internalNote: uniqueNotes.join("\n"),
    createdAt: canonical.createdAt < duplicate.createdAt ? canonical.createdAt : duplicate.createdAt,
    updatedAt: now,
    normalizedPhone: canonicalPhone,
  };

  const reassignedRequestIds = referencedRequests.map(request => request.id);
  const nextRequests = requests.map(request => {
    if (request.customerId !== duplicateCustomerId) return request;
    const event = {
      at: now,
      text: `Демо-объединение клиентов по нормализованному телефону: ${duplicateCustomerId} → ${canonicalCustomerId}`,
      who: "Администратор · DEMO",
    };
    return {
      ...request,
      customerId: canonicalCustomerId,
      events: request.events ? [event, ...request.events] : request.events,
    };
  });

  if (nextRequests.some(request => request.customerId === duplicateCustomerId)) {
    throw new Error("Объединение отменено: остались заявки со ссылкой на профиль-дубль");
  }

  return {
    requests: nextRequests,
    customers: customers.filter(customer => customer.id !== duplicateCustomerId).map(customer =>
      customer.id === canonicalCustomerId ? mergedCanonical : customer,
    ),
    changed: true,
    reassignedRequestIds,
  };
}
