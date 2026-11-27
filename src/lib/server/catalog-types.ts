export type ProductStatus = "ACTIVE" | "ARCHIVED_SOLD" | "DRAFT";
export type OfferCondition = "NEW" | "USED";
export type OfferStatus = "IN_STOCK" | "ON_REQUEST" | "OUT_OF_STOCK" | "ARCHIVED_SOLD";

export type CarApplicability = {
  make: string;
  model: string;
  year?: string;
  yearFrom?: number;
  yearTo?: number;
};

export type PublicOfferDto = {
  id: string;
  source: string;
  supplierCountry: "Россия" | "Беларусь" | "Польша" | string;
  originalTitle: string;
  rawArticle: string | null;
  condition: "Новая" | "БУ";
  status: OfferStatus;
  deliveryTerms: string | null;
  deliveryDays: number | null;
  publicPrice: number | null; // Display retail price in RUB
  currency: string;
  lastSeenAt: string;
};

export type StaffOfferDto = PublicOfferDto & {
  supplierId: string;
  supplierName: string;
  purchasePrice: string | null; // Decimal formatted string
  purchaseCurrency: string | null;
  quantity: number;
  sourceUrl: string | null;
};

export type PublicProductDto = {
  id: string;
  canonicalName: string;
  brand: string;
  category: string;
  primaryOem: string;
  oemCodes: string[];
  altArticles: string[];
  specs: Record<string, unknown> | null;
  applicability: CarApplicability[] | null;
  photos: string[];
  description: string | null;
  status: ProductStatus;
  badge: "ORIGINAL" | "ANALOG" | "USED" | "ARCHIVED_SOLD";
  condition: "Новая" | "БУ" | "Новая / БУ";
  country: "Россия" | "Беларусь" | "Польша" | string;
  countries: string[];
  minPrice: number | null;
  offersCount: number;
  offers: PublicOfferDto[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogSearchFilters = {
  query?: string;
  category?: string;
  make?: string;
  model?: string;
  year?: string;
  fitmentOnly?: boolean;
  brand?: string;
  condition?: string;
  country?: string;
  availability?: "IN_STOCK" | "ARCHIVED_SOLD" | "";
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "newest";
  skip?: number;
  take?: number;
};

export type CatalogSearchResult = {
  items: PublicProductDto[];
  total: number;
  skip: number;
  take: number;
};
