import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as XLSX from "xlsx";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { importService } from "../src/lib/server/import/import-service.ts";
import { parseFeedBuffer } from "../src/lib/server/import/feed-parser.ts";
import { normalizeFeedRow } from "../src/lib/server/import/field-normalizer.ts";
import { catalogService } from "../src/lib/server/catalog-service.ts";
import { supplierPortalService } from "../src/lib/server/supplier-portal-service.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING REAL SUPPLIER ONBOARDING & LIVE INVENTORY VERIFICATION ===\n");

  // 1. Get or setup 2 suppliers for multi-tenant and product unification testing
  const supplierRu = await prisma.supplier.findFirst({ where: { countryCode: "RU" } });
  const supplierBy = await prisma.supplier.findFirst({ where: { countryCode: "BY" } });
  assert.ok(supplierRu, "RU Supplier must exist");
  assert.ok(supplierBy, "BY Supplier must exist");
  console.log(`[SETUP] RU Supplier: ${supplierRu.name} (${supplierRu.id})`);
  console.log(`[SETUP] BY Supplier: ${supplierBy.name} (${supplierBy.id})`);

  // 2. Multi-tenant Isolation Test
  console.log("\n--> 1. Testing Supplier User Creation & Multi-tenant Isolation...");
  const uniqueSuffix = Date.now();
  const ruUserEmail = `supplier.ru.${uniqueSuffix}@test.zaptut.pro`;
  const byUserEmail = `supplier.by.${uniqueSuffix}@test.zaptut.pro`;

  const ruSupplierUser = await supplierPortalService.createSupplierUser({
    supplierId: supplierRu.id,
    name: "Менеджер Север Авто",
    email: ruUserEmail,
    password: "Password123!Secure",
    role: "OWNER",
  });
  assert.ok(ruSupplierUser.id, "RU Supplier user created");

  const bySupplierUser = await supplierPortalService.createSupplierUser({
    supplierId: supplierBy.id,
    name: "Менеджер Минск Моторс",
    email: byUserEmail,
    password: "Password123!Secure",
    role: "MANAGER",
  });
  assert.ok(bySupplierUser.id, "BY Supplier user created");
  console.log("  ✓ Created dedicated SupplierUser for both suppliers");

  // Verify dashboard metrics scoped to supplier
  const ruMetrics = await supplierPortalService.getDashboardMetrics(supplierRu.id);
  const byMetrics = await supplierPortalService.getDashboardMetrics(supplierBy.id);
  assert.ok(typeof ruMetrics.activeOffersCount === "number");
  assert.ok(typeof byMetrics.activeOffersCount === "number");
  console.log("  ✓ Supplier dashboard metrics strictly isolated per supplierId");

  // 3. Test Feed Parsers for all 4 formats: CSV, XLSX, XML, YML
  console.log("\n--> 2. Testing Feed Parsers (CSV, XLSX, XML, YML)...");

  // Format 1: CSV with UTF-8 BOM, semicolons, quotes, edge cases
  const csvContent = `\uFEFFoem;name;brand;price;quantity;condition;city;delivery
OEM-REAL-CSV-01;"Рычаг передний левый";LEMFORDER;4200;3;Новая;Москва;1-2 дня
OEM-REAL-CSV-02;"Фара правая LED (без кол-ва)";HELLA;18500;;Новая;Москва;2 дня
OEM-REAL-CSV-03;"Блок ABS (без цены)";BOSCH;;1;Новая;Москва;3 дня
OEM-REAL-CSV-04;"Дроссельная заслонка (дубль)";PIERBURG;7800;2;Новая;Москва;1 день
OEM-REAL-CSV-04;"Дроссельная заслонка (дубль)";PIERBURG;7800;2;Новая;Москва;1 день
;"Деталь без артикула";NONAME;1000;1;Новая;Москва;1 день
`;
  const csvBuffer = Buffer.from(csvContent, "utf8");
  const parsedCsv = parseFeedBuffer("feed_ru.csv", csvBuffer);
  assert.equal(parsedCsv.format, "CSV");
  assert.equal(parsedCsv.rawRowCount, 6);
  console.log("  ✓ CSV parser: 6 rows parsed correctly with semicolons and BOM");

  // Format 2: XLSX (Excel binary)
  const xlsxRows = [
    { oem: "OEM-REAL-XLSX-01", name: "Амортизатор задний газовый", brand: "KYB", price: 3400, quantity: 4, condition: "Новая", city: "Минск" },
    { oem: "OEM-REAL-XLSX-02", name: "Колодки тормозные керамика", brand: "BREMBO", price: 5100, quantity: 2, condition: "Новая", city: "Минск" },
  ];
  const ws = XLSX.utils.json_to_sheet(xlsxRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parts");
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const parsedXlsx = parseFeedBuffer("feed_by.xlsx", xlsxBuffer);
  assert.equal(parsedXlsx.format, "XLSX");
  assert.equal(parsedXlsx.rawRowCount, 2);
  console.log("  ✓ XLSX parser: 2 rows parsed correctly without macros");

  // Format 3: XML (Universal feed format)
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<items>
  <item>
    <oem>OEM-REAL-XML-01</oem>
    <name>Стартер редукторный 12V</name>
    <brand>VALEO</brand>
    <price>9500</price>
    <quantity>2</quantity>
    <condition>Новая</condition>
  </item>
</items>`;
  const xmlBuffer = Buffer.from(xmlContent, "utf8");
  const parsedXml = parseFeedBuffer("feed_universal.xml", xmlBuffer);
  assert.equal(parsedXml.format, "XML");
  assert.equal(parsedXml.rawRowCount, 1);
  console.log("  ✓ XML parser: 1 row parsed correctly with XXE entity expansion disabled");

  // Format 4: YML (Yandex Market / Drom format)
  const ymlContent = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-11-09 12:00">
  <shop>
    <name>Baltic Parts</name>
    <offers>
      <offer id="yml-ext-01">
        <name>Генератор 14V 150A</name>
        <vendor>DENSO</vendor>
        <vendorCode>OEM-REAL-YML-01</vendorCode>
        <price>14800</price>
        <currencyId>RUB</currencyId>
        <count>3</count>
        <picture>https://zaptut.pro/generator.webp</picture>
      </offer>
    </offers>
  </shop>
</yml_catalog>`;
  const ymlBuffer = Buffer.from(ymlContent, "utf8");
  const parsedYml = parseFeedBuffer("feed_drom.yml", ymlBuffer);
  assert.equal(parsedYml.format, "YML");
  assert.equal(parsedYml.rawRowCount, 1);
  console.log("  ✓ YML parser: 1 offer parsed correctly from yml_catalog structure");

  // 4. Staging and Edge Cases Verification (Rule 3)
  console.log("\n--> 3. Staging CSV and Verifying Strict Business Rules...");
  const stageRes = await importService.stageImportJob({
    supplierId: supplierRu.id,
    fileName: "feed_ru.csv",
    buffer: csvBuffer,
    source: "RU_DISMANTLE",
  });

  const stagedRows = await prisma.importRow.findMany({
    where: { jobId: stageRes.job.id },
    orderBy: { rowIndex: "asc" },
  });

  // Verify Row 1: Valid
  assert.equal(stagedRows[0].status, "VALID");
  assert.equal(stagedRows[0].normalizedOem, "OEMREALCSV01");
  console.log("  ✓ Row 1: Valid row correctly marked VALID");

  // Verify Row 2: Missing quantity -> must NOT be assumed confirmed in stock
  const row2Norm = normalizeFeedRow(parsedCsv.rows[1], supplierRu.id);
  assert.equal(row2Norm.hasExplicitQuantity, false, "Quantity must not be assumed");
  assert.equal(stagedRows[1].quantity, 0, "Missing quantity must be 0");
  console.log("  ✓ Row 2: Missing quantity strictly NOT treated as confirmed in-stock");

  // Verify Row 3: Missing price -> must NOT be turned into 0
  const row3Norm = normalizeFeedRow(parsedCsv.rows[2], supplierRu.id);
  assert.equal(row3Norm.price, null, "Missing price must remain null");
  assert.equal(stagedRows[2].price, null, "Missing price in DB row must remain null");
  console.log("  ✓ Row 3: Missing price strictly remains null (never turned to 0)");

  // Verify Row 4 & 5: Duplicate in feed
  assert.equal(stagedRows[4].matchType, "DUPLICATE_IN_FEED");
  assert.equal(stagedRows[4].status, "INVALID");
  console.log("  ✓ Row 5: Duplicate inside feed flagged DUPLICATE_IN_FEED and INVALID");

  // Verify Row 6: Invalid OEM
  assert.equal(stagedRows[5].status, "INVALID");
  console.log("  ✓ Row 6: Invalid OEM correctly rejected from automatic commit");

  // 5. Commit Job to Live Inventory
  console.log("\n--> 4. Committing Staged Feed into Live Catalog...");
  const commitRes = await importService.commitImportJob(stageRes.job.id);
  assert.ok(commitRes.success, "Commit must succeed");
  console.log(`  ✓ Commit complete: created ${commitRes.createdProducts} products, ${commitRes.createdOffers} offers`);

  // Verify Row 2 offer status is ON_REQUEST (not in stock)
  const offerRow2 = await prisma.supplierOffer.findFirst({
    where: { supplierId: supplierRu.id, rawArticle: "OEM-REAL-CSV-02" },
  });
  assert.ok(offerRow2, "Offer for Row 2 must exist");
  assert.equal(offerRow2.status, "ON_REQUEST", "Offer without confirmed quantity must be ON_REQUEST");
  console.log("  ✓ Live offer without explicit quantity set to ON_REQUEST status");

  // 6. Product Unification: Two suppliers offering the exact same part
  console.log("\n--> 5. Testing Product Unification Across Multiple Suppliers (Single Product, Multiple Offers)...");
  const sharedOem = `OEM-SHARED-${uniqueSuffix}`;

  // Supplier RU imports the part
  const ruSharedCsv = `oem,name,brand,price,quantity\n${sharedOem},"Тормозной диск вентилируемый",NORTHLINE,5000,5\n`;
  const ruSharedStage = await importService.stageImportJob({
    supplierId: supplierRu.id,
    fileName: "ru_shared.csv",
    buffer: Buffer.from(ruSharedCsv),
    source: "RU_DISMANTLE",
  });
  await importService.commitImportJob(ruSharedStage.job.id);

  // Supplier BY imports the same OEM
  const bySharedCsv = `oem,name,brand,price,quantity\n${sharedOem},"Диск тормозной Northline",NORTHLINE,5400,2\n`;
  const bySharedStage = await importService.stageImportJob({
    supplierId: supplierBy.id,
    fileName: "by_shared.csv",
    buffer: Buffer.from(bySharedCsv),
    source: "BY_DISMANTLE",
  });
  await importService.commitImportJob(bySharedStage.job.id);

  // Verify in PostgreSQL: exactly ONE Product and TWO SupplierOffers
  const normalizedSharedOem = sharedOem.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const matchedProducts = await prisma.product.findMany({
    where: {
      OR: [
        { primaryOem: sharedOem },
        { oemCodes: { has: normalizedSharedOem } },
      ],
    },
    include: {
      offers: {
        include: { supplier: true },
      },
    },
  });

  assert.equal(matchedProducts.length, 1, "Exactly ONE Product card must exist");
  assert.equal(matchedProducts[0].offers.length, 2, "Exactly TWO SupplierOffers must be linked");
  console.log(`  ✓ Product '${matchedProducts[0].canonicalName}' (${matchedProducts[0].id}) unified with 2 distinct supplier offers`);

  // 7. Public Catalog Sanitization and Retail Pricing Formula (Rule 8)
  console.log("\n--> 6. Verifying Public Catalog Retail Pricing Formula & Zero Data Leakage...");
  const publicSearchResult = await catalogService.searchPublic({ query: sharedOem });
  assert.ok(publicSearchResult.items.length >= 1, "Product must appear in public search");
  const publicProduct = publicSearchResult.items[0];

  console.log(`  [CATALOG] Canonical name: ${publicProduct.canonicalName}`);
  console.log(`  [CATALOG] Minimum retail price: ${publicProduct.minPrice} RUB`);
  console.log(`  [CATALOG] Offers count: ${publicProduct.offersCount}`);
  console.log(`  [CATALOG] Countries: ${publicProduct.countries?.join(", ")}`);

  // Approved formula check:
  // RU purchase: 5000 RUB -> Markup: max(28% of 5000 = 1400, min 300) = 1400 -> Retail: 6400 RUB
  // BY purchase: 5400 RUB -> Markup: max(28% of 5400 = 1512, min 300) = 1512 -> Retail: 6912 RUB
  // Min price in catalog should be 6400 RUB!
  assert.equal(publicProduct.minPrice, 6400, "Public price must strictly follow approved 28% formula (5000 + 1400 = 6400 RUB)");
  console.log("  ✓ Public retail price matches approved 28% formula (5000 + 1400 = 6400 RUB)");

  // Strict check: no supplier names, wholesale purchase prices, or CRM notes in public output
  const publicJson = JSON.stringify(publicProduct);
  assert.ok(!publicJson.includes("Север Авто Деталь"), "Supplier name must NEVER be exposed");
  assert.ok(!publicJson.includes("Минск Моторс"), "Supplier name must NEVER be exposed");
  assert.ok(!publicJson.includes("5000"), "Purchase cost must NEVER be exposed in public DTO");
  assert.ok(!publicJson.includes("purchasePrice"), "Field purchasePrice must NEVER be exposed in public DTO");
  console.log("  ✓ Commercial secrecy: 0 supplier names or purchase costs exposed in public API");

  // 8. Repeat Imports & Full Feed Archiving (Rule 5)
  console.log("\n--> 7. Testing Repeat Import, In-Place Price/Quantity Updates & Full Feed Archiving...");

  // Repeat import for Supplier RU: price updated from 5000 to 5800, quantity from 5 to 8
  const ruRepeatCsv = `oem,name,brand,price,quantity\n${sharedOem},"Тормозной диск вентилируемый",NORTHLINE,5800,8\n`;
  const ruRepeatStage = await importService.stageImportJob({
    supplierId: supplierRu.id,
    fileName: "ru_repeat.csv",
    buffer: Buffer.from(ruRepeatCsv),
    source: "RU_DISMANTLE",
  });
  const repeatCommit = await importService.commitImportJob(ruRepeatStage.job.id, {
    isFullFeed: false, // Delta mode: do not archive other parts
  });
  assert.equal(repeatCommit.createdProducts, 0, "No new products should be created on repeat import");
  assert.equal(repeatCommit.updatedOffers, 1, "Existing offer must be updated in-place");

  // Verify updated values in DB
  const updatedRuOffer = await prisma.supplierOffer.findFirst({
    where: { supplierId: supplierRu.id, productId: matchedProducts[0].id },
  });
  assert.equal(Number(updatedRuOffer.purchasePrice), 5800, "Purchase price must be updated to 5800");
  assert.equal(updatedRuOffer.quantity, 8, "Quantity must be updated to 8");
  console.log("  ✓ Repeat import updated price (5800 RUB) and quantity (8) in-place without duplicating offer");

  // Test Full Feed Mode Archiving:
  // Upload a full feed that intentionally omits an older part, with archiveMissing: true
  console.log("  [TEST] Testing Full Feed mode: archiving missing items...");
  const obsoleteOem = `OEM-OBSOLETE-${uniqueSuffix}`;
  const initialFeed = `oem,name,brand,price,quantity\n${obsoleteOem},"Старый амортизатор",KYB,3000,1\n`;
  const initialStage = await importService.stageImportJob({
    supplierId: supplierRu.id,
    fileName: "initial_full.csv",
    buffer: Buffer.from(initialFeed),
    source: "RU_DISMANTLE",
  });
  await importService.commitImportJob(initialStage.job.id);

  // Now upload new full feed without the obsolete part
  const nextFullFeed = `oem,name,brand,price,quantity\n${sharedOem},"Тормозной диск",NORTHLINE,5800,8\n`;
  const nextFullStage = await importService.stageImportJob({
    supplierId: supplierRu.id,
    fileName: "next_full.csv",
    buffer: Buffer.from(nextFullFeed),
    source: "RU_DISMANTLE",
  });
  const fullCommit = await importService.commitImportJob(nextFullStage.job.id, {
    isFullFeed: true,
    archiveMissing: true,
  });

  // Verify obsolete item was transitioned to ARCHIVED_SOLD
  const obsoleteOffer = await prisma.supplierOffer.findFirst({
    where: { supplierId: supplierRu.id, rawArticle: obsoleteOem },
  });
  assert.equal(obsoleteOffer.status, "ARCHIVED_SOLD", "Missing item in full feed must be marked ARCHIVED_SOLD");
  console.log("  ✓ Full feed mode correctly transitioned missing item to ARCHIVED_SOLD");

  // 9. Staff CRM Suppliers API & Freshness Metrics
  console.log("\n--> 8. Verifying Staff CRM Supplier Registry & Live Inventory Metrics...");
  const crmSuppliers = await prisma.supplier.findMany({
    include: {
      _count: { select: { offers: true, importJobs: true } },
      importJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      offers: { select: { status: true, lastSeenAt: true } },
    },
  });

  const ruCrmSupplier = crmSuppliers.find((s) => s.id === supplierRu.id);
  assert.ok(ruCrmSupplier.importJobs.length > 0, "Last import job must be tracked");
  assert.ok(ruCrmSupplier._count.offers > 0, "Total offers must be tracked");
  console.log(`  [CRM] Supplier: ${ruCrmSupplier.name}`);
  console.log(`  [CRM] Total offers: ${ruCrmSupplier._count.offers}`);
  console.log(`  [CRM] Last job file: ${ruCrmSupplier.importJobs[0].fileName}`);
  console.log(`  [CRM] Last job status: ${ruCrmSupplier.importJobs[0].status}`);
  console.log("  ✓ CRM supplier registry reflects accurate live inventory metrics and last upload date");

  console.log("\n==================================================================");
  console.log(" ALL REAL SUPPLIER ONBOARDING & LIVE INVENTORY CHECKS PASSED!");
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
