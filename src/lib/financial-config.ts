export type SupplierCountry = "Россия" | "Беларусь" | "Польша";
export type CurrencyCode = "RUB" | "USD" | "EUR" | "BYN" | "PLN";

export type CountryTariff = {
  markupBasisPoints: number;
  minimumMarkupRubMinor: string;
};

export type FinancialConfig = {
  demoOnly: true;
  /** RUB value of one currency unit, represented as a decimal string. */
  rubPerCurrencyUnit: Record<CurrencyCode, string>;
  tariffs: Record<SupplierCountry, CountryTariff>;
};

export type PriceAdjustmentReason = "SPECIAL_CLIENT_PRICE" | "COMPETITIVE_PRICE" | "LOYAL_CUSTOMER_DISCOUNT" | "PURCHASE_COST_CHANGE" | "OTHER";
export type PriceAdjustmentHistoryEntry = {
  id: string;
  occurredAt: string;
  manager: string;
  requestId: string;
  quoteId: string;
  article: string;
  previousManualPrice: string | null;
  automaticPrice: string;
  newManualPrice: string;
  currency: CurrencyCode;
  reason: PriceAdjustmentReason | null;
  explanation: string;
  belowPurchaseCost: boolean;
  lossManagerConfirmed: boolean;
  lossExplanation: string;
  legacy?: true;
  legacyText?: string;
};
export type PriceHistoryEntry = PriceAdjustmentHistoryEntry;

const currencyCodes: CurrencyCode[] = ["RUB", "USD", "EUR", "BYN", "PLN"];
const adjustmentReasons: PriceAdjustmentReason[] = ["SPECIAL_CLIENT_PRICE", "COMPETITIVE_PRICE", "LOYAL_CUSTOMER_DISCOUNT", "PURCHASE_COST_CHANGE", "OTHER"];

export const FINANCIAL_CONFIG_STORAGE_KEY = "zaptut.crm.demo.financial-config.v1";
export const PRICE_OVERRIDES_STORAGE_KEY = "zaptut.crm.demo.price-overrides.v1";
export const PRICE_HISTORY_STORAGE_KEY = "zaptut.crm.demo.price-history.v1";

// Seed configuration for the interactive prototype. FX values are placeholders,
// not quotes from a bank or live market feed. Change these from /admin settings.
export const initialFinancialConfig: FinancialConfig = {
  demoOnly: true,
  rubPerCurrencyUnit: { RUB: "1", USD: "92", EUR: "100", BYN: "28", PLN: "23.5" },
  tariffs: {
    "Польша": { markupBasisPoints: 5500, minimumMarkupRubMinor: "170000" },
    "Россия": { markupBasisPoints: 2800, minimumMarkupRubMinor: "30000" },
    "Беларусь": { markupBasisPoints: 2800, minimumMarkupRubMinor: "30000" },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Merge a versioned stored config with safe defaults; invalid fields fall back individually. */
export function normalizeStoredFinancialConfig(value: unknown): FinancialConfig {
  const defaults: FinancialConfig = {
    demoOnly: true,
    rubPerCurrencyUnit: { ...initialFinancialConfig.rubPerCurrencyUnit },
    tariffs: {
      "Польша": { ...initialFinancialConfig.tariffs["Польша"] },
      "Россия": { ...initialFinancialConfig.tariffs["Россия"] },
      "Беларусь": { ...initialFinancialConfig.tariffs["Беларусь"] },
    },
  };
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.config)) return defaults;
  const stored = value.config;
  const rates = isRecord(stored.rubPerCurrencyUnit) ? stored.rubPerCurrencyUnit : {};
  const storedTariffs = isRecord(stored.tariffs) ? stored.tariffs : {};
  const currencies: CurrencyCode[] = ["RUB", "USD", "EUR", "BYN", "PLN"];
  const countries: SupplierCountry[] = ["Польша", "Россия", "Беларусь"];
  for (const currency of currencies) {
    const rate = rates[currency];
    if (typeof rate === "string" && /^\d+(?:\.\d{1,4})?$/.test(rate) && Number(rate) > 0) {
      defaults.rubPerCurrencyUnit[currency] = rate;
    }
  }
  for (const country of countries) {
    const tariff = storedTariffs[country];
    if (!isRecord(tariff)) continue;
    if (typeof tariff.markupBasisPoints === "number" && Number.isSafeInteger(tariff.markupBasisPoints) && tariff.markupBasisPoints >= 0) {
      defaults.tariffs[country].markupBasisPoints = tariff.markupBasisPoints;
    }
    if (typeof tariff.minimumMarkupRubMinor === "string" && /^\d+$/.test(tariff.minimumMarkupRubMinor)) {
      defaults.tariffs[country].minimumMarkupRubMinor = tariff.minimumMarkupRubMinor;
    }
  }
  return defaults;
}

export function normalizeStoredPriceOverrides(value: unknown): Record<string, string> {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.overrides)) return {};
  return Object.fromEntries(Object.entries(value.overrides).filter(([id, amount]) =>
    id.length > 0 && typeof amount === "string" && /^\d+(?:[.,]\d{1,2})?$/.test(amount),
  )) as Record<string, string>;
}

export function normalizeStoredPriceHistory(value: unknown): PriceHistoryEntry[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) return [];
  return value.entries.flatMap((entry, index): PriceHistoryEntry[] => {
    if (typeof entry === "string") return [{
      id: `legacy-${index}`, occurredAt: "", manager: "", requestId: "", quoteId: "", article: "",
      previousManualPrice: null, automaticPrice: "", newManualPrice: "", currency: "RUB", reason: null,
      explanation: "", belowPurchaseCost: false, lossManagerConfirmed: false, lossExplanation: "",
      legacy: true, legacyText: entry,
    }];
    if (!isRecord(entry)) return [];
    const currency = currencyCodes.includes(entry.currency as CurrencyCode) ? entry.currency as CurrencyCode : "RUB";
    const reason = adjustmentReasons.includes(entry.reason as PriceAdjustmentReason) ? entry.reason as PriceAdjustmentReason : null;
    const requiredText = (field: unknown) => typeof field === "string" ? field : "";
    const legacy = entry.legacy === true || reason === null;
    const legacyText = requiredText(entry.legacyText) || [requiredText(entry.occurredAt), requiredText(entry.manager), requiredText(entry.requestId), requiredText(entry.article), requiredText(entry.newManualPrice)].filter(Boolean).join(" · ");
    return [{
      id: requiredText(entry.id) || `legacy-${index}`,
      occurredAt: requiredText(entry.occurredAt), manager: requiredText(entry.manager), requestId: requiredText(entry.requestId),
      quoteId: requiredText(entry.quoteId), article: requiredText(entry.article),
      previousManualPrice: typeof entry.previousManualPrice === "string" ? entry.previousManualPrice : null,
      automaticPrice: requiredText(entry.automaticPrice), newManualPrice: requiredText(entry.newManualPrice), currency,
      reason, explanation: requiredText(entry.explanation), belowPurchaseCost: entry.belowPurchaseCost === true,
      lossManagerConfirmed: entry.lossManagerConfirmed === true, lossExplanation: requiredText(entry.lossExplanation),
      ...(legacy ? { legacy: true as const, legacyText } : {}),
    }];
  });
}

/** Validate a manually entered line price; purchase total already includes quantity and deliberately excludes logistics. */
export function validatePriceOverride(args: {
  newPrice: string; purchaseTotalMinor: string; currency: CurrencyCode; reason: PriceAdjustmentReason | "";
  explanation: string; lossManagerConfirmed: boolean; lossExplanation: string;
}): { newPriceMinor: string; belowPurchaseCost: boolean; potentialLossMinor: string } {
  const price = toMinorUnits(args.newPrice, args.currency);
  const purchase = BigInt(args.purchaseTotalMinor);
  if (purchase < 0n) throw new Error("Закупочная стоимость не может быть отрицательной.");
  if (!args.reason || !adjustmentReasons.includes(args.reason)) throw new Error("Выберите причину корректировки.");
  if (args.reason === "OTHER" && !args.explanation.trim()) throw new Error("Укажите пояснение для причины «Другое».");
  const belowPurchaseCost = price < purchase;
  const potentialLoss = belowPurchaseCost ? purchase - price : 0n;
  if (belowPurchaseCost && !args.lossManagerConfirmed) throw new Error("Подтвердите отдельным действием продажу ниже закупочной стоимости.");
  if (belowPurchaseCost && !args.lossExplanation.trim()) throw new Error("Объясните причину потенциального убытка.");
  return { newPriceMinor: price.toString(), belowPurchaseCost, potentialLossMinor: potentialLoss.toString() };
}

/** Append-only history helper; repeated handling of the same event id cannot duplicate the record. */
export function appendPriceAdjustmentHistory(entries: PriceHistoryEntry[], entry: PriceAdjustmentHistoryEntry): PriceHistoryEntry[] {
  return entries.some((existing) => existing.id === entry.id) ? entries : [entry, ...entries];
}

export function describePriceAdjustmentHistoryEntry(entry: PriceHistoryEntry): string {
  if (entry.legacy) return `${entry.legacyText || "Старая запись"} · Причина не указана (старая запись)`;
  const reasonLabels: Record<PriceAdjustmentReason, string> = {
    SPECIAL_CLIENT_PRICE: "Специальная цена для клиента", COMPETITIVE_PRICE: "Конкурентная цена",
    LOYAL_CUSTOMER_DISCOUNT: "Скидка для постоянного клиента", PURCHASE_COST_CHANGE: "Корректировка из-за изменения закупочной цены", OTHER: "Другое",
  };
  const previous = entry.previousManualPrice === null ? "нет предыдущей ручной цены" : `предыдущая ${entry.previousManualPrice} ${entry.currency}`;
  const loss = entry.belowPurchaseCost ? ` · ниже закупки: подтверждено${entry.lossExplanation ? ` — ${entry.lossExplanation}` : ""}` : "";
  return `${entry.occurredAt} · ${entry.manager} · ${entry.requestId} · ${entry.article} · ${reasonLabels[entry.reason ?? "OTHER"]}${entry.explanation ? ` — ${entry.explanation}` : ""} · ${previous} · расчётная ${entry.automaticPrice} ${entry.currency} → ручная ${entry.newManualPrice} ${entry.currency}${loss}`;
}

const CURRENCY_DIGITS: Record<CurrencyCode, number> = { RUB: 2, USD: 2, EUR: 2, BYN: 2, PLN: 2 };
const RATE_SCALE = 10_000n;

function pow10(n: number): bigint { return 10n ** BigInt(n); }

/** Parse a user-entered decimal into integer minor units without IEEE-754 math. */
export function toMinorUnits(input: string | null | undefined, currency: CurrencyCode): bigint {
  if (!input) return 0n;
  const value = String(input).trim().replace(",", ".");
  if (!value) return 0n;
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("Введите корректную неотрицательную сумму.");
  const [whole, fraction = ""] = value.split(".");
  const digits = CURRENCY_DIGITS[currency] ?? 2;
  if (fraction.length > digits) throw new Error(`Для ${currency} допускается не более ${digits} знаков после запятой.`);
  return BigInt(whole) * pow10(digits) + BigInt((fraction + "0".repeat(digits)).slice(0, digits) || "0");
}

/** Preserve the supplier's entered logistics scope; total-order charges are never multiplied by quantity. */
export function calculateLogisticsTotalMinor(args: { amount: string | null | undefined; quantity: number; basis: "ORDER"|"PER_UNIT"; currency: CurrencyCode }): string {
  if (!Number.isInteger(args.quantity) || args.quantity < 1) throw new Error("Количество в позиции должно быть не меньше 1.");
  const entered = toMinorUnits(args.amount || "0", args.currency);
  return (args.basis === "PER_UNIT" ? entered * BigInt(args.quantity) : entered).toString();
}

/** Allocate one RUB order charge by positive purchase weights; the final share absorbs rounding remainder. */
export function distributeOrderLogisticsMinor(totalMinor: string, purchaseWeightsMinor: string[]): string[] {
  const total = BigInt(totalMinor);
  if (total < 0n) throw new Error("Общая логистика не может быть отрицательной.");
  if (!purchaseWeightsMinor.length) return [];
  const weights = purchaseWeightsMinor.map((value) => BigInt(value));
  if (weights.some((weight) => weight < 0n)) throw new Error("Стоимость закупки для распределения не может быть отрицательной.");
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  let remainder = total;
  return weights.map((weight, index) => {
    const share = index === weights.length - 1
      ? remainder
      : weightTotal > 0n ? total * weight / weightTotal : total / BigInt(weights.length);
    remainder -= share;
    return share.toString();
  });
}

function decimalRateToScaled(rate: string): bigint {
  if (!/^\d+(?:\.\d{1,4})?$/.test(rate) || Number(rate) <= 0) throw new Error("Демо-курс должен быть положительным числом с точностью до 4 знаков.");
  const [whole, fraction = ""] = rate.split(".");
  return BigInt(whole) * RATE_SCALE + BigInt((fraction + "0000").slice(0, 4));
}

/** Convert a currency amount (minor units) to RUB minor units using a fixed quote rate. */
export function convertMinorUnitsToRub(amountMinor: string, currency: CurrencyCode, rubPerCurrencyUnit: string): string {
  const rate = decimalRateToScaled(rubPerCurrencyUnit);
  return roundHalfUp(BigInt(amountMinor) * rate, RATE_SCALE).toString();
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export type RetailCalculation = {
  currency: CurrencyCode;
  supplierCountry: SupplierCountry;
  purchaseMinor: string;
  percentageMarkupMinor: string;
  minimumMarkupMinor: string;
  appliedMarkupMinor: string;
  customerPriceMinor: string;
  markupBasisPoints: number;
};

export function calculateRetailPrice(args: {
  /** Supplier purchase price for one physical part; quantity is applied by the caller. */
  purchaseAmount: string;
  currency: CurrencyCode;
  supplierCountry: SupplierCountry;
  config: FinancialConfig;
}): RetailCalculation {
  const { purchaseAmount, currency, supplierCountry, config } = args;
  const tariff = config.tariffs[supplierCountry];
  const purchaseMinor = toMinorUnits(purchaseAmount, currency);
  const percentageMarkupMinor = roundHalfUp(purchaseMinor * BigInt(tariff.markupBasisPoints), 10_000n);
  const rubPerUnitScaled = decimalRateToScaled(config.rubPerCurrencyUnit[currency]);
  // Convert the RUB minimum into the quote currency's minor units, rounding up
  // so the resulting markup never falls below the configured RUB floor.
  const minimumMarkupMinor = ceilDiv(BigInt(tariff.minimumMarkupRubMinor) * RATE_SCALE, rubPerUnitScaled);
  const appliedMarkupMinor = percentageMarkupMinor > minimumMarkupMinor ? percentageMarkupMinor : minimumMarkupMinor;
  return {
    currency, supplierCountry, purchaseMinor: purchaseMinor.toString(),
    percentageMarkupMinor: percentageMarkupMinor.toString(), minimumMarkupMinor: minimumMarkupMinor.toString(),
    appliedMarkupMinor: appliedMarkupMinor.toString(), customerPriceMinor: (purchaseMinor + appliedMarkupMinor).toString(),
    markupBasisPoints: tariff.markupBasisPoints,
  };
}

/** Apply the per-part tariff once for every requested unit, then aggregate the line. */
export function calculateRetailPositionPrice(args: {
  unitPurchasePrice: string;
  quantity: number;
  currency: CurrencyCode;
  supplierCountry: SupplierCountry;
  config: FinancialConfig;
}): RetailCalculation {
  if (!Number.isInteger(args.quantity) || args.quantity < 1) throw new Error("Количество в позиции должно быть не меньше 1.");
  const unit = calculateRetailPrice({ purchaseAmount: args.unitPurchasePrice, currency: args.currency, supplierCountry: args.supplierCountry, config: args.config });
  const quantity = BigInt(args.quantity);
  return {
    ...unit,
    purchaseMinor: (BigInt(unit.purchaseMinor) * quantity).toString(),
    percentageMarkupMinor: (BigInt(unit.percentageMarkupMinor) * quantity).toString(),
    minimumMarkupMinor: (BigInt(unit.minimumMarkupMinor) * quantity).toString(),
    appliedMarkupMinor: (BigInt(unit.appliedMarkupMinor) * quantity).toString(),
    customerPriceMinor: (BigInt(unit.customerPriceMinor) * quantity).toString(),
  };
}

export function formatMinorUnits(minor: string, currency: CurrencyCode, locale = "ru-RU"): string {
  const scale = pow10(CURRENCY_DIGITS[currency]);
  const signedValue = BigInt(minor);
  const sign = signedValue < 0n ? "−" : "";
  const value = signedValue < 0n ? -signedValue : signedValue;
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(CURRENCY_DIGITS[currency], "0");
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).formatToParts(whole);
  const lastInteger = parts.map((part) => part.type).lastIndexOf("integer");
  const decimal = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  parts.splice(lastInteger + 1, 0, { type: "decimal", value: decimal }, { type: "fraction", value: fraction });
  return `${sign}${parts.map((part) => part.value).join("")}`;
}

export function minorUnitsToDecimal(minor: string, currency: CurrencyCode): string {
  const scale = pow10(CURRENCY_DIGITS[currency]);
  const value = BigInt(minor);
  return `${value / scale}.${(value % scale).toString().padStart(CURRENCY_DIGITS[currency], "0")}`;
}
