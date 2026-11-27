import { Decimal } from "@prisma/client/runtime/library";
import type {
  PublicProductDto,
  PublicOfferDto,
  StaffOfferDto,
  CatalogSearchFilters,
  CatalogSearchResult,
  CarApplicability,
  ProductStatus,
} from "./catalog-types.ts";
import type { ProductWithOffers } from "./catalog-repository.ts";
import { catalogRepository, PrismaCatalogRepository } from "./catalog-repository.ts";
import { prisma } from "./db.ts";
import {
  calculateRetailPrice,
  convertMinorUnitsToRub,
  initialFinancialConfig,
  type CurrencyCode,
  type SupplierCountry,
} from "../financial-config.ts";

const COUNTRY_NAME_MAP: Record<string, "Россия" | "Беларусь" | "Польша" | string> = {
  RU: "Россия",
  BY: "Беларусь",
  PL: "Польша",
};

/** Convert currency to RUB for public estimation */
function convertToRub(amount: number, currency: string): number {
  switch (currency.toUpperCase()) {
    case "RUB":
      return Math.round(amount);
    case "PLN":
      return Math.round(amount * 24.5);
    case "USD":
      return Math.round(amount * 92);
    case "EUR":
      return Math.round(amount * 100);
    case "BYN":
      return Math.round(amount * 29);
    default:
      return Math.round(amount);
  }
}

/** Sanitize an offer for the public customer layer with approved retail financial formulas */
export function toPublicOfferDto(
  offer: ProductWithOffers["offers"][number]
): PublicOfferDto {
  let publicPrice: number | null = null;

  if (offer.purchasePrice !== null && Number(offer.purchasePrice) > 0) {
    try {
      const countryCode = offer.supplier?.countryCode || "RU";
      const supplierCountry: SupplierCountry =
        countryCode === "BY" ? "Беларусь" : countryCode === "PL" ? "Польша" : "Россия";
      const currency = (offer.currency?.toUpperCase() || "RUB") as CurrencyCode;

      const calc = calculateRetailPrice({
        purchaseAmount: offer.purchasePrice.toString(),
        currency,
        supplierCountry,
        config: initialFinancialConfig,
      });

      const rubMinor =
        currency === "RUB"
          ? calc.customerPriceMinor
          : convertMinorUnitsToRub(
              calc.customerPriceMinor,
              currency,
              initialFinancialConfig.rubPerCurrencyUnit[currency] || "1"
            );

      publicPrice = Math.round(Number(rubMinor) / 100);
    } catch (e) {
      publicPrice = convertToRub(Number(offer.purchasePrice), offer.currency);
    }
  }

  return {
    id: offer.id,
    source: offer.source,
    supplierCountry: COUNTRY_NAME_MAP[offer.supplier.countryCode] || offer.supplier.countryCode,
    originalTitle: offer.originalTitle,
    rawArticle: offer.rawArticle,
    condition: offer.condition === "NEW" ? "Новая" : "БУ",
    status: offer.status,
    deliveryTerms: offer.deliveryTerms,
    deliveryDays: offer.deliveryDays,
    publicPrice,
    currency: "RUB",
    lastSeenAt: offer.lastSeenAt.toISOString(),
  };
}

/** Staff view with purchase prices, margins, supplier identifiers */
export function toStaffOfferDto(
  offer: ProductWithOffers["offers"][number],
  canReadPurchase = false
): StaffOfferDto {
  const publicOffer = toPublicOfferDto(offer);
  return {
    ...publicOffer,
    supplierId: offer.supplierId,
    supplierName: offer.supplier.name,
    purchasePrice: canReadPurchase && offer.purchasePrice ? offer.purchasePrice.toString() : null,
    purchaseCurrency: canReadPurchase ? offer.currency : null,
    quantity: offer.quantity,
    sourceUrl: offer.sourceUrl,
  };
}

/** Map product entity to public customer DTO */
export function toPublicProductDto(product: ProductWithOffers): PublicProductDto {
  const publicOffers = product.offers.map(toPublicOfferDto);

  const activeOffers = publicOffers.filter(
    (o) => o.status === "IN_STOCK" || o.status === "ON_REQUEST"
  );

  const countriesSet = new Set(publicOffers.map((o) => o.supplierCountry));
  const countries = Array.from(countriesSet);

  // Determine lowest public retail price among active offers
  const pricedOffers = activeOffers
    .map((o) => o.publicPrice)
    .filter((p): p is number => p !== null && p > 0);

  const minPrice = pricedOffers.length ? Math.min(...pricedOffers) : null;

  // Determine condition
  const hasNew = publicOffers.some((o) => o.condition === "Новая");
  const hasUsed = publicOffers.some((o) => o.condition === "БУ");
  const conditionLabel: "Новая" | "БУ" | "Новая / БУ" =
    hasNew && hasUsed ? "Новая / БУ" : hasUsed ? "БУ" : "Новая";

  // Determine badge
  let badge: "ORIGINAL" | "ANALOG" | "USED" | "ARCHIVED_SOLD" = "ANALOG";
  if (product.status === "ARCHIVED_SOLD" || (publicOffers.length > 0 && activeOffers.length === 0)) {
    badge = "ARCHIVED_SOLD";
  } else if (hasUsed && !hasNew) {
    badge = "USED";
  } else if (product.brand.toUpperCase().includes("ORIGINAL") || product.brand.toUpperCase() === "KIA" || product.brand.toUpperCase() === "HYUNDAI") {
    badge = "ORIGINAL";
  } else if (product.brand === "NORTHLINE") {
    badge = "ORIGINAL";
  }

  return {
    id: product.id,
    canonicalName: product.canonicalName,
    brand: product.brand,
    category: product.category,
    primaryOem: product.primaryOem,
    oemCodes: product.oemCodes,
    altArticles: product.altArticles,
    specs: product.specs as Record<string, unknown> | null,
    applicability: product.applicability as CarApplicability[] | null,
    photos: product.photos.length ? product.photos : ["/brake-rotor.webp"],
    description: product.description,
    status: (product.status === "ARCHIVED_SOLD" || badge === "ARCHIVED_SOLD" ? "ARCHIVED_SOLD" : "ACTIVE") as ProductStatus,
    badge,
    condition: conditionLabel,
    country: countries[0] || "Россия",
    countries,
    minPrice,
    offersCount: publicOffers.length,
    offers: publicOffers,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export class CatalogService {
  private repo: PrismaCatalogRepository;

  constructor(repo: PrismaCatalogRepository = catalogRepository) {
    this.repo = repo;
  }

  async searchPublic(filters: CatalogSearchFilters): Promise<CatalogSearchResult> {
    const { products, total } = await this.repo.search(filters);
    let items = products.map(toPublicProductDto);

    if (filters.minPrice !== undefined) {
      items = items.filter((item) => item.minPrice !== null && item.minPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      items = items.filter((item) => item.minPrice !== null && item.minPrice <= filters.maxPrice!);
    }

    if (filters.sortBy === "price_asc") {
      items.sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity));
    } else if (filters.sortBy === "price_desc") {
      items.sort((a, b) => (b.minPrice ?? -1) - (a.minPrice ?? -1));
    } else if (filters.sortBy === "newest") {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return {
      items,
      total: items.length < total && (filters.minPrice !== undefined || filters.maxPrice !== undefined) ? items.length : total,
      skip: filters.skip ?? 0,
      take: filters.take ?? 50,
    };
  }

  async getPublicProductById(id: string): Promise<PublicProductDto | null> {
    const product = await this.repo.findById(id);
    if (!product) return null;
    return toPublicProductDto(product);
  }

  async getStaffProductById(id: string, canReadPurchase = false): Promise<(PublicProductDto & { staffOffers: StaffOfferDto[] }) | null> {
    const product = await this.repo.findById(id);
    if (!product) return null;
    const publicDto = toPublicProductDto(product);
    return {
      ...publicDto,
      staffOffers: product.offers.map((o) => toStaffOfferDto(o, canReadPurchase)),
    };
  }

  async archiveOffer(offerId: string) {
    return this.repo.archiveOffer(offerId);
  }

  async archiveProduct(productId: string) {
    return this.repo.archiveProduct(productId);
  }

  /**
   * Safe, idempotent seeder for initial catalog in dev/test environment.
   * Migrates the initial 7 demo items into persistent PostgreSQL Products + Multi-Offers.
   */
  async seedDemoCatalogIfEmpty(): Promise<{ seeded: boolean; count: number }> {
    const existingCount = await prisma.product.count();
    if (existingCount > 0) {
      return { seeded: false, count: existingCount };
    }

    // 1. Ensure Suppliers exist
    const ruSupplier = await prisma.supplier.upsert({
      where: { id: "a0000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "a0000000-0000-0000-0000-000000000001",
        name: "Север Авто Деталь",
        countryCode: "RU",
        contactName: "Алексей",
        phone: "+7 000 000-00-01",
        email: "demo-ru@example.test",
        specialization: "Тормоза, подвеска, узлы ДВС",
        terms: "Доставка 2-4 дня",
        status: "ACTIVE",
      },
    });

    const bySupplier = await prisma.supplier.upsert({
      where: { id: "a0000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "a0000000-0000-0000-0000-000000000002",
        name: "Минск Моторс",
        countryCode: "BY",
        contactName: "Марина",
        phone: "+375 00 000-00-02",
        email: "demo-by@example.test",
        specialization: "Разборка европейских авто",
        terms: "Доставка 3-6 дней",
        status: "ACTIVE",
      },
    });

    const plSupplier = await prisma.supplier.upsert({
      where: { id: "a0000000-0000-0000-0000-000000000003" },
      update: {},
      create: {
        id: "a0000000-0000-0000-0000-000000000003",
        name: "Baltic Parts Demo (Allegro B2B Partner)",
        countryCode: "PL",
        contactName: "Tomasz",
        phone: "+48 000 000 003",
        email: "demo-pl@example.test",
        specialization: "Польские разборки и склады",
        terms: "Доставка 4-7 дней",
        status: "ACTIVE",
      },
    });

    // 2. Demo Products Definition
    const demoItems = [
      {
        id: "b0000000-0000-0000-0000-000000000001",
        canonicalName: "Диск тормозной передний, вентилируемый",
        primaryOem: "51712-C1A00",
        oemCodes: ["51712-C1A00", "51712-C2000"],
        altArticles: ["DF6142S", "0986479C12"],
        brand: "NORTHLINE",
        category: "Тормозная система",
        photos: ["/brake-rotor.webp"],
        description: "Оригинальный тормозной диск. Высокая термостойкость, заводские параметры балансировки.",
        status: "ACTIVE" as const,
        specs: { diameter: "305 мм", thickness: "25 мм", ventilation: "вентилируемый", side: "передний" },
        applicability: [{ make: "Kia", model: "Sportage", year: "2020–2024", yearFrom: 2020, yearTo: 2024 }],
        offers: [
          {
            supplierId: ruSupplier.id,
            source: "RU_DISMANTLE",
            externalId: "offer-ru-51712",
            originalTitle: "Диск тормозной передний вентилируемый новый",
            rawArticle: "51712-C1A00",
            purchasePrice: 6940,
            currency: "RUB",
            quantity: 4,
            condition: "NEW" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Склад в РФ. Доставка 2-4 дня.",
            deliveryDays: 3,
          },
          {
            supplierId: bySupplier.id,
            source: "BY_DISMANTLE",
            externalId: "offer-by-51712",
            originalTitle: "Диск тормозной Kia Sportage 2020-2024",
            rawArticle: "51712-C1A00",
            purchasePrice: 7200,
            currency: "RUB",
            quantity: 2,
            condition: "NEW" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Склад в Минске. Экспресс-доставка СДЭК 3-5 дней.",
            deliveryDays: 4,
          },
          {
            supplierId: plSupplier.id,
            source: "ALLEGRO",
            externalId: "allegro-offer-991283",
            originalTitle: "Tarcza hamulcowa przod Kia Sportage Tucson",
            rawArticle: "51712C1A00",
            purchasePrice: 170, // 170 PLN ≈ 4165 RUB
            currency: "PLN",
            quantity: 1,
            condition: "USED" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Поставка со склада в Польше. Таможенная очистка 5-8 дней.",
            deliveryDays: 7,
          },
        ],
      },
      {
        id: "b0000000-0000-0000-0000-000000000002",
        canonicalName: "Суппорт тормозной передний, правый",
        primaryOem: "58130-A6A00",
        oemCodes: ["58130-A6A00"],
        altArticles: ["BHS1289E"],
        brand: "PARTS LAB",
        category: "Тормозная система",
        photos: ["/brake-caliper.webp"],
        description: "Контрактная деталь с европейской разборки. Проверена геометрия и целостность поршня.",
        status: "ACTIVE" as const,
        specs: { pistonDiameter: "60 мм", axis: "передний", side: "правый" },
        applicability: [{ make: "Kia", model: "Sportage", year: "2019–2023", yearFrom: 2019, yearTo: 2023 }],
        offers: [
          {
            supplierId: bySupplier.id,
            source: "BY_DISMANTLE",
            externalId: "offer-by-58130",
            originalTitle: "Суппорт передний правый в сборе контрактный",
            rawArticle: "58130-A6A00",
            purchasePrice: null,
            currency: "RUB",
            quantity: 1,
            condition: "USED" as const,
            status: "ON_REQUEST" as const,
            deliveryTerms: "Под заказ из Беларуси. 3-6 дней.",
            deliveryDays: 5,
          },
        ],
      },
      {
        id: "b0000000-0000-0000-0000-000000000003",
        canonicalName: "Комплект тормозных колодок передний",
        primaryOem: "58101-A6A00",
        oemCodes: ["58101-A6A00", "58101-D7A00"],
        altArticles: ["GDB3585", "SP1403"],
        brand: "NORTHLINE",
        category: "Тормозная система",
        photos: ["/brake-pads.webp"],
        description: "Сертифицированный европейский аналог. Низкий уровень пылеобразования и шума.",
        status: "ACTIVE" as const,
        specs: { frictionMaterial: "Low-Metallic", withShims: true },
        applicability: [{ make: "Hyundai", model: "Tucson", year: "2021–2025", yearFrom: 2021, yearTo: 2025 }],
        offers: [
          {
            supplierId: plSupplier.id,
            source: "ALLEGRO",
            externalId: "allegro-offer-771822",
            originalTitle: "Klocki hamulcowe przod Hyundai Tucson 2021+",
            rawArticle: "58101-A6A00",
            purchasePrice: 175, // 175 PLN ≈ 4280 RUB
            currency: "PLN",
            quantity: 10,
            condition: "NEW" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Европейский хаб. Доставка 4-7 дней.",
            deliveryDays: 5,
          },
          {
            supplierId: ruSupplier.id,
            source: "RU_DISMANTLE",
            externalId: "offer-ru-58101",
            originalTitle: "Колодки передние комплект Northline",
            rawArticle: "58101-A6A00",
            purchasePrice: 4500,
            currency: "RUB",
            quantity: 3,
            condition: "NEW" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Склад Москва. Доставка 2-3 дня.",
            deliveryDays: 2,
          },
        ],
      },
      {
        id: "b0000000-0000-0000-0000-000000000004",
        canonicalName: "Турбокомпрессор в сборе",
        primaryOem: "28231-2F100",
        oemCodes: ["28231-2F100", "28231-2F750"],
        altArticles: ["49377-07050"],
        brand: "MECHCORE",
        category: "Двигатель",
        photos: ["/turbocharger.webp"],
        description: "Оригинальный узел с малым пробегом. Проведена диагностика крыльчатки и клапана геометрии.",
        status: "ACTIVE" as const,
        specs: { engineCode: "2.0 CRDi D4HA", actuator: "электронный" },
        applicability: [{ make: "Hyundai", model: "Tucson", year: "2018–2022", yearFrom: 2018, yearTo: 2022 }],
        offers: [
          {
            supplierId: ruSupplier.id,
            source: "RU_DISMANTLE",
            externalId: "offer-ru-28231",
            originalTitle: "Турбина дизельная 2.0 CRDi Hyundai Tucson",
            rawArticle: "28231-2F100",
            purchasePrice: 38900,
            currency: "RUB",
            quantity: 1,
            condition: "USED" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Проверена на стенде. Гарантия 30 дней. Доставка 2-4 дня.",
            deliveryDays: 3,
          },
        ],
      },
      {
        id: "b0000000-0000-0000-0000-000000000005",
        canonicalName: "Амортизатор передний газомасляный",
        primaryOem: "54651-D7A00",
        oemCodes: ["54651-D7A00"],
        altArticles: ["335808"],
        brand: "NORTHLINE",
        category: "Подвеска и рулевое управление",
        photos: ["/shock-absorber.webp"],
        description: "Заводская стойка амортизатора. Полное соответствие характеристикам штатной подвески.",
        status: "ACTIVE" as const,
        specs: { type: "газомасляный", side: "передний левый/правый" },
        applicability: [{ make: "Kia", model: "Sportage", year: "2020–2024", yearFrom: 2020, yearTo: 2024 }],
        offers: [
          {
            supplierId: bySupplier.id,
            source: "BY_DISMANTLE",
            externalId: "offer-by-54651",
            originalTitle: "Стойка амортизатора Kia Sportage новая",
            rawArticle: "54651-D7A00",
            purchasePrice: 11800,
            currency: "RUB",
            quantity: 2,
            condition: "NEW" as const,
            status: "IN_STOCK" as const,
            deliveryTerms: "Склад Минск. Доставка 3-5 дней.",
            deliveryDays: 4,
          },
        ],
      },
      {
        id: "b0000000-0000-0000-0000-000000000006",
        canonicalName: "Генератор автомобильный 14V",
        primaryOem: "37300-2E300",
        oemCodes: ["37300-2E300"],
        altArticles: ["DRA0892"],
        brand: "PARTS LAB",
        category: "Электрика",
        photos: ["/alternator.webp"],
        description: "Проверен на испытательном стенде под нагрузкой. Поставка со склада в Польше (Allegro B2B).",
        status: "ACTIVE" as const,
        specs: { voltage: "14V", current: "130A" },
        applicability: [{ make: "Hyundai", model: "Tucson", year: "2019–2024", yearFrom: 2019, yearTo: 2024 }],
        offers: [
          {
            supplierId: plSupplier.id,
            source: "ALLEGRO",
            externalId: "allegro-offer-37300",
            originalTitle: "Alternator 14V 130A Hyundai Tucson Kia",
            rawArticle: "37300-2E300",
            purchasePrice: null,
            currency: "PLN",
            quantity: 1,
            condition: "USED" as const,
            status: "ON_REQUEST" as const,
            deliveryTerms: "Под заказ из Польши (Allegro B2B). 5-7 дней.",
            deliveryDays: 6,
          },
        ],
      },
      {
        id: "b0000000-0000-0000-0000-000000000007",
        canonicalName: "Рулевая рейка с электроусилителем (в сборе)",
        primaryOem: "56500-D7000",
        oemCodes: ["56500-D7000"],
        altArticles: ["JRM612"],
        brand: "ORIGINAL OEM",
        category: "Подвеска и рулевое управление",
        photos: ["/shock-absorber.webp"],
        description: "Контрактный узел. Товар продан (ARCHIVED_SOLD). Карточка сохранена в вечном архиве для сверки характеристик и подбора аналогов.",
        status: "ARCHIVED_SOLD" as const,
        specs: { type: "электрическая рулевая рейка", drive: "LHD" },
        applicability: [{ make: "Kia", model: "Sportage", year: "2019–2022", yearFrom: 2019, yearTo: 2022 }],
        offers: [
          {
            supplierId: plSupplier.id,
            source: "ALLEGRO",
            externalId: "allegro-offer-56500-sold",
            originalTitle: "Przekladnia kierownicza elektryczna Kia Sportage",
            rawArticle: "56500-D7000",
            purchasePrice: 34500,
            currency: "RUB",
            quantity: 0,
            condition: "USED" as const,
            status: "ARCHIVED_SOLD" as const,
            deliveryTerms: "Товар продан. Позиция перемещена в вечный архив.",
            deliveryDays: null,
          },
        ],
      },
    ];

    for (const item of demoItems) {
      const { offers, ...productData } = item;
      const product = await prisma.product.create({
        data: productData,
      });

      for (const off of offers) {
        await prisma.supplierOffer.create({
          data: {
            productId: product.id,
            supplierId: off.supplierId,
            source: off.source,
            externalId: off.externalId,
            originalTitle: off.originalTitle,
            rawArticle: off.rawArticle,
            purchasePrice: off.purchasePrice !== null ? new Decimal(off.purchasePrice) : null,
            currency: off.currency,
            quantity: off.quantity,
            condition: off.condition,
            status: off.status,
            deliveryTerms: off.deliveryTerms,
            deliveryDays: off.deliveryDays,
          },
        });
      }
    }

    return { seeded: true, count: demoItems.length };
  }
}

export const catalogService = new CatalogService();
