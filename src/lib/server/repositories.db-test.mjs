import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("Integration test requires DATABASE_URL from the local .env");
const databaseUrl = new URL(configuredUrl);
if (!(["127.0.0.1", "localhost"].includes(databaseUrl.hostname)) || databaseUrl.pathname !== "/zaptut_dev") {
  throw new Error("Refusing integration tests outside the dedicated local zaptut_dev database");
}

const [{ prisma }, { customerRepository }, { createCustomer, getCustomer, searchCustomers, updateCustomer },
  { requestRepository }, { addRequestItem, createRequest, getRequest, listRequests, updateRequest },
  { supplierRepository }, { createSupplier, createSupplierInquiry, createSupplierQuote, searchSuppliers, updateSupplier, updateSupplierInquiryStatus, updateSupplierQuote }] = await Promise.all([
  import("@/lib/server/db"), import("@/lib/server/customer-repository"), import("@/lib/server/customer-service"),
  import("@/lib/server/request-repository"), import("@/lib/server/request-service"),
  import("@/lib/server/supplier-repository"), import("@/lib/server/supplier-service"),
]);

test("real Prisma repositories persist CRM records and clean up only their own test graph", async () => {
  const token = randomUUID();
  const ownedIds = new Set();
  let requestId = null;
  let supplierId = null;
  let customerId = null;
  let inquiryId = null;
  let quoteId = null;

  try {
    const customer = await createCustomer(customerRepository, {
      name: `Integration Customer ${token.slice(0, 8)}`,
      email: `integration-${token}@example.invalid`,
      internalNote: "test-owned record",
    });
    customerId = customer.id;
    ownedIds.add(customerId);

    const customerSearch = await searchCustomers(customerRepository, customer.email ?? "");
    assert.equal(customerSearch.total, 1);
    assert.equal((await getCustomer(customerRepository, customerId)).id, customerId);
    const updatedCustomer = await updateCustomer(customerRepository, customerId, {
      name: `${customer.name} updated`, email: customer.email, internalNote: "updated by integration test",
    });
    assert.equal(updatedCustomer.id, customerId);
    assert.equal(updatedCustomer.createdAt.toISOString(), customer.createdAt.toISOString());

    const supplier = await createSupplier(supplierRepository, {
      name: `Integration Supplier ${token.slice(0, 8)}`, countryCode: "PL", status: "REVIEW",
      internalNote: "test-owned record",
    });
    supplierId = supplier.id;
    ownedIds.add(supplierId);
    await updateSupplier(supplierRepository, supplierId, { status: "ACTIVE" });
    assert.equal((await searchSuppliers(supplierRepository, supplier.name)).total, 1);

    const request = await createRequest(requestRepository, {
      customerId,
      number: `ZP-TEST-${token}`,
      items: [{ description: "Integration test brake pad", requestedPartNumber: "TEST-OEM-01", quantity: 2 }],
    });
    requestId = request.id;
    ownedIds.add(requestId);
    const requestItemId = request.items[0].id;
    ownedIds.add(requestItemId);

    const foundRequests = await listRequests(requestRepository, request.number);
    assert.equal(foundRequests.total, 1);
    assert.equal((await getRequest(requestRepository, requestId)).items.length, 1);
    await updateRequest(requestRepository, requestId, { status: "ASSIGNED", internalNote: "integration test" });
    const addedItem = await addRequestItem(requestRepository, requestId, { description: "Second integration part", quantity: 1 });
    ownedIds.add(addedItem.id);

    const inquiry = await createSupplierInquiry(supplierRepository, { requestItemId, supplierId });
    inquiryId = inquiry.id;
    ownedIds.add(inquiryId);
    await updateSupplierInquiryStatus(supplierRepository, inquiryId, "SENT");

    const quote = await createSupplierQuote(supplierRepository, {
      requestItemId, supplierId, inquiryId, partNumber: "TEST-OEM-01", purchasePrice: "12.3400", currency: "USD",
      deliveryCost: "3.25", deliveryCurrency: "USD", quantityAvailable: 4, deliveryDays: 6,
    });
    quoteId = quote.id;
    ownedIds.add(quoteId);
    await updateSupplierQuote(supplierRepository, quoteId, { status: "DECLINED" });

    const persistedQuote = await prisma.supplierQuote.findUnique({ where: { id: quoteId } });
    assert.equal(persistedQuote?.purchasePrice?.toString(), "12.34");
    assert.equal(persistedQuote?.status, "DECLINED");
    const persistedRequest = await prisma.request.findUnique({ where: { id: requestId }, include: { activityEvents: true } });
    assert.ok(persistedRequest?.activityEvents.some(event => event.action === "REQUEST_CREATED"));
    assert.ok(persistedRequest?.activityEvents.some(event => event.action === "SUPPLIER_QUOTE_UPDATED"));
  } finally {
    const ids = [...ownedIds];
    if (ids.length) await prisma.activityLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, ...(requestId ? [{ requestId }] : [])] } });
    if (quoteId) await prisma.supplierQuote.deleteMany({ where: { id: quoteId } });
    if (inquiryId) await prisma.supplierInquiry.deleteMany({ where: { id: inquiryId } });
    if (requestId) await prisma.request.deleteMany({ where: { id: requestId } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { id: supplierId } });
    if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } });
  }
});

test.after(async () => prisma.$disconnect());
