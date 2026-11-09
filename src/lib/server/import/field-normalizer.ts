import crypto from "node:crypto";
import type { RawFeedItem } from "./feed-parser.ts";

export type NormalizedFeedItem = {
  externalId: string | null;
  rawOem: string | null;
  normalizedOem: string | null;
  title: string;
  brand: string;
  category: string;
  price: number | null;
  hasExplicitPrice: boolean;
  currency: string;
  quantity: number;
  hasExplicitQuantity: boolean;
  condition: "NEW" | "USED";
  deliveryTerms: string | null;
  deliveryDays: number | null;
  photos: string[];
  description: string | null;
  city: string | null;
  sourceUrl: string | null;
  validationErrors: string[];
};

export function normalizeOemCode(val: unknown): string | null {
  if (typeof val !== "string" && typeof val !== "number") return null;
  const str = String(val).trim();
  if (!str) return null;
  const clean = str.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean.length >= 3 ? clean : null;
}

const SUPPORTED_CURRENCIES = new Set(["RUB", "RUR", "BYN", "USD", "EUR", "PLN"]);

/** Helper to find value from mapping or synonym keys */
function findVal(
  row: RawFeedItem,
  synonyms: string[],
  overrideKey?: string
): unknown {
  if (overrideKey && row[overrideKey] !== undefined && row[overrideKey] !== null && String(row[overrideKey]).trim() !== "") {
    return row[overrideKey];
  }
  for (const s of synonyms) {
    if (row[s] !== undefined && row[s] !== null && String(row[s]).trim() !== "") {
      return row[s];
    }
  }
  return undefined;
}

export function normalizeFeedRow(
  rawRow: RawFeedItem,
  supplierId: string,
  defaultSource = "RU_DISMANTLE",
  columnMapping?: Record<string, string>
): NormalizedFeedItem {
  const errors: string[] = [];

  // 1. External ID
  const rawExternalId = findVal(
    rawRow,
    [
      "@_id",
      "id",
      "external_id",
      "externalid",
      "offer_id",
      "avito_id",
      "drom_id",
      "код_товара",
      "номер_объявления",
      "код",
    ],
    columnMapping?.externalId
  );
  let externalId = rawExternalId ? String(rawExternalId).trim() : null;

  // 2. OEM / Article
  const rawOemVal = findVal(
    rawRow,
    [
      "oem",
      "oem_number",
      "oem_code",
      "артикул",
      "оем",
      "номер",
      "номер_детали",
      "код_детали",
      "каталожный_номер",
      "partnumber",
      "part_number",
      "article",
      "sku",
    ],
    columnMapping?.rawOem || columnMapping?.oem
  );
  const rawOem = rawOemVal ? String(rawOemVal).trim() : null;
  const normalizedOem = normalizeOemCode(rawOem);

  // 3. Title / Canonical Name
  const rawTitle = findVal(
    rawRow,
    [
      "name",
      "title",
      "название",
      "наименование",
      "заголовок",
      "деталь",
      "товар",
      "наименование_детали",
      "наименование_товара",
    ],
    columnMapping?.title || columnMapping?.name
  );
  const title = rawTitle ? String(rawTitle).trim() : "";
  if (!title) {
    errors.push("Отсутствует обязательное поле 'название' детали");
  }

  // If OEM is missing in column, check if it's extracted from title
  if (!normalizedOem && title) {
    const match = title.match(/\b([A-Z0-9]{4,5}[-_][A-Z0-9]{4,5})\b/i);
    if (!match) {
      errors.push("Не удалось определить OEM или артикул детали");
    }
  }

  // 4. Brand / Manufacturer
  const rawBrand = findVal(
    rawRow,
    [
      "brand",
      "vendor",
      "производитель",
      "бренд",
      "марка",
      "марка_детали",
      "изготовитель",
      "фирма",
    ],
    columnMapping?.brand
  );
  const brand = rawBrand ? String(rawBrand).trim().toUpperCase() : "ORIGINAL OEM";

  // 5. Category
  const rawCat = findVal(
    rawRow,
    [
      "category",
      "category_name",
      "categoryId",
      "категория",
      "раздел",
      "группа",
    ],
    columnMapping?.category
  );
  const category = rawCat ? String(rawCat).trim() : "Общие детали";

  // 6. Price (Strictly NO conversion of null to 0!)
  const rawPrice = findVal(
    rawRow,
    [
      "price",
      "cost",
      "цена",
      "стоимость",
      "закупка",
      "цена_закупки",
      "цена_поставщика",
    ],
    columnMapping?.price
  );
  let price: number | null = null;
  let hasExplicitPrice = false;
  if (rawPrice !== undefined && rawPrice !== null && String(rawPrice).trim() !== "") {
    const num = Number(String(rawPrice).replace(/[^\d.,]/g, "").replace(",", "."));
    if (isNaN(num) || num < 0) {
      errors.push(`Некорректная цена: '${rawPrice}'`);
    } else {
      price = num;
      hasExplicitPrice = true;
    }
  }

  // 7. Currency
  const rawCur = findVal(
    rawRow,
    ["currencyId", "currency", "валюта", "вал"],
    columnMapping?.currency
  );
  let currency = rawCur ? String(rawCur).trim().toUpperCase() : "RUB";
  if (currency === "RUR") currency = "RUB";
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    errors.push(`Неподдерживаемая валюта: '${currency}'`);
  }

  // 8. Quantity (Do NOT assume missing quantity is confirmed in stock!)
  const rawQty = findVal(
    rawRow,
    [
      "count",
      "quantity",
      "amount",
      "остаток",
      "количество",
      "наличие",
      "кол-во",
      "колво",
    ],
    columnMapping?.quantity
  );
  let quantity = 0;
  let hasExplicitQuantity = false;
  if (rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== "") {
    const q = parseInt(String(rawQty).replace(/[^\d]/g, ""), 10);
    if (!isNaN(q) && q >= 0) {
      quantity = q;
      hasExplicitQuantity = true;
    }
  }

  // 9. Condition
  const rawCond = findVal(
    rawRow,
    ["condition", "state", "состояние", "бу"],
    columnMapping?.condition
  );
  let condition: "NEW" | "USED" = "USED";
  if (rawCond) {
    const cStr = String(rawCond).trim().toLowerCase();
    if (cStr.includes("нов") || cStr === "new") {
      condition = "NEW";
    }
  }

  // 10. Delivery terms
  const rawDelivery = findVal(
    rawRow,
    ["delivery", "terms", "доставка", "срок_доставки", "условия", "срок"],
    columnMapping?.deliveryTerms
  );
  const deliveryTerms = rawDelivery ? String(rawDelivery).trim() : null;

  let deliveryDays: number | null = null;
  if (deliveryTerms) {
    const match = deliveryTerms.match(/(\d+)/);
    if (match) deliveryDays = parseInt(match[1], 10);
  }

  // 11. Photos
  const rawPic = findVal(
    rawRow,
    ["picture", "photo", "image", "pictures", "photos", "фото", "изображение"],
    columnMapping?.photos
  );
  let photos: string[] = [];
  if (Array.isArray(rawPic)) {
    photos = rawPic.map((p) => String(p).trim()).filter(Boolean);
  } else if (typeof rawPic === "string") {
    photos = rawPic
      .split(/[,;\s]+/)
      .map((p) => p.trim())
      .filter((p) => p.startsWith("http") || p.startsWith("/"));
  }

  // 12. Description
  const rawDesc = findVal(
    rawRow,
    ["description", "desc", "описание", "примечание", "комментарий"],
    columnMapping?.description
  );
  const description = rawDesc ? String(rawDesc).trim() : null;

  // 13. City
  const rawCity = findVal(
    rawRow,
    ["city", "region", "город", "регион", "склад", "местонахождение"],
    columnMapping?.city
  );
  const city = rawCity ? String(rawCity).trim() : null;

  // 14. Source URL
  const rawUrl = findVal(
    rawRow,
    ["url", "link", "source_url", "ссылка", "страница"],
    columnMapping?.sourceUrl
  );
  const sourceUrl = rawUrl ? String(rawUrl).trim() : null;

  // 15. If externalId is missing, generate a deterministic stable ID
  if (!externalId) {
    const key = `${supplierId}:${defaultSource}:${normalizedOem || rawOem || title}:${brand}:${condition}`;
    externalId = "gen-" + crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
  }

  return {
    externalId,
    rawOem,
    normalizedOem,
    title,
    brand,
    category,
    price,
    hasExplicitPrice,
    currency,
    quantity,
    hasExplicitQuantity,
    condition,
    deliveryTerms,
    deliveryDays,
    photos,
    description,
    city,
    sourceUrl,
    validationErrors: errors,
  };
}
