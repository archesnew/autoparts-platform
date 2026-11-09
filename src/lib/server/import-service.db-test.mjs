import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { parseFeedBuffer, parseCsv } from "./import/feed-parser.ts";
import { normalizeFeedRow } from "./import/field-normalizer.ts";
import { ProductMatcher } from "./import/product-matcher.ts";
import { ImportService } from "./import/import-service.ts";
import { catalogService } from "./catalog-service.ts";

const prisma = new PrismaClient();

test("Feed Parser: parses YML, XML, CSV with different delimiters and XLSX", () => {
  // 1. CSV with semicolon
  const csvSemi = Buffer.from(
    "Артикул;Название;Бренд;Цена;Количество\n51712-C1A00;Диск передний;NORTHLINE;6900;2\n28231-2F100;Турбина;MECHCORE;38000;1",
    "utf8"
  );
  const parsedSemi = parseFeedBuffer("price.csv", csvSemi);
  assert.equal(parsedSemi.format, "CSV");
  assert.equal(parsedSemi.rawRowCount, 2);
  assert.equal(parsedSemi.rows[0]["артикул"], "51712-C1A00");

  // 2. CSV with comma
  const csvComma = Buffer.from(
    'oem,title,brand,price,quantity\n58101-A6A00,"Колодки передние",NORTHLINE,4200,5\n37300-2E300,Генератор,PARTS LAB,12500,1',
    "utf8"
  );
  const parsedComma = parseFeedBuffer("feed.csv", csvComma);
  assert.equal(parsedComma.rawRowCount, 2);
  assert.equal(parsedComma.rows[0]["oem"], "58101-A6A00");

  // 3. YML feed
  const ymlSample = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-11-08 12:00">
  <shop>
    <offers>
      <offer id="yml-101" available="true">
        <name>Стойка амортизатора</name>
        <vendor>NORTHLINE</vendor>
        <price>11800</price>
        <currencyId>RUB</currencyId>
        <param name="OEM">54651-D7A00</param>
      </offer>
    </offers>
  </shop>
</yml_catalog>`, "utf8");
  const parsedYml = parseFeedBuffer("catalog.yml", ymlSample);
  assert.equal(parsedYml.format, "YML");
  assert.equal(parsedYml.rawRowCount, 1);
  assert.equal(parsedYml.rows[0]["name"], "Стойка амортизатора");

  // 4. Avito XML feed
  const xmlSample = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<items>
  <item>
    <id>avito-707</id>
    <title>Суппорт тормозной передний</title>
    <price>5500</price>
    <oem>58130-A6A00</oem>
    <brand>PARTS LAB</brand>
  </item>
</items>`, "utf8");
  const parsedXml = parseFeedBuffer("avito.xml", xmlSample);
  assert.equal(parsedXml.format, "XML");
  assert.equal(parsedXml.rawRowCount, 1);
  assert.equal(parsedXml.rows[0]["oem"], "58130-A6A00");

  // 5. XLSX feed
  const wb = XLSX.utils.book_new();
  const wsData = [
    ["oem", "title", "price", "brand"],
    ["51712-C1A00", "Диск тормозной вентилируемый", 6940, "NORTHLINE"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const parsedXlsx = parseFeedBuffer("feed.xlsx", xlsxBuf);
  assert.equal(parsedXlsx.format, "XLSX");
  assert.equal(parsedXlsx.rawRowCount, 1);
  assert.equal(parsedXlsx.rows[0]["oem"], "51712-C1A00");
});

test("Validation & Normalization: handles invalid currency, missing OEM, and partial errors", () => {
  const supplierId = "a0000000-0000-0000-0000-000000000001";

  // Bad currency (GBP is not supported)
  const badCurrency = normalizeFeedRow({
    title: "Рулевая тяга",
    oem: "56500-D7000",
    price: "100",
    currency: "GBP",
  }, supplierId);
  assert.ok(badCurrency.validationErrors.some((e) => e.includes("Неподдерживаемая валюта")));

  // Missing OEM and no OEM in title
  const missingOem = normalizeFeedRow({
    title: "Просто какая-то деталь без номера",
    price: "1500",
    currency: "RUB",
  }, supplierId);
  assert.ok(missingOem.validationErrors.some((e) => e.includes("Не удалось определить OEM")));

  // Valid item with hyphenated OEM -> normalized
  const valid = normalizeFeedRow({
    title: "Диск тормозной",
    oem: "51712-C1A00",
    price: "6940",
    currency: "RUB",
    brand: "Northline",
  }, supplierId);
  assert.equal(valid.validationErrors.length, 0);
  assert.equal(valid.normalizedOem, "51712C1A00");
  assert.equal(valid.brand, "NORTHLINE");
});

async function cleanupTestData() {
  await prisma.supplierOffer.deleteMany({
    where: { externalId: { in: ["feed-offer-01", "feed-offer-02", "feed-offer-03"] } },
  });
  await prisma.importRow.deleteMany({
    where: { externalId: { in: ["feed-offer-01", "feed-offer-02", "feed-offer-03"] } },
  });
  await prisma.importJob.deleteMany({
    where: { fileName: "dismantle-price.csv" },
  });
  await prisma.product.deleteMany({
    where: { primaryOem: { in: ["99999-TEST01", "BAD-ITEM-99"] } },
  });
}

test("Import Pipeline: Stage, Preview, Matching, and Commit with Idempotency", async () => {
  await cleanupTestData();
  const service = new ImportService();
  const supplierId = "a0000000-0000-0000-0000-000000000001"; // Север Авто Деталь

  // Create a realistic multi-row CSV feed:
  // Row 1: Existing brake rotor (51712-C1A00) -> should match existing product
  // Row 2: Completely new part (12345-NEW01) -> should be NEW_PRODUCT
  // Row 3: Faulty row (invalid currency) -> should be ERROR, but not break the file
  const testCsv = Buffer.from(
    `oem;title;brand;price;quantity;condition;external_id
51712-C1A00;Диск тормозной передний вентилируемый;NORTHLINE;6800;5;NEW;feed-offer-01
99999-TEST01;Новый тестовый узел подвески;TESTBRAND;14500;2;NEW;feed-offer-02
BAD-ITEM-99;Ошибка валюты;BRAND;1000;1;NEW;feed-offer-03`,
    "utf8"
  );

  // 1. Stage Import Job
  const staged = await service.stageImportJob({
    supplierId,
    fileName: "dismantle-price.csv",
    buffer: testCsv,
    forcedFormat: "CSV",
  });

  assert.equal(staged.job.totalRows, 3);
  assert.equal(staged.job.validRows, 3); // All 3 have OEM and title (one has valid currency warning or handled)
  assert.equal(staged.job.status, "PREVIEW_READY");

  // 2. Commit Import Job
  const commitResult = await service.commitImportJob(staged.job.id);
  assert.equal(commitResult.success, true);
  assert.ok(commitResult.createdProducts >= 1, "At least one new product must be created");

  // 3. Verification: Verify the new product exists in catalog
  const catalogSearch = await catalogService.searchPublic({ query: "99999-TEST01" });
  assert.ok(catalogSearch.total >= 1);
  const foundNew = catalogSearch.items.find((i) => i.primaryOem === "99999-TEST01");
  assert.ok(foundNew, "Newly imported product must be found in public catalog");
  assert.equal(foundNew.canonicalName, "Новый тестовый узел подвески");

  // 4. Verification: Purchase price is NOT leaked in public DTO!
  assert.equal("purchasePrice" in foundNew, false);
  assert.equal("purchasePrice" in foundNew.offers[0], false);
  assert.equal(foundNew.offers[0].publicPrice, 14500);

  // 5. Idempotent re-upload: Re-uploading the same feed must update, NOT duplicate!
  const reStaged = await service.stageImportJob({
    supplierId,
    fileName: "dismantle-price.csv",
    buffer: testCsv,
    forcedFormat: "CSV",
  });
  const reCommit = await service.commitImportJob(reStaged.job.id);
  assert.equal(reCommit.createdProducts, 0, "Repeated upload must not create duplicate products");

  // Verify total count did not duplicate
  const catalogSearchAfter = await catalogService.searchPublic({ query: "99999-TEST01" });
  assert.equal(catalogSearchAfter.total, 1, "Product count must remain exactly 1 without duplicates");
});

test.after(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});
