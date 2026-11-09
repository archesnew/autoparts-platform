import test from "node:test";
import assert from "node:assert/strict";
import { addRequestItem, createRequest, updateRequest, updateRequestItem } from "./request-service.ts";

const customerId = "11111111-1111-4111-8111-111111111111";
const requestId = "33333333-3333-4333-8333-333333333333";
const itemId = "44444444-4444-4444-8444-444444444444";
const request = { id: requestId, number: "ZP-TEST-1", customerId, status: "NEW", priority: "NORMAL", customerNameSnapshot: "Покупатель", items: [] };

function fakeRepository() {
  const events = [];
  const items = [];
  return {
    events, items,
    async search(input) { return { requests: [], total: 0, input }; },
    async findById(id) { return id === requestId ? request : null; },
    async findCustomerSnapshot(id) { return id === customerId ? { id, name: "Покупатель", phone: null, email: null } : null; },
    async findManager() { return null; },
    async create(data) { Object.assign(request, data, { id: requestId, status: "NEW" }); return request; },
    async update(id, patch) { Object.assign(request, patch); return request; },
    async createItem(reqId, data) { const item = { id: itemId, requestId: reqId, ...data }; items.push(item); return { id: item.id }; },
    async updateItem(reqId, id, patch) { const item = items.find(value => value.id === id && value.requestId === reqId); if (!item) throw new Error("Позиция не найдена"); Object.assign(item, patch); return { id }; },
    async recordActivity(reqId, entityType, entityId, action, fields) { events.push({ reqId, entityType, entityId, action, fields }); },
    async transaction(work) { return work(this); },
  };
}

test("new request requires customer and items and creates internal history", async () => {
  const repository = fakeRepository();
  const result = await createRequest(repository, { customerId, number: " ZP-TEST-1 ", items: [{ description: " Диск ", quantity: 2 }] });
  assert.equal(result.status, "NEW");
  assert.equal(result.customerNameSnapshot, "Покупатель");
  assert.equal(result.items[0].description, "Диск");
  assert.equal(repository.events[0].action, "REQUEST_CREATED");
  await assert.rejects(createRequest(repository, { customerId, number: "ZP-TEST-2", items: [] }), /хотя бы одну/);
});

test("request status transitions are validated and external sent state cannot be forged", async () => {
  const repository = fakeRepository();
  await assert.rejects(updateRequest(repository, requestId, { status: "SENT_TO_CUSTOMER" }), /внешнего канала/);
  const result = await updateRequest(repository, requestId, { status: "ASSIGNED" });
  assert.equal(result.status, "ASSIGNED");
  await assert.rejects(updateRequest(repository, requestId, { status: "COMPLETED" }), /Недопустимый переход/);
  assert.equal(repository.events.length, 1);
});

test("request item updates are scoped to the request and append audit events", async () => {
  const repository = fakeRepository();
  await addRequestItem(repository, requestId, { description: "Колодки", quantity: 1 });
  await updateRequestItem(repository, requestId, itemId, { quantity: 2, requestedPartNumber: "  OEM-1  " });
  assert.equal(repository.items[0].quantity, 2);
  assert.equal(repository.items[0].requestedPartNumber, "OEM-1");
  assert.deepEqual(repository.events.map(event => event.action), ["REQUEST_ITEM_ADDED", "REQUEST_ITEM_UPDATED"]);
  await assert.rejects(updateRequestItem(repository, requestId, "55555555-5555-4555-8555-555555555555", { quantity: 1 }), /не найдена/);
});
