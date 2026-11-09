import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./auth.ts";
import { GET as getRequests, POST as postRequest } from "../../app/api/requests/route.ts";
import { GET as getRequestById, PATCH as patchRequestById } from "../../app/api/requests/[id]/route.ts";
import { POST as postItem } from "../../app/api/requests/[id]/items/route.ts";
import { PATCH as patchItem } from "../../app/api/requests/[id]/items/[itemId]/route.ts";
import { POST as postQuote } from "../../app/api/requests/[id]/quotes/route.ts";
import { PATCH as patchQuote } from "../../app/api/requests/[id]/quotes/[quoteId]/route.ts";
import { POST as postOffer } from "../../app/api/requests/[id]/customer-offer/route.ts";
import { PATCH as patchCustomerResponse } from "../../app/api/requests/[id]/customer-response/route.ts";
import { GET as getTasks, POST as postTask } from "../../app/api/tasks/route.ts";
import { PATCH as patchTask } from "../../app/api/tasks/[id]/route.ts";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("Integration test requires DATABASE_URL from the local .env");
const databaseUrl = new URL(configuredUrl);
if (!["127.0.0.1", "localhost"].includes(databaseUrl.hostname) || databaseUrl.pathname !== "/zaptut_dev") {
  throw new Error("Refusing integration tests outside the dedicated local zaptut_dev database");
}

const prisma = new PrismaClient();

async function createStaffSession(role) {
  const token = randomUUID();
  const email = `req-test-${token}@example.test`;
  const password = `Test-Pass-${token}-123!`;
  const ip = `198.51.100.${20 + (Number.parseInt(token.slice(0, 2), 16) % 200)}`;

  const user = await prisma.user.create({
    data: { name: `Staff ${role} ${token.slice(0, 6)}`, email, role, active: true },
    select: { id: true },
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
  assert.ok(cookie, "Auth session cookie must be present");
  return { userId: user.id, cookie, email };
}

test("Requests API: Security & RBAC access control", async () => {
  const superAdmin = await createStaffSession("SUPER_ADMIN");
  const logistics = await createStaffSession("LOGISTICS");

  // 1. Unauthenticated request -> 401
  const unauthRes = await getRequests(new Request("http://127.0.0.1:3000/api/requests"));
  assert.equal(unauthRes.status, 401);

  // 2. LOGISTICS -> 403 Forbidden
  const logisticsRes = await getRequests(
    new Request("http://127.0.0.1:3000/api/requests", {
      headers: { cookie: logistics.cookie },
    }),
  );
  assert.equal(logisticsRes.status, 403);

  // 3. SUPER_ADMIN -> 200 OK
  const adminRes = await getRequests(
    new Request("http://127.0.0.1:3000/api/requests", {
      headers: { cookie: superAdmin.cookie },
    }),
  );
  assert.equal(adminRes.status, 200);
});

test("Requests API: Batch migration from demo data is idempotent and preserves links", async () => {
  const superAdmin = await createStaffSession("SUPER_ADMIN");

  const testNumber = `ZP-TEST-${Date.now()}`;
  const testCustomer = "Демо: Тестовый Клиент";
  const testPhone = "+7 999 000-11-22";
  const testEmail = `test-buyer-${Date.now()}@example.test`;

  const demoPayload = {
    action: "migrate",
    requests: [
      {
        id: testNumber,
        customer: testCustomer,
        phone: testPhone,
        email: testEmail,
        make: "Toyota",
        model: "Camry",
        year: "2022",
        vin: "TEST-VIN-CAMRY-2022",
        manager: "Анна Смирнова",
        status: "WAITING_SUPPLIERS",
        priority: "Высокий",
        comment: "Нужен передний бампер",
        internalNote: "Срочный заказ",
        created: "08.11.2026 12:00",
        items: [
          {
            id: `it-${testNumber}-1`,
            name: "Бампер передний",
            oem: "52119-06975",
            qty: 1,
            note: "В цвет",
          },
        ],
        events: [
          { at: "08.11.2026 12:00", text: "Заявка создана через демо", who: "Система" },
        ],
      },
    ],
    quotes: [
      {
        id: `qt-${testNumber}-1`,
        itemId: `it-${testNumber}-1`,
        supplierId: "sup-ru-01",
        article: "52119-06975-OEM",
        maker: "Toyota OEM",
        condition: "Новая",
        cost: "25000.00",
        currency: "RUB",
        availability: "1 шт.",
        deliveryDays: 3,
        shipping: "1500.00",
        status: "RECEIVED",
      },
    ],
    tasks: [
      {
        id: `task-${testNumber}-1`,
        title: "Согласовать цвет с клиентом",
        description: "Уточнить код краски",
        requestId: testNumber,
        dueAt: "2026-11-09T15:00:00+03:00",
        priority: "Высокий",
        done: false,
      },
    ],
  };

  // Run migration 1st time
  const migrateRes1 = await postRequest(
    new Request("http://127.0.0.1:3000/api/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: superAdmin.cookie,
      },
      body: JSON.stringify(demoPayload),
    }),
  );
  assert.equal(migrateRes1.status, 200);
  const data1 = await migrateRes1.json();
  assert.equal(data1.migratedCount, 1);
  assert.ok(data1.idMap[testNumber]);

  // Run migration 2nd time (idempotency check)
  const migrateRes2 = await postRequest(
    new Request("http://127.0.0.1:3000/api/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: superAdmin.cookie,
      },
      body: JSON.stringify(demoPayload),
    }),
  );
  assert.equal(migrateRes2.status, 200);

  // Fetch full card by request number
  const cardRes = await getRequestById(
    new Request(`http://127.0.0.1:3000/api/requests/${testNumber}`, {
      headers: { cookie: superAdmin.cookie },
    }),
    { params: Promise.resolve({ id: testNumber }) },
  );
  assert.equal(cardRes.status, 200);
  const card = await cardRes.json();

  assert.equal(card.request.number, testNumber);
  assert.equal(card.request.customer, testCustomer);
  assert.equal(card.request.make, "Toyota");
  assert.equal(card.request.vin, "TEST-VIN-CAMRY-2022");
  assert.equal(card.request.items.length, 1);
  assert.equal(card.quotes.length, 1);
  assert.equal(card.quotes[0].article, "52119-06975-OEM");
  assert.equal(card.tasks.length, 1);
  assert.equal(card.tasks[0].title, "Согласовать цвет с клиентом");
  assert.equal(card.request.events.length, 1);
});

test("Requests API: Full lifecycle (Items, Quotes, Selection, Customer Offer, Buyer Response)", async () => {
  const superAdmin = await createStaffSession("SUPER_ADMIN");

  // 1. Create a customer to link
  const customer = await prisma.customer.create({
    data: {
      name: "Покупатель Lifecycle",
      phone: "+7 999 555-44-33",
      normalizedPhone: "79995554433",
      email: "buyer-lifecycle@example.test",
      normalizedEmail: "buyer-lifecycle@example.test",
    },
  });

  const reqNumber = `ZP-LIFE-${Date.now()}`;

  // 2. Create request
  const createRes = await postRequest(
    new Request("http://127.0.0.1:3000/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({
        number: reqNumber,
        customerId: customer.id,
        items: [{ description: "Фара левая", requestedPartNumber: "92101-C1000", quantity: 1 }],
      }),
    }),
  );
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()).request;
  assert.equal(created.number, reqNumber);
  assert.equal(created.items.length, 1);
  const firstItemId = created.items[0].id;

  // 3. Add second item
  const addItemRes = await postItem(
    new Request(`http://127.0.0.1:3000/api/requests/${reqNumber}/items`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({ description: "Фара правая", requestedPartNumber: "92102-C1000", quantity: 1 }),
    }),
    { params: Promise.resolve({ id: reqNumber }) },
  );
  assert.equal(addItemRes.status, 201);

  // 4. Update status: NEW -> ASSIGNED
  const updateStatusRes = await patchRequestById(
    new Request(`http://127.0.0.1:3000/api/requests/${reqNumber}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({ status: "ASSIGNED", priority: "Высокий" }),
    }),
    { params: Promise.resolve({ id: reqNumber }) },
  );
  assert.equal(updateStatusRes.status, 200);

  // 5. Add quote for first item
  const supplier = (await prisma.supplier.findFirst()) || { id: "a0000000-0000-0000-0000-000000000001" };
  const addQuoteRes = await postQuote(
    new Request(`http://127.0.0.1:3000/api/requests/${reqNumber}/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({
        requestItemId: firstItemId,
        supplierId: supplier.id,
        partNumber: "92101-C1000-OEM",
        purchasePrice: 18000,
        currency: "RUB",
        deliveryDays: 4,
        shippingBasis: "ORDER",
      }),
    }),
    { params: Promise.resolve({ id: reqNumber }) },
  );
  assert.equal(addQuoteRes.status, 201);
  const quote = (await addQuoteRes.json()).quote;

  // 6. Select quote
  const selectQuoteRes = await patchQuote(
    new Request(`http://127.0.0.1:3000/api/requests/${reqNumber}/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({ action: "select" }),
    }),
    { params: Promise.resolve({ id: reqNumber, quoteId: quote.id }) },
  );
  assert.equal(selectQuoteRes.status, 200);
  assert.equal((await selectQuoteRes.json()).quote.status, "SELECTED");

  // 7. Save customer offer snapshot
  const saveOfferRes = await postOffer(
    new Request(`http://127.0.0.1:3000/api/requests/${reqNumber}/customer-offer`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({
        comment: "Оригинальная фара в наличии",
        sharedLogisticsRub: "500.00",
        status: "FORMED",
        snapshot: {
          version: 1,
          totalRubMinor: "2450000",
          lines: [{ itemId: firstItemId, name: "Фара левая", totalRubMinor: "2450000" }],
        },
      }),
    }),
    { params: Promise.resolve({ id: reqNumber }) },
  );
  assert.equal(saveOfferRes.status, 200);

  // 8. Update customer response
  const responseRes = await patchCustomerResponse(
    new Request(`http://127.0.0.1:3000/api/requests/${reqNumber}/customer-response`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({ responseStatus: "ACCEPTED" }),
    }),
    { params: Promise.resolve({ id: reqNumber }) },
  );
  assert.equal(responseRes.status, 200);
  assert.equal((await responseRes.json()).responseStatus, "ACCEPTED");

  // 9. Create and toggle manager task
  const createTaskRes = await postTask(
    new Request("http://127.0.0.1:3000/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: superAdmin.cookie },
      body: JSON.stringify({
        title: "Запросить предоплату",
        requestId: reqNumber,
        priority: "Высокий",
        dueAt: new Date().toISOString(),
      }),
    }),
  );
  assert.equal(createTaskRes.status, 201);
  const task = (await createTaskRes.json()).task;

  const toggleTaskRes = await patchTask(
    new Request(`http://127.0.0.1:3000/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { cookie: superAdmin.cookie },
    }),
    { params: Promise.resolve({ id: task.id }) },
  );
  assert.equal(toggleTaskRes.status, 200);
  assert.equal((await toggleTaskRes.json()).task.done, true);
});
