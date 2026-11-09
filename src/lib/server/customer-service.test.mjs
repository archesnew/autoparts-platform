import test from "node:test";
import assert from "node:assert/strict";
import { createCustomer, getCustomer, searchCustomers, updateCustomer } from "./customer-service.ts";
import { normalizeEmail, normalizePhone } from "../customer-model.ts";

const customerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const makeCustomer = (overrides = {}) => ({
  id: customerId, name: "Мария Иванова", phone: "+375 00 222-14-70", normalizedPhone: "375002221470",
  email: "maria@example.test", normalizedEmail: "maria@example.test", internalNote: null,
  createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), ...overrides,
});

function fakeRepository(initial = []) {
  const customers = [...initial];
  const events = [];
  return {
    customers, events,
    async search(input) {
      const query = input.query.toLocaleLowerCase("ru-RU");
      const found = customers.filter(customer => !query || customer.name.toLocaleLowerCase("ru-RU").includes(query) ||
        customer.normalizedPhone?.includes(input.normalizedPhone) || customer.normalizedEmail?.includes(input.normalizedEmail));
      return { customers: found.slice(input.skip, input.skip + input.take), total: found.length };
    },
    async findById(id) { return customers.find(customer => customer.id === id) ?? null; },
    async findByNormalizedContacts(phone, email, excludeId) {
      return customers.filter(customer => customer.id !== excludeId &&
        ((phone && (customer.normalizedPhone || normalizePhone(customer.phone ?? "")) === phone) ||
         (email && (customer.normalizedEmail || normalizeEmail(customer.email ?? "")) === email)));
    },
    async create(data) {
      const customer = { ...data, id: otherId, createdAt: new Date(), updatedAt: new Date() };
      customers.push(customer);
      return customer;
    },
    async update(id, data) {
      const index = customers.findIndex(customer => customer.id === id);
      customers[index] = { ...customers[index], ...data, updatedAt: new Date() };
      return customers[index];
    },
    async recordActivity(id, action, fields) { events.push({ id, action, fields }); },
    async transaction(work) { return work(this); },
  };
}

test("customer service normalizes and persists contact fields and emits a minimal audit event", async () => {
  const repository = fakeRepository();
  const customer = await createCustomer(repository, { name: " Новый клиент ", phone: "+7 (900) 111-22-33", email: " NEW@EXAMPLE.TEST " });
  assert.equal(customer.normalizedPhone, "79001112233");
  assert.equal(customer.normalizedEmail, "new@example.test");
  assert.deepEqual(repository.events[0].fields, ["profile"]);
});

test("customer duplicate contact is rejected across phone formats", async () => {
  const repository = fakeRepository([makeCustomer()]);
  await assert.rejects(createCustomer(repository, { name: "Мария 2", phone: "375002221470" }), /уже существует/);
  assert.equal(repository.customers.length, 1);
});

test("customer profile update preserves identity and records changed fields", async () => {
  const original = makeCustomer();
  const repository = fakeRepository([original]);
  const updated = await updateCustomer(repository, customerId, { name: "Мария И.", phone: "+375 (29) 555-44-33", email: "MARIA2@example.test" });
  assert.equal(updated.id, customerId);
  assert.equal(updated.createdAt, original.createdAt);
  assert.equal(updated.normalizedPhone, "375295554433");
  assert.equal(updated.normalizedEmail, "maria2@example.test");
  assert.deepEqual(repository.events[0].fields.sort(), ["email", "name", "normalizedEmail", "normalizedPhone", "phone"]);
});

test("customer lookup validates UUID and search normalizes query and clamps page size", async () => {
  const repository = fakeRepository([makeCustomer()]);
  assert.equal((await getCustomer(repository, customerId)).id, customerId);
  await assert.rejects(getCustomer(repository, "not-an-id"), /Некорректный ID/);
  const result = await searchCustomers(repository, "  +375 00 222-14-70  ", 0, 1000);
  assert.equal(result.total, 1);
});
