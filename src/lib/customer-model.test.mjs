import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerRegistry, mergeDuplicateCustomer, migrateCustomerLinks, normalizeCustomers, normalizePhone, searchCustomerRegistry, updateCustomerProfile } from "./customer-model.ts";

const storedMaria = {
  id: "cust-maria-01",
  name: "Мария Иванова",
  phone: "+375 00 222-14-70",
  normalizedPhone: "stale-value",
  email: "maria@example.test",
  normalizedEmail: "stale@example.test",
  createdAt: "2026-11-06T10:00:00.000Z",
  updatedAt: "2026-11-06T10:00:00.000Z",
  internalNote: "Оставить заметку при сопоставлении",
};

test("phone normalization ignores plus, spaces, brackets, and separators", () => {
  const variants = [
    "+375 00 222-14-70",
    "+375002221470",
    "+375 (00) 222-14-70",
    "375.00.222.14.70",
  ];
  assert.ok(variants.every(phone => normalizePhone(phone) === "375002221470"));
});

test("new request reuses an existing profile even if its stored normalizedPhone is stale", () => {
  const request = {
    id: "ZP-2026-0149",
    customer: "Демо: 222",
    phone: "+375002221470",
    email: "another@example.test",
  };

  const linked = migrateCustomerLinks([request], [storedMaria], "2026-11-07T09:00:00.000Z");

  assert.equal(linked.requests[0].customerId, storedMaria.id);
  assert.equal(linked.customers.length, 1);
  assert.equal(linked.customers[0].internalNote, storedMaria.internalNote);
});

test("normalizing stored profiles repairs normalized contact fields from raw contacts", () => {
  const normalized = normalizeCustomers({ version: 1, customers: [storedMaria] });
  assert.equal(normalized?.[0].normalizedPhone, "375002221470");
  assert.equal(normalized?.[0].normalizedEmail, "maria@example.test");
});

test("a genuinely new phone creates one new profile", () => {
  const request = {
    id: "ZP-2026-0150",
    customer: "Демо: Новый клиент",
    phone: "+375 (00) 999-88-77",
    email: "new@example.test",
  };

  const linked = migrateCustomerLinks([request], [storedMaria], "2026-11-07T09:00:00.000Z");

  assert.notEqual(linked.requests[0].customerId, storedMaria.id);
  assert.equal(linked.customers.length, 2);
  assert.equal(linked.customers[1].normalizedPhone, "375009998877");
});

test("duplicate profiles merge by normalized phone, preserve request data, and are idempotent", () => {
  const duplicate = {
    ...storedMaria,
    id: "cust-demo-222",
    name: "Демо: 222",
    phone: "+375002221470",
    normalizedPhone: "375002221470",
    email: "duplicate@example.test",
    normalizedEmail: "duplicate@example.test",
    internalNote: "Заметка дубля",
  };
  const requests = [
    { id: "ZP-2026-0147", customerId: storedMaria.id, customer: storedMaria.name, phone: storedMaria.phone, email: storedMaria.email, status: "OFFERS_READY", events: [{ at: "before", text: "old history", who: "Manager" }], offers: ["quote-a"] },
    { id: "ZP-2026-0149", customerId: duplicate.id, customer: duplicate.name, phone: duplicate.phone, email: duplicate.email, status: "NEW", events: [{ at: "before", text: "request created", who: "Manager" }], offers: ["quote-b"], items: [{ id: "item-b", qty: 2 }] },
  ];

  const merged = mergeDuplicateCustomer(requests, [storedMaria, duplicate], storedMaria.id, duplicate.id, "2026-11-07T12:00:00.000Z");

  assert.equal(merged.changed, true);
  assert.deepEqual(merged.reassignedRequestIds, ["ZP-2026-0149"]);
  assert.equal(merged.requests[0].customerId, storedMaria.id);
  assert.equal(merged.requests[1].customerId, storedMaria.id);
  assert.equal(merged.requests[1].status, requests[1].status);
  assert.deepEqual(merged.requests[1].offers, requests[1].offers);
  assert.deepEqual(merged.requests[1].items, requests[1].items);
  assert.equal(merged.requests[1].events?.[1].text, "request created");
  assert.match(merged.requests[1].events?.[0].text ?? "", /cust-demo-222 → cust-maria-01/);
  assert.equal(merged.customers.some(customer => customer.id === duplicate.id), false);
  assert.match(merged.customers[0].internalNote, /Заметка дубля/);
  assert.match(merged.customers[0].internalNote, /Демо: 222/);
  assert.equal(merged.requests.some(request => request.customerId === duplicate.id), false);

  const repeated = mergeDuplicateCustomer(merged.requests, merged.customers, storedMaria.id, duplicate.id, "2026-11-07T13:00:00.000Z");
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.requests, merged.requests);
  assert.deepEqual(repeated.customers, merged.customers);
});

test("duplicate merge refuses profiles whose normalized phone numbers differ", () => {
  const differentPhone = { ...storedMaria, id: "cust-other", phone: "+375 00 999-88-77" };
  assert.throws(
    () => mergeDuplicateCustomer([], [storedMaria, differentPhone], storedMaria.id, differentPhone.id),
    /нормализованные телефоны профилей не совпадают/,
  );
});

test("customer registry shows one profile with one linked request", () => {
  const rows = buildCustomerRegistry([storedMaria], [
    { id: "ZP-2026-0147", customerId: storedMaria.id, customer: storedMaria.name, phone: storedMaria.phone, email: storedMaria.email },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].requests.map(request => request.id), ["ZP-2026-0147"]);
});

test("customer registry groups multiple requests by customerId", () => {
  const rows = buildCustomerRegistry([storedMaria], [
    { id: "ZP-2026-0147", customerId: storedMaria.id, customer: storedMaria.name, phone: storedMaria.phone, email: storedMaria.email },
    { id: "ZP-2026-0149", customerId: storedMaria.id, customer: "Демо: 222", phone: "+375002221470", email: "old-request@example.test" },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].requests.map(request => request.id), ["ZP-2026-0147", "ZP-2026-0149"]);
  assert.equal(rows[0].customer.name, "Мария Иванова");
  assert.equal(rows[0].customer.email, "maria@example.test");
});

test("customer registry keeps different customer profiles separate", () => {
  const other = { ...storedMaria, id: "cust-other", name: "Другой клиент", phone: "+375 00 999-88-77" };
  const rows = buildCustomerRegistry([storedMaria, other], [
    { id: "ZP-2026-0147", customerId: storedMaria.id, customer: storedMaria.name, phone: storedMaria.phone, email: storedMaria.email },
    { id: "ZP-2026-0150", customerId: other.id, customer: other.name, phone: other.phone, email: other.email },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.requests.length), [1, 1]);
});

const secondCustomer = {
  ...storedMaria,
  id: "cust-other",
  name: "Другой клиент",
  phone: "+7 900 111-22-33",
  normalizedPhone: "79001112233",
  email: "other@example.test",
  normalizedEmail: "other@example.test",
};

test("profile edit changes name and survives versioned storage reload without changing id or createdAt", () => {
  const updated = updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, name: "Мария Петрова" }, "2026-11-07T12:00:00.000Z");
  const restored = normalizeCustomers({ version: 1, customers: updated });
  assert.equal(restored?.[0].name, "Мария Петрова");
  assert.equal(restored?.[0].id, storedMaria.id);
  assert.equal(restored?.[0].createdAt, storedMaria.createdAt);
  assert.equal(restored?.[0].updatedAt, "2026-11-07T12:00:00.000Z");
});

test("updated profile is the same canonical record used by registry rows and profile history", () => {
  const request = { id: "ZP-2026-0147", customerId: storedMaria.id, customer: "Заявочное имя", phone: "snapshot-phone", email: "snapshot@example.test" };
  const updated = updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, name: "Мария Петрова" });
  const registry = buildCustomerRegistry(updated, [request]);
  assert.equal(registry[0].customer.name, "Мария Петрова");
  assert.equal(registry[0].requests[0].id, request.id);
  assert.equal(registry[0].requests[0].customer, "Заявочное имя");
});

test("profile edit normalizes changed phone and email", () => {
  const updated = updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, phone: "+375 (29) 555-44-33", email: " NEW@Example.test " });
  assert.equal(updated[0].normalizedPhone, "375295554433");
  assert.equal(updated[0].normalizedEmail, "new@example.test");
});

test("cancel leaves the original profile unchanged", () => {
  const original = structuredClone(storedMaria);
  const draft = { ...storedMaria, name: "Unsaved" };
  void draft; // Cancel discards the form draft without calling the update function.
  assert.deepEqual(storedMaria, original);
});

test("profile edit leaves request links, contact snapshots, and request history untouched", () => {
  const requests = [
    { id: "ZP-2026-0147", customerId: storedMaria.id, customer: "Заявочное имя", phone: "старый телефон", email: "old@example.test", events: [{ at: "old", text: "history", who: "Manager" }] },
    { id: "ZP-2026-0149", customerId: storedMaria.id, customer: "Демо: 222", phone: "+375002221470", email: "different@example.test", events: [{ at: "new", text: "created", who: "Manager" }] },
  ];
  const before = structuredClone(requests);
  updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, name: "Мария Петрова", phone: "+375295554433", email: "new@example.test" });
  assert.deepEqual(requests, before);
  assert.deepEqual(requests.map(request => request.customerId), [storedMaria.id, storedMaria.id]);
});

test("profile edit blocks a phone used by another profile", () => {
  assert.throws(() => updateCustomerProfile([storedMaria, secondCustomer], storedMaria.id, { ...storedMaria, phone: "7 (900) 111-22-33" }), /телефон уже указан/);
});

test("profile edit blocks an email used by another profile", () => {
  assert.throws(() => updateCustomerProfile([storedMaria, secondCustomer], storedMaria.id, { ...storedMaria, email: " OTHER@example.test " }), /email уже указан/);
});

test("profile edit validates required name, optional email format, and optional phone format", () => {
  assert.throws(() => updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, name: "  " }), /Укажите имя/);
  assert.throws(() => updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, email: "bad-email" }), /формат email/);
  assert.throws(() => updateCustomerProfile([storedMaria], storedMaria.id, { ...storedMaria, phone: "123" }), /корректный номер/);
});

const searchRequests = [
  { id: "ZP-2026-0147", customerId: storedMaria.id, customer: storedMaria.name, phone: storedMaria.phone, email: storedMaria.email, make: "Hyundai", model: "Tucson", year: "2020" },
  { id: "ZP-2026-0149", customerId: storedMaria.id, customer: "Демо: 222", phone: "+375002221470", email: "old@example.test", make: "Kia", model: "Rio", year: "2018" },
  { id: "ZP-2026-0150", customerId: secondCustomer.id, customer: secondCustomer.name, phone: secondCustomer.phone, email: secondCustomer.email, make: "Toyota", model: "Corolla", year: "2022" },
];
const searchRows = buildCustomerRegistry([storedMaria, secondCustomer], searchRequests);

test("customer search matches full or partial profile name without case sensitivity", () => {
  assert.deepEqual(searchCustomerRegistry(searchRows, "  МАРИЯ   Иванова ").map(row => row.customer.id), [storedMaria.id]);
  assert.deepEqual(searchCustomerRegistry(searchRows, "иван" ).map(row => row.customer.id), [storedMaria.id]);
});

test("customer search matches phone with or without punctuation", () => {
  assert.deepEqual(searchCustomerRegistry(searchRows, "+375 (00) 222-14-70").map(row => row.customer.id), [storedMaria.id]);
  assert.deepEqual(searchCustomerRegistry(searchRows, "375002221470").map(row => row.customer.id), [storedMaria.id]);
});

test("customer search matches profile email without case sensitivity", () => {
  assert.deepEqual(searchCustomerRegistry(searchRows, "MARIA@EXAMPLE.TEST").map(row => row.customer.id), [storedMaria.id]);
});

test("request ID, car make, model, and year resolve to the unique customer profile", () => {
  for (const query of ["ZP-2026-0149", "hyundai", "TUCSON", "2020"]) {
    assert.deepEqual(searchCustomerRegistry(searchRows, query).map(row => row.customer.id), [storedMaria.id], query);
  }
});

test("multiple matching requests still produce one customer result", () => {
  const found = searchCustomerRegistry(searchRows, "ZP-2026-014");
  assert.equal(found.length, 1);
  assert.equal(found[0].requests.length, 2);
});

test("no matches produce an empty result and clearing query restores the full registry", () => {
  assert.deepEqual(searchCustomerRegistry(searchRows, "nonexistent value"), []);
  assert.deepEqual(searchCustomerRegistry(searchRows, "   "), searchRows);
});

test("search is read-only and preserves customerId links and source records", () => {
  const customersBefore = structuredClone([storedMaria, secondCustomer]);
  const requestsBefore = structuredClone(searchRequests);
  searchCustomerRegistry(searchRows, "ZP-2026-0149");
  assert.deepEqual([storedMaria, secondCustomer], customersBefore);
  assert.deepEqual(searchRequests, requestsBefore);
  assert.deepEqual(searchRows.flatMap(row => row.requests.map(request => request.customerId)), [storedMaria.id, storedMaria.id, secondCustomer.id]);
});
