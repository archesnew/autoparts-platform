export type SupplierStatus = "ACTIVE" | "REVIEW" | "SUSPENDED";
export type SupplierInquiryStatus = "DRAFT" | "SENT" | "RECEIVED" | "DECLINED" | "EXPIRED";
export type SupplierQuoteStatus = "RECEIVED" | "SELECTED" | "DECLINED" | "EXPIRED";

export type SupplierFields = {
  name: string;
  countryCode: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  specialization?: string | null;
  terms?: string | null;
  internalNote?: string | null;
  status?: SupplierStatus;
};

export type SupplierQuoteFields = {
  requestItemId: string;
  supplierId: string;
  inquiryId?: string | null;
  partNumber?: string | null;
  manufacturer?: string | null;
  condition?: string | null;
  purchasePrice?: string | null;
  currency?: string | null;
  quantityAvailable?: number | null;
  deliveryCost?: string | null;
  deliveryCurrency?: string | null;
  deliveryDays?: number | null;
  compatibilityNote?: string | null;
  sourceUrl?: string | null;
  internalComment?: string | null;
  validUntil?: Date | null;
  status?: SupplierQuoteStatus;
};

export type SupplierRepository = {
  searchSuppliers(input: { query: string; status?: SupplierStatus; countryCode?: string; skip: number; take: number }): Promise<{ suppliers: unknown[]; total: number }>;
  findSupplier(id: string): Promise<any | null>;
  createSupplier(data: ReturnType<typeof normalizeSupplierFields>): Promise<any>;
  updateSupplier(id: string, data: Partial<ReturnType<typeof normalizeSupplierFields>>): Promise<any>;
  findRequestItem(id: string): Promise<{ id: string; requestId: string } | null>;
  findInquiry(id: string): Promise<{ id: string; requestItemId: string; supplierId: string; status: SupplierInquiryStatus; requestId: string } | null>;
  findQuote(id: string): Promise<SupplierQuoteFields & { id: string; requestId: string } | null>;
  createInquiry(data: { requestItemId: string; supplierId: string; responseDueAt: Date | null; internalComment: string | null }): Promise<any>;
  updateInquiry(id: string, data: { status: SupplierInquiryStatus; sentAt?: Date; respondedAt?: Date }): Promise<any>;
  createQuote(data: ReturnType<typeof normalizeQuoteFields>): Promise<any>;
  updateQuote(id: string, data: Partial<ReturnType<typeof normalizeQuoteFields>>): Promise<any>;
  recordActivity(entityId: string, entityType: string, action: string, requestId: string | null, fields: string[]): Promise<void>;
  transaction<T>(work: (repository: SupplierRepository) => Promise<T>): Promise<T>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const decimalPattern = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/;
const supplierStatuses = new Set<SupplierStatus>(["ACTIVE", "REVIEW", "SUSPENDED"]);
const inquiryStatuses = new Set<SupplierInquiryStatus>(["DRAFT", "SENT", "RECEIVED", "DECLINED", "EXPIRED"]);
const quoteStatuses = new Set<SupplierQuoteStatus>(["RECEIVED", "SELECTED", "DECLINED", "EXPIRED"]);

function assertUuid(value: string, label: string) {
  if (!uuidPattern.test(value)) throw new Error(`Некорректный ${label}`);
}

function normalizeSupplierFields(fields: SupplierFields) {
  const name = fields.name.trim();
  const countryCode = fields.countryCode.trim().toUpperCase();
  const email = fields.email?.trim() || null;
  if (!name) throw new Error("Укажите название поставщика");
  if (name.length > 200 || (fields.contactName?.length ?? 0) > 200 || (fields.phone?.length ?? 0) > 64 || (email?.length ?? 0) > 254) throw new Error("Контактные данные поставщика слишком длинные");
  if ((fields.specialization?.length ?? 0) > 2000 || (fields.terms?.length ?? 0) > 5000 || (fields.internalNote?.length ?? 0) > 10000) throw new Error("Описание поставщика слишком длинное");
  if (!["PL", "RU", "BY"].includes(countryCode)) throw new Error("Страна должна быть PL, RU или BY");
  if (email && !emailPattern.test(email)) throw new Error("Проверьте формат email поставщика");
  if (fields.status && !supplierStatuses.has(fields.status)) throw new Error("Недопустимый статус поставщика");
  return {
    name,
    countryCode,
    contactName: fields.contactName?.trim() || null,
    phone: fields.phone?.trim() || null,
    email,
    specialization: fields.specialization?.trim() || null,
    terms: fields.terms?.trim() || null,
    internalNote: fields.internalNote?.trim() || null,
    status: fields.status ?? "REVIEW" as SupplierStatus,
  };
}

function normalizeQuoteFields(fields: SupplierQuoteFields) {
  assertUuid(fields.requestItemId, "ID позиции заявки");
  assertUuid(fields.supplierId, "ID поставщика");
  if (fields.inquiryId) assertUuid(fields.inquiryId, "ID запроса поставщику");
  if (fields.purchasePrice !== undefined && fields.purchasePrice !== null && !decimalPattern.test(fields.purchasePrice)) throw new Error("Закупочная цена должна быть десятичной строкой до 4 знаков после запятой");
  if (fields.deliveryCost !== undefined && fields.deliveryCost !== null && !decimalPattern.test(fields.deliveryCost)) throw new Error("Стоимость доставки должна быть десятичной строкой до 4 знаков после запятой");
  for (const currency of [fields.currency, fields.deliveryCurrency]) {
    if (currency != null && !/^[A-Za-z]{3}$/.test(currency.trim())) throw new Error("Код валюты должен содержать 3 буквы");
  }
  if (fields.quantityAvailable != null && (!Number.isInteger(fields.quantityAvailable) || fields.quantityAvailable < 0)) throw new Error("Наличие должно быть неотрицательным целым числом");
  if (fields.deliveryDays != null && (!Number.isInteger(fields.deliveryDays) || fields.deliveryDays < 0)) throw new Error("Срок доставки должен быть неотрицательным целым числом дней");
  if (fields.status && !quoteStatuses.has(fields.status)) throw new Error("Недопустимый статус предложения поставщика");
  if (fields.sourceUrl && !/^https?:\/\//i.test(fields.sourceUrl)) throw new Error("Ссылка на источник должна начинаться с http:// или https://");
  if ((fields.partNumber?.length ?? 0) > 120 || (fields.manufacturer?.length ?? 0) > 200 || (fields.condition?.length ?? 0) > 100 || (fields.compatibilityNote?.length ?? 0) > 4000 || (fields.internalComment?.length ?? 0) > 5000 || (fields.sourceUrl?.length ?? 0) > 2048) throw new Error("Одно из полей предложения слишком длинное");
  if (fields.validUntil && !Number.isFinite(fields.validUntil.getTime())) throw new Error("Некорректная дата срока действия предложения");
  return {
    requestItemId: fields.requestItemId,
    supplierId: fields.supplierId,
    inquiryId: fields.inquiryId ?? null,
    partNumber: fields.partNumber?.trim() || null,
    manufacturer: fields.manufacturer?.trim() || null,
    condition: fields.condition?.trim() || null,
    purchasePrice: fields.purchasePrice ?? null,
    currency: fields.currency?.trim().toUpperCase() || null,
    quantityAvailable: fields.quantityAvailable ?? null,
    deliveryCost: fields.deliveryCost ?? null,
    deliveryCurrency: fields.deliveryCurrency?.trim().toUpperCase() || null,
    deliveryDays: fields.deliveryDays ?? null,
    compatibilityNote: fields.compatibilityNote?.trim() || null,
    sourceUrl: fields.sourceUrl?.trim() || null,
    internalComment: fields.internalComment?.trim() || null,
    validUntil: fields.validUntil ?? null,
    status: fields.status ?? "RECEIVED" as SupplierQuoteStatus,
  };
}

export function searchSuppliers(repository: SupplierRepository, query: string, filters: { status?: SupplierStatus; countryCode?: string; page?: number; pageSize?: number } = {}) {
  if (filters.status && !supplierStatuses.has(filters.status)) throw new Error("Недопустимый статус поставщика");
  const countryCode = filters.countryCode?.toUpperCase();
  if (countryCode && !["PL", "RU", "BY"].includes(countryCode)) throw new Error("Недопустимый код страны");
  const page = Number.isInteger(filters.page) && (filters.page ?? 0) > 0 ? filters.page! : 1;
  const pageSize = Number.isInteger(filters.pageSize) ? Math.min(100, Math.max(1, filters.pageSize!)) : 25;
  return repository.searchSuppliers({ query: query.trim().replace(/\s+/g, " "), status: filters.status, countryCode, skip: (page - 1) * pageSize, take: pageSize });
}

export async function createSupplier(repository: SupplierRepository, input: SupplierFields) {
  const data = normalizeSupplierFields(input);
  return repository.transaction(async tx => {
    const created = await tx.createSupplier(data);
    await tx.recordActivity(created.id, "SUPPLIER", "SUPPLIER_CREATED", null, ["profile"]);
    return created;
  });
}

export async function updateSupplier(repository: SupplierRepository, id: string, input: Partial<SupplierFields>) {
  assertUuid(id, "ID поставщика");
  if (!Object.keys(input).length || Object.keys(input).some(key => !["name", "countryCode", "contactName", "phone", "email", "specialization", "terms", "internalNote", "status"].includes(key))) throw new Error("Нет допустимых полей для изменения поставщика");
  return repository.transaction(async tx => {
    const current = await tx.findSupplier(id);
    if (!current) throw new Error("Поставщик не найден");
    const merged = normalizeSupplierFields({ ...current, ...input });
    const changed = Object.keys(input).filter(key => (current as Record<string, unknown>)[key] !== (merged as unknown as Record<string, unknown>)[key]);
    if (!changed.length) return current;
    const statusChanged = input.status !== undefined && input.status !== current.status;
    const updated = await tx.updateSupplier(id, merged);
    const action = statusChanged ? "SUPPLIER_STATUS_CHANGED" : "SUPPLIER_UPDATED";
    await tx.recordActivity(id, "SUPPLIER", action, null, changed);
    return updated;
  });
}

export async function createSupplierInquiry(repository: SupplierRepository, input: { requestItemId: string; supplierId: string; responseDueAt?: Date | null; internalComment?: string | null }) {
  assertUuid(input.requestItemId, "ID позиции заявки");
  assertUuid(input.supplierId, "ID поставщика");
  if (input.responseDueAt && !Number.isFinite(input.responseDueAt.getTime())) throw new Error("Некорректный срок ответа поставщика");
  if ((input.internalComment?.length ?? 0) > 5000) throw new Error("Внутренний комментарий слишком длинный");
  return repository.transaction(async tx => {
    if (!await tx.findSupplier(input.supplierId)) throw new Error("Поставщик не найден");
    if (!await tx.findRequestItem(input.requestItemId)) throw new Error("Позиция заявки не найдена");
    const item = await tx.findRequestItem(input.requestItemId);
    if (!item) throw new Error("Позиция заявки не найдена");
    const inquiry = await tx.createInquiry({
      requestItemId: input.requestItemId,
      supplierId: input.supplierId,
      responseDueAt: input.responseDueAt ?? null,
      internalComment: input.internalComment?.trim() || null,
    });
    await tx.recordActivity(inquiry.id, "SUPPLIER_INQUIRY", "SUPPLIER_INQUIRY_CREATED", item.requestId, ["inquiry"]);
    return inquiry;
  });
}

const inquiryTransitions: Record<SupplierInquiryStatus, SupplierInquiryStatus[]> = {
  DRAFT: ["SENT", "DECLINED"], SENT: ["RECEIVED", "DECLINED", "EXPIRED"],
  RECEIVED: ["EXPIRED"], DECLINED: [], EXPIRED: [],
};

export async function updateSupplierInquiryStatus(repository: SupplierRepository, id: string, status: SupplierInquiryStatus) {
  assertUuid(id, "ID запроса поставщику");
  if (!inquiryStatuses.has(status)) throw new Error("Недопустимый статус запроса поставщику");
  return repository.transaction(async tx => {
    const current = await tx.findInquiry(id);
    if (!current) throw new Error("Запрос поставщику не найден");
    if (current.status === status) return current;
    if (!inquiryTransitions[current.status].includes(status)) throw new Error(`Недопустимый переход статуса запроса: ${current.status} → ${status}`);
    const now = new Date();
    const updated = await tx.updateInquiry(id, { status, ...(status === "SENT" ? { sentAt: now } : {}), ...(status === "RECEIVED" ? { respondedAt: now } : {}) });
    await tx.recordActivity(id, "SUPPLIER_INQUIRY", "SUPPLIER_INQUIRY_STATUS_CHANGED", current.requestId, ["status"]);
    return updated;
  });
}

export async function createSupplierQuote(repository: SupplierRepository, input: SupplierQuoteFields) {
  const data = normalizeQuoteFields(input);
  return repository.transaction(async tx => {
    const [supplier, item, inquiry] = await Promise.all([
      tx.findSupplier(data.supplierId),
      tx.findRequestItem(data.requestItemId),
      data.inquiryId ? tx.findInquiry(data.inquiryId) : Promise.resolve(null),
    ]);
    if (!supplier) throw new Error("Поставщик не найден");
    if (!item) throw new Error("Позиция заявки не найдена");
    if (data.inquiryId && (!inquiry || inquiry.requestItemId !== data.requestItemId || inquiry.supplierId !== data.supplierId)) throw new Error("Запрос поставщику не соответствует позиции и поставщику предложения");
    const quote = await tx.createQuote(data);
    await tx.recordActivity(quote.id, "SUPPLIER_QUOTE", "SUPPLIER_QUOTE_CREATED", item.requestId, ["quote"]);
    return quote;
  });
}

export async function updateSupplierQuote(repository: SupplierRepository, id: string, patch: Partial<Omit<SupplierQuoteFields, "requestItemId" | "supplierId" | "inquiryId">>) {
  assertUuid(id, "ID предложения поставщика");
  if (!Object.keys(patch).length || Object.keys(patch).some(key => !["partNumber", "manufacturer", "condition", "purchasePrice", "currency", "quantityAvailable", "deliveryCost", "deliveryCurrency", "deliveryDays", "compatibilityNote", "sourceUrl", "internalComment", "validUntil", "status"].includes(key))) throw new Error("Нет допустимых полей для изменения предложения");
  return repository.transaction(async tx => {
    const current = await tx.findQuote(id);
    if (!current) throw new Error("Предложение поставщика не найдено");
    const normalized = normalizeQuoteFields({
      ...current,
      ...(current.purchasePrice !== null && typeof current.purchasePrice !== "string" ? { purchasePrice: String(current.purchasePrice) } : {}),
      ...(current.deliveryCost !== null && typeof current.deliveryCost !== "string" ? { deliveryCost: String(current.deliveryCost) } : {}),
      ...patch,
    } as SupplierQuoteFields);
    const updated = await tx.updateQuote(id, normalized);
    await tx.recordActivity(id, "SUPPLIER_QUOTE", "SUPPLIER_QUOTE_UPDATED", current.requestId, Object.keys(patch));
    return updated;
  });
}
