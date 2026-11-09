import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  toPublicProductDto,
  toPublicOfferDto,
  toStaffOfferDto,
  CatalogService,
} from "./catalog-service.ts";
import { PrismaCatalogRepository } from "./catalog-repository.ts";

const prisma = new PrismaClient();

test("Catalog DTO segregation: public offer strictly hides purchase price and internal data", () => {
  const mockOffer = {
    id: "offer-123",
    productId: "prod-123",
    supplierId: "sup-999",
    source: "ALLEGRO",
    externalId: "ext-1",
    originalTitle: "Tarcza hamulcowa",
    rawArticle: "51712-C1A00",
    purchasePrice: new Decimal(170), // 170 PLN
    currency: "PLN",
    quantity: 3,
    condition: "NEW",
    status: "IN_STOCK",
    deliveryTerms: "Доставка 4-7 дней",
    deliveryDays: 5,
    sourceUrl: "https://allegro.pl/listing/secret-deal",
    lastSeenAt: new Date("2026-11-08T10:00:00Z"),
    createdAt: new Date("2026-11-08T10:00:00Z"),
    updatedAt: new Date("2026-11-08T10:00:00Z"),
    supplier: {
      id: "sup-999",
      name: "Secret Wholesale Supplier Sp. z o.o.",
      countryCode: "PL",
    },
  };

  const publicDto = toPublicOfferDto(mockOffer);

  // Verification 1: Public DTO must NOT contain purchasePrice, supplierId, or sourceUrl
  assert.equal("purchasePrice" in publicDto, false, "Public DTO must not have purchasePrice field");
  assert.equal("supplierId" in publicDto, false, "Public DTO must not have supplierId field");
  assert.equal("sourceUrl" in publicDto, false, "Public DTO must not have sourceUrl field");

  // Verification 2: Public price in RUB is calculated
  assert.equal(typeof publicDto.publicPrice, "number");
  assert.ok(publicDto.publicPrice > 0, "Public price must be converted to RUB");
  assert.equal(publicDto.currency, "RUB");
  assert.equal(publicDto.supplierCountry, "Польша");
  assert.equal(publicDto.condition, "Новая");

  // Verification 3: Staff DTO hides purchase price by default, but reveals to authorized staff
  const staffDtoDefault = toStaffOfferDto(mockOffer);
  assert.equal(staffDtoDefault.supplierId, "sup-999");
  assert.equal(staffDtoDefault.supplierName, "Secret Wholesale Supplier Sp. z o.o.");
  assert.equal(staffDtoDefault.purchasePrice, null);
  assert.equal(staffDtoDefault.purchaseCurrency, null);

  const staffDtoAuthorized = toStaffOfferDto(mockOffer, true);
  assert.equal(staffDtoAuthorized.purchasePrice, "170");
  assert.equal(staffDtoAuthorized.purchaseCurrency, "PLN");
  assert.equal(staffDtoAuthorized.sourceUrl, "https://allegro.pl/listing/secret-deal");
});

test("Catalog multi-offer aggregation: one card aggregates multiple suppliers, conditions, and currencies", () => {
  const mockProduct = {
    id: "prod-rotor-1",
    canonicalName: "Диск тормозной вентилируемый",
    brand: "NORTHLINE",
    category: "Тормозная система",
    primaryOem: "51712-C1A00",
    oemCodes: ["51712-C1A00", "51712-C2000"],
    altArticles: ["DF6142S"],
    specs: { diameter: "305 мм" },
    applicability: [{ make: "Kia", model: "Sportage", year: "2020–2024" }],
    photos: ["/brake-rotor.webp"],
    description: "Тестовое описание",
    status: "ACTIVE",
    createdAt: new Date("2026-11-08T10:00:00Z"),
    updatedAt: new Date("2026-11-08T10:00:00Z"),
    offers: [
      {
        id: "off-ru-1",
        productId: "prod-rotor-1",
        supplierId: "sup-ru",
        source: "RU_DISMANTLE",
        externalId: "ext-ru",
        originalTitle: "Диск RU",
        rawArticle: "51712-C1A00",
        purchasePrice: new Decimal(6940),
        currency: "RUB",
        quantity: 2,
        condition: "NEW",
        status: "IN_STOCK",
        deliveryTerms: "2-4 дня",
        deliveryDays: 3,
        sourceUrl: null,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { id: "sup-ru", name: "Север Авто Деталь", countryCode: "RU" },
      },
      {
        id: "off-pl-2",
        productId: "prod-rotor-1",
        supplierId: "sup-pl",
        source: "ALLEGRO",
        externalId: "ext-pl",
        originalTitle: "Tarcza PL",
        rawArticle: "51712-C1A00",
        purchasePrice: new Decimal(170), // PLN
        currency: "PLN",
        quantity: 1,
        condition: "USED",
        status: "IN_STOCK",
        deliveryTerms: "5-7 дней",
        deliveryDays: 6,
        sourceUrl: null,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { id: "sup-pl", name: "Baltic Parts", countryCode: "PL" },
      },
    ],
  };

  const publicProduct = toPublicProductDto(mockProduct);

  assert.equal(publicProduct.offersCount, 2);
  assert.equal(publicProduct.offers.length, 2);
  // Offers include both Russia and Poland
  assert.ok(publicProduct.countries.includes("Россия"));
  assert.ok(publicProduct.countries.includes("Польша"));
  // Mixed conditions
  assert.equal(publicProduct.condition, "Новая / БУ");
  // minPrice should be minimum of (6940, 170*24.5 = 4165)
  assert.equal(publicProduct.minPrice, 4165);
});

test("Perpetual memory: ARCHIVED_SOLD item retains OEM, specs, and photos", () => {
  const mockArchived = {
    id: "prod-rack-sold",
    canonicalName: "Рулевая рейка контрактная",
    brand: "ORIGINAL OEM",
    category: "Подвеска и рулевое управление",
    primaryOem: "56500-D7000",
    oemCodes: ["56500-D7000"],
    altArticles: ["JRM612"],
    specs: { drive: "LHD" },
    applicability: [{ make: "Kia", model: "Sportage", year: "2019–2022" }],
    photos: ["/shock-absorber.webp"],
    description: "Лот продан, сохранён в вечном архиве.",
    status: "ARCHIVED_SOLD",
    createdAt: new Date("2026-11-08T10:00:00Z"),
    updatedAt: new Date("2026-11-08T10:00:00Z"),
    offers: [
      {
        id: "off-sold-1",
        productId: "prod-rack-sold",
        supplierId: "sup-pl",
        source: "ALLEGRO",
        externalId: "ext-sold",
        originalTitle: "Przekladnia kierownicza",
        rawArticle: "56500-D7000",
        purchasePrice: new Decimal(34500),
        currency: "RUB",
        quantity: 0,
        condition: "USED",
        status: "ARCHIVED_SOLD",
        deliveryTerms: "Товар продан",
        deliveryDays: null,
        sourceUrl: null,
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { id: "sup-pl", name: "Baltic Parts", countryCode: "PL" },
      },
    ],
  };

  const publicDto = toPublicProductDto(mockArchived);

  assert.equal(publicDto.status, "ARCHIVED_SOLD");
  assert.equal(publicDto.badge, "ARCHIVED_SOLD");
  assert.equal(publicDto.primaryOem, "56500-D7000");
  assert.equal(publicDto.photos[0], "/shock-absorber.webp");
  assert.deepEqual(publicDto.specs, { drive: "LHD" });
  assert.equal(publicDto.minPrice, null, "Archived sold lot has no active minPrice");
});

test("Database integration: seedDemoCatalogIfEmpty seeds 7 canonical items and is idempotent", async () => {
  const service = new CatalogService();

  // 1. Run seeder
  const firstRun = await service.seedDemoCatalogIfEmpty();
  assert.ok(firstRun.count >= 7);

  // 2. Second run must be idempotent (seeded = false)
  const secondRun = await service.seedDemoCatalogIfEmpty();
  assert.equal(secondRun.seeded, false);
  assert.equal(secondRun.count, firstRun.count);

  // 3. Search by OEM 51712-C1A00
  const searchOem = await service.searchPublic({ query: "51712-C1A00" });
  assert.ok(searchOem.total >= 1);
  const rotor = searchOem.items.find((i) => i.primaryOem === "51712-C1A00");
  assert.ok(rotor, "Brake rotor must be found by OEM");
  assert.equal(rotor.offersCount, 3, "Brake rotor has 3 offers from RU, BY, PL");

  // 4. Search by OEM 56500-D7000 (Archived lot)
  const searchArchived = await service.searchPublic({ query: "56500-D7000" });
  assert.ok(searchArchived.total >= 1);
  const rack = searchArchived.items.find((i) => i.primaryOem === "56500-D7000");
  assert.ok(rack, "Archived rack must be found");
  assert.equal(rack.status, "ARCHIVED_SOLD");
  assert.equal(rack.badge, "ARCHIVED_SOLD");

  // 5. Filter by supplier country: Poland
  const searchPoland = await service.searchPublic({ country: "Польша" });
  assert.ok(searchPoland.total >= 1);
  assert.ok(searchPoland.items.every((item) => item.countries.includes("Польша")));

  // 6. Filter by condition: БУ
  const searchUsed = await service.searchPublic({ condition: "БУ" });
  assert.ok(searchUsed.total >= 1);

  // 7. Filter availability: ARCHIVED_SOLD
  const searchOnlyArchived = await service.searchPublic({ availability: "ARCHIVED_SOLD" });
  assert.ok(searchOnlyArchived.total >= 1);
  assert.ok(searchOnlyArchived.items.every((item) => item.status === "ARCHIVED_SOLD" || item.badge === "ARCHIVED_SOLD"));
});

test.after(async () => {
  await prisma.$disconnect();
});
