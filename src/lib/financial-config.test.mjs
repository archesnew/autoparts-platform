import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCIAL_CONFIG_STORAGE_KEY,
  initialFinancialConfig,
  normalizeStoredFinancialConfig,
  normalizeStoredPriceHistory,
  normalizeStoredPriceOverrides,
  appendPriceAdjustmentHistory,
  describePriceAdjustmentHistoryEntry,
  validatePriceOverride,
  calculateRetailPositionPrice,
  calculateRetailPrice,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_OVERRIDES_STORAGE_KEY,
} from "./financial-config.ts";

test("financial storage keys are versioned and separate", () => {
  assert.equal(FINANCIAL_CONFIG_STORAGE_KEY, "zaptut.crm.demo.financial-config.v1");
  assert.equal(PRICE_OVERRIDES_STORAGE_KEY, "zaptut.crm.demo.price-overrides.v1");
  assert.equal(PRICE_HISTORY_STORAGE_KEY, "zaptut.crm.demo.price-history.v1");
});

test("first run and malformed storage use cloned initial financial defaults", () => {
  const missing = normalizeStoredFinancialConfig(null);
  const broken = normalizeStoredFinancialConfig({ version: 1, config: "not-an-object" });
  assert.deepEqual(missing, initialFinancialConfig);
  assert.deepEqual(broken, initialFinancialConfig);
  assert.notEqual(missing, initialFinancialConfig);
  assert.notEqual(missing.tariffs, initialFinancialConfig.tariffs);
});

test("partial financial settings restore valid values and default missing or invalid fields", () => {
  const restored = normalizeStoredFinancialConfig({
    version: 1,
    config: {
      tariffs: { "Польша": { markupBasisPoints: 6000 } },
      rubPerCurrencyUnit: { USD: "97.25", EUR: "0", BYN: "bad" },
    },
  });
  assert.equal(restored.tariffs["Польша"].markupBasisPoints, 6000);
  assert.equal(restored.tariffs["Польша"].minimumMarkupRubMinor, "170000");
  assert.equal(restored.tariffs["Россия"].markupBasisPoints, 2800);
  assert.equal(restored.rubPerCurrencyUnit.USD, "97.25");
  assert.equal(restored.rubPerCurrencyUnit.EUR, initialFinancialConfig.rubPerCurrencyUnit.EUR);
  assert.equal(restored.rubPerCurrencyUnit.BYN, initialFinancialConfig.rubPerCurrencyUnit.BYN);
});

test("config values survive a versioned JSON storage round trip", () => {
  const changed = normalizeStoredFinancialConfig({
    version: 1,
    config: { ...initialFinancialConfig, tariffs: { ...initialFinancialConfig.tariffs, "Польша": { ...initialFinancialConfig.tariffs["Польша"], markupBasisPoints: 6000 } }, rubPerCurrencyUnit: { ...initialFinancialConfig.rubPerCurrencyUnit, USD: "97.25" } },
  });
  const restored = normalizeStoredFinancialConfig(JSON.parse(JSON.stringify({ version: 1, config: changed })));
  assert.equal(restored.tariffs["Польша"].markupBasisPoints, 6000);
  assert.equal(restored.rubPerCurrencyUnit.USD, "97.25");
});

test("overrides survive refresh and damaged or missing entries are ignored safely", () => {
  const values = { "quote-a": "1234.50", "quote-b": "14,25", bad: "-20", malformed: "1.234" };
  const restored = normalizeStoredPriceOverrides(JSON.parse(JSON.stringify({ version: 1, overrides: values })));
  assert.deepEqual(restored, { "quote-a": "1234.50", "quote-b": "14,25" });
  assert.deepEqual(normalizeStoredPriceOverrides(null), {});
  assert.deepEqual(normalizeStoredPriceOverrides({ version: 1, overrides: null }), {});
});

const historyEntry = (overrides = {}) => ({
  id: "event-1", occurredAt: "2026-11-07T10:00:00.000Z", manager: "Менеджер", requestId: "ZP-2026-0147",
  quoteId: "quote-1", article: "OEM-1", previousManualPrice: null, automaticPrice: "2500.00",
  newManualPrice: "2000.00", currency: "RUB", reason: "COMPETITIVE_PRICE", explanation: "",
  belowPurchaseCost: false, lossManagerConfirmed: false, lossExplanation: "", ...overrides,
});

test("manual price cannot be saved without a reason", () => {
  assert.throws(() => validatePriceOverride({ newPrice: "2000", purchaseTotalMinor: "100000", currency: "RUB", reason: "", explanation: "", lossManagerConfirmed: false, lossExplanation: "" }), /Выберите причину/);
});

test("OTHER reason requires a non-empty explanation", () => {
  assert.throws(() => validatePriceOverride({ newPrice: "2000", purchaseTotalMinor: "100000", currency: "RUB", reason: "OTHER", explanation: "  ", lossManagerConfirmed: false, lossExplanation: "" }), /пояснение/);
  assert.equal(validatePriceOverride({ newPrice: "2000", purchaseTotalMinor: "100000", currency: "RUB", reason: "OTHER", explanation: "Особый случай", lossManagerConfirmed: false, lossExplanation: "" }).newPriceMinor, "200000");
});

test("price above purchase is saved without loss confirmation", () => {
  const result = validatePriceOverride({ newPrice: "1200", purchaseTotalMinor: "100000", currency: "RUB", reason: "COMPETITIVE_PRICE", explanation: "", lossManagerConfirmed: false, lossExplanation: "" });
  assert.deepEqual(result, { newPriceMinor: "120000", belowPurchaseCost: false, potentialLossMinor: "0" });
});

test("price below purchase requires separate manager confirmation", () => {
  assert.throws(() => validatePriceOverride({ newPrice: "900", purchaseTotalMinor: "100000", currency: "RUB", reason: "LOYAL_CUSTOMER_DISCOUNT", explanation: "", lossManagerConfirmed: false, lossExplanation: "Причина" }), /Подтвердите/);
});

test("price below purchase requires a written loss explanation", () => {
  assert.throws(() => validatePriceOverride({ newPrice: "900", purchaseTotalMinor: "100000", currency: "RUB", reason: "LOYAL_CUSTOMER_DISCOUNT", explanation: "", lossManagerConfirmed: true, lossExplanation: "  " }), /Объясните/);
  const result = validatePriceOverride({ newPrice: "900", purchaseTotalMinor: "100000", currency: "RUB", reason: "LOYAL_CUSTOMER_DISCOUNT", explanation: "", lossManagerConfirmed: true, lossExplanation: "Сохранить клиента" });
  assert.deepEqual(result, { newPriceMinor: "90000", belowPurchaseCost: true, potentialLossMinor: "10000" });
});

test("history entry preserves all required audit fields", () => {
  const entry = historyEntry({ previousManualPrice: "2100.00", belowPurchaseCost: true, lossManagerConfirmed: true, lossExplanation: "Решение руководителя" });
  const restored = normalizeStoredPriceHistory({ version: 1, entries: [entry] });
  assert.deepEqual(restored[0], entry);
  assert.equal(restored[0].requestId, "ZP-2026-0147");
  assert.equal(restored[0].lossManagerConfirmed, true);
});

test("multiple adjustments append as separate records and duplicate event ids are ignored", () => {
  const first = historyEntry();
  const second = historyEntry({ id: "event-2", newManualPrice: "1900.00", previousManualPrice: "2000.00" });
  const history = appendPriceAdjustmentHistory(appendPriceAdjustmentHistory([], first), second);
  assert.deepEqual(history.map((entry) => entry.id), ["event-2", "event-1"]);
  assert.equal(appendPriceAdjustmentHistory(history, second), history);
});

test("old string history records remain visible with the legacy reason label", () => {
  const oldText = "07.11.2026 · Менеджер · A-1: ручная цена";
  const restored = normalizeStoredPriceHistory({ version: 1, entries: [oldText, 42, null] });
  assert.equal(restored.length, 1);
  assert.equal(restored[0].legacyText, oldText);
  assert.match(describePriceAdjustmentHistoryEntry(restored[0]), /Причина не указана \(старая запись\)/);
  assert.deepEqual(normalizeStoredPriceHistory(null), []);
});

test("manual price and append-only history survive a JSON round trip", () => {
  const overrides = { "quote-1": "2000.00" };
  const entries = [historyEntry(), historyEntry({ id: "event-2", newManualPrice: "1900.00" })];
  const restoredOverrides = normalizeStoredPriceOverrides(JSON.parse(JSON.stringify({ version: 1, overrides })));
  const restoredHistory = normalizeStoredPriceHistory(JSON.parse(JSON.stringify({ version: 1, entries })));
  assert.deepEqual(restoredOverrides, overrides);
  assert.deepEqual(restoredHistory, entries);
});

test("normalizing financial settings and manual price rules do not mutate existing offer snapshots", () => {
  const existingRequest = Object.freeze({
    customerOfferSnapshot: Object.freeze({
      totalRubMinor: "123450",
      financeLines: Object.freeze([Object.freeze({ fxRate: "92", markupBasisPoints: 5500, saleRubMinor: "123450" })]),
    }),
  });
  normalizeStoredFinancialConfig({ version: 1, config: { tariffs: { "Польша": { markupBasisPoints: 6000 } } } });
  validatePriceOverride({ newPrice: "1200", purchaseTotalMinor: "100000", currency: "RUB", reason: "COMPETITIVE_PRICE", explanation: "", lossManagerConfirmed: false, lossExplanation: "" });
  assert.equal(existingRequest.customerOfferSnapshot.financeLines[0].fxRate, "92");
  assert.equal(existingRequest.customerOfferSnapshot.financeLines[0].markupBasisPoints, 5500);
  assert.equal(existingRequest.customerOfferSnapshot.financeLines[0].saleRubMinor, "123450");
});

test("official financial tariff rules: Russia 28% min 300 RUB, Belarus 28% min 300 RUB, Poland 55% min 1700 RUB", () => {
  assert.equal(initialFinancialConfig.tariffs["Россия"].markupBasisPoints, 2800);
  assert.equal(initialFinancialConfig.tariffs["Россия"].minimumMarkupRubMinor, "30000"); // 300 RUB = 30 000 minor units

  assert.equal(initialFinancialConfig.tariffs["Беларусь"].markupBasisPoints, 2800);
  assert.equal(initialFinancialConfig.tariffs["Беларусь"].minimumMarkupRubMinor, "30000"); // 300 RUB = 30 000 minor units

  assert.equal(initialFinancialConfig.tariffs["Польша"].markupBasisPoints, 5500);
  assert.equal(initialFinancialConfig.tariffs["Польша"].minimumMarkupRubMinor, "170000"); // 1700 RUB = 170 000 minor units
});

test("Russia calculation selects MAX between 28% percentage markup and 300 RUB minimum per physical part", () => {
  // Case A: Low purchase price where 300 RUB minimum dominates
  // 100 RUB: 28% = 28 RUB, min = 300 RUB -> applied markup = 300 RUB
  const calcLow = calculateRetailPositionPrice({
    unitPurchasePrice: "100.00",
    quantity: 4,
    currency: "RUB",
    supplierCountry: "Россия",
    config: initialFinancialConfig,
  });
  assert.equal(calcLow.purchaseMinor, "40000"); // 400.00 RUB
  assert.equal(calcLow.percentageMarkupMinor, "11200"); // 112.00 RUB (4 x 28)
  assert.equal(calcLow.minimumMarkupMinor, "120000"); // 1200.00 RUB (4 x 300)
  assert.equal(calcLow.appliedMarkupMinor, "120000"); // Max applied: 1200.00 RUB
  assert.equal(calcLow.customerPriceMinor, "160000"); // 1600.00 RUB

  // Case B: High purchase price where 28% percentage dominates
  // 10 000 RUB: 28% = 2800 RUB, min = 300 RUB -> applied markup = 2800 RUB
  const calcHigh = calculateRetailPositionPrice({
    unitPurchasePrice: "10000.00",
    quantity: 1,
    currency: "RUB",
    supplierCountry: "Россия",
    config: initialFinancialConfig,
  });
  assert.equal(calcHigh.purchaseMinor, "1000000"); // 10 000.00 RUB
  assert.equal(calcHigh.percentageMarkupMinor, "280000"); // 2800.00 RUB (28%)
  assert.equal(calcHigh.minimumMarkupMinor, "30000"); // 300.00 RUB
  assert.equal(calcHigh.appliedMarkupMinor, "280000"); // Max applied: 2800.00 RUB
  assert.equal(calcHigh.customerPriceMinor, "1280000"); // 12 800.00 RUB
});

test("Belarus calculation selects MAX between 28% percentage markup and 300 RUB minimum per physical part", () => {
  // 1 BYN = 28 RUB. Purchase: 20 BYN (~560 RUB). Quantity: 2
  // Percentage markup: 20 * 28% = 5.60 BYN (560 minor units)
  // Minimum markup: 300 RUB / 28 = 10.714... BYN -> ceil to 10.72 BYN (1072 minor units)
  // Max applied: 10.72 BYN per part. For 2 parts: 21.44 BYN (2144 minor units)
  const calcBY = calculateRetailPositionPrice({
    unitPurchasePrice: "20.00",
    quantity: 2,
    currency: "BYN",
    supplierCountry: "Беларусь",
    config: initialFinancialConfig,
  });
  assert.equal(calcBY.purchaseMinor, "4000"); // 40.00 BYN
  assert.equal(calcBY.percentageMarkupMinor, "1120"); // 11.20 BYN (2 x 5.60)
  assert.equal(calcBY.minimumMarkupMinor, "2144"); // 21.44 BYN (2 x 10.72)
  assert.equal(calcBY.appliedMarkupMinor, "2144"); // Max applied: 21.44 BYN
  assert.equal(calcBY.customerPriceMinor, "6144"); // 61.44 BYN
});

test("Poland calculation selects MAX between 55% percentage markup and 1700 RUB minimum per physical part", () => {
  // 1 PLN = 23.5 RUB.
  // Case A: 100 PLN (~2350 RUB). Quantity: 2
  // Percentage markup: 100 * 55% = 55 PLN (5500 minor units)
  // Minimum markup: 1700 RUB / 23.5 = 72.3404... PLN -> ceil to 72.35 PLN (7235 minor units)
  // Max applied: 72.35 PLN per part. For 2 parts: 144.70 PLN (14470 minor units)
  const calcPL_low = calculateRetailPositionPrice({
    unitPurchasePrice: "100.00",
    quantity: 2,
    currency: "PLN",
    supplierCountry: "Польша",
    config: initialFinancialConfig,
  });
  assert.equal(calcPL_low.purchaseMinor, "20000"); // 200.00 PLN
  assert.equal(calcPL_low.percentageMarkupMinor, "11000"); // 110.00 PLN (2 x 55.00)
  assert.equal(calcPL_low.minimumMarkupMinor, "14470"); // 144.70 PLN (2 x 72.35)
  assert.equal(calcPL_low.appliedMarkupMinor, "14470"); // Max applied: 144.70 PLN
  assert.equal(calcPL_low.customerPriceMinor, "34470"); // 344.70 PLN

  // Case B: High purchase price where 55% percentage markup dominates
  // 1000 PLN (~23 500 RUB). Quantity: 1
  // Percentage markup: 1000 * 55% = 550 PLN
  // Minimum markup: 72.35 PLN
  // Max applied: 550 PLN
  const calcPL_high = calculateRetailPositionPrice({
    unitPurchasePrice: "1000.00",
    quantity: 1,
    currency: "PLN",
    supplierCountry: "Польша",
    config: initialFinancialConfig,
  });
  assert.equal(calcPL_high.purchaseMinor, "100000"); // 1000.00 PLN
  assert.equal(calcPL_high.percentageMarkupMinor, "55000"); // 550.00 PLN (55%)
  assert.equal(calcPL_high.minimumMarkupMinor, "7235"); // 72.35 PLN
  assert.equal(calcPL_high.appliedMarkupMinor, "55000"); // Max applied: 550.00 PLN
  assert.equal(calcPL_high.customerPriceMinor, "155000"); // 1550.00 PLN
});
