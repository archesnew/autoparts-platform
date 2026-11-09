import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./auth.ts";
import { GET as getCustomers, POST as postCustomer } from "../../app/api/customers/route.ts";
import { GET as getCustomerById, PATCH as patchCustomerById } from "../../app/api/customers/[id]/route.ts";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("Integration test requires DATABASE_URL from the local .env");
const databaseUrl = new URL(configuredUrl);
if (!["127.0.0.1", "localhost"].includes(databaseUrl.hostname) || databaseUrl.pathname !== "/zaptut_dev") {
  throw new Error("Refusing integration tests outside the dedicated local zaptut_dev database");
}

const prisma = new PrismaClient();

// Helper to create a user, session and return cookie
async function createStaffSession(role) {
  const token = randomUUID();
  const email = `api-test-${token}@example.test`;
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

  const setCookies = response.headers.getSetCookie();
  const sessionCookie = setCookies.find((val) => /session_token=/i.test(val));
  if (!sessionCookie) throw new Error("Failed to get session cookie");
  const cookie = sessionCookie.split(";")[0];

  return {
    userId: user.id,
    cookie,
    async cleanup() {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    },
  };
}

test("Customer API: security, RBAC, CRUD, search, normalization, migration and request links", { timeout: 40_000 }, async () => {
  const staffLogistics = await createStaffSession("LOGISTICS");
  const staffManager = await createStaffSession("MANAGER");
  const staffAdmin = await createStaffSession("ADMIN");
  const staffSuperAdmin = await createStaffSession("SUPER_ADMIN");

  const createdCustomerIds = new Set();
  const createdRequestIds = new Set();

  try {
    // 1. Отсутствие сессии -> 401
    const unauthReq = new Request("http://127.0.0.1:3000/api/customers");
    const unauthRes = await getCustomers(unauthReq);
    assert.equal(unauthRes.status, 401);
    const unauthBody = await unauthRes.json();
    assert.equal(unauthBody.error, "unauthorized");

    // 2. Запрещённая роль LOGISTICS -> 403
    const logisticsHeaders = { cookie: staffLogistics.cookie };
    const logisticsListRes = await getCustomers(new Request("http://127.0.0.1:3000/api/customers", { headers: logisticsHeaders }));
    assert.equal(logisticsListRes.status, 403);
    assert.equal((await logisticsListRes.json()).error, "forbidden");

    const logisticsCreateRes = await postCustomer(new Request("http://127.0.0.1:3000/api/customers", {
      method: "POST",
      headers: { ...logisticsHeaders, "content-type": "application/json" },
      body: JSON.stringify({ name: "Forbidden Client" }),
    }));
    assert.equal(logisticsCreateRes.status, 403);

    // 3. Создание клиента с MANAGER (201) и нормализация телефона
    const suffix = randomUUID().slice(0, 8);
    const createReq = new Request("http://127.0.0.1:3000/api/customers", {
      method: "POST",
      headers: { cookie: staffManager.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: `Тестовый Клиент ${suffix}`,
        phone: "+7 (999) 123-45-67",
        email: `client-${suffix}@example.test`,
        internalNote: "Внутренняя заметка менеджера",
      }),
    });
    const createRes = await postCustomer(createReq);
    assert.equal(createRes.status, 201);
    const createBody = await createRes.json();
    assert.ok(createBody.customer);
    const customer = createBody.customer;
    createdCustomerIds.add(customer.id);
    assert.equal(customer.name, `Тестовый Клиент ${suffix}`);
    assert.equal(customer.phone, "+7 (999) 123-45-67");
    assert.equal(customer.normalizedPhone, "79991234567");
    assert.equal(customer.email, `client-${suffix}@example.test`);
    assert.equal(customer.normalizedEmail, `client-${suffix}@example.test`);
    assert.equal(customer.internalNote, "Внутренняя заметка менеджера");

    // 4. Защита от дублей: попытка создать с тем же нормализованным телефоном -> 400
    const duplicateReq = new Request("http://127.0.0.1:3000/api/customers", {
      method: "POST",
      headers: { cookie: staffManager.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Дублирующий Клиент",
        phone: "8 (999) 123-45-67", // тот же нормализованный 79991234567
      }),
    });
    const duplicateRes = await postCustomer(duplicateReq);
    assert.equal(duplicateRes.status, 400);
    const duplicateBody = await duplicateRes.json();
    assert.match(duplicateBody.error, /уже существует/);

    // 5. Получение карточки клиента GET /api/customers/[id]
    const getCardRes = await getCustomerById(
      new Request(`http://127.0.0.1:3000/api/customers/${customer.id}`, { headers: { cookie: staffManager.cookie } }),
      { params: Promise.resolve({ id: customer.id }) },
    );
    assert.equal(getCardRes.status, 200);
    const cardBody = await getCardRes.json();
    assert.equal(cardBody.customer.id, customer.id);
    assert.equal(cardBody.customer.name, customer.name);

    // LOGISTICS не может получить карточку клиента -> 403
    const logisticsCardRes = await getCustomerById(
      new Request(`http://127.0.0.1:3000/api/customers/${customer.id}`, { headers: { cookie: staffLogistics.cookie } }),
      { params: Promise.resolve({ id: customer.id }) },
    );
    assert.equal(logisticsCardRes.status, 403);

    // Некорректный UUID -> 400
    const invalidIdRes = await getCustomerById(
      new Request("http://127.0.0.1:3000/api/customers/invalid-uuid", { headers: { cookie: staffManager.cookie } }),
      { params: Promise.resolve({ id: "invalid-uuid" }) },
    );
    assert.equal(invalidIdRes.status, 400);

    // 6. Редактирование клиента PATCH /api/customers/[id]
    const patchReq = new Request(`http://127.0.0.1:3000/api/customers/${customer.id}`, {
      method: "PATCH",
      headers: { cookie: staffManager.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: `Обновлённый Клиент ${suffix}`,
        phone: "+7 (999) 765-43-21",
        email: `updated-${suffix}@example.test`,
        internalNote: "Обновлённая заметка",
      }),
    });
    const patchRes = await patchCustomerById(patchReq, { params: Promise.resolve({ id: customer.id }) });
    assert.equal(patchRes.status, 200);
    const patchBody = await patchRes.json();
    assert.equal(patchBody.customer.name, `Обновлённый Клиент ${suffix}`);
    assert.equal(patchBody.customer.normalizedPhone, "79997654321");
    assert.equal(patchBody.customer.internalNote, "Обновлённая заметка");

    // 7. Поиск клиентов GET /api/customers?query=...
    const searchRes = await getCustomers(
      new Request(`http://127.0.0.1:3000/api/customers?query=${encodeURIComponent(suffix)}`, { headers: { cookie: staffManager.cookie } }),
    );
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.ok(searchBody.customers.some((c) => c.id === customer.id));
    assert.ok(searchBody.total >= 1);

    // Поиск по телефону без знаков пунктуации
    const phoneSearchRes = await getCustomers(
      new Request("http://127.0.0.1:3000/api/customers?query=79997654321", { headers: { cookie: staffManager.cookie } }),
    );
    assert.equal(phoneSearchRes.status, 200);
    assert.ok((await phoneSearchRes.json()).customers.some((c) => c.id === customer.id));

    // 8. Сохранение связей с заявками
    const requestRecord = await prisma.request.create({
      data: {
        number: `ZP-TEST-CUST-${suffix}`,
        customerId: customer.id,
        status: "NEW",
        items: {
          create: [{ description: "Тестовая деталь", requestedPartNumber: "TEST-OEM", quantity: 1 }],
        },
      },
    });
    createdRequestIds.add(requestRecord.id);

    const cardWithRequestRes = await getCustomerById(
      new Request(`http://127.0.0.1:3000/api/customers/${customer.id}`, { headers: { cookie: staffManager.cookie } }),
      { params: Promise.resolve({ id: customer.id }) },
    );
    const cardWithRequestBody = await cardWithRequestRes.json();
    assert.ok(cardWithRequestBody.customer.requests);
    assert.ok(cardWithRequestBody.customer.requests.some((r) => r.id === requestRecord.id && r.number === requestRecord.number));

    // 9. Перенос данных и повторный импорт (идемпотентность, отсутствие дублей и защита от перезаписи)
    const demoPayload = [
      {
        id: `cust-demo-1-${suffix}`,
        name: `Демо Алексей ${suffix}`,
        phone: `+7 999 111-${suffix.slice(0, 4)}`,
        email: `demo148-${suffix}@example.test`,
        internalNote: "Демо-профиль 148",
      },
      {
        id: `cust-demo-2-${suffix}`,
        name: `Демо Мария ${suffix}`,
        phone: `+375 29 222-${suffix.slice(0, 4)}`,
        email: `demo147-${suffix}@example.test`,
        internalNote: "Демо-профиль 147",
      },
    ];

    const migrateReq1 = new Request("http://127.0.0.1:3000/api/customers", {
      method: "POST",
      headers: { cookie: staffManager.cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "migrate", customers: demoPayload }),
    });
    const migrateRes1 = await postCustomer(migrateReq1);
    assert.equal(migrateRes1.status, 200);
    const migrateBody1 = await migrateRes1.json();
    assert.equal(migrateBody1.success, true);
    assert.ok(migrateBody1.idMap[`cust-demo-1-${suffix}`]);
    assert.ok(migrateBody1.idMap[`cust-demo-2-${suffix}`]);
    const mappedId1 = migrateBody1.idMap[`cust-demo-1-${suffix}`];
    createdCustomerIds.add(mappedId1);
    createdCustomerIds.add(migrateBody1.idMap[`cust-demo-2-${suffix}`]);

    // Обновим на сервере заметку для проверки, что повторный импорт не перезапишет серверные данные
    await patchCustomerById(
      new Request(`http://127.0.0.1:3000/api/customers/${mappedId1}`, {
        method: "PATCH",
        headers: { cookie: staffManager.cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: `Серверный Алексей ${suffix}`, internalNote: "Свежие серверные данные" }),
      }),
      { params: Promise.resolve({ id: mappedId1 }) },
    );

    // Повторный импорт тех же демо-данных
    const migrateReq2 = new Request("http://127.0.0.1:3000/api/customers", {
      method: "POST",
      headers: { cookie: staffManager.cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "migrate", customers: demoPayload }),
    });
    const migrateRes2 = await postCustomer(migrateReq2);
    assert.equal(migrateRes2.status, 200);
    const migrateBody2 = await migrateRes2.json();
    assert.equal(migrateBody2.idMap[`cust-demo-1-${suffix}`], mappedId1);

    // Проверяем, что серверные данные не перезаписались старыми демо-данными
    const verifyServerDataRes = await getCustomerById(
      new Request(`http://127.0.0.1:3000/api/customers/${mappedId1}`, { headers: { cookie: staffManager.cookie } }),
      { params: Promise.resolve({ id: mappedId1 }) },
    );
    const verifyServerDataBody = await verifyServerDataRes.json();
    assert.equal(verifyServerDataBody.customer.name, `Серверный Алексей ${suffix}`);
    assert.equal(verifyServerDataBody.customer.internalNote, "Свежие серверные данные");

    // 10. Проверка доступа для ролей ADMIN и SUPER_ADMIN
    const adminRes = await getCustomers(new Request("http://127.0.0.1:3000/api/customers", { headers: { cookie: staffAdmin.cookie } }));
    assert.equal(adminRes.status, 200);

    const superAdminRes = await getCustomers(new Request("http://127.0.0.1:3000/api/customers", { headers: { cookie: staffSuperAdmin.cookie } }));
    assert.equal(superAdminRes.status, 200);
  } finally {
    // Cleanup created test records
    for (const reqId of createdRequestIds) {
      await prisma.requestItem.deleteMany({ where: { requestId: reqId } });
      await prisma.request.delete({ where: { id: reqId } }).catch(() => {});
    }
    for (const custId of createdCustomerIds) {
      await prisma.activityLog.deleteMany({ where: { entityId: custId } });
      await prisma.customer.delete({ where: { id: custId } }).catch(() => {});
    }
    await staffLogistics.cleanup();
    await staffManager.cleanup();
    await staffAdmin.cleanup();
    await staffSuperAdmin.cleanup();
    await prisma.$disconnect();
  }
});
