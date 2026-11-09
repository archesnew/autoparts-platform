import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { supplierPortalService } from "./supplier-portal-service.ts";
import { importService } from "./import/import-service.ts";

const prisma = new PrismaClient();

const testPrefix = `test-sup-${Date.now()}`;
let supplierAId;
let supplierBId;
let userA1Id;
let userA2Id;
let userB1Id;

test.before(async () => {
  // Ensure SUPPLIER role exists in staff_roles
  await prisma.staffRole.upsert({
    where: { code: "SUPPLIER" },
    create: { code: "SUPPLIER", name: "Представитель поставщика", isSystem: true },
    update: {},
  });

  // Create Supplier A
  const supA = await prisma.supplier.create({
    data: {
      name: `${testPrefix} Supplier Alpha`,
      countryCode: "RU",
      status: "ACTIVE",
      contactName: "Иван Иванов",
      phone: "+7 900 111-22-33",
      email: `${testPrefix}-alpha@example.test`,
      legalName: 'ООО "Альфа Авто"',
      innOrVat: "7701234567",
      city: "Москва",
      warehouseAddress: "г. Москва, ул. Складская, 1",
      deliveryMethods: ["СДЭК", "Деловые Линии", "Курьер"],
      pickupAvailable: true,
      orderProcessingDays: 1,
      supportedCurrencies: ["RUB"],
    },
  });
  supplierAId = supA.id;

  // Create Supplier B
  const supB = await prisma.supplier.create({
    data: {
      name: `${testPrefix} Supplier Beta`,
      countryCode: "BY",
      status: "ACTIVE",
      contactName: "Пётр Петров",
      phone: "+375 29 999-88-77",
      email: `${testPrefix}-beta@example.test`,
      legalName: 'ООО "Бета Минск"',
      innOrVat: "100200300",
      city: "Минск",
      warehouseAddress: "г. Минск, пр-т Партизанский, 15",
      deliveryMethods: ["Автолайт", "СДЭК"],
      pickupAvailable: true,
      orderProcessingDays: 2,
      supportedCurrencies: ["BYN", "RUB"],
    },
  });
  supplierBId = supB.id;
});

test("Supplier Portal: user creation, multiple users per supplier, and isolation", async () => {
  // 1. Create first user for Supplier A
  const userA1 = await supplierPortalService.createSupplierUser({
    supplierId: supplierAId,
    name: "Менеджер Альфа 1",
    email: `${testPrefix}-userA1@example.test`,
    password: "Password12345!",
    role: "OWNER",
  });
  userA1Id = userA1.id;
  assert.equal(userA1.role, "OWNER");

  // 2. Create second user for Supplier A (multiple users linked to one supplier)
  const userA2 = await supplierPortalService.createSupplierUser({
    supplierId: supplierAId,
    name: "Менеджер Альфа 2",
    email: `${testPrefix}-userA2@example.test`,
    password: "Password12345!",
    role: "MANAGER",
  });
  userA2Id = userA2.id;
  assert.equal(userA2.role, "MANAGER");

  // 3. Create user for Supplier B
  const userB1 = await supplierPortalService.createSupplierUser({
    supplierId: supplierBId,
    name: "Менеджер Бета 1",
    email: `${testPrefix}-userB1@example.test`,
    password: "Password12345!",
    role: "OWNER",
  });
  userB1Id = userB1.id;

  // Verify list of users for Supplier A has exactly 2 users
  const listA = await supplierPortalService.listSupplierUsers(supplierAId);
  assert.equal(listA.length, 2);
  assert.ok(listA.some((u) => u.email.toLowerCase() === `${testPrefix}-usera1@example.test`.toLowerCase()));
  assert.ok(listA.some((u) => u.email.toLowerCase() === `${testPrefix}-usera2@example.test`.toLowerCase()));

  // Verify list of users for Supplier B has exactly 1 user
  const listB = await supplierPortalService.listSupplierUsers(supplierBId);
  assert.equal(listB.length, 1);
  assert.equal(listB[0].email.toLowerCase(), `${testPrefix}-userb1@example.test`.toLowerCase());
});

test("Supplier Portal: invitation workflow (create, check, and accept)", async () => {
  const inviteEmail = `${testPrefix}-invite@example.test`;

  // 1. Create invitation
  const invitation = await supplierPortalService.createInvitation({
    supplierId: supplierAId,
    email: inviteEmail,
    role: "MANAGER",
  });
  assert.ok(invitation.token);
  assert.equal(invitation.status, "PENDING");

  // 2. Accept invitation
  const accepted = await supplierPortalService.acceptInvitation({
    token: invitation.token,
    name: "Приглашённый Менеджер",
    password: "SecurePassword999!",
  });
  assert.equal(accepted.email, inviteEmail);

  // 3. Trying to accept again must fail
  await assert.rejects(
    async () => {
      await supplierPortalService.acceptInvitation({
        token: invitation.token,
        name: "Повторная попытка",
        password: "SecurePassword999!",
      });
    },
    /Приглашение уже использовано или отозвано/
  );
});

test("Supplier Portal: offer data isolation and cross-tenant protection", async () => {
  // 1. Create product & offer for Supplier A
  const productA = await prisma.product.create({
    data: {
      canonicalName: `${testPrefix} Фара левая`,
      primaryOem: `OEM-${testPrefix}-A`,
      brand: "VALEO",
      category: "Оптика",
    },
  });

  const offerA = await prisma.supplierOffer.create({
    data: {
      productId: productA.id,
      supplierId: supplierAId,
      source: "RU_DISMANTLE",
      externalId: `${testPrefix}-ext-A`,
      originalTitle: "Фара левая оригинальная",
      purchasePrice: 12000,
      currency: "RUB",
      quantity: 3,
      condition: "USED",
      status: "IN_STOCK",
      deliveryDays: 2,
    },
  });

  // 2. Create product & offer for Supplier B
  const productB = await prisma.product.create({
    data: {
      canonicalName: `${testPrefix} Стартер`,
      primaryOem: `OEM-${testPrefix}-B`,
      brand: "BOSCH",
      category: "Электрика",
    },
  });

  const offerB = await prisma.supplierOffer.create({
    data: {
      productId: productB.id,
      supplierId: supplierBId,
      source: "BY_DISMANTLE",
      externalId: `${testPrefix}-ext-B`,
      originalTitle: "Стартер восстановленный",
      purchasePrice: 8500,
      currency: "RUB",
      quantity: 1,
      condition: "USED",
      status: "IN_STOCK",
      deliveryDays: 4,
    },
  });

  // 3. Verify Supplier A can see ONLY their own offers
  const offersA = await supplierPortalService.getOffers(supplierAId, {});
  const offerIdsA = offersA.items.map((o) => o.id);
  assert.ok(offerIdsA.includes(offerA.id), "Supplier A must see their own offer");
  assert.equal(offerIdsA.includes(offerB.id), false, "Supplier A MUST NOT see Supplier B's offer");

  // 4. Verify Supplier B can see ONLY their own offers
  const offersB = await supplierPortalService.getOffers(supplierBId, {});
  const offerIdsB = offersB.items.map((o) => o.id);
  assert.ok(offerIdsB.includes(offerB.id), "Supplier B must see their own offer");
  assert.equal(offerIdsB.includes(offerA.id), false, "Supplier B MUST NOT see Supplier A's offer");

  // 5. Cross-tenant mutation protection: Supplier A cannot edit Supplier B's offer!
  await assert.rejects(
    async () => {
      await supplierPortalService.updateOffer(supplierAId, offerB.id, {
        purchasePrice: 999999,
      });
    },
    /Предложение не найдено или принадлежит другому поставщику/
  );

  // 6. Legitimate mutation: Supplier A updates their own offer
  const updatedA = await supplierPortalService.updateOffer(supplierAId, offerA.id, {
    purchasePrice: 13500,
    quantity: 5,
    deliveryDays: 1,
  });
  assert.equal(updatedA.purchasePrice, 13500);
  assert.equal(updatedA.quantity, 5);
  assert.equal(updatedA.deliveryDays, 1);
});

test("Supplier Portal: feed import automatically bound to supplier & KPI stats", async () => {
  // Feed for Supplier A
  const csvData = Buffer.from(
    `oem;title;brand;price;quantity;condition;external_id
OEM-${testPrefix}-FEED-01;Рычаг подвески;LEMFORDER;4500;4;NEW;ext-${testPrefix}-01
OEM-${testPrefix}-FEED-02;Амортизатор;KYB;6000;2;NEW;ext-${testPrefix}-02`,
    "utf8"
  );

  // Stage import
  const staged = await importService.stageImportJob({
    supplierId: supplierAId,
    fileName: `${testPrefix}-price.csv`,
    buffer: csvData,
    forcedFormat: "CSV",
  });

  assert.equal(staged.job.supplierId, supplierAId);
  assert.equal(staged.job.totalRows, 2);

  // Commit import
  const committed = await importService.commitImportJob(staged.job.id);
  assert.equal(committed.success, true);

  // Dashboard metrics for Supplier A
  const metricsA = await supplierPortalService.getDashboardMetrics(supplierAId);
  assert.ok(metricsA.activeOffersCount >= 2);
  assert.ok(metricsA.totalProductsCount >= 2);
  assert.ok(metricsA.latestJobs.length >= 1);
  assert.equal(metricsA.priceFreshness.freshPercentage, 100);

  // Repeated import (idempotency test): re-uploading with updated price
  const csvDataUpdated = Buffer.from(
    `oem;title;brand;price;quantity;condition;external_id
OEM-${testPrefix}-FEED-01;Рычаг подвески;LEMFORDER;4700;8;NEW;ext-${testPrefix}-01
OEM-${testPrefix}-FEED-02;Амортизатор;KYB;6200;1;NEW;ext-${testPrefix}-02`,
    "utf8"
  );
  const staged2 = await importService.stageImportJob({
    supplierId: supplierAId,
    fileName: `${testPrefix}-price.csv`,
    buffer: csvDataUpdated,
    forcedFormat: "CSV",
  });
  const committed2 = await importService.commitImportJob(staged2.job.id);
  assert.equal(committed2.createdProducts, 0, "No duplicate products created on repeat import");
  assert.equal(committed2.createdOffers + committed2.updatedOffers, 2, "Both offers updated");

  // Verify updated prices in database
  const searchOffers = await supplierPortalService.getOffers(supplierAId, {
    query: `OEM-${testPrefix}-FEED-01`,
  });
  assert.equal(searchOffers.items.length, 1);
  assert.equal(searchOffers.items[0].purchasePrice, 4700);
  assert.equal(searchOffers.items[0].quantity, 8);
});

test("Supplier Portal: blocking user and suspending all offers", async () => {
  // 1. Suspend all offers of Supplier A
  const suspendRes = await supplierPortalService.suspendAllOffers(supplierAId);
  assert.ok(suspendRes.updatedCount >= 1);

  // Verify active count is now 0
  const activeOffers = await prisma.supplierOffer.count({
    where: { supplierId: supplierAId, status: "IN_STOCK" },
  });
  assert.equal(activeOffers, 0, "All active offers must be suspended (OUT_OF_STOCK)");

  // 2. Block/suspend user A1
  await supplierPortalService.setSupplierUserStatus(supplierAId, userA1Id, "SUSPENDED");

  const checkUserA1 = await prisma.supplierUser.findUnique({ where: { id: userA1Id } });
  assert.equal(checkUserA1.status, "SUSPENDED");
  const checkUserAuth = await prisma.user.findUnique({ where: { id: checkUserA1.userId } });
  assert.equal(checkUserAuth.active, false);

  // 3. Reactivate user A1
  await supplierPortalService.setSupplierUserStatus(supplierAId, userA1Id, "ACTIVE");
  const checkReactivated = await prisma.supplierUser.findUnique({ where: { id: userA1Id } });
  assert.equal(checkReactivated.status, "ACTIVE");
});

test("Supplier Portal: profile retrieval and update", async () => {
  const profile = await supplierPortalService.getProfile(supplierAId);
  assert.equal(profile.name, `${testPrefix} Supplier Alpha`);
  assert.equal(profile.legalName, 'ООО "Альфа Авто"');

  const updated = await supplierPortalService.updateProfile(supplierAId, {
    contactName: "Алексей Смирнов",
    phone: "+7 999 555-44-33",
    orderProcessingDays: 3,
    pickupAvailable: false,
  });

  assert.equal(updated.contactName, "Алексей Смирнов");
  assert.equal(updated.phone, "+7 999 555-44-33");
  assert.equal(updated.orderProcessingDays, 3);
  assert.equal(updated.pickupAvailable, false);
});

test.after(async () => {
  // Clean up test data
  try {
    await prisma.supplierOffer.deleteMany({
      where: { supplierId: { in: [supplierAId, supplierBId] } },
    });
    await prisma.importRow.deleteMany({
      where: { job: { supplierId: { in: [supplierAId, supplierBId] } } },
    });
    await prisma.importJob.deleteMany({
      where: { supplierId: { in: [supplierAId, supplierBId] } },
    });
    await prisma.supplierInvitation.deleteMany({
      where: { supplierId: { in: [supplierAId, supplierBId] } },
    });
    const supUsers = await prisma.supplierUser.findMany({
      where: { supplierId: { in: [supplierAId, supplierBId] } },
      select: { userId: true },
    });
    const userIds = supUsers.map((su) => su.userId);
    await prisma.supplierUser.deleteMany({
      where: { supplierId: { in: [supplierAId, supplierBId] } },
    });
    if (userIds.length > 0) {
      await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.supplier.deleteMany({
      where: { id: { in: [supplierAId, supplierBId] } },
    });
    await prisma.product.deleteMany({
      where: { canonicalName: { contains: testPrefix } },
    });
  } catch (e) {
    console.error("Cleanup error:", e);
  } finally {
    await prisma.$disconnect();
  }
});
