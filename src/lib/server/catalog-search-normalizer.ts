// Catalog search query normalizer, transliterator, and ranking engine

const CYR_TO_LAT_LOOKALIKES: Record<string, string> = {
  а: "a",
  в: "b",
  с: "c",
  е: "e",
  н: "h",
  к: "k",
  м: "m",
  о: "o",
  р: "p",
  т: "t",
  х: "x",
};

const LAT_TO_CYR_LOOKALIKES: Record<string, string> = {
  a: "а",
  b: "в",
  c: "с",
  e: "е",
  h: "н",
  k: "к",
  m: "м",
  o: "о",
  p: "р",
  t: "т",
  x: "х",
};

const BRAND_ALIASES: Record<string, string> = {
  бмв: "BMW",
  мерседес: "Mercedes-Benz",
  мерс: "Mercedes-Benz",
  ауди: "Audi",
  фольксваген: "Volkswagen",
  фольц: "Volkswagen",
  ваг: "VAG",
  хендай: "Hyundai",
  хёндай: "Hyundai",
  хундай: "Hyundai",
  киа: "Kia",
  кия: "Kia",
  тойота: "Toyota",
  тойотамотор: "Toyota",
  ниссан: "Nissan",
  нисан: "Nissan",
  мазда: "Mazda",
  форд: "Ford",
  рено: "Renault",
  пежо: "Peugeot",
  ситроен: "Citroen",
  шкода: "Skoda",
  вольво: "Volvo",
  нортлайн: "NORTHLINE",
  партслаб: "PARTS LAB",
};

const CATEGORY_KEYWORDS: Record<string, string> = {
  колодки: "Тормозная система",
  диск: "Тормозная система",
  диски: "Тормозная система",
  суппорт: "Тормозная система",
  тормоз: "Тормозная система",
  тормоза: "Тормозная система",
  турбина: "Двигатель",
  турбокомпрессор: "Двигатель",
  мотор: "Двигатель",
  генератор: "Электрика",
  стартер: "Электрика",
  рейка: "Подвеска и рулевое управление",
  рычаг: "Подвеска и рулевое управление",
  амортизатор: "Подвеска и рулевое управление",
  бампер: "Кузовные детали",
  радиатор: "Охлаждение",
  фильтр: "Фильтры и расходники",
};

/** Normalizes part numbers/OEM codes by stripping whitespace, dashes, slashes, dots */
export function normalizePartNumber(str: string): string {
  return str.replace(/[\s\-_./\\,]/g, "").toUpperCase();
}

/** Converts visually identical Cyrillic characters to Latin lookalikes */
export function cyrillicToLatin(str: string): string {
  return str
    .split("")
    .map((char) => CYR_TO_LAT_LOOKALIKES[char.toLowerCase()] || char)
    .join("");
}

/** Converts visually identical Latin characters to Cyrillic lookalikes */
export function latinToCyrillic(str: string): string {
  return str
    .split("")
    .map((char) => LAT_TO_CYR_LOOKALIKES[char.toLowerCase()] || char)
    .join("");
}

export type SearchAnalysis = {
  original: string;
  cleanPartNumber: string;
  queryVariants: string[];
  brandHints: string[];
  categoryHints: string[];
};

export function analyzeSearchQuery(rawQuery: string): SearchAnalysis {
  const original = rawQuery.trim();
  const cleanPart = normalizePartNumber(original);
  const qLower = original.toLowerCase();

  const variants = new Set<string>();
  variants.add(original);
  if (cleanPart && cleanPart !== original) {
    variants.add(cleanPart);
  }

  // Lookalike letter swaps
  const cyrSwapped = cyrillicToLatin(original);
  if (cyrSwapped !== original) variants.add(cyrSwapped);

  const cleanCyrSwapped = normalizePartNumber(cyrSwapped);
  if (cleanCyrSwapped) variants.add(cleanCyrSwapped);

  const latSwapped = latinToCyrillic(original);
  if (latSwapped !== original) variants.add(latSwapped);

  // Check brand aliases
  const brandHints: string[] = [];
  for (const [alias, brandName] of Object.entries(BRAND_ALIASES)) {
    if (qLower.includes(alias)) {
      brandHints.push(brandName);
    }
  }

  // Check category hints
  const categoryHints: string[] = [];
  for (const [kw, catName] of Object.entries(CATEGORY_KEYWORDS)) {
    if (qLower.includes(kw)) {
      categoryHints.push(catName);
    }
  }

  return {
    original,
    cleanPartNumber: cleanPart,
    queryVariants: Array.from(variants),
    brandHints,
    categoryHints,
  };
}

/**
 * Calculates a relevance score for a product given a user query.
 * Priorities:
 * 1. Exact OEM match (Score: 1000+)
 * 2. Exact article match (Score: 600+)
 * 3. Brand match + Name match (Score: 300+)
 * 4. Partial OEM / article match (Score: 150+)
 * 5. Name / Description match (Score: 80+)
 * 6. Alternative spelling / transliteration match (Score: 40+)
 */
export function scoreProductRelevance(
  product: {
    primaryOem: string;
    oemCodes: string[];
    altArticles: string[];
    canonicalName: string;
    brand: string;
    description: string | null;
    offers?: { rawArticle: string | null; originalTitle: string }[];
  },
  analysis: SearchAnalysis
): number {
  let score = 0;
  const cleanClean = analysis.cleanPartNumber;

  const prodOems = [
    product.primaryOem,
    ...(product.oemCodes || []),
  ].map((o) => normalizePartNumber(o));

  const prodArticles = [
    ...(product.altArticles || []),
    ...(product.offers?.map((o) => o.rawArticle || "").filter(Boolean) || []),
  ].map((a) => normalizePartNumber(a));

  const prodNameLower = product.canonicalName.toLowerCase();
  const prodBrandUpper = product.brand.toUpperCase();

  // 1. Exact OEM match
  if (cleanClean.length >= 3 && prodOems.some((o) => o === cleanClean)) {
    score += 1000;
  } else if (cleanClean.length >= 3 && prodOems.some((o) => o.includes(cleanClean) || cleanClean.includes(o))) {
    score += 200;
  }

  // 2. Exact article match
  if (cleanClean.length >= 3 && prodArticles.some((a) => a === cleanClean)) {
    score += 600;
  } else if (cleanClean.length >= 3 && prodArticles.some((a) => a.includes(cleanClean) || cleanClean.includes(a))) {
    score += 150;
  }

  // 3. Brand hint match
  for (const b of analysis.brandHints) {
    if (prodBrandUpper === b.toUpperCase() || prodNameLower.includes(b.toLowerCase())) {
      score += 250;
    }
  }

  // 4. Query variants in title or brand
  for (const variant of analysis.queryVariants) {
    const vLower = variant.toLowerCase();
    if (prodNameLower.includes(vLower)) {
      score += 80;
    }
    if (prodBrandUpper.includes(variant.toUpperCase())) {
      score += 120;
    }
  }

  // 5. Category hint match
  for (const c of analysis.categoryHints) {
    if (prodNameLower.includes(c.toLowerCase())) {
      score += 50;
    }
  }

  return score;
}
