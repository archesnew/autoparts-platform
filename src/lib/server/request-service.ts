import {
  Prisma,
  RequestStatus,
  SupplierQuoteStatus,
  CustomerOfferStatus,
  TaskStatus,
} from "@prisma/client";
import { toDeterministicUuid } from "./customer-service.ts";
import type { StaffContext } from "./staff-session.ts";
import { calculateRetailPrice, convertMinorUnitsToRub, formatMinorUnits, initialFinancialConfig } from "../financial-config.ts";

export type { RequestStatus, SupplierQuoteStatus, CustomerOfferStatus, TaskStatus };

export type BuyerResponseStatus = "NO_RESPONSE" | "INTERESTED" | "NEEDS_CLARIFICATION" | "ACCEPTED" | "REJECTED";

export type RequestItemInput = {
  id?: string;
  description: string;
  requestedPartNumber?: string | null;
  quantity: number;
  conditionPreference?: string | null;
  compatibilityNotes?: string | null;
};

export type RequestFields = {
  id?: string;
  customerId: string;
  number: string;
  status?: RequestStatus;
  assignedManagerId?: string | null;
  managerNameSnapshot?: string | null;
  priority?: string;
  customerNameSnapshot?: string | null;
  customerPhoneSnapshot?: string | null;
  customerEmailSnapshot?: string | null;
  customerComment?: string | null;
  internalNote?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | null;
  vehicleVin?: string | null;
  customerOfferStatus?: CustomerOfferStatus | null;
  customerResponseStatus?: string | null;
  items: RequestItemInput[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type RequestUpdate = Partial<
  Pick<
    RequestFields,
    | "assignedManagerId"
    | "managerNameSnapshot"
    | "customerComment"
    | "internalNote"
    | "vehicleMake"
    | "vehicleModel"
    | "vehicleYear"
    | "vehicleVin"
    | "customerOfferStatus"
    | "customerResponseStatus"
  >
> & {
  status?: RequestStatus;
  priority?: string;
};

export type SupplierQuoteInput = {
  id?: string;
  requestItemId: string;
  supplierId: string;
  partNumber?: string | null;
  manufacturer?: string | null;
  condition?: string | null;
  purchasePrice?: number | string | Prisma.Decimal | null;
  currency?: string | null;
  quantityAvailable?: number | null;
  deliveryDays?: number | null;
  deliveryCost?: number | string | Prisma.Decimal | null;
  shippingBasis?: string | null;
  compatibilityNote?: string | null;
  sourceUrl?: string | null;
  internalComment?: string | null;
  status?: SupplierQuoteStatus;
};

export type TaskInput = {
  id?: string;
  requestId?: string | null;
  assigneeId?: string | null;
  title: string;
  description?: string | null;
  priority?: string | null;
  category?: string | null;
  status?: TaskStatus;
  dueAt?: Date | string | null;
};

export type CustomerOfferInput = {
  id?: string;
  requestId: string;
  version?: number;
  status?: CustomerOfferStatus;
  currency?: string;
  customerNote?: string | null;
  sharedLogisticsRub?: number | string | Prisma.Decimal | null;
  responseStatus?: string | null;
  sentAt?: Date | string | null;
  snapshot?: any;
  items?: Array<{
    id?: string;
    requestItemId: string;
    supplierQuoteId: string;
    quantity: number;
    customerUnitPrice: number | string | Prisma.Decimal;
    currency: string;
    deliveryDays?: number | null;
    conditionSnapshot?: string | null;
  }>;
};

export type RequestRepository = {
  search(input: {
    query: string;
    status?: RequestStatus;
    priority?: string;
    manager?: string;
    sort?: string;
    skip: number;
    take: number;
  }): Promise<{ requests: any[]; total: number }>;
  findById(idOrNumber: string): Promise<any | null>;
  findCustomerSnapshot(id: string): Promise<{ id: string; name: string; phone: string | null; email: string | null } | null>;
  findCustomerByContacts(phone: string | null, email: string | null): Promise<any | null>;
  findSupplier(id: string): Promise<any | null>;
  listSuppliers(): Promise<any[]>;
  findManager(id: string): Promise<{ id: string; name: string } | null>;
  create(data: RequestFields): Promise<any>;
  update(id: string, data: RequestUpdate): Promise<any>;
  createItem(requestId: string, data: RequestItemInput): Promise<any>;
  updateItem(requestId: string, itemId: string, data: Partial<RequestItemInput>): Promise<any>;
  deleteItem(requestId: string, itemId: string): Promise<{ id: string }>;
  createQuote(data: SupplierQuoteInput): Promise<any>;
  updateQuote(quoteId: string, data: Partial<SupplierQuoteInput>): Promise<any>;
  deleteQuote(quoteId: string): Promise<any>;
  createCustomerOffer(data: CustomerOfferInput): Promise<any>;
  updateCustomerOffer(offerId: string, data: Partial<CustomerOfferInput>): Promise<any>;
  createTask(data: TaskInput): Promise<any>;
  updateTask(taskId: string, data: Partial<TaskInput>): Promise<any>;
  listTasks(filter?: { requestId?: string; status?: TaskStatus }): Promise<any[]>;
  recordActivity(
    requestId: string,
    entityType: string,
    entityId: string,
    action: string,
    details?: any,
    occurredAt?: Date,
    actorId?: string,
  ): Promise<void>;
  transaction<T>(work: (repository: RequestRepository) => Promise<T>): Promise<T>;
};

const statuses = new Set<RequestStatus>([
  "NEW", "ASSIGNED", "SEARCHING", "WAITING_SUPPLIERS", "OFFERS_READY",
  "SENT_TO_CUSTOMER", "WAITING_CUSTOMER", "CONFIRMED", "COMPLETED", "CANCELLED",
]);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COUNTRY_NAME_MAP: Record<string, string> = {
  RU: "Россия",
  BY: "Беларусь",
  PL: "Польша",
};

export const transitions: Record<RequestStatus, RequestStatus[]> = {
  NEW: ["ASSIGNED", "SEARCHING", "CANCELLED"],
  ASSIGNED: ["SEARCHING", "WAITING_SUPPLIERS", "CANCELLED"],
  SEARCHING: ["WAITING_SUPPLIERS", "OFFERS_READY", "CANCELLED"],
  WAITING_SUPPLIERS: ["SEARCHING", "OFFERS_READY", "CANCELLED"],
  OFFERS_READY: ["SEARCHING", "WAITING_CUSTOMER", "CONFIRMED", "CANCELLED"],
  SENT_TO_CUSTOMER: ["WAITING_CUSTOMER", "CONFIRMED", "CANCELLED"],
  WAITING_CUSTOMER: ["OFFERS_READY", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function localDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

export function parseDateString(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value.trim()) return new Date();
  const match = /(\d{2})\.(\d{2})\.(\d{4}),?\s+(\d{2}):(\d{2})/.exec(value);
  if (match) {
    const [, d, m, y, h, min] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min)));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeItem(item: RequestItemInput): RequestItemInput {
  const description = item.description.trim();
  if (!description) throw new Error("Укажите название запрашиваемой детали");
  if (description.length > 500) throw new Error("Название детали не должно превышать 500 символов");
  if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) {
    throw new Error("Количество детали должно быть целым числом от 1 до 10000");
  }
  return {
    ...(item.id ? { id: item.id } : {}),
    description,
    requestedPartNumber: item.requestedPartNumber?.trim() || null,
    quantity: item.quantity,
    conditionPreference: item.conditionPreference?.trim() || null,
    compatibilityNotes: item.compatibilityNotes?.trim() || null,
  };
}

// -------------------------------------------------------------
// DTO Transformers
// -------------------------------------------------------------

export function toItemDto(item: any) {
  const hasSelectedQuote = item.supplierQuotes?.some((q: any) => q.status === "SELECTED");
  const hasReceivedQuote = item.supplierQuotes?.some((q: any) => q.status === "RECEIVED");
  const hasInquiry = item.supplierInquiries && item.supplierInquiries.length > 0;

  let selectionStatus: "SEARCHING" | "CHECKING" | "FOUND" | "NOT_FOUND" = "SEARCHING";
  if (hasSelectedQuote) selectionStatus = "FOUND";
  else if (hasReceivedQuote || hasInquiry) selectionStatus = "CHECKING";

  return {
    id: item.id,
    name: item.description,
    oem: item.requestedPartNumber || "",
    qty: item.quantity,
    note: item.conditionPreference || "",
    compatibility: item.compatibilityNotes || "",
    selectionStatus,
  };
}

export function toQuoteDto(quote: any, staff?: StaffContext) {
  const isSuperAdmin = staff?.role === "SUPER_ADMIN";
  const canSeePurchase = Boolean(isSuperAdmin || staff?.permissions?.includes("quotes.purchase.read"));

  let customerPriceRub: string | null = null;
  if (quote.purchasePrice) {
    try {
      const countryCode = quote.supplier?.countryCode;
      const country = countryCode === "BY" ? "Беларусь" : countryCode === "PL" ? "Польша" : "Россия";
      const calc = calculateRetailPrice({
        purchaseAmount: quote.purchasePrice.toString(),
        currency: (quote.currency || "RUB") as any,
        supplierCountry: country,
        config: initialFinancialConfig,
      });
      const fxRate = (initialFinancialConfig.rubPerCurrencyUnit as any)[quote.currency || "RUB"] || "1.00";
      const rubMinor = convertMinorUnitsToRub(calc.customerPriceMinor, (quote.currency || "RUB") as any, fxRate);
      customerPriceRub = formatMinorUnits(rubMinor, "RUB");
    } catch {
      customerPriceRub = null;
    }
  }

  return {
    id: quote.id,
    itemId: quote.requestItemId,
    supplierId: quote.supplierId,
    supplierName: quote.supplier?.name || "",
    country: quote.supplier?.countryCode ? (COUNTRY_NAME_MAP[quote.supplier.countryCode] || quote.supplier.countryCode) : "Россия",
    article: quote.partNumber || "",
    maker: quote.manufacturer || "",
    condition: quote.condition || "Новая",
    cost: canSeePurchase ? (quote.purchasePrice ? quote.purchasePrice.toString() : "0.00") : null,
    purchasePrice: canSeePurchase ? (quote.purchasePrice ? quote.purchasePrice.toString() : "0.00") : null,
    customerPriceRub,
    currency: quote.currency || "RUB",
    availability: quote.quantityAvailable ? `${quote.quantityAvailable} шт.` : "Есть",
    deliveryDays: quote.deliveryDays ?? 3,
    shipping: canSeePurchase ? (quote.deliveryCost ? quote.deliveryCost.toString() : "0.00") : "0.00",
    shippingBasis: quote.shippingBasis || "ORDER",
    compatible: quote.compatibilityNote || "",
    source: quote.sourceUrl || "",
    note: quote.internalComment || "",
    status: quote.status,
  };
}

export function toTaskDto(task: any) {
  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    requestId: task.request?.number || task.requestId || "",
    dueAt: task.dueAt ? task.dueAt.toISOString() : "",
    priority: (task.priority === "HIGH" || task.priority === "Высокий") ? "Высокий" : "Обычный",
    done: task.status === "DONE",
  };
}

export function toEventDto(event: any) {
  return {
    id: event.id,
    at: localDateLabel(event.occurredAt),
    text: event.action + (event.details?.text && event.details.text !== event.action ? `: ${event.details.text}` : ""),
    who: event.actor?.name || (event.details?.who as string) || "Система",
  };
}

function sanitizeOfferSnapshot(snapshot: any, canSeePurchase: boolean) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  if (canSeePurchase) return snapshot;
  return {
    version: snapshot.version,
    formedAt: snapshot.formedAt,
    comment: snapshot.comment,
    sharedLogisticsRubMinor: snapshot.sharedLogisticsRubMinor,
    totalRubMinor: snapshot.totalRubMinor,
    lines: snapshot.lines,
    financeLines: [], // STRICTLY stripped for users without quotes.purchase.read
  };
}

export function toRequestDto(request: any, staff?: StaffContext) {
  const isSuperAdmin = staff?.role === "SUPER_ADMIN";
  const canSeePurchase = Boolean(isSuperAdmin || staff?.permissions?.includes("quotes.purchase.read"));
  const latestOffer = request.offers && request.offers.length > 0 ? request.offers[0] : null;

  const items = Array.isArray(request.items) ? request.items.map(toItemDto) : [];
  const events = Array.isArray(request.activityEvents) ? request.activityEvents.map(toEventDto) : [];

  return {
    id: request.number,
    dbId: request.id,
    number: request.number,
    customerId: request.customerId,
    customer: request.customerNameSnapshot || request.customer?.name || "Покупатель",
    phone: request.customerPhoneSnapshot || request.customer?.phone || "",
    email: request.customerEmailSnapshot || request.customer?.email || "",
    make: request.vehicleMake || "",
    model: request.vehicleModel || "",
    year: request.vehicleYear || "",
    vin: request.vehicleVin || "",
    comment: request.customerComment || "",
    manager: request.assignedManager?.name || request.managerNameSnapshot || "Не назначен",
    status: request.status,
    priority: (request.priority === "HIGH" || request.priority === "Высокий") ? "Высокий" : "Обычный",
    items,
    internalNote: request.internalNote || "",
    events,
    customerOfferComment: latestOffer?.customerNote || undefined,
    customerOfferSharedLogisticsRub: latestOffer?.sharedLogisticsRub ? latestOffer.sharedLogisticsRub.toString() : undefined,
    customerOfferSnapshot: sanitizeOfferSnapshot(latestOffer?.snapshot, canSeePurchase),
    customerOfferVersions: request.offers?.map((offer: any) => ({
      version: offer.version,
      status: offer.status,
      responseStatus: offer.responseStatus || "NO_RESPONSE",
      sentAt: offer.sentAt ? offer.sentAt.toISOString() : undefined,
      archivedAt: offer.createdAt.toISOString(),
      archivedBy: "Менеджер",
      snapshot: sanitizeOfferSnapshot(offer.snapshot, canSeePurchase),
    })) || undefined,
    customerOfferVersion: latestOffer?.version || undefined,
    customerOfferStatus: request.customerOfferStatus || latestOffer?.status || undefined,
    customerOfferSentAt: latestOffer?.sentAt ? latestOffer.sentAt.toISOString() : undefined,
    customerResponseStatus: (request.customerResponseStatus || latestOffer?.responseStatus || "NO_RESPONSE") as BuyerResponseStatus,
    created: localDateLabel(request.createdAt),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

// -------------------------------------------------------------
// Service Methods
// -------------------------------------------------------------

export async function listRequests(
  repository: RequestRepository,
  queryOrOptions?:
    | string
    | {
        query?: string;
        status?: RequestStatus;
        priority?: string;
        manager?: string;
        sort?: string;
        page?: number;
        pageSize?: number;
      },
  statusOrStaff?: RequestStatus | StaffContext,
  pageArg = 1,
  pageSizeArg = 25,
  staffArg?: StaffContext,
) {
  let query = "";
  let status: RequestStatus | undefined;
  let priority: string | undefined;
  let manager: string | undefined;
  let sort: string | undefined;
  let page = 1;
  let pageSize = 25;
  let staff: StaffContext | undefined;

  if (typeof queryOrOptions === "string") {
    query = queryOrOptions;
    if (typeof statusOrStaff === "string") {
      status = statusOrStaff;
    } else if (statusOrStaff && typeof statusOrStaff === "object") {
      staff = statusOrStaff as StaffContext;
    }
    page = pageArg;
    pageSize = pageSizeArg;
    staff = staff || staffArg;
  } else if (queryOrOptions && typeof queryOrOptions === "object") {
    query = queryOrOptions.query || "";
    status = queryOrOptions.status;
    priority = queryOrOptions.priority;
    manager = queryOrOptions.manager;
    sort = queryOrOptions.sort;
    page = queryOrOptions.page || 1;
    pageSize = queryOrOptions.pageSize || 25;
    if (statusOrStaff && typeof statusOrStaff === "object") {
      staff = statusOrStaff as StaffContext;
    }
  }

  const cleanQuery = query.trim().replace(/\s+/g, " ");
  const safeStatus = status && statuses.has(status) ? status : undefined;
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));

  const result = await repository.search({
    query: cleanQuery,
    status: safeStatus,
    priority,
    manager,
    sort,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });

  return {
    requests: result.requests.map((r) => toRequestDto(r, staff)),
    total: result.total,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getRequest(repository: RequestRepository, idOrNumber: string, staff?: StaffContext) {
  const request = await repository.findById(idOrNumber);
  if (!request) throw new Error("Заявка не найдена");

  const dto = toRequestDto(request, staff);
  const allQuotes: any[] = [];
  if (Array.isArray(request.items)) {
    for (const item of request.items) {
      if (Array.isArray(item.supplierQuotes)) {
        for (const quote of item.supplierQuotes) {
          allQuotes.push(toQuoteDto(quote, staff));
        }
      }
    }
  }

  const tasks = Array.isArray(request.tasks) ? request.tasks.map(toTaskDto) : [];

  return {
    ...dto,
    request: dto,
    quotes: allQuotes,
    tasks,
  };
}

export async function createRequest(
  repository: RequestRepository,
  input: RequestFields,
  actorId?: string,
) {
  if (!input.number.trim()) throw new Error("Укажите номер заявки");
  if (input.status && input.status !== "NEW") throw new Error("Новая заявка должна начинаться со статуса NEW");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Добавьте хотя бы одну запрашиваемую деталь");

  const items = input.items.map(normalizeItem);

  return repository.transaction(async (tx) => {
    let customer = await tx.findCustomerSnapshot(input.customerId);
    if (!customer) {
      customer = await tx.findCustomerByContacts(input.customerPhoneSnapshot || null, input.customerEmailSnapshot || null);
    }
    if (!customer) throw new Error("Клиент не найден");

    if (input.assignedManagerId) {
      if (!(await tx.findManager(input.assignedManagerId))) throw new Error("Менеджер не найден");
    }

    const priority = input.priority === "Высокий" ? "HIGH" : input.priority === "Обычный" ? "NORMAL" : input.priority || "NORMAL";

    const request = await tx.create({
      ...input,
      number: input.number.trim(),
      customerId: customer.id,
      priority,
      customerNameSnapshot: input.customerNameSnapshot?.trim() || customer.name,
      customerPhoneSnapshot: input.customerPhoneSnapshot?.trim() || customer.phone,
      customerEmailSnapshot: input.customerEmailSnapshot?.trim() || customer.email,
      customerComment: input.customerComment?.trim() || null,
      internalNote: input.internalNote?.trim() || null,
      items,
    });

    await tx.recordActivity(request.id, "REQUEST", request.id, "REQUEST_CREATED", ["request", "items"], new Date(), actorId);
    return request;
  });
}

export async function updateRequest(
  repository: RequestRepository,
  idOrNumber: string,
  patch: RequestUpdate,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");

    if (patch.status) {
      if (!statuses.has(patch.status)) throw new Error("Недопустимый статус заявки");
      if (patch.status === "SENT_TO_CUSTOMER") {
        throw new Error("Статус отправки требует подтверждённого внешнего канала связи");
      }
      if (patch.status !== current.status && !transitions[current.status as RequestStatus].includes(patch.status)) {
        throw new Error(`Недопустимый переход статуса: ${current.status} → ${patch.status}`);
      }
    }

    if (patch.assignedManagerId && !(await tx.findManager(patch.assignedManagerId))) {
      throw new Error("Менеджер не найден");
    }

    const normalized: RequestUpdate = { ...patch };
    if (patch.priority) {
      normalized.priority = patch.priority === "Высокий" ? "HIGH" : patch.priority === "Обычный" ? "NORMAL" : patch.priority;
    }
    if (normalized.customerComment !== undefined) normalized.customerComment = normalized.customerComment?.trim() || null;
    if (normalized.internalNote !== undefined) normalized.internalNote = normalized.internalNote?.trim() || null;

    const updated = await tx.update(current.id, normalized);
    const changed = Object.keys(patch);
    await tx.recordActivity(current.id, "REQUEST", current.id, "REQUEST_UPDATED", changed, new Date(), actorId);
    return updated;
  });
}

export async function addRequestItem(
  repository: RequestRepository,
  idOrNumber: string,
  input: RequestItemInput,
  actorId?: string,
) {
  const item = normalizeItem(input);
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");
    const created = await tx.createItem(current.id, item);
    await tx.recordActivity(current.id, "REQUEST_ITEM", created.id, "REQUEST_ITEM_ADDED", ["item"], new Date(), actorId);
    return created;
  });
}

export async function updateRequestItem(
  repository: RequestRepository,
  idOrNumber: string,
  itemId: string,
  patch: Partial<RequestItemInput>,
  actorId?: string,
) {
  const normalized: Partial<RequestItemInput> = {};
  if (patch.description !== undefined) {
    if (!patch.description.trim()) throw new Error("Укажите название запрашиваемой детали");
    normalized.description = patch.description.trim();
  }
  if (patch.requestedPartNumber !== undefined) {
    normalized.requestedPartNumber = patch.requestedPartNumber ? patch.requestedPartNumber.trim() : null;
  }
  if (patch.quantity !== undefined) {
    if (!Number.isInteger(patch.quantity) || patch.quantity < 1 || patch.quantity > 10000) {
      throw new Error("Некорректное количество детали");
    }
    normalized.quantity = patch.quantity;
  }
  if (patch.conditionPreference !== undefined) {
    normalized.conditionPreference = patch.conditionPreference ? patch.conditionPreference.trim() : null;
  }
  if (patch.compatibilityNotes !== undefined) {
    normalized.compatibilityNotes = patch.compatibilityNotes ? patch.compatibilityNotes.trim() : null;
  }

  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");
    const updated = await tx.updateItem(current.id, itemId, normalized);
    await tx.recordActivity(current.id, "REQUEST_ITEM", itemId, "REQUEST_ITEM_UPDATED", Object.keys(patch), new Date(), actorId);
    return updated;
  });
}

export async function deleteRequestItem(
  repository: RequestRepository,
  idOrNumber: string,
  itemId: string,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");
    const deleted = await tx.deleteItem(current.id, itemId);
    await tx.recordActivity(current.id, "REQUEST_ITEM", itemId, "REQUEST_ITEM_DELETED", ["deleted"], new Date(), actorId);
    return deleted;
  });
}

export async function createSupplierQuote(
  repository: RequestRepository,
  idOrNumber: string,
  input: SupplierQuoteInput,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");
    const quote = await tx.createQuote(input);
    await tx.recordActivity(current.id, "SUPPLIER_QUOTE", quote.id, "SUPPLIER_QUOTE_CREATED", ["quote"], new Date(), actorId);
    return quote;
  });
}

export async function updateSupplierQuote(
  repository: RequestRepository,
  idOrNumber: string,
  quoteId: string,
  patch: Partial<SupplierQuoteInput>,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");
    const updated = await tx.updateQuote(quoteId, patch);
    await tx.recordActivity(current.id, "SUPPLIER_QUOTE", quoteId, "SUPPLIER_QUOTE_UPDATED", Object.keys(patch), new Date(), actorId);
    return updated;
  });
}

export async function selectSupplierQuote(
  repository: RequestRepository,
  idOrNumber: string,
  quoteId: string,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");

    const quote = await tx.updateQuote(quoteId, { status: "SELECTED" });
    await tx.recordActivity(current.id, "SUPPLIER_QUOTE", quoteId, "QUOTE_SELECTED", ["status: SELECTED"], new Date(), actorId);
    return quote;
  });
}

export async function saveCustomerOffer(
  repository: RequestRepository,
  idOrNumber: string,
  input: {
    comment?: string;
    sharedLogisticsRub?: string;
    snapshot: any;
    status?: CustomerOfferStatus;
    selectedQuoteIds?: string[];
  },
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");

    const existingOffersCount = current.offers?.length || 0;
    const version = (input.snapshot?.version) || (existingOffersCount + 1);

    const offer = await tx.createCustomerOffer({
      requestId: current.id,
      version,
      status: input.status || "FORMED",
      currency: "RUB",
      customerNote: input.comment || input.snapshot?.comment || null,
      sharedLogisticsRub: input.sharedLogisticsRub ? parseFloat(input.sharedLogisticsRub) : null,
      responseStatus: "NO_RESPONSE",
      snapshot: input.snapshot,
    });

    // Update request state
    await tx.update(current.id, {
      customerOfferStatus: input.status || "FORMED",
      customerResponseStatus: "NO_RESPONSE",
    });

    await tx.recordActivity(current.id, "CUSTOMER_OFFER", offer.id, "CUSTOMER_OFFER_SAVED", [`версия ${version}`], new Date(), actorId);
    return offer;
  });
}

export async function setCustomerResponse(
  repository: RequestRepository,
  idOrNumber: string,
  responseStatus: BuyerResponseStatus,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const current = await tx.findById(idOrNumber);
    if (!current) throw new Error("Заявка не найдена");

    await tx.update(current.id, {
      customerResponseStatus: responseStatus,
      status: responseStatus === "ACCEPTED" ? "CONFIRMED" : current.status,
    });

    if (current.offers && current.offers.length > 0) {
      await tx.updateCustomerOffer(current.offers[0].id, { responseStatus });
    }

    await tx.recordActivity(current.id, "CUSTOMER_OFFER", current.id, "CUSTOMER_RESPONSE_UPDATED", [responseStatus], new Date(), actorId);
    return { success: true, responseStatus };
  });
}

export async function createTask(
  repository: RequestRepository,
  input: TaskInput,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    let reqId = input.requestId;
    if (reqId) {
      const current = await tx.findById(reqId);
      if (current) reqId = current.id;
    }
    const task = await tx.createTask({
      ...input,
      requestId: reqId || null,
      priority: input.priority === "Высокий" ? "HIGH" : "NORMAL",
    });
    if (reqId) {
      await tx.recordActivity(reqId, "TASK", task.id, "TASK_CREATED", [task.title], new Date(), actorId);
    }
    return task;
  });
}

export async function toggleTask(
  repository: RequestRepository,
  taskId: string,
  actorId?: string,
) {
  return repository.transaction(async (tx) => {
    const tasks = await tx.listTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("Задача не найдена");

    const newStatus = task.status === "DONE" ? "OPEN" : "DONE";
    const updated = await tx.updateTask(taskId, { status: newStatus });
    if (task.requestId) {
      await tx.recordActivity(task.requestId, "TASK", taskId, "TASK_TOGGLED", [newStatus], new Date(), actorId);
    }
    return updated;
  });
}

export async function listTasks(repository: RequestRepository, filter?: { requestId?: string; status?: TaskStatus }) {
  return repository.listTasks(filter);
}

// -------------------------------------------------------------
// Safe Migration of Demo Requests
// -------------------------------------------------------------

export async function migrateDemoRequests(
  repository: RequestRepository,
  data: {
    requests: any[];
    quotes?: any[];
    tasks?: any[];
  },
  actorId?: string,
) {
  const { requests = [], quotes = [], tasks = [] } = data;
  const migratedRequests: any[] = [];
  const idMap: Record<string, string> = {};

  return repository.transaction(async (tx) => {
    const suppliers = await tx.listSuppliers();
    const supplierMap: Record<string, string> = {};
    for (const s of suppliers) {
      supplierMap[s.id] = s.id;
      if (s.countryCode === "RU") supplierMap["sup-ru-01"] = s.id;
      if (s.countryCode === "BY") supplierMap["sup-by-02"] = s.id;
      if (s.countryCode === "PL") supplierMap["sup-pl-03"] = s.id;
    }

    // Default supplier fallback if specific demo IDs are not matched
    const defaultSupplierId = suppliers[0]?.id || "a0000000-0000-0000-0000-000000000001";

    for (const r of requests) {
      const targetReqId = toDeterministicUuid(r.id);
      idMap[r.id] = targetReqId;

      // 1. Resolve Customer
      let customerId = r.customerId ? toDeterministicUuid(r.customerId) : null;
      let existingCustomer: any = customerId ? await tx.findCustomerSnapshot(customerId) : null;
      if (!existingCustomer) {
        existingCustomer = await tx.findCustomerByContacts(r.phone || null, r.email || null);
      }
      if (!existingCustomer) {
        // Create customer if missing
        const newCustId = toDeterministicUuid(r.phone || r.email || r.id);
        const createdCustomer = await (tx as any).db.customer.create({
          data: {
            id: newCustId,
            name: r.customer || "Покупатель",
            phone: r.phone || null,
            normalizedPhone: r.phone ? r.phone.replace(/\D/g, "") : null,
            email: r.email || null,
            normalizedEmail: r.email ? r.email.toLowerCase().trim() : null,
            internalNote: "Создан автоматически при миграции заявок",
          },
        });
        existingCustomer = createdCustomer;
      }
      const finalCustomerId: string = existingCustomer?.id || "00000000-0000-0000-0000-000000000000";

      // 2. Check if Request already exists
      const existingReq = await tx.findById(targetReqId);
      let requestRecord: any;

      const priority = r.priority === "Высокий" ? "HIGH" : "NORMAL";
      const createdAt = parseDateString(r.created);

      if (existingReq) {
        requestRecord = existingReq;
      } else {
        requestRecord = await tx.create({
          id: targetReqId,
          number: r.id,
          customerId: finalCustomerId,
          customerNameSnapshot: r.customer || existingCustomer?.name || "Покупатель",
          customerPhoneSnapshot: r.phone || existingCustomer?.phone || null,
          customerEmailSnapshot: r.email || existingCustomer?.email || null,
          vehicleMake: r.make || null,
          vehicleModel: r.model || null,
          vehicleYear: r.year ? r.year.toString() : null,
          vehicleVin: r.vin || null,
          managerNameSnapshot: r.manager || null,
          status: statuses.has(r.status) ? r.status : "NEW",
          priority,
          customerComment: r.comment || null,
          internalNote: r.internalNote || null,
          customerOfferStatus: r.customerOfferStatus || null,
          customerResponseStatus: r.customerResponseStatus || "NO_RESPONSE",
          createdAt,
          items: (r.items || []).map((it: any) => ({
            id: toDeterministicUuid(it.id),
            description: it.name || it.description || "Деталь",
            requestedPartNumber: it.oem || it.requestedPartNumber || null,
            quantity: it.qty || it.quantity || 1,
            conditionPreference: it.note || it.conditionPreference || null,
            compatibilityNotes: it.compatibility || it.compatibilityNotes || null,
          })),
        });

        // Migrate historical events
        if (Array.isArray(r.events)) {
          for (const ev of r.events) {
            const eventId = toDeterministicUuid(targetReqId + "-evt-" + ev.at + "-" + ev.text);
            const occurredAt = parseDateString(ev.at);
            await tx.recordActivity(targetReqId, "REQUEST", targetReqId, ev.text, { who: ev.who, text: ev.text }, occurredAt, actorId);
          }
        }
      }

      // 3. Migrate quotes belonging to this request's items
      const reqQuotes = quotes.filter((q) => (r.items || []).some((it: any) => it.id === q.itemId || toDeterministicUuid(it.id) === q.itemId));
      for (const q of reqQuotes) {
        const targetQuoteId = toDeterministicUuid(q.id);
        const targetItemId = toDeterministicUuid(q.itemId);
        const resolvedSupplierId = supplierMap[q.supplierId] || defaultSupplierId;

        try {
          const existingQuote = await (tx as any).db.supplierQuote.findUnique({ where: { id: targetQuoteId } });
          if (!existingQuote) {
            await tx.createQuote({
              id: targetQuoteId,
              requestItemId: targetItemId,
              supplierId: resolvedSupplierId,
              partNumber: q.article || null,
              manufacturer: q.maker || null,
              condition: q.condition || null,
              purchasePrice: q.cost ? parseFloat(q.cost) : 0,
              currency: q.currency || "RUB",
              quantityAvailable: q.availability ? (parseInt(q.availability, 10) || null) : null,
              deliveryDays: q.deliveryDays || 3,
              deliveryCost: q.shipping ? parseFloat(q.shipping) : 0,
              shippingBasis: q.shippingBasis || "ORDER",
              compatibilityNote: q.compatible || null,
              sourceUrl: q.source || null,
              internalComment: q.note || null,
              status: q.status || "RECEIVED",
            });
          }
        } catch {
          // Keep resilient on duplicate or missing foreign keys
        }
      }

      // 4. Migrate customer offer snapshot if present
      if (r.customerOfferSnapshot) {
        const targetOfferId = toDeterministicUuid(targetReqId + "-offer-" + (r.customerOfferSnapshot.version || 1));
        try {
          const existingOffer = await (tx as any).db.customerOffer.findUnique({ where: { id: targetOfferId } });
          if (!existingOffer) {
            await tx.createCustomerOffer({
              id: targetOfferId,
              requestId: targetReqId,
              version: r.customerOfferSnapshot.version || 1,
              status: r.customerOfferStatus || "FORMED",
              currency: "RUB",
              customerNote: r.customerOfferComment || r.customerOfferSnapshot.comment || null,
              sharedLogisticsRub: r.customerOfferSharedLogisticsRub ? parseFloat(r.customerOfferSharedLogisticsRub) : null,
              responseStatus: r.customerResponseStatus || "NO_RESPONSE",
              sentAt: r.customerOfferSentAt ? new Date(r.customerOfferSentAt) : null,
              snapshot: r.customerOfferSnapshot,
            });
          }
        } catch {
          // Resilient
        }
      }

      // 5. Migrate tasks belonging to this request
      const reqTasks = tasks.filter((t) => t.requestId === r.id || t.requestId === targetReqId);
      for (const t of reqTasks) {
        const targetTaskId = toDeterministicUuid(t.id);
        try {
          const existingTask = await (tx as any).db.task.findUnique({ where: { id: targetTaskId } });
          if (!existingTask) {
            await tx.createTask({
              id: targetTaskId,
              requestId: targetReqId,
              title: t.title,
              description: t.description || null,
              priority: t.priority === "Высокий" ? "HIGH" : "NORMAL",
              status: t.done ? "DONE" : "OPEN",
              dueAt: parseDateString(t.dueAt),
            });
          }
        } catch {
          // Resilient
        }
      }

      migratedRequests.push(toRequestDto(requestRecord));
    }

    return {
      success: true,
      migratedCount: migratedRequests.length,
      idMap,
      requests: migratedRequests,
    };
  });
}
