"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { calculateLogisticsTotalMinor, calculateRetailPositionPrice, calculateRetailPrice, convertMinorUnitsToRub, describePriceAdjustmentHistoryEntry, distributeOrderLogisticsMinor, type CurrencyCode, type FinancialConfig, formatMinorUnits, minorUnitsToDecimal, type PriceAdjustmentReason, type PriceHistoryEntry, toMinorUnits } from "@/lib/financial-config";

export type WorkspaceRequestStatus = "NEW"|"ASSIGNED"|"SEARCHING"|"WAITING_SUPPLIERS"|"OFFERS_READY"|"SENT_TO_CUSTOMER"|"WAITING_CUSTOMER"|"CONFIRMED"|"COMPLETED"|"CANCELLED";
export type WorkspaceItem = { id: string; name: string; oem: string; qty: number; note: string; compatibility?: string; selectionStatus?: "SEARCHING"|"CHECKING"|"FOUND"|"NOT_FOUND" };
export type WorkspaceSupplier = { id: string; name: string; country: string; contact: string; phone: string; email: string };
export type WorkspaceQuoteStatus = "DRAFT"|"INQUIRY_SENT"|"RECEIVED"|"SELECTED"|"DECLINED"|"EXPIRED";
export type WorkspaceQuote = { id: string; itemId: string; supplierId: string; article: string; maker: string; condition: string; cost: string | null; customerPriceRub?: string | null; supplierName?: string; country?: string; currency: CurrencyCode; availability: string; deliveryDays: number; shipping: string; shippingBasis?: "ORDER"|"PER_UNIT"; compatible: string; source: string; note: string; status: WorkspaceQuoteStatus };
export type CustomerOfferStatus = "DRAFT"|"FORMED"|"SENT"|"VIEWED";
export type BuyerResponseStatus = "NO_RESPONSE"|"INTERESTED"|"NEEDS_CLARIFICATION"|"ACCEPTED"|"REJECTED";
export type CustomerOfferLine = { itemId: string; name: string; quantity: number; condition: string; deliveryDays: number; totalRubMinor: string };
export type CustomerOfferFinanceLine = { itemId: string; quoteId: string; currency: CurrencyCode; supplierCountry: string; sourceUnitPrice: string; purchaseMinor: string; fxRate: string; fxSource: "DEMO_FINANCIAL_SETTINGS"; fxDate: string; purchaseRubMinor: string; supplierLogisticsMinor: string; supplierLogisticsRubMinor: string; percentageMarkupMinor: string; minimumMarkupMinor: string; markupMinor: string; actualMarkupMinor: string; markupBasisPoints: number; costCurrencyMinor: string; saleCurrencyMinor: string; costRubMinor: string; saleRubMinor: string; grossProfitRubMinor: string; marginBasisPoints: string; allocatedSharedLogisticsRubMinor: string };
export type CustomerOfferSnapshot = { version: number; formedAt: string; comment: string; sharedLogisticsRubMinor: string; totalRubMinor: string; lines: CustomerOfferLine[]; financeLines: CustomerOfferFinanceLine[] };
export type CustomerOfferVersion = { version: number; status: CustomerOfferStatus; responseStatus: BuyerResponseStatus; sentAt?: string; archivedAt: string; archivedBy: string; snapshot: CustomerOfferSnapshot };
export type WorkspaceTask = { id: string; title: string; description: string; requestId: string; dueAt: string; priority: "Высокий"|"Обычный"; done: boolean };
export type WorkspaceRequest = { id: string; created: string; customer: string; email: string; phone: string; make: string; model: string; year: string; vin: string; comment: string; manager: string; status: WorkspaceRequestStatus; priority: "Высокий"|"Обычный"; items: WorkspaceItem[]; internalNote: string; events: { at: string; text: string; who: string }[]; customerOfferComment?: string; customerOfferSharedLogisticsRub?: string; customerOfferSnapshot?: CustomerOfferSnapshot; customerOfferVersions?: CustomerOfferVersion[]; customerOfferVersion?: number; customerOfferStatus?: CustomerOfferStatus; customerOfferSentAt?: string; customerResponseStatus?: BuyerResponseStatus; };

const statusLabels: Record<WorkspaceRequestStatus, string> = { NEW:"Новая", ASSIGNED:"Назначена", SEARCHING:"Подбор", WAITING_SUPPLIERS:"Ожидает поставщиков", OFFERS_READY:"Предложение сформировано", SENT_TO_CUSTOMER:"Отправлена покупателю", WAITING_CUSTOMER:"Ждём ответ покупателя", CONFIRMED:"Подтверждена", COMPLETED:"Завершена", CANCELLED:"Отменена" };
const quoteStatusLabels: Record<WorkspaceQuoteStatus, string> = { DRAFT:"Черновик", INQUIRY_SENT:"Запрос отправлен", RECEIVED:"Получен", SELECTED:"Выбрано", DECLINED:"Отклонено", EXPIRED:"Истёк" };
const itemStatusLabels = { SEARCHING:"Подбор", CHECKING:"Проверка совместимости", FOUND:"Подобрано", NOT_FOUND:"Не найдено" } as const;
const panel = "border border-[#383e41] bg-[#202325]";
const field = "mt-1 min-h-9 w-full min-w-0 border border-[#414749] bg-[#17191b] px-2.5 py-2 text-xs text-[#f5f5f5] outline-none focus:border-[#ff6428]";
const rateFor = (quote: WorkspaceQuote, config: FinancialConfig) => config.rubPerCurrencyUnit[quote.currency];
const configFor = (quote: WorkspaceQuote, config: FinancialConfig): FinancialConfig => ({ ...config, rubPerCurrencyUnit: { ...config.rubPerCurrencyUnit, [quote.currency]: rateFor(quote, config) } });
const shippingTotalMinor = (quote: WorkspaceQuote, quantity: number) => calculateLogisticsTotalMinor({ amount: quote.shipping || "0", quantity, basis: quote.shippingBasis ?? "ORDER", currency: quote.currency });
function FinanceRow({ label, value, emphasis, wrapValue = false }: { label: string; value: string; emphasis?: "cost" | "sale" | "profit"; wrapValue?: boolean }) {
  const tone = emphasis === "sale" ? "text-[#ff986f]" : emphasis ? "text-[#f5f5f5]" : "text-[#d0d5d6]";
  return <div className={`box-border grid min-w-0 grid-cols-1 items-start gap-x-2 gap-y-0.5 py-1 @min-[18rem]:grid-cols-[minmax(0,1fr)_minmax(0,45%)] ${emphasis ? "mt-0.5 border-t border-[#414749] pt-1.5" : ""}`}>
    <span className={`box-border min-w-0 max-w-full break-words text-[10px] leading-4 [overflow-wrap:anywhere] ${emphasis ? "font-bold" : "text-[#929a9c]"}`}>{label}</span>
    <b className={`box-border min-w-0 max-w-full text-left text-[10px] leading-4 tabular-nums ${wrapValue ? "break-words [overflow-wrap:anywhere]" : "whitespace-nowrap"} @min-[18rem]:text-right ${emphasis ? `font-extrabold ${tone}` : "text-[#d0d5d6]"}`}>{value}</b>
  </div>;
}
const minor = (quote: WorkspaceQuote, quantity: number, suppliers: WorkspaceSupplier[], config: FinancialConfig, overrides: Record<string,string>) => {
  const supplier = suppliers.find((entry) => entry.id === quote.supplierId) || (quote.supplierName ? { id: quote.supplierId, name: quote.supplierName, country: quote.country || "Россия", contact: "", phone: "", email: "" } : null);
  if (!supplier) return null;
  if (!quote.cost) return null;
  try {
    const calculation = calculateRetailPositionPrice({ unitPurchasePrice: quote.cost, quantity, currency: quote.currency, supplierCountry: (["Россия","Беларусь","Польша"].includes(supplier.country) ? supplier.country : "Россия") as "Россия"|"Беларусь"|"Польша", config: configFor(quote, config) });
    const unitCalculation = calculateRetailPrice({ purchaseAmount: quote.cost, currency: quote.currency, supplierCountry: (["Россия","Беларусь","Польша"].includes(supplier.country) ? supplier.country : "Россия") as "Россия"|"Беларусь"|"Польша", config: configFor(quote, config) });
    const retail = overrides[quote.id] ? toMinorUnits(overrides[quote.id], quote.currency).toString() : calculation.customerPriceMinor;
    return { supplier, calculation, unitCalculation, purchaseTotal: calculation.purchaseMinor, retail };
  } catch {
    return null;
  }
};
function todayLabel() { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()); }
export function buildCustomerOfferSnapshot(args: { items: WorkspaceItem[]; selectedQuoteIds: string[]; quotes: WorkspaceQuote[]; suppliers: WorkspaceSupplier[]; config: FinancialConfig; overrides: Record<string,string>; sharedLogisticsRub: string; comment: string }): Omit<CustomerOfferSnapshot,"version"> {
  const { items, selectedQuoteIds, quotes, suppliers, config, overrides, comment } = args;
  if (!items.length) throw new Error("В заявке нет обязательных позиций.");
  const selected = items.map((item) => {
    const quote = quotes.find((candidate) => candidate.itemId === item.id && selectedQuoteIds.includes(candidate.id));
    if (!quote) throw new Error(`Выберите предложение для позиции «${item.name}».`);
    if (quote.status !== "RECEIVED" && quote.status !== "SELECTED") throw new Error(`Предложение по позиции «${item.name}» ещё не получено или уже отклонено.`);
    const amounts = minor(quote, item.qty, suppliers, config, overrides);
    if (!amounts) throw new Error(`Не найден поставщик для позиции «${item.name}».`);
    const fxRate = rateFor(quote, config);
    const purchase = BigInt(amounts.purchaseTotal);
    const supplierLogistics = BigInt(shippingTotalMinor(quote, item.qty));
    const sale = BigInt(amounts.retail) + supplierLogistics;
    const costRub = BigInt(convertMinorUnitsToRub((purchase + supplierLogistics).toString(), quote.currency, fxRate));
    const saleRub = BigInt(convertMinorUnitsToRub(sale.toString(), quote.currency, fxRate));
    return { item, quote, amounts, fxRate, purchase, supplierLogistics, saleRub, costRub, weight: BigInt(convertMinorUnitsToRub(purchase.toString(), quote.currency, fxRate)) };
  });
  const sharedLogistics = toMinorUnits(args.sharedLogisticsRub || "0", "RUB");
  const sharedShares = distributeOrderLogisticsMinor(sharedLogistics.toString(), selected.map((line) => line.weight.toString())).map(BigInt);
  const formedAt = new Date().toISOString();
  const fxDate = todayLabel();
  const lines: CustomerOfferLine[] = [];
  const financeLines: CustomerOfferFinanceLine[] = [];
  selected.forEach((line, index) => {
    const share = sharedShares[index];
    const totalSaleRub = line.saleRub + share;
    const totalCostRub = line.costRub + share;
    const profitRub = totalSaleRub - totalCostRub;
    const marginBasisPoints = totalSaleRub ? profitRub * 10000n / totalSaleRub : 0n;
    lines.push({ itemId: line.item.id, name: line.item.name, quantity: line.item.qty, condition: line.quote.condition, deliveryDays: line.quote.deliveryDays, totalRubMinor: totalSaleRub.toString() });
    financeLines.push({ itemId: line.item.id, quoteId: line.quote.id, currency: line.quote.currency, supplierCountry: line.amounts.supplier.country, sourceUnitPrice: line.quote.cost ?? "0.00", purchaseMinor: line.purchase.toString(), fxRate: line.fxRate, fxSource: "DEMO_FINANCIAL_SETTINGS", fxDate, purchaseRubMinor: line.weight.toString(), supplierLogisticsMinor: line.supplierLogistics.toString(), supplierLogisticsRubMinor: convertMinorUnitsToRub(line.supplierLogistics.toString(), line.quote.currency, line.fxRate), percentageMarkupMinor: line.amounts.calculation.percentageMarkupMinor, minimumMarkupMinor: line.amounts.calculation.minimumMarkupMinor, markupMinor: line.amounts.calculation.appliedMarkupMinor, actualMarkupMinor: (BigInt(line.amounts.retail)-line.purchase).toString(), markupBasisPoints: line.amounts.calculation.markupBasisPoints, costCurrencyMinor: (line.purchase+line.supplierLogistics).toString(), saleCurrencyMinor: (BigInt(line.amounts.retail)+line.supplierLogistics).toString(), costRubMinor: totalCostRub.toString(), saleRubMinor: totalSaleRub.toString(), grossProfitRubMinor: profitRub.toString(), marginBasisPoints: marginBasisPoints.toString(), allocatedSharedLogisticsRubMinor: share.toString() });
  });
  return { formedAt, comment, sharedLogisticsRubMinor: sharedLogistics.toString(), totalRubMinor: lines.reduce((sum, line) => sum + BigInt(line.totalRubMinor), 0n).toString(), lines, financeLines };
}
function ruDateTime(value: string) {
  const match = /(\d{2})\.(\d{2})\.(\d{4})[,]?\s+(\d{2}):(\d{2})/.exec(value);
  if (match) return `${match[1]}.${match[2]}.${match[3]} · ${match[4]}:${match[5]}`;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(date);
  return value;
}
function localDateTimeInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function CompactPanel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className={`${panel} min-w-0`}><div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#383e41] px-3 py-2.5"><h2 className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#d8dcdd]">{title}</h2>{action}</div><div className="p-3">{children}</div></section>;
}

function QuoteEditor({ quote, itemId, items, suppliers, onCancel, onSave }: { quote: WorkspaceQuote | null; itemId: string; items: WorkspaceItem[]; suppliers: WorkspaceSupplier[]; onCancel: () => void; onSave: (quote: WorkspaceQuote) => void }) {
  const [error, setError] = useState("");
  const [shippingBasis, setShippingBasis] = useState<"ORDER"|"PER_UNIT">(quote?.shippingBasis ?? "ORDER");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currency = String(data.get("currency")) as CurrencyCode;
    const cost = String(data.get("cost"));
    const shipping = String(data.get("shipping") || "0");
    try { toMinorUnits(cost, currency); toMinorUnits(shipping, currency); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Проверьте формат денежных сумм"); return; }
    onSave({ id: quote?.id ?? "", itemId: String(data.get("itemId")), supplierId: String(data.get("supplierId")), article: String(data.get("article")), maker: String(data.get("maker")), condition: String(data.get("condition")), cost, currency, availability: String(data.get("availability")), deliveryDays: Number(data.get("deliveryDays")), shipping, shippingBasis, compatible: String(data.get("compatible")), source: String(data.get("source")), note: String(data.get("note")), status: quote?.status ?? "RECEIVED" });
  }
  return <form onSubmit={submit} className="grid min-w-0 gap-2 border border-[#4b5255] bg-[#1a1d1f] p-3 sm:grid-cols-2 xl:grid-cols-3">
    <p className="text-[10px] font-bold uppercase tracking-wide text-[#ff986f] sm:col-span-2 xl:col-span-3">{quote ? "Редактирование предложения" : "Новое предложение поставщика"} · данные демонстрационные</p>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Запрашиваемая деталь<select required name="itemId" defaultValue={quote?.itemId ?? itemId} className={field}>{items.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.oem}</option>)}</select></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Поставщик<select required name="supplierId" defaultValue={quote?.supplierId ?? suppliers[0]?.id} className={field}>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name} · {supplier.country}</option>)}</select></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Артикул<input required name="article" defaultValue={quote?.article} className={field}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Производитель<input required name="maker" defaultValue={quote?.maker} className={field}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Состояние<select name="condition" defaultValue={quote?.condition ?? "Новая"} className={field}><option>Новая</option><option>БУ</option><option>Восстановленная</option></select></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Закупочная цена<input required name="cost" inputMode="decimal" defaultValue={quote?.cost ?? ""} placeholder="0.00" className={`${field} tabular-nums`}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Валюта<select name="currency" defaultValue={quote?.currency ?? "EUR"} className={field}>{(["RUB","USD","EUR","BYN","PLN"] as CurrencyCode[]).map((currency) => <option key={currency}>{currency}</option>)}</select></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Наличие<input name="availability" defaultValue={quote?.availability} placeholder="Есть / срок ожидания" className={field}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Срок поставки, дней<input required name="deliveryDays" type="number" min="0" defaultValue={quote?.deliveryDays ?? 0} className={`${field} tabular-nums`}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Логистика · {shippingBasis === "ORDER" ? "за заказ" : "за единицу"}<input name="shipping" inputMode="decimal" defaultValue={quote?.shipping ?? "0"} className={`${field} tabular-nums`}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Как указана логистика<select name="shippingBasis" value={shippingBasis} onChange={(event) => setShippingBasis(event.target.value as "ORDER"|"PER_UNIT")} className={field}><option value="ORDER">Сумма за весь заказ</option><option value="PER_UNIT">Сумма за одну единицу</option></select></label>
    <p className="text-[9px] leading-4 text-[#929a9c] sm:col-span-2 xl:col-span-3">Исходная цена и валюта поставщика сохраняются. Курс финансовых настроек будет зафиксирован только при формировании предложения.</p>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Совместимость<input name="compatible" defaultValue={quote?.compatible} className={field}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6]">Ссылка на источник<input name="source" type="url" defaultValue={quote?.source} className={field}/></label>
    <label className="min-w-0 text-[9px] font-bold uppercase text-[#aeb5b6] sm:col-span-2">Внутренний комментарий<input name="note" defaultValue={quote?.note} className={field}/></label>
    {error && <p role="alert" className="text-xs text-[#ff986f] sm:col-span-2 xl:col-span-3">{error}</p>}
    <div className="flex justify-end gap-2 sm:col-span-2 xl:col-span-3"><button type="button" onClick={onCancel} className="min-h-9 border border-[#51595c] px-3 text-[10px] font-bold uppercase">Отмена</button><button className="min-h-9 bg-[#ff6428] px-3 text-[10px] font-extrabold uppercase text-[#17191b]">{quote ? "Сохранить изменения" : "Добавить предложение"}</button></div>
  </form>;
}

export function RequestWorkspace({ request, suppliers, quotes, tasks, config, overrides, priceHistory, selectedQuoteIds, canReadFinancialData = false, onBack, onStatus, onManager, onPriority, onItemStatus, onSaveNote, onSaveQuote, onQuoteStatus, onPriceOverride, onToggleQuote, onFormOffer, onBuyerComment, onBuyerLogistics, onBuyerResponse, onSaveTask, onCreateOrder }: {
  request: WorkspaceRequest; suppliers: WorkspaceSupplier[]; quotes: WorkspaceQuote[]; tasks: WorkspaceTask[]; config: FinancialConfig;
  overrides: Record<string,string>; priceHistory: PriceHistoryEntry[]; selectedQuoteIds: string[];
  canReadFinancialData?: boolean;
  onBack: () => void; onStatus: (status: WorkspaceRequestStatus) => void; onManager: (manager: string) => void; onPriority: (priority: "Высокий"|"Обычный") => void;
  onItemStatus: (itemId: string, status: WorkspaceItem["selectionStatus"]) => void; onSaveNote: (note: string) => void;
  onSaveQuote: (quote: WorkspaceQuote) => void; onQuoteStatus: (quoteId: string, status: WorkspaceQuoteStatus) => void;
  onPriceOverride: (quote: WorkspaceQuote, value: string, reason: PriceAdjustmentReason, explanation: string, lossManagerConfirmed: boolean, lossExplanation: string) => boolean; onToggleQuote: (quoteId: string) => void; onFormOffer: (snapshot: CustomerOfferSnapshot) => void;
  onBuyerComment: (comment: string) => void; onBuyerLogistics: (amountRub: string) => void; onBuyerResponse: (response: BuyerResponseStatus) => void;
  onSaveTask: (taskId: string | undefined, title: string, dueAt: string, priority: "Высокий"|"Обычный") => void;
  onCreateOrder?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editingQuote, setEditingQuote] = useState<WorkspaceQuote | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string,string>>({});
  const [priceReasons, setPriceReasons] = useState<Record<string,PriceAdjustmentReason | "">>({});
  const [priceExplanations, setPriceExplanations] = useState<Record<string,string>>({});
  const [lossConfirmations, setLossConfirmations] = useState<Record<string,boolean>>({});
  const [lossExplanations, setLossExplanations] = useState<Record<string,string>>({});
  const priceSaveLocks = useRef(new Set<string>());
  const [quoteFormItemId, setQuoteFormItemId] = useState("");
  const [responseDraft, setResponseDraft] = useState<BuyerResponseStatus>(request.customerResponseStatus ?? "NO_RESPONSE");
  const [buyerCommentDraft, setBuyerCommentDraft] = useState(request.customerOfferComment ?? "");
  const [buyerLogisticsDraft, setBuyerLogisticsDraft] = useState(request.customerOfferSharedLogisticsRub ?? "0");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const requestQuotes = quotes.filter((quote) => request.items.some((item) => item.id === quote.itemId));
  useEffect(() => { setResponseDraft(request.customerResponseStatus ?? "NO_RESPONSE"); }, [request.customerResponseStatus, request.customerOfferVersion, request.customerOfferStatus]);
  const activeTask = tasks.filter((task) => task.requestId === request.id && !task.done).sort((a,b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  const chosenQuotes = requestQuotes.filter((quote) => selectedQuoteIds.includes(quote.id));
  const draftOffer = useMemo(() => {
    try { return buildCustomerOfferSnapshot({ items: request.items, selectedQuoteIds, quotes: requestQuotes, suppliers, config, overrides, sharedLogisticsRub: buyerLogisticsDraft, comment: buyerCommentDraft }); }
    catch { return null; }
  }, [request.items, buyerLogisticsDraft, buyerCommentDraft, selectedQuoteIds, requestQuotes, suppliers, config, overrides]);
  const totals = useMemo(() => chosenQuotes.reduce((result, quote) => {
    const item = request.items.find((candidate) => candidate.id === quote.itemId);
    if (!item) return result;
    const amounts = minor(quote, item.qty, suppliers, config, overrides);
    if (!amounts) return result;
    const logistics = BigInt(shippingTotalMinor(quote, item.qty));
    const line = result[quote.currency] ?? { products: 0n, logistics: 0n, total: 0n };
    line.products += BigInt(amounts.retail);
    line.logistics += logistics;
    line.total += BigInt(amounts.retail) + logistics;
    result[quote.currency] = line;
    return result;
  }, {} as Partial<Record<CurrencyCode,{products:bigint;logistics:bigint;total:bigint}>>), [chosenQuotes, suppliers, config, overrides, request.items]);
  async function copyVin() {
    try { await navigator.clipboard.writeText(request.vin); }
    catch { const input = document.createElement("textarea"); input.value = request.vin; input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove(); }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }
  function saveQuote(quote: WorkspaceQuote) { onSaveQuote(quote); setEditingQuote(null); setQuoteFormItemId(""); }
  function saveResponse(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); onBuyerResponse(String(form.get("response")) as BuyerResponseStatus); }
  function saveTask(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const localValue = String(form.get("dueAt")); onSaveTask(activeTask?.id, String(form.get("title")), new Date(localValue).toISOString(), String(form.get("priority")) as "Высокий"|"Обычный"); setTaskFormOpen(false); }

  return <>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><button onClick={onBack} className="mb-2 text-xs font-semibold text-[#ff865c] hover:text-[#f1f0eb]">← К реестру заявок</button><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ff6428]">Создана {ruDateTime(request.created)} · демонстрационная заявка</p><h1 className="mt-1 break-words text-2xl font-extrabold uppercase sm:text-3xl">{request.id}</h1></div>
      <div className="flex flex-wrap items-center gap-2"><span className="border border-[#414749] bg-[#202325] px-2 py-1 text-[10px] font-bold text-[#d0d5d6]">{statusLabels[request.status]}</span><span className={`border px-2 py-1 text-[10px] font-bold ${request.priority === "Высокий" ? "border-[#7b3c25] bg-[#30231f] text-[#ff986f]" : "border-[#414749] text-[#c2c8c9]"}`}>{request.priority} приоритет</span><span className="border border-[#414749] px-2 py-1 text-[10px] text-[#c2c8c9]">{request.manager}</span></div>
    </div>

    <div className="grid min-w-0 grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid min-w-0 content-start gap-3">
        <div className="grid min-w-0 gap-2 md:grid-cols-2">
          <section className={`${panel} min-w-0 p-3`}><p className="text-[10px] font-bold uppercase tracking-wide text-[#929a9c]">Покупатель</p><h2 className="mt-1 break-words text-base font-bold">{request.customer}</h2><div className="mt-2 grid gap-1 text-xs text-[#c2c8c9] sm:grid-cols-2"><a className="break-all hover:text-[#f1f0eb]" href={`mailto:${request.email}`}>{request.email}</a><a className="tabular-nums hover:text-[#f1f0eb]" href={`tel:${request.phone.replace(/[^+\d]/g,"")}`}>{request.phone}</a></div></section>
          <section className={`${panel} min-w-0 p-3`}><p className="text-[10px] font-bold uppercase tracking-wide text-[#929a9c]">Автомобиль</p><h2 className="mt-1 break-words text-base font-bold">{request.make} {request.model} <span className="text-sm font-medium text-[#b7bec0]">· {request.year}</span></h2><div className="mt-2 flex min-w-0 flex-wrap items-center gap-2"><span className="break-all font-mono text-[11px] tabular-nums text-[#d0d5d6]">VIN {request.vin}</span><button onClick={() => void copyVin()} className="shrink-0 border border-[#51595c] px-2 py-1 text-[9px] font-bold uppercase text-[#ff986f] hover:border-[#ff6428]">{copied ? "Скопировано" : "Копировать VIN"}</button></div></section>
        </div>

        <CompactPanel title="Запрашиваемые детали · требования покупателя">
          <div className="grid gap-2">{request.items.map((item) => {
            const itemQuotes = requestQuotes.filter((quote) => quote.itemId === item.id);
            const compatibility = item.compatibility || itemQuotes.find((quote) => quote.compatible)?.compatible || "Совместимость не проверена";
            return <article key={item.id} className="min-w-0 border border-[#383e41] bg-[#1a1d1f] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-bold">{item.name}</h3><p className="mt-1 font-mono text-[11px] tabular-nums text-[#c2c8c9]">OEM {item.oem}</p></div><span className="border border-[#4b5255] px-2 py-1 text-[10px] tabular-nums text-[#d0d5d6]">Количество · {item.qty}</span></div>
              <div className="mt-2 grid min-w-0 gap-2 border-t border-[#383e41] pt-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)]"><div className="grid gap-1 text-[11px]"><p><span className="text-[#929a9c]">Требование: </span><span className="text-[#d0d5d6]">{item.note || "Не указано"}</span></p><p className="break-words"><span className="text-[#929a9c]">Совместимость: </span><span className="text-[#d0d5d6]">{compatibility}</span></p><p className="text-[#929a9c]">Предложений поставщиков · <b className="text-[#d0d5d6]">{itemQuotes.length}</b></p></div><label className="min-w-0 text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Статус подбора<select value={item.selectionStatus ?? "SEARCHING"} onChange={(event) => onItemStatus(item.id,event.target.value as WorkspaceItem["selectionStatus"])} className={field}><option value="SEARCHING">Подбор</option><option value="CHECKING">Проверка совместимости</option><option value="FOUND">Подобрано</option><option value="NOT_FOUND">Не найдено</option></select></label></div>
            </article>;
          })}</div>
          <div className="mt-3 border-t border-[#383e41] pt-2"><p className="text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Комментарий покупателя</p><p className="mt-1 break-words text-xs leading-5 text-[#d0d5d6]">{request.comment || "Комментарий не добавлен."}</p></div>
        </CompactPanel>

        <CompactPanel title={`Поставщики и сравнение предложений · ${requestQuotes.length}`} action={<span className="text-[9px] text-[#ff986f]">Закупка и контактные данные доступны только сотрудникам</span>}>
          {request.items.map((item) => {
            const itemQuotes = requestQuotes.filter((quote) => quote.itemId === item.id);
            return <div key={item.id} className="mb-3 last:mb-0"><div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xs font-bold">{item.name} <span className="font-mono text-[10px] text-[#aeb5b6]">· {item.oem}</span></h3><button onClick={() => { setEditingQuote(null); setQuoteFormItemId(item.id); }} className="border border-[#51595c] px-2 py-1 text-[9px] font-bold uppercase text-[#ff986f] hover:border-[#ff6428]">+ Предложение</button></div>
              {quoteFormItemId === item.id && <QuoteEditor key={editingQuote?.id ?? `new-${item.id}`} quote={editingQuote} itemId={item.id} items={request.items} suppliers={suppliers} onCancel={() => { setQuoteFormItemId(""); setEditingQuote(null); }} onSave={saveQuote}/>}
              {!itemQuotes.length && quoteFormItemId !== item.id && <p className="border-t border-[#383e41] py-2 text-[11px] text-[#929a9c]">Ответов пока нет.</p>}
              <div className="grid gap-1.5">{itemQuotes.map((quote) => {
                const amounts = minor(quote,item.qty,suppliers,config,overrides);
                const supplier = suppliers.find((entry) => entry.id === quote.supplierId) || { name: quote.supplierName || "Поставщик", country: quote.country || "Россия" };
                const fxRate = (config.rubPerCurrencyUnit as any)[quote.currency] || "1.00";
                const logisticsTotal = BigInt(shippingTotalMinor(quote, item.qty));
                const logisticsPerUnit = (logisticsTotal + BigInt(item.qty) / 2n) / BigInt(item.qty);

                let purchaseUnit = 0n;
                let purchaseTotal = 0n;
                let markupPercentPosition = 0n;
                let markupMinimumPosition = 0n;
                let markupAppliedPosition = 0n;
                let markupTotal = 0n;
                let costTotal = 0n;
                let lineTotal = 0n;
                let grossProfit = 0n;
                let marginPercent = "0.00%";

                if (amounts) {
                  try {
                    purchaseUnit = toMinorUnits(quote.cost || "0", quote.currency);
                    purchaseTotal = BigInt(amounts.purchaseTotal);
                    markupPercentPosition = BigInt(amounts.calculation.percentageMarkupMinor);
                    markupMinimumPosition = BigInt(amounts.calculation.minimumMarkupMinor);
                    markupAppliedPosition = BigInt(amounts.calculation.appliedMarkupMinor);
                    markupTotal = BigInt(amounts.retail) - purchaseTotal;
                    costTotal = purchaseTotal + logisticsTotal;
                    lineTotal = BigInt(amounts.retail) + logisticsTotal;
                    grossProfit = lineTotal - costTotal;
                    const marginBasisPoints = lineTotal ? grossProfit * 10000n / lineTotal : 0n;
                    const marginAbsolute = marginBasisPoints < 0n ? -marginBasisPoints : marginBasisPoints;
                    marginPercent = `${marginBasisPoints < 0n ? "−" : ""}${marginAbsolute / 100n}.${(marginAbsolute % 100n).toString().padStart(2,"0")}%`;
                  } catch {
                    // Safe fallback if calculation fails
                  }
                }

                const rub = (amount: bigint) => convertMinorUnitsToRub(amount.toString(), quote.currency, fxRate);
                const displayRetailRub = quote.customerPriceRub || (lineTotal > 0n ? formatMinorUnits(rub(lineTotal), "RUB") : null);

                return <article key={quote.id} className="grid min-w-0 gap-2 border-t border-[#383e41] py-2">
                  <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><b className="break-words text-xs">{supplier.name}</b><span className="text-[10px] text-[#aeb5b6]">{supplier.country}</span><span className="border border-[#414749] px-1.5 py-0.5 text-[9px] text-[#c2c8c9]">{quoteStatusLabels[quote.status]}</span></div><p className="mt-1 break-words text-[11px] text-[#c2c8c9]">Артикул {quote.article} · {quote.maker} · {quote.condition}</p><p className="mt-1 break-words text-[10px] text-[#929a9c]">{quote.availability || "Наличие не указано"} · доставка {quote.deliveryDays} дн. · совместимость: {quote.compatible || "не указана"}</p>{quote.note&&<p className="mt-1 break-words text-[10px] text-[#9da5a7]">Внутренне: {quote.note}</p>}</div>
                  <div className="min-w-0 border-t border-[#383e41] pt-2 text-[10px]">
                    {canReadFinancialData && amounts ? (
                      <>
                        <div className="@container grid min-w-0 gap-2 @2xl:grid-cols-2">
                      <section className="@container box-border min-w-0 border border-[#383e41] bg-[#1a1d1f] p-2.5">
                        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Закупка и логистика</h4>
                        <div className="grid min-w-0 gap-y-0.5">
                          <FinanceRow label={`Закупка · ${item.qty} шт.`} value={formatMinorUnits(amounts.purchaseTotal,quote.currency)}/>
                          <FinanceRow label="Логистика · за заказ" value={formatMinorUnits(logisticsTotal.toString(),quote.currency)}/>
                          <FinanceRow label="Логистика · в среднем за шт." value={formatMinorUnits(logisticsPerUnit.toString(),quote.currency)}/>
                          <FinanceRow label="Полная себестоимость" value={formatMinorUnits(costTotal.toString(),quote.currency)} emphasis="cost"/>
                        </div>
                      </section>
                      <section className="@container box-border min-w-0 border border-[#383e41] bg-[#1a1d1f] p-2.5">
                        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Наценка и результат</h4>
                        <div className="grid min-w-0 gap-y-0.5">
                          <FinanceRow label={`Наценка по проценту · ${amounts.calculation.markupBasisPoints/100}%`} value={formatMinorUnits(markupPercentPosition.toString(),quote.currency)}/>
                          <FinanceRow label={`Применённый минимум · ${item.qty} шт.`} value={formatMinorUnits(markupMinimumPosition.toString(),quote.currency)}/>
                          <FinanceRow label="Применённая наценка" value={formatMinorUnits(markupAppliedPosition.toString(),quote.currency)}/>
                          <FinanceRow label="Фактическая наценка" value={formatMinorUnits(markupTotal.toString(),quote.currency)}/>
                          <FinanceRow label="Продажа · с логистикой" value={formatMinorUnits(lineTotal.toString(),quote.currency)} emphasis="sale"/>
                          <FinanceRow label="Валовая прибыль" value={formatMinorUnits(grossProfit.toString(),quote.currency)} emphasis="profit"/>
                          <FinanceRow label="Маржинальность · прибыль / продажа" value={marginPercent}/>
                        </div>
                      </section>
                    </div>
                    <details className="mt-2 border-t border-[#383e41] pt-1.5"><summary className="cursor-pointer text-[9px] font-bold uppercase tracking-wide text-[#ff986f]">Детали расчёта</summary>
                      <div className="@container mt-2 grid min-w-0 gap-2 @2xl:grid-cols-2">
                        <div className="@container box-border grid min-w-0 content-start gap-y-0.5 border border-[#383e41] p-2">
                          <FinanceRow label="Исходная цена · за единицу" value={`${quote.cost} ${quote.currency}`}/>
                          <FinanceRow label={`Закупка · ${item.qty} × ${formatMinorUnits(purchaseUnit.toString(),quote.currency)}`} value={formatMinorUnits(purchaseTotal.toString(),quote.currency)}/>
                          <FinanceRow label="Исходная цена · RUB/шт." value={formatMinorUnits(rub(purchaseUnit),"RUB")}/>
                          <FinanceRow label="Закупка · эквивалент RUB" value={formatMinorUnits(rub(purchaseTotal),"RUB")}/>
                          <FinanceRow label={`Курс конвертации · ${quote.currency}`} value={`1 ${quote.currency} = ${fxRate} RUB · предварительный; дата фиксируется при формировании`} wrapValue/>
                        </div>
                        <div className="@container box-border grid min-w-0 content-start gap-y-0.5 border border-[#383e41] p-2">
                          <FinanceRow label="Логистика · за заказ" value={formatMinorUnits(logisticsTotal.toString(),quote.currency)}/>
                          <FinanceRow label="Логистика · RUB эквивалент" value={formatMinorUnits(rub(logisticsTotal),"RUB")}/>
                          <FinanceRow label="Распределение логистики" value={quote.shippingBasis === "PER_UNIT" ? "сумма за единицу × количество" : "сумма за заказ ÷ количество"} wrapValue/>
                          <FinanceRow label="Себестоимость · RUB" value={formatMinorUnits(rub(costTotal),"RUB")}/>
                          <FinanceRow label="Минимум на 1 деталь · тариф RUB" value={formatMinorUnits(rub(BigInt(amounts.unitCalculation.minimumMarkupMinor)),"RUB")}/>
                          <FinanceRow label={`Цена продажи · с логистикой ${overrides[quote.id] ? "(ручная цена)" : ""}`} value={formatMinorUnits(lineTotal.toString(),quote.currency)}/>
                          <FinanceRow label="Валовая прибыль" value={formatMinorUnits(grossProfit.toString(),quote.currency)}/>
                          <FinanceRow label="Маржинальность · прибыль / продажа" value={marginPercent}/>
                          <FinanceRow label="Применённая наценка · MAX на деталь × количество" value={formatMinorUnits(markupAppliedPosition.toString(),quote.currency)}/>
                        </div>
                      </div>
                      <div className="mt-2 grid min-w-0 gap-2 border-t border-[#383e41] pt-2">
                          <label htmlFor={`manual-price-${quote.id}`} className="text-[9px] text-[#929a9c]">Ручная цена детали за позицию · без логистики</label>
                          <div className="mt-1 flex gap-2"><input id={`manual-price-${quote.id}`} inputMode="decimal" value={priceDrafts[quote.id] ?? overrides[quote.id] ?? minorUnitsToDecimal(amounts.calculation.customerPriceMinor,quote.currency)} onChange={(event)=>{priceSaveLocks.current.delete(quote.id);setPriceDrafts(previous=>({...previous,[quote.id]:event.target.value}));}} className="min-w-0 flex-1 border border-[#414749] bg-[#17191b] px-2 py-1 text-right tabular-nums text-[#f5f5f5]"/><span className="self-center text-[10px] text-[#aeb5b6]">{quote.currency}</span></div>
                          {(() => {
                            const value = priceDrafts[quote.id] ?? overrides[quote.id] ?? minorUnitsToDecimal(amounts.calculation.customerPriceMinor,quote.currency);
                            let draftMinor: bigint | null = null;
                            try { draftMinor = toMinorUnits(value,quote.currency); } catch { /* Invalid draft remains unsavable. */ }
                            const belowCost = draftMinor !== null && draftMinor < purchaseTotal;
                            const reason = priceReasons[quote.id] ?? "";
                            const explanation = priceExplanations[quote.id] ?? "";
                            const lossConfirmed = lossConfirmations[quote.id] ?? false;
                            const lossExplanation = lossExplanations[quote.id] ?? "";
                            const valid = draftMinor !== null && Boolean(reason) && (reason !== "OTHER" || Boolean(explanation?.trim())) && (!belowCost || (lossConfirmed && Boolean(lossExplanation?.trim())));
                            return <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <fieldset className="min-w-0 sm:col-span-2">
                                <legend className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Причина корректировки</legend>
                                <div role="radiogroup" aria-label={`Причина корректировки ${quote.article}`} className="grid min-w-0 gap-1.5">
                                  {([
                                    ["SPECIAL_CLIENT_PRICE", "Специальная цена", "Индивидуальные условия для этого покупателя."],
                                    ["COMPETITIVE_PRICE", "Конкурентная цена", "Цена скорректирована с учётом альтернативного предложения."],
                                    ["LOYAL_CUSTOMER_DISCOUNT", "Скидка постоянному клиенту", "Льготная цена за историю сотрудничества."],
                                    ["PURCHASE_COST_CHANGE", "Изменение закупочной цены", "Корректировка после изменения стоимости поставщика."],
                                    ["OTHER", "Другая причина", "Нестандартное основание; потребуется пояснение."],
                                  ] as const).map(([value,title,description]) => {
                                    const selected = reason === value;
                                    const optionId = `manual-price-reason-${quote.id}-${value}`;
                                    return <div key={value} className="min-w-0">
                                      <input id={optionId} type="radio" name={`manual-price-reason-${quote.id}`} value={value} checked={selected} onChange={()=>{priceSaveLocks.current.delete(quote.id);setPriceReasons(previous=>({...previous,[quote.id]:value}));}} className="peer sr-only"/>
                                      <label htmlFor={optionId} className={`flex min-h-12 w-full min-w-0 cursor-pointer items-start gap-2 border px-2.5 py-2 transition-colors focus-within:ring-1 focus-within:ring-[#ff6428] ${selected ? "border-[#ff6428] bg-[#29231f]" : "border-[#414749] bg-[#1a1d1f] hover:border-[#697174]"}`}>
                                        <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border text-[10px] leading-none ${selected ? "border-[#ff6428] bg-[#ff6428] font-bold text-[#17191b]" : "border-[#697174] text-transparent"}`}>{selected ? "✓" : "·"}</span>
                                        <span className="min-w-0 flex-1"><span className={`block break-words text-[11px] font-semibold leading-4 ${selected ? "text-[#fff2ec]" : "text-[#d0d5d6]"}`}>{title}</span><span className="mt-0.5 block break-words text-[9px] leading-3.5 text-[#929a9c]">{description}</span></span>
                                      </label>
                                    </div>;
                                  })}
                                </div>
                              </fieldset>
                              {reason === "OTHER" && <label className="text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6] sm:col-span-2">Пояснение причины<input aria-label={`Пояснение причины корректировки ${quote.article}`} value={explanation} onChange={(event)=>{priceSaveLocks.current.delete(quote.id);setPriceExplanations(previous=>({...previous,[quote.id]:event.target.value}));}} className="mt-1 w-full border border-[#414749] bg-[#17191b] px-2 py-1.5 text-xs font-normal normal-case text-[#f5f5f5]"/></label>}
                              {belowCost && <div role="alert" className="border border-[#9b4a2b] bg-[#30231f] p-2 text-[10px] leading-4 text-[#ffb08c] sm:col-span-2"><b>Цена ниже закупочной стоимости позиции на {formatMinorUnits((purchaseTotal - (draftMinor ?? 0n)).toString(),quote.currency)}.</b><span className="block">Сравнение включает {item.qty} шт. и не включает логистику.</span><label className="mt-1 flex items-start gap-2 text-[#f0c5b2]"><input type="checkbox" checked={lossConfirmed} onChange={(event)=>{priceSaveLocks.current.delete(quote.id);setLossConfirmations(previous=>({...previous,[quote.id]:event.target.checked}));}} className="mt-0.5 accent-[#ff6428]"/>Подтверждаю осознанное решение продать ниже закупки</label><label className="mt-1 block font-bold uppercase tracking-wide">Объяснение потенциального убытка<textarea aria-label={`Объяснение убытка ${quote.article}`} value={lossExplanation} onChange={(event)=>{priceSaveLocks.current.delete(quote.id);setLossExplanations(previous=>({...previous,[quote.id]:event.target.value}));}} rows={2} className="mt-1 w-full border border-[#6c493d] bg-[#17191b] px-2 py-1 text-xs font-normal normal-case text-[#f5f5f5]"/></label></div>}
                              <button type="button" disabled={!valid || priceSaveLocks.current.has(quote.id)} onClick={()=>{if(!valid||priceSaveLocks.current.has(quote.id))return;priceSaveLocks.current.add(quote.id);const saved=onPriceOverride(quote,value,reason as PriceAdjustmentReason,explanation,lossConfirmed,lossExplanation);if(saved){setPriceDrafts(previous=>({...previous,[quote.id]:value}));setPriceReasons(previous=>({...previous,[quote.id]:""}));setPriceExplanations(previous=>({...previous,[quote.id]:""}));setLossConfirmations(previous=>({...previous,[quote.id]:false}));setLossExplanations(previous=>({...previous,[quote.id]:""}));}else priceSaveLocks.current.delete(quote.id);}} className="min-h-8 border border-[#51595c] px-2 py-1 text-[9px] font-bold uppercase text-[#ff986f] hover:border-[#ff6428] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2">Сохранить ручную цену</button>
                            </div>;
                          })()}
                        </div>
                    </details>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 border border-[#383e41] bg-[#1a1d1f] p-2.5">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Розничная цена для клиента:</span>
                          <span className="ml-2 font-mono text-xs font-extrabold text-[#ff986f]">
                            {displayRetailRub ? displayRetailRub : (lineTotal > 0n ? formatMinorUnits(lineTotal.toString(), quote.currency) : "Формируется системой")}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#aeb5b6]">
                          Срок: <b className="text-[#f1f0eb]">{quote.deliveryDays} дн.</b> · Состояние: <b className="text-[#f1f0eb]">{quote.condition}</b>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><label className="flex items-center gap-2 text-[10px] text-[#bfc5c7]"><select aria-label={`Статус ответа поставщика ${quote.article}`} value={quote.status} onChange={(event) => onQuoteStatus(quote.id,event.target.value as WorkspaceQuoteStatus)} className="border border-[#414749] bg-[#17191b] px-2 py-1"><option value="DRAFT">Черновик</option><option value="INQUIRY_SENT">Запрос отправлен</option><option value="RECEIVED">Получен</option><option value="SELECTED">Выбран</option><option value="DECLINED">Отклонён</option><option value="EXPIRED">Истёк</option></select>{quote.source && <a className="text-[#ff986f] hover:text-[#f1f0eb]" href={quote.source} target="_blank" rel="noreferrer">Источник ↗</a>}</label><button onClick={() => { setEditingQuote(quote); setQuoteFormItemId(item.id); }} className="border border-[#51595c] px-2 py-1 text-[9px] font-bold uppercase hover:border-[#ff6428]">Редактировать</button></div>
                </article>;
              })}</div>
            </div>;
          })}
          {canReadFinancialData && priceHistory.length > 0 && <details className="mt-2 border-t border-[#383e41] pt-2"><summary className="cursor-pointer text-[10px] font-bold text-[#aeb5b6]">История корректировок цен · {priceHistory.length}</summary><ul className="mt-2 grid gap-1">{priceHistory.map((entry) => <li key={entry.id} className="break-words text-[10px] text-[#929a9c]">{describePriceAdjustmentHistoryEntry(entry)}</li>)}</ul></details>}
        </CompactPanel>

        <CompactPanel title="Предложение покупателю">
          <p className="mb-2 text-[10px] leading-4 text-[#929a9c]">Для каждой обязательной позиции выберите один вариант. Курс берётся из демонстрационных финансовых настроек и фиксируется при формировании предложения; это не рыночная котировка.</p>
          <label className="mb-2 block max-w-sm text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Дополнительная логистика на весь заказ · RUB<input inputMode="decimal" value={buyerLogisticsDraft} onChange={(event) => setBuyerLogisticsDraft(event.target.value)} onBlur={() => onBuyerLogistics(buyerLogisticsDraft)} className={`${field} tabular-nums`}/><span className="mt-1 block font-normal normal-case text-[#929a9c]">Сумма распределяется между позициями пропорционально закупочной стоимости; логистика поставщиков сюда не дублируется.</span></label>
          <div className="grid gap-2">{request.items.map((item) => {
            const itemQuotes = requestQuotes.filter((quote) => quote.itemId === item.id);
            const selected = itemQuotes.find((quote) => selectedQuoteIds.includes(quote.id));
            const selectedAmounts = selected ? minor(selected,item.qty,suppliers,config,overrides) : null;
            const selectedTotal = selected && selectedAmounts ? BigInt(selectedAmounts.retail)+BigInt(shippingTotalMinor(selected,item.qty)) : null;
            const selectedRub = selected && selectedTotal !== null ? convertMinorUnitsToRub(selectedTotal.toString(),selected.currency,config.rubPerCurrencyUnit[selected.currency]) : null;
            const customerPositionTotal = draftOffer?.lines.find(line=>line.itemId===item.id)?.totalRubMinor ?? selectedRub;
            return <section key={item.id} className="min-w-0 border-t border-[#383e41] pt-2"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="break-words text-xs font-bold">{item.name} · {item.qty} шт.</h3><span className="text-[9px] text-[#929a9c]">{selected ? "Вариант выбран" : "Нужно выбрать предложение"}</span></div>
              {!itemQuotes.length ? <p className="mt-1 text-[10px] text-[#929a9c]">Сначала добавьте предложение поставщика.</p> : <div className="mt-1 grid gap-1">{itemQuotes.map((quote) => {
                const amounts = minor(quote,item.qty,suppliers,config,overrides);
                const total = amounts ? BigInt(amounts.retail) + BigInt(shippingTotalMinor(quote,item.qty)) : 0n;
                const fxRate = (config.rubPerCurrencyUnit as any)[quote.currency] || "1.00";
                const rub = total > 0n ? convertMinorUnitsToRub(total.toString(),quote.currency,fxRate) : "0";
                const displayPrice = quote.customerPriceRub || (total > 0n ? formatMinorUnits(rub,"RUB") : "Цена рассчитывается");
                const available = quote.status==="RECEIVED" || quote.status==="SELECTED";
                return <label key={quote.id} className="flex min-w-0 items-start gap-2 border border-[#343a3d] px-2 py-1.5 text-[10px]"><input type="radio" name={`offer-${item.id}`} disabled={!available} checked={selectedQuoteIds.includes(quote.id)} onChange={()=>onToggleQuote(quote.id)} className="mt-0.5 shrink-0 accent-[#ff6428] disabled:opacity-40"/><span className="min-w-0 break-words text-[#c2c8c9]">{quote.article} · {quote.maker ? `${quote.maker} · ` : ""}{quote.condition} · {quote.deliveryDays} дн. · клиентская цена: <b className="text-[#f1f0eb]">{displayPrice}</b><small className="block text-[#929a9c]">{canReadFinancialData && total > 0n ? `${formatMinorUnits(total.toString(),quote.currency)} · курс 1 ${quote.currency} = ${fxRate} RUB · ` : ""}общая доставка заявки распределится после выбора всех позиций{!available?` · ${quoteStatusLabels[quote.status]}`:""}</small></span></label>;
              })}</div>}
              {selected && selectedAmounts && customerPositionTotal !== null && customerPositionTotal !== undefined && <p className="mt-1 text-[10px] font-bold tabular-nums text-[#ff986f]">Итог позиции в RUB {draftOffer ? "с распределённой логистикой" : "до распределения общей логистики"}: {formatMinorUnits(customerPositionTotal,"RUB")} · {selected.condition} · срок {selected.deliveryDays} дней</p>}
            </section>;
          })}</div>
          <label className="mt-3 block text-[9px] font-bold uppercase tracking-wide text-[#aeb5b6]">Комментарий менеджера покупателю<textarea rows={2} value={buyerCommentDraft} onChange={(event) => setBuyerCommentDraft(event.target.value)} onBlur={() => onBuyerComment(buyerCommentDraft)} placeholder="Условия, срок или уточнение для покупателя" className={field}/></label>
          <div className="mt-3 grid gap-3 border-t border-[#383e41] pt-3 md:grid-cols-2">
            <section className="min-w-0" aria-label="Предпросмотр данных, предназначенных покупателю">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Предпросмотр клиентского предложения</p>
              <article className="mt-2 border border-[#51595c] bg-[#17191b] p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#383e41] pb-2"><div><BrandLogo variant="light" className="w-36" sizes="144px"/><p className="mt-1 text-[10px] text-[#aeb5b6]">Предложение по заявке {request.id}</p></div><span className="border border-[#6f3c28] px-2 py-1 text-[9px] font-bold uppercase text-[#ff986f]">{request.customerOfferSnapshot?`Версия ${request.customerOfferSnapshot.version}`:"Черновик"}</span></div>
                {(() => { const publicOffer=request.customerOfferSnapshot ?? (draftOffer?{...draftOffer,version:(request.customerOfferVersion??0)+1}:null); return publicOffer ? <><div className="grid gap-2 py-3">{publicOffer.lines.map(line=><div key={line.itemId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-[#292e30] pb-2 text-[10px]"><div className="min-w-0"><p className="break-words font-bold text-[#f1f0eb]">{line.name}</p><p className="mt-0.5 text-[#aeb5b6]">{line.quantity} шт. · {line.condition} · доставка {line.deliveryDays} дней</p></div><b className="whitespace-nowrap text-right tabular-nums text-[#f1f0eb]">{formatMinorUnits(line.totalRubMinor,"RUB")}</b></div>)}</div><div className="flex items-start justify-between gap-3 border-t border-[#383e41] pt-2"><span className="text-xs font-bold">Итого к оплате</span><b className="text-sm font-extrabold tabular-nums text-[#ff986f]">{formatMinorUnits(publicOffer.totalRubMinor,"RUB")}</b></div>{publicOffer.comment&&<p className="mt-3 whitespace-pre-wrap break-words border-t border-[#383e41] pt-2 text-[10px] text-[#c2c8c9]">{publicOffer.comment}</p>}</> : <p className="py-4 text-[10px] text-[#929a9c]">Выберите по одному предложению для каждой позиции, чтобы сформировать клиентскую версию.</p>; })()}
              </article>
              <p className="mt-1 text-[9px] text-[#929a9c]">В предпросмотр включены только наименование, количество, состояние, срок, цены в RUB и комментарий покупателю. Контактов поставщика, закупочных цен, наценки и внутренних заметок здесь нет.</p>
              {(request.customerOfferVersions?.length??0)>0&&<details className="mt-2 border-t border-[#383e41] pt-2"><summary className="cursor-pointer text-[9px] font-bold uppercase text-[#ff986f]">История версий клиентского предложения · {request.customerOfferVersions?.length}</summary><div className="mt-2 grid gap-2">{[...(request.customerOfferVersions??[])].reverse().map(version=><article key={version.version} className="border border-[#383e41] p-2"><p className="text-[10px] font-bold">Версия {version.version} · {version.status} · зафиксирована {ruDateTime(version.snapshot.formedAt)} · архивирована {ruDateTime(version.archivedAt)} · {version.archivedBy}</p><div className="mt-2 grid gap-1">{version.snapshot.lines.map(line=><p key={line.itemId} className="text-[9px] text-[#c2c8c9]">{line.name} · {line.quantity} шт. · {line.condition} · {line.deliveryDays} дней · {formatMinorUnits(line.totalRubMinor,"RUB")}</p>)}</div><p className="mt-1 text-[10px] font-bold tabular-nums text-[#ff986f]">Итого · {formatMinorUnits(version.snapshot.totalRubMinor,"RUB")}</p>{version.snapshot.comment&&<p className="mt-1 whitespace-pre-wrap text-[9px] text-[#aeb5b6]">{version.snapshot.comment}</p>}</article>)}</div></details>}
            </section>
            <div className="grid content-start gap-2">
              <section className="border-b border-[#383e41] pb-2"><p className="text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Статус предложения</p><p className="mt-1 text-xs font-bold text-[#f1f0eb]">{{DRAFT:"Черновик",FORMED:"Предложение сформировано · локально, не отправлено",SENT:"Отправлено покупателю",VIEWED:"Просмотрено покупателем"}[request.customerOfferStatus ?? "DRAFT"]}</p>{request.customerOfferSnapshot&&<p className="mt-1 text-[9px] text-[#929a9c]">Версия {request.customerOfferSnapshot.version} · курс зафиксирован {ruDateTime(request.customerOfferSnapshot.formedAt)}</p>}{request.customerOfferStatus==="FORMED"&&<p className="mt-1 text-[9px] text-[#ffb08c]">Демо-среда: версия сохранена локально. Канал отправки не подключён.</p>}</section>
              <section className="border-b border-[#383e41] pb-2">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#929a9c]">Ответ покупателя · отдельно</p>
                <form onSubmit={saveResponse} className="grid content-start gap-1">
                  <select name="response" aria-label="Ответ покупателя" value={responseDraft} onChange={(event) => setResponseDraft(event.target.value as BuyerResponseStatus)} className={field}>
                    <option value="NO_RESPONSE">Не отвечал</option>
                    <option value="INTERESTED">Интересуется</option>
                    <option value="NEEDS_CLARIFICATION">Нужны уточнения</option>
                    <option value="ACCEPTED">Подтвердил</option>
                    <option value="REJECTED">Отказался</option>
                  </select>
                  <button disabled={!request.customerOfferSnapshot || !["FORMED","SENT","VIEWED"].includes(request.customerOfferStatus ?? "DRAFT") || responseDraft===(request.customerResponseStatus??"NO_RESPONSE")} className="min-h-8 border border-[#51595c] px-2 text-[9px] font-bold uppercase hover:border-[#ff6428] disabled:opacity-40">Сохранить ответ</button>
                </form>
                {request.customerOfferStatus==="FORMED"&&<p className="mt-1 text-[9px] text-[#929a9c]">Демо-проверка ответа: сохранение не отправляет предложение покупателю.</p>}
                {onCreateOrder && request.customerOfferSnapshot && (
                  <div className="mt-3 border-t border-[#383e41] pt-2">
                    <button
                      type="button"
                      onClick={onCreateOrder}
                      className="min-h-9 w-full border border-[#ff6428] bg-[#ff6428] px-3 text-[10px] font-extrabold uppercase tracking-wider text-[#17191b] shadow-md transition hover:bg-[#ff8050]"
                    >
                      📦 Оформить заказ в один клик
                    </button>
                    <p className="mt-1 text-[9px] text-[#ff986f]">
                      Создаёт заказ в PostgreSQL из согласованного предложения и переходит к доставке.
                    </p>
                  </div>
                )}
              </section>
              {request.customerOfferSnapshot&&<p className="text-[9px] text-[#929a9c]">Сформировано {ruDateTime(request.customerOfferSnapshot.formedAt)}</p>}
            </div>
          </div>
          {canReadFinancialData && request.customerOfferSnapshot?.financeLines && request.customerOfferSnapshot.financeLines.length > 0 && <details className="mt-3 border-t border-[#383e41] pt-2"><summary className="cursor-pointer text-[9px] font-bold uppercase tracking-wide text-[#ff986f]">Зафиксированный финансовый расчёт</summary><div className="mt-2 grid gap-2">{request.customerOfferSnapshot.financeLines.map((line)=>{const item=request.items.find(candidate=>candidate.id===line.itemId);return <article key={line.quoteId} className="grid min-w-0 gap-1 border border-[#383e41] bg-[#1a1d1f] p-2 text-[9px]"><b className="break-words text-[10px] text-[#f1f0eb]">{item?.name ?? "Позиция"} · {item?.qty ?? 1} шт. · поставщик: {line.supplierCountry}</b><p className="break-words text-[#c2c8c9]">Исходная цена: {line.sourceUnitPrice} {line.currency} / шт. · закупка позиции: {formatMinorUnits(line.purchaseMinor,line.currency)}</p><p className="break-words text-[#929a9c]">Курс: 1 {line.currency} = {line.fxRate} RUB · {line.fxDate} · источник: demo-настройки, не рынок</p><p className="break-words text-[#c2c8c9]">Закупка: {formatMinorUnits(line.purchaseRubMinor,"RUB")} · доставка поставщика: {formatMinorUnits(line.supplierLogisticsMinor,line.currency)} ({formatMinorUnits(line.supplierLogisticsRubMinor,"RUB")}) · общая доставка по заявке: {formatMinorUnits(line.allocatedSharedLogisticsRubMinor,"RUB")}</p><p className="break-words text-[#c2c8c9]">Тариф: {line.markupBasisPoints/100}% · минимум на каждую деталь × {item?.qty ?? 1}: {formatMinorUnits(line.minimumMarkupMinor,line.currency)} · наценка позиции: {formatMinorUnits(line.markupMinor,line.currency)}</p><p className="break-words font-bold text-[#ff986f]">Себестоимость: {formatMinorUnits(line.costRubMinor,"RUB")} · продажа: {formatMinorUnits(line.saleRubMinor,"RUB")} · валовая прибыль: {formatMinorUnits(line.grossProfitRubMinor,"RUB")} · маржа: {(Number(line.marginBasisPoints)/100).toFixed(2)}%</p></article>;})}</div></details>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#383e41] pt-3"><span className="text-[10px] text-[#929a9c]">{draftOffer ? "Курс из demo-настроек и тариф фиксируются в версии предложения. Сумма — в RUB." : "Не хватает выбранной позиции или корректного курса/суммы."}</span><div className="flex flex-wrap gap-2"><button disabled={!draftOffer || (request.customerOfferStatus ?? "DRAFT") !== "DRAFT"} onClick={() => draftOffer && onFormOffer({...draftOffer,version:(request.customerOfferVersion??0)+1,formedAt:new Date().toISOString(),financeLines:draftOffer.financeLines.map(line=>({...line,fxDate:todayLabel()}))})} className="min-h-9 bg-[#ff6428] px-3 text-[10px] font-extrabold uppercase text-[#17191b] disabled:cursor-not-allowed disabled:opacity-40">Сформировать версию предложения</button></div></div>
        </CompactPanel>
        <CompactPanel title={`История действий · ${request.events.length}`}>
          <ol className="grid gap-2">{[...request.events].reverse().map((event,index) => <li key={`${event.at}-${index}`} className="grid min-w-0 grid-cols-[10px_minmax(0,1fr)] gap-2"><span className="mt-1.5 h-2 w-2 rounded-full bg-[#ff6428]"/><div className="min-w-0 border-b border-[#383e41] pb-2"><p className="break-words text-[11px] text-[#d0d5d6]">{event.text}</p><p className="mt-0.5 text-[9px] text-[#929a9c]">{ruDateTime(event.at)} · {event.who}</p></div></li>)}</ol>
        </CompactPanel>
      </div>

      <aside className="grid min-w-0 content-start gap-2 xl:sticky xl:top-[76px]">
        <CompactPanel title="Рабочая панель">
          <div className="grid gap-2"><label className="text-[9px] font-bold uppercase text-[#929a9c]">Статус заявки<select value={request.status} onChange={(event) => onStatus(event.target.value as WorkspaceRequestStatus)} className={field}>{Object.entries(statusLabels).filter(([status])=>status!=="SENT_TO_CUSTOMER"||request.status===status).map(([status,label]) => <option key={status} value={status} disabled={status==="SENT_TO_CUSTOMER"}>{status==="SENT_TO_CUSTOMER"?`${label} · только после реальной отправки`:label}</option>)}</select><span className="mt-1 block font-normal normal-case text-[#929a9c]">«Отправлена покупателю» устанавливается только подтверждённым каналом отправки.</span></label><label className="text-[9px] font-bold uppercase text-[#929a9c]">Ответственный<select value={request.manager} onChange={(event) => onManager(event.target.value)} className={field}>{["Анна Смирнова","Илья Волков","Мария Ким"].map((manager) => <option key={manager}>{manager}</option>)}</select></label><label className="text-[9px] font-bold uppercase text-[#929a9c]">Приоритет<select value={request.priority} onChange={(event) => onPriority(event.target.value as "Высокий"|"Обычный")} className={field}><option>Обычный</option><option>Высокий</option></select></label></div>
        </CompactPanel>
        <CompactPanel title="Следующее действие" action={activeTask && <span className="text-[9px] text-[#ff986f]">{new Date(activeTask.dueAt).getTime()<Date.now()?"Просрочено":"Запланировано"}</span>}>
          {activeTask && !taskFormOpen ? <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-xs font-bold">{activeTask.title}</p><p className="mt-1 break-words text-[10px] text-[#aeb5b6]">{activeTask.description}</p><p className="mt-1 text-[10px] tabular-nums text-[#d0d5d6]">{new Intl.DateTimeFormat("ru-RU",{dateStyle:"short",timeStyle:"short"}).format(new Date(activeTask.dueAt))}</p></div><button onClick={() => setTaskFormOpen(true)} className="shrink-0 border border-[#51595c] px-2 py-1 text-[9px] uppercase hover:border-[#ff6428]">Изменить</button></div> : <form onSubmit={saveTask} className="grid gap-2"><label className="text-[9px] font-bold uppercase text-[#929a9c]">Действие<input required name="title" defaultValue={activeTask?.title ?? "Связаться с покупателем"} className={field}/></label><label className="text-[9px] font-bold uppercase text-[#929a9c]">Срок<input required name="dueAt" type="datetime-local" defaultValue={localDateTimeInput(activeTask?.dueAt)} className={field}/></label><label className="text-[9px] font-bold uppercase text-[#929a9c]">Приоритет задачи<select name="priority" defaultValue={activeTask?.priority ?? request.priority} className={field}><option>Обычный</option><option>Высокий</option></select></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setTaskFormOpen(false)} className="border border-[#51595c] px-2 py-1 text-[9px] uppercase">Отмена</button><button className="bg-[#ff6428] px-2 py-1 text-[9px] font-bold uppercase text-[#17191b]">Сохранить</button></div></form>}
        </CompactPanel>
        <CompactPanel title="Внутренняя заметка"><textarea key={request.id} id="internal-note" defaultValue={request.internalNote} rows={4} placeholder="Заметки для команды" className="w-full resize-y border border-[#414749] bg-[#17191b] p-2.5 text-xs leading-5 outline-none focus:border-[#ff6428]"/><button onClick={() => onSaveNote((document.getElementById("internal-note") as HTMLTextAreaElement).value)} className="mt-2 min-h-8 w-full border border-[#51595c] text-[9px] font-bold uppercase hover:border-[#ff6428]">Сохранить заметку</button><p className="mt-1 text-[9px] text-[#929a9c]">Только для сотрудников CRM.</p></CompactPanel>
        <CompactPanel title="Финансовый итог"><p className="mb-2 text-[9px] text-[#929a9c]">Демо · без смешения валют</p><div className="grid gap-2">{Object.entries(totals).length ? Object.entries(totals).map(([currency,value]) => value && <div key={currency} className="border-t border-[#383e41] pt-2"><div className="flex justify-between gap-2 text-[10px]"><span className="text-[#929a9c]">Детали</span><b className="tabular-nums">{formatMinorUnits(value.products.toString(),currency as CurrencyCode)}</b></div><div className="mt-1 flex justify-between gap-2 text-[10px]"><span className="text-[#929a9c]">Логистика</span><b className="tabular-nums">{formatMinorUnits(value.logistics.toString(),currency as CurrencyCode)}</b></div><div className="mt-1 flex justify-between gap-2 text-xs"><span className="font-bold">Итого покупателю</span><b className="tabular-nums text-[#ff986f]">{formatMinorUnits(value.total.toString(),currency as CurrencyCode)}</b></div></div>) : <p className="text-[10px] text-[#929a9c]">Выберите предложение покупателю.</p>}</div></CompactPanel>
      </aside>
    </div>
  </>;
}
