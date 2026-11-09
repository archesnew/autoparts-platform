import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./auth.ts";
import { orderService, toOrderDto } from "./order-service.ts";
import { GET as getOrders, POST as postOrder } from "../../app/api/orders/route.ts";
import { GET as getOrderById, PATCH as patchOrderById } from "../../app/api/orders/[id]/route.ts";
import { POST as postPayment } from "../../app/api/orders/[id]/payments/route.ts";
import { PATCH as patchShipment } from "../../app/api/orders/[id]/shipment/route.ts";
import { GET as getDocuments, POST as postDocument } from "../../app/api/orders/[id]/documents/route.ts";
import { GET as getMessages, POST as postMessage } from "../../app/api/orders/[id]/messages/route.ts";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("Integration test requires DATABASE_URL from local .env");
const databaseUrl = new URL(configuredUrl);
if (!["127.0.0.1", "localhost"].includes(databaseUrl.hostname) || databaseUrl.pathname !== "/zaptut_dev") {
  throw new Error("Refusing integration tests outside the dedicated local zaptut_dev database");
}

const prisma = new PrismaClient();

async function createStaffSession(role) {
  const token = randomUUID();
  const email = `ord-test-${token}@example.test`;
  const password = `Test-Pass-${token}-123!`;
  const ip = `198.51.100.${20 + (Number.parseInt(token.slice(0, 2), 16) % 200)}`;

  const user = await prisma.user.create({
    data: { name: `Staff ${role} ${token.slice(0, 6)}`, email, role, active: true },
    select: { id: true, name: true, role: true },
  });

  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await hashPassword(password),
    },
  });

  const response = await auth.handler(
    new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email, password }),
    }),
  );

  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error(`Could not sign in staff user for role ${role}`);

  return {
    user,
    headers: {
      cookie: cookie.split(";")[0],
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
    },
  };
}

test("Order Management: End-to-end integration test with PostgreSQL", async (t) => {
  // Clear rate limits for clean execution
  await prisma.rateLimit.deleteMany();

  // Create staff sessions: SuperAdmin, Manager, Logistics
  const superAdmin = await createStaffSession("SUPER_ADMIN");
  const manager = await createStaffSession("MANAGER");
  const logistics = await createStaffSession("LOGISTICS");

  // Ensure customer exists
  let customer = await prisma.customer.findFirst();
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "ООО Тестовый Заказчик",
        phone: "+7 999 111-22-33",
        email: "order-test@client.test",
        type: "LEGAL_ENTITY",
        source: "CRM",
      },
    });
  }

  // Ensure supplier exists (one RU, one Poland)
  let supplierRu = await prisma.supplier.findFirst({ where: { countryCode: "RU" } });
  if (!supplierRu) {
    supplierRu = await prisma.supplier.create({
      data: {
        name: "Авторазборка Москва",
        countryCode: "RU",
        city: "Москва",
        contactName: "Иван",
      },
    });
  }

  let supplierPl = await prisma.supplier.findFirst({ where: { countryCode: "PL" } });
  if (!supplierPl) {
    supplierPl = await prisma.supplier.create({
      data: {
        name: "Allegro Moto PL",
        countryCode: "PL",
        city: "Варшава",
        contactName: "Piotr",
      },
    });
  }

  // 1. Create a confirmed request with items and quotes to test financial rules
  const testReqNumber = `ZP-2026-TEST-${Date.now().toString().slice(-4)}`;
  const testRequest = await prisma.request.create({
    data: {
      number: testReqNumber,
      customerId: customer.id,
      assignedManagerId: manager.user.id,
      status: "WAITING_CUSTOMER",
      priority: "HIGH",
      internalNote: "Секретная заметка менеджера: скидка не предусмотрена",
      customerComment: "Доставить до двери",
      items: {
        create: [
          // Item 1: Russia low price -> test RU min markup 300 RUB
          // purchase = 500 RUB -> 28% = 140 RUB < 300 RUB -> markup = 300 RUB -> sale = 800 RUB
          {
            requestedPartNumber: "OEM-RU-MIN-01",
            description: "Кронштейн фары правый",
            quantity: 1,
            supplierQuotes: {
              create: {
                supplierId: supplierRu.id,
                purchasePrice: 500,
                currency: "RUB",
                status: "SELECTED",
                condition: "USED_GOOD",
                deliveryDays: 2,
                deliveryCost: 200,
              },
            },
          },
          // Item 2: Russia percentage markup
          // purchase = 10 000 RUB -> 28% = 2800 RUB > 300 RUB -> markup = 2800 RUB -> sale = 12 800 RUB
          {
            requestedPartNumber: "OEM-RU-PERCENT-02",
            description: "Генератор 120A",
            quantity: 1,
            supplierQuotes: {
              create: {
                supplierId: supplierRu.id,
                purchasePrice: 10000,
                currency: "RUB",
                status: "SELECTED",
                condition: "USED_EXCELLENT",
                deliveryDays: 3,
                deliveryCost: 500,
              },
            },
          },
          // Item 3: Poland min markup 1700 RUB
          // purchase = 2000 RUB -> 55% = 1100 RUB < 1700 RUB -> markup = 1700 RUB -> sale = 3700 RUB
          {
            requestedPartNumber: "OEM-PL-MIN-03",
            description: "Блок управления климатом",
            quantity: 1,
            supplierQuotes: {
              create: {
                supplierId: supplierPl.id,
                purchasePrice: 2000,
                currency: "RUB",
                status: "SELECTED",
                condition: "USED_GOOD",
                deliveryDays: 10,
                deliveryCost: 800,
              },
            },
          },
        ],
      },
    },
  });

  let createdOrderId = "";

  await t.test("1. Convert Request -> Order via POST /api/orders with official financial rules", async () => {
    const res = await postOrder(
      new Request("http://127.0.0.1:3000/api/orders", {
        method: "POST",
        headers: superAdmin.headers,
        body: JSON.stringify({
          requestId: testRequest.id,
          deliveryDetails: {
            carrier: "CDEK",
            city: "Москва",
            address: "ул. Тверская, 10",
            pickupPointId: "MSK-01",
          },
          customerComment: "Позвонить за час",
          internalComment: "Срочный заказ",
        }),
      })
    );

    const text = await res.text();
    if (res.status !== 201) {
      console.log("POST /api/orders failed:", res.status, text);
    }
    assert.equal(res.status, 201);
    const body = JSON.parse(text);
    assert.equal(body.success, true);
    assert.ok(body.order);
    createdOrderId = body.order.id;

    const order = body.order;
    assert.ok(order.orderNumber.startsWith("ORD-2026-"));
    assert.equal(order.requestId, testRequest.id);
    assert.equal(order.status, "NEW");
    assert.equal(order.paymentStatus, "PENDING");
    assert.equal(order.deliveryStatus, "PENDING");

    // Check items count
    assert.equal(order.items.length, 3);

    // Check item 1: RU min markup 300 RUB
    const item1 = order.items.find((i) => i.requestedPartNumber === "OEM-RU-MIN-01");
    assert.ok(item1);
    assert.equal(item1.purchasePrice, "500");
    assert.equal(item1.markup, "300"); // 300 RUB applied min markup
    assert.equal(item1.salePrice, "800");

    // Check item 2: RU percent markup 2800 RUB (28% of 10000)
    const item2 = order.items.find((i) => i.requestedPartNumber === "OEM-RU-PERCENT-02");
    assert.ok(item2);
    assert.equal(item2.purchasePrice, "10000");
    assert.equal(item2.markup, "2800");
    assert.equal(item2.salePrice, "12800");

    // Check item 3: Poland min markup 1700 RUB (since 55% of 2000 is 1100 < 1700)
    const item3 = order.items.find((i) => i.requestedPartNumber === "OEM-PL-MIN-03");
    assert.ok(item3);
    assert.equal(item3.purchasePrice, "2000");
    assert.equal(item3.markup, "1700");
    assert.equal(item3.salePrice, "3700");

    // Subtotal: 800 + 12800 + 3700 = 17300 RUB
    assert.equal(order.subtotal, "17300");

    // Logistics: 200 + 500 + 800 = 1500 RUB
    assert.equal(order.logisticsTotal, "1500");

    // Grand total: 17300 + 1500 = 18800 RUB
    assert.equal(order.grandTotal, "18800");

    // Initial shipment created
    assert.equal(order.shipments.length, 1);
    assert.equal(order.shipments[0].carrier, "CDEK");
    assert.equal(order.shipments[0].city, "Москва");

    // Initial document (INVOICE) created
    assert.equal(order.documents.length, 1);
    assert.equal(order.documents[0].documentType, "INVOICE");

    // Request is now CONFIRMED
    const updatedReq = await prisma.request.findUnique({ where: { id: testRequest.id } });
    assert.equal(updatedReq.status, "CONFIRMED");
    assert.equal(updatedReq.customerResponseStatus, "ACCEPTED");
  });

  await t.test("2. Idempotency: Duplicate creation request returns existing order", async () => {
    const res = await postOrder(
      new Request("http://127.0.0.1:3000/api/orders", {
        method: "POST",
        headers: manager.headers,
        body: JSON.stringify({ requestId: testRequest.id }),
      })
    );

    const text = await res.text();
    if (res.status !== 201) {
      console.log("POST /api/orders failed:", res.status, text);
    }
    assert.equal(res.status, 201);
    const body = JSON.parse(text);
    assert.equal(body.order.id, createdOrderId);
  });

  await t.test("3. RBAC data isolation: LOGISTICS role gets sanitized DTO", async () => {
    // 3.1 Manager sees operational & retail data, but NOT purchase costs or markups
    const resManager = await getOrderById(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}`, {
        headers: manager.headers,
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );
    assert.equal(resManager.status, 200);
    const managerOrder = (await resManager.json()).order;
    assert.equal(managerOrder.items[0].purchasePrice, undefined);
    assert.equal(managerOrder.items[0].markup, undefined);
    assert.equal(managerOrder.items[0].grossProfit, undefined);
    assert.equal(managerOrder.items[0].salePrice, "800");
    assert.ok(managerOrder.internalComment);

    // 3.1b SUPER_ADMIN sees full confidential financial data
    const resAdmin = await getOrderById(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}`, {
        headers: superAdmin.headers,
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );
    assert.equal(resAdmin.status, 200);
    const adminOrder = (await resAdmin.json()).order;
    assert.ok(adminOrder.items[0].purchasePrice);
    assert.ok(adminOrder.items[0].markup);
    assert.ok(adminOrder.items[0].grossProfit);

    // 3.2 Logistics cannot see purchase data, markups, or internal comments
    const resLogistics = await getOrderById(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}`, {
        headers: logistics.headers,
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );
    assert.equal(resLogistics.status, 200);
    const logOrder = (await resLogistics.json()).order;
    assert.equal(logOrder.items[0].purchasePrice, undefined);
    assert.equal(logOrder.items[0].markup, undefined);
    assert.equal(logOrder.items[0].grossProfit, undefined);
    assert.equal(logOrder.items[0].financialSnapshot, undefined);
    assert.equal(logOrder.internalComment, null);

    // But logistics CAN see shipment details
    assert.ok(logOrder.shipments.length > 0);
    assert.equal(logOrder.shipments[0].carrier, "CDEK");
  });

  await t.test("4. Payment processing: Partial and Full payments", async () => {
    // 4.1 Record partial payment: 5000 RUB
    const resPartial = await postPayment(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}/payments`, {
        method: "POST",
        headers: manager.headers,
        body: JSON.stringify({
          amount: 5000,
          paymentMethod: "BANK_TRANSFER",
          notes: "Аванс 5 000 руб.",
        }),
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );

    assert.equal(resPartial.status, 201);
    const partialOrder = (await resPartial.json()).order;
    assert.equal(partialOrder.paymentStatus, "PARTIALLY_PAID");
    assert.equal(partialOrder.payments.length, 1);
    assert.equal(partialOrder.payments[0].amount, "5000");

    // 4.2 Record remaining payment: 13800 RUB (Total is 18800)
    const resFull = await postPayment(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}/payments`, {
        method: "POST",
        headers: manager.headers,
        body: JSON.stringify({
          amount: 13800,
          paymentMethod: "CARD_ONLINE",
          notes: "Окончательный расчёт 13 800 руб.",
        }),
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );

    assert.equal(resFull.status, 201);
    const fullOrder = (await resFull.json()).order;
    assert.equal(fullOrder.paymentStatus, "PAID");
    assert.equal(fullOrder.status, "PAID"); // Automatically advanced to PAID!
    assert.equal(fullOrder.payments.length, 2);
  });

  await t.test("5. Shipment management: Logistics enters tracking and marks IN_TRANSIT", async () => {
    const resShipment = await patchShipment(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}/shipment`, {
        method: "PATCH",
        headers: logistics.headers,
        body: JSON.stringify({
          carrier: "CDEK",
          trackingNumber: "CDEK-TEST-998877",
          status: "IN_TRANSIT",
          estimatedDays: 2,
        }),
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );

    assert.equal(resShipment.status, 200);
    const updatedOrder = (await resShipment.json()).order;
    assert.equal(updatedOrder.deliveryStatus, "IN_TRANSIT");
    assert.equal(updatedOrder.status, "SHIPPED"); // Status advances to SHIPPED
    assert.equal(updatedOrder.shipments[0].trackingNumber, "CDEK-TEST-998877");
  });

  await t.test("6. Documents & Communications", async () => {
    // 6.1 Add WAYBILL document
    const resDoc = await postDocument(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}/documents`, {
        method: "POST",
        headers: manager.headers,
        body: JSON.stringify({
          documentType: "WAYBILL",
          documentNumber: "ТН-TEST-001",
          contentJson: { note: "Товарная накладная" },
        }),
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );
    assert.equal(resDoc.status, 201);
    const orderWithDoc = (await resDoc.json()).order;
    assert.equal(orderWithDoc.documents.length, 2);

    // 6.2 Add internal message
    const resMsg = await postMessage(
      new Request(`http://127.0.0.1:3000/api/orders/${createdOrderId}/messages`, {
        method: "POST",
        headers: manager.headers,
        body: JSON.stringify({
          message: "Посылка передана курьеру CDEK.",
          isInternal: true,
        }),
      }),
      { params: Promise.resolve({ id: createdOrderId }) }
    );
    assert.equal(resMsg.status, 201);
    const orderWithMsg = (await resMsg.json()).order;
    assert.ok(orderWithMsg.messages.some((m) => m.message.includes("курьеру CDEK")));
  });

  await t.test("7. Query orders list and queue counts", async () => {
    const resList = await getOrders(
      new Request("http://127.0.0.1:3000/api/orders?page=1&pageSize=10", {
        headers: manager.headers,
      })
    );
    assert.equal(resList.status, 200);
    const listBody = await resList.json();
    assert.ok(Array.isArray(listBody.orders));
    assert.ok(listBody.orders.length > 0);
    assert.ok(listBody.queues);
    assert.ok(typeof listBody.queues.all === "number");
  });
});
