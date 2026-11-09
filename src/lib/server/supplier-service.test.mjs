import test from "node:test";
import assert from "node:assert/strict";
import { createSupplier, createSupplierInquiry, createSupplierQuote, searchSuppliers, updateSupplier, updateSupplierInquiryStatus, updateSupplierQuote } from "./supplier-service.ts";

const supplierId = "11111111-1111-4111-8111-111111111111";
const requestItemId = "22222222-2222-4222-8222-222222222222";
const inquiryId = "33333333-3333-4333-8333-333333333333";
const quoteId = "44444444-4444-4444-8444-444444444444";

function fakeRepository() {
  const events = [];
  const supplier = { id: supplierId, name: "Warsaw Parts", countryCode: "PL", status: "REVIEW", contactName: null, phone: null, email: null, specialization: null, terms: null, internalNote: null };
  const inquiry = { id: inquiryId, requestItemId, supplierId, status: "DRAFT", requestId: "55555555-5555-4555-8555-555555555555" };
  let quote = null;
  return {
    events,
    async searchSuppliers(input) { return { suppliers: [supplier], total: 1, input }; },
    async findSupplier(id) { return id === supplierId ? supplier : null; },
    async createSupplier(data) { Object.assign(supplier, data); return supplier; },
    async updateSupplier(id, data) { Object.assign(supplier, data); return supplier; },
    async findRequestItem(id) { return id === requestItemId ? { id, requestId: inquiry.requestId } : null; },
    async findInquiry(id) { return id === inquiryId ? inquiry : null; },
    async findQuote(id) { return id === quoteId ? quote : null; },
    async createInquiry(data) { Object.assign(inquiry, data); return inquiry; },
    async updateInquiry(id, data) { Object.assign(inquiry, data); return inquiry; },
    async createQuote(data) { quote = { id: quoteId, ...data, requestId: inquiry.requestId }; return quote; },
    async updateQuote(id, data) { Object.assign(quote, data); return quote; },
    async recordActivity(entityId, entityType, action, requestId, fields) { events.push({ entityId, entityType, action, requestId, fields }); },
    async transaction(work) { return work(this); },
  };
}

test("supplier create/update validates country and logs status changes", async () => {
  const repository = fakeRepository();
  const created = await createSupplier(repository, { name: " Warsaw Parts ", countryCode: "pl" });
  assert.equal(created.countryCode, "PL");
  await updateSupplier(repository, supplierId, { status: "ACTIVE" });
  assert.deepEqual(repository.events.map(event => event.action), ["SUPPLIER_CREATED", "SUPPLIER_STATUS_CHANGED"]);
  await assert.rejects(createSupplier(repository, { name: "Wrong", countryCode: "US" }), /PL, RU или BY/);
});

test("supplier inquiry and quote statuses remain separate and record request history", async () => {
  const repository = fakeRepository();
  await createSupplierInquiry(repository, { requestItemId, supplierId });
  await updateSupplierInquiryStatus(repository, inquiryId, "SENT");
  assert.equal(repository.events[1].action, "SUPPLIER_INQUIRY_STATUS_CHANGED");
  assert.equal(repository.events[1].requestId, "55555555-5555-4555-8555-555555555555");
});

test("supplier quotes preserve exact decimal strings, currency, and relationship checks", async () => {
  const repository = fakeRepository();
  const quote = await createSupplierQuote(repository, {
    requestItemId, supplierId, inquiryId, purchasePrice: "82.0000", currency: "usd",
    deliveryCost: "18.00", deliveryCurrency: "USD", quantityAvailable: 3, deliveryDays: 8,
  });
  assert.equal(quote.purchasePrice, "82.0000");
  assert.equal(quote.currency, "USD");
  await updateSupplierQuote(repository, quoteId, { status: "DECLINED" });
  assert.equal(quote.purchasePrice, "82.0000", "status update must retain the source price");
  assert.equal(quote.status, "DECLINED");
  await assert.rejects(createSupplierQuote(repository, { requestItemId, supplierId, purchasePrice: "1.00001", currency: "USD" }), /до 4 знаков/);
  await assert.rejects(createSupplierQuote(repository, { requestItemId, supplierId, inquiryId: "66666666-6666-4666-8666-666666666666" }), /соответствует/);
});

test("supplier search passes status, country, pagination and excludes no historical suppliers itself", async () => {
  const repository = fakeRepository();
  const result = await searchSuppliers(repository, "  Warsaw  ", { status: "SUSPENDED", countryCode: "pl", page: 2, pageSize: 200 });
  assert.equal(result.total, 1);
  assert.equal(result.input.skip, 100);
  assert.equal(result.input.take, 100);
});
