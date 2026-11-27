import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./db.ts";
import { customerPortalService } from "./customer-portal-service.ts";
import { auth } from "./auth.ts";
import { sha256Hex, clearRateLimitBuckets } from "./security/rate-limiter.ts";

test("Customer Portal: End-to-end integration test with PostgreSQL", async (t) => {
  const timestamp = Date.now();
  const emailA = `cust-a-${timestamp}@test.example`;
  const emailB = `cust-b-${timestamp}@test.example`;
  const phoneA = `+7 999 ${timestamp.toString().slice(-7)}`;
  const phoneB = `+7 998 ${timestamp.toString().slice(-7)}`;
  const passwordA = "SecretPass123!A";
  const passwordB = "SecretPass123!B";

  let userA, customerA;
  let userB, customerB;
  let vehicleA1Id, addressA1Id;
  let requestIdA, orderIdA;

  // Cleanup helper
  t.after(async () => {
    try {
      if (orderIdA) {
        await prisma.orderMessage.deleteMany({ where: { orderId: orderIdA } });
        await prisma.orderDocument.deleteMany({ where: { orderId: orderIdA } });
        await prisma.shipment.deleteMany({ where: { orderId: orderIdA } });
        await prisma.orderItem.deleteMany({ where: { orderId: orderIdA } });
        await prisma.order.deleteMany({ where: { id: orderIdA } });
      }
      if (requestIdA) {
        await prisma.activityLog.deleteMany({ where: { entityId: requestIdA } });
        await prisma.customerOffer.deleteMany({ where: { requestId: requestIdA } });
        await prisma.requestItem.deleteMany({ where: { requestId: requestIdA } });
        await prisma.request.deleteMany({ where: { id: requestIdA } });
      }
      if (customerA?.id) {
        await prisma.customerVehicle.deleteMany({ where: { customerId: customerA.id } });
        await prisma.customerAddress.deleteMany({ where: { customerId: customerA.id } });
      }
      if (customerB?.id) {
        await prisma.customerVehicle.deleteMany({ where: { customerId: customerB.id } });
        await prisma.customerAddress.deleteMany({ where: { customerId: customerB.id } });
      }
      if (userA?.id) {
        await prisma.account.deleteMany({ where: { userId: userA.id } });
        await prisma.session.deleteMany({ where: { userId: userA.id } });
        await prisma.user.delete({ where: { id: userA.id } });
      }
      if (userB?.id) {
        await prisma.account.deleteMany({ where: { userId: userB.id } });
        await prisma.session.deleteMany({ where: { userId: userB.id } });
        await prisma.user.delete({ where: { id: userB.id } });
      }
      if (customerA?.id) {
        await prisma.customer.delete({ where: { id: customerA.id } });
      }
      if (customerB?.id) {
        await prisma.customer.delete({ where: { id: customerB.id } });
      }
      await prisma.verification.deleteMany({
        where: { identifier: `pwd_reset:${emailA}` },
      });
      await clearRateLimitBuckets("pwd_reset:");
    } catch (e) {
      // Best-effort cleanup
    }
  });

  await t.test("1. Registration & Account Creation", async () => {
    // 1.1 Register Customer A
    const resA = await customerPortalService.register({
      name: "Иван Петров",
      email: emailA,
      phone: phoneA,
      password: passwordA,
    });

    assert.ok(resA.user.id);
    assert.equal(resA.user.email, emailA);
    assert.ok(resA.customer.id);
    assert.equal(resA.customer.name, "Иван Петров");
    userA = resA.user;
    customerA = resA.customer;

    // 1.2 Register Customer B
    const resB = await customerPortalService.register({
      name: "Сергей Смирнов",
      email: emailB,
      phone: phoneB,
      password: passwordB,
    });
    userB = resB.user;
    customerB = resB.customer;

    // 1.3 Duplicate registration throws 409
    await assert.rejects(
      customerPortalService.register({
        name: "Иван Клон",
        email: emailA,
        password: "OtherPassword123!",
      }),
      (err) => err.status === 409
    );
  });

  await t.test("2. Better Auth Session & Role Isolation", async () => {
    // Customer can sign in via Better Auth
    const signInRes = await auth.api.signInEmail({
      body: { email: emailA, password: passwordA },
      asResponse: true,
    });
    assert.equal(signInRes.status, 200);

    const userInDb = await prisma.user.findUnique({
      where: { id: userA.id },
      select: { role: true, active: true },
    });
    assert.equal(userInDb.role, "CUSTOMER");
  });

  await t.test("3. Password Reset Workflow (no token leak + hashed single-use token)", async () => {
    await clearRateLimitBuckets("pwd_reset:");
    const forgotRes = await customerPortalService.requestPasswordReset(emailA, "127.0.0.10");
    assert.equal(forgotRes.success, true);
    assert.equal("token" in forgotRes, false, "Public API must NEVER return reset token");
    assert.equal("resetUrl" in forgotRes, false, "Public API must NEVER return resetUrl");

    const unknownRes = await customerPortalService.requestPasswordReset(
      `unknown-${timestamp}@test.example`,
      "127.0.0.10"
    );
    assert.deepEqual(forgotRes, unknownRes, "Response must be identical regardless of account existence");

    // Simulate out-of-band server-side token issuance & verify single-use hashed redemption
    const rawToken = randomBytes(32).toString("hex");
    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: `pwd_reset:${emailA}`,
        value: sha256Hex(`${emailA}:${rawToken}`),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const newPass = "NewSecretPass456!";
    const resetRes = await customerPortalService.resetPassword({
      email: emailA,
      token: rawToken,
      newPassword: newPass,
    });
    assert.equal(resetRes.success, true);

    // Token must be single-use
    await assert.rejects(
      () => customerPortalService.resetPassword({ email: emailA, token: rawToken, newPassword: "AnotherPass456!" }),
      /Недействительный|истёкший/
    );

    // Verify customer can sign in with new password
    const signInRes = await auth.api.signInEmail({
      body: { email: emailA, password: newPass },
      asResponse: true,
    });
    assert.equal(signInRes.status, 200);
  });

  await t.test("4. Garage (Vehicles) & Isolation", async () => {
    // 4.1 Customer A adds a car
    const carA1 = await customerPortalService.createVehicle(customerA.id, {
      make: "Toyota",
      model: "Camry",
      generation: "XV70",
      year: 2021,
      vin: "JTMBF3HK00000001",
      engine: "2.5 A25A-FKS",
      isDefault: true,
    });
    assert.ok(carA1.id);
    assert.equal(carA1.isDefault, true);
    vehicleA1Id = carA1.id;

    // 4.2 Customer A adds a second car
    const carA2 = await customerPortalService.createVehicle(customerA.id, {
      make: "BMW",
      model: "X5",
      year: 2020,
      vin: "WBA0000000000002",
      isDefault: true,
    });
    assert.ok(carA2.id);

    // Default was reassigned
    const listA = await customerPortalService.listVehicles(customerA.id);
    assert.equal(listA.length, 2);
    assert.equal(listA[0].id, carA2.id); // Default is first

    // 4.3 Isolation check: Customer B cannot see Customer A's cars
    const listB = await customerPortalService.listVehicles(customerB.id);
    assert.equal(listB.length, 0);

    // 4.4 Isolation check: Customer B cannot update or delete Customer A's car
    await assert.rejects(
      customerPortalService.updateVehicle(customerB.id, vehicleA1Id, { make: "Hacked" }),
      (err) => err.status === 404
    );

    await assert.rejects(
      customerPortalService.deleteVehicle(customerB.id, vehicleA1Id),
      (err) => err.status === 404
    );
  });

  await t.test("5. Address Book & Isolation", async () => {
    // 5.1 Customer A adds delivery address
    const addrA1 = await customerPortalService.createAddress(customerA.id, {
      recipientName: "Иван Петров",
      phone: "+7 999 111-22-33",
      country: "Россия",
      city: "Москва",
      street: "ул. Ленина",
      house: "10",
      apartment: "45",
      isDefault: true,
    });
    assert.ok(addrA1.id);
    addressA1Id = addrA1.id;

    // 5.2 Isolation check: Customer B cannot see Customer A's addresses
    const listB = await customerPortalService.listAddresses(customerB.id);
    assert.equal(listB.length, 0);

    // 5.3 Isolation check: Customer B cannot update Customer A's address
    await assert.rejects(
      customerPortalService.updateAddress(customerB.id, addressA1Id, { city: "Hacked" }),
      (err) => err.status === 404
    );
  });

  await t.test("6. Customer Requests & Strict Isolation", async () => {
    // 6.1 Customer A creates a request using saved car
    const reqA = await customerPortalService.createRequest(customerA.id, {
      vehicleId: vehicleA1Id,
      customerComment: "Нужны качественные передние тормоза",
      items: [
        {
          description: "Тормозные колодки передние",
          requestedPartNumber: "58101-A6A00",
          quantity: 1,
          conditionPreference: "Новая",
        },
        {
          description: "Тормозной диск вентилируемый",
          requestedPartNumber: "51712-C1A00",
          quantity: 2,
          conditionPreference: "Новая",
        },
      ],
    });

    assert.ok(reqA.id);
    assert.ok(reqA.number.startsWith("ZP-2026-"));
    assert.equal(reqA.vehicleMake, "Toyota");
    assert.equal(reqA.vehicleModel, "Camry");
    assert.equal(reqA.items.length, 2);
    requestIdA = reqA.id;

    // 6.2 Customer A lists requests
    const listA = await customerPortalService.listRequests(customerA.id);
    assert.equal(listA.length, 1);
    assert.equal(listA[0].id, requestIdA);

    // 6.3 Isolation check: Customer B cannot see Customer A's requests
    const listB = await customerPortalService.listRequests(customerB.id);
    assert.equal(listB.length, 0);

    // 6.4 Isolation check: Customer B cannot get Customer A's request by ID or Number
    await assert.rejects(
      customerPortalService.getRequestById(customerB.id, requestIdA),
      (err) => err.status === 404
    );
    await assert.rejects(
      customerPortalService.getRequestById(customerB.id, reqA.number),
      (err) => err.status === 404
    );
  });

  await t.test("7. Customer Offer & Response (Accept / Reject)", async () => {
    // 7.1 Simulate manager preparing customer offer in PostgreSQL
    const formedOffer = await prisma.customerOffer.create({
      data: {
        requestId: requestIdA,
        version: 1,
        sharedLogisticsRub: "500",
        snapshot: {
          version: 1,
          formedAt: new Date().toISOString(),
          comment: "Доставка до Москвы 3 дня.",
          totalRubMinor: "1540000",
          lines: [
            {
              itemId: "item-1",
              name: "Тормозные колодки передние",
              quantity: 1,
              condition: "Новая",
              deliveryDays: 3,
              totalRubMinor: "440000",
            },
            {
              itemId: "item-2",
              name: "Тормозной диск вентилируемый",
              quantity: 2,
              condition: "Новая",
              deliveryDays: 3,
              totalRubMinor: "1100000",
            },
          ],
          // Internal finance lines that MUST be stripped from customer
          financeLines: [
            {
              purchaseMinor: "250000",
              markupBasisPoints: 2800,
              grossProfitRubMinor: "190000",
            },
          ],
        },
      },
    });

    await prisma.request.update({
      where: { id: requestIdA },
      data: {
        customerOfferStatus: "SENT",
      },
    });

    // 7.2 Customer A retrieves request and checks offer sanitization
    const reqWithOffer = await customerPortalService.getRequestById(customerA.id, requestIdA);
    assert.ok(reqWithOffer.customerOffer);
    assert.equal(reqWithOffer.customerOffer.version, 1);
    assert.equal(reqWithOffer.customerOffer.lines.length, 2);
    // Verified: No financeLines, purchase prices or margins in customer DTO!
    assert.equal(reqWithOffer.customerOffer.financeLines, undefined);

    // 7.3 Customer A accepts the offer
    const acceptRes = await customerPortalService.respondToOffer(
      customerA.id,
      requestIdA,
      "ACCEPTED"
    );
    assert.equal(acceptRes.status, "CONFIRMED");
    assert.equal(acceptRes.responseStatus, "ACCEPTED");

    // Verify DB request status updated to CONFIRMED
    const updatedReq = await prisma.request.findUnique({
      where: { id: requestIdA },
      select: { status: true, customerResponseStatus: true },
    });
    assert.equal(updatedReq.status, "CONFIRMED");
    assert.equal(updatedReq.customerResponseStatus, "ACCEPTED");
  });

  await t.test("8. Order Visibility & Isolation", async () => {
    // 8.1 Create an order for Customer A
    const orderA = await prisma.order.create({
      data: {
        orderNumber: `ORD-2026-TEST-${timestamp.toString().slice(-4)}`,
        customerId: customerA.id,
        requestId: requestIdA,
        status: "IN_FULFILLMENT",
        paymentStatus: "PAID",
        deliveryStatus: "IN_TRANSIT",
        subtotal: 14900,
        logisticsTotal: 500,
        grandTotal: 15400,
        currency: "RUB",
        items: {
          create: [
            {
              requestedPartNumber: "58101-A6A00",
              nameOnPurchase: "Тормозные колодки передние",
              quantity: 1,
              salePrice: 4400,
              totalAmount: 4400,
              purchasePrice: 2500, // Should be hidden from customer
              markup: 1900, // Should be hidden
              grossProfit: 1900, // Should be hidden
            },
          ],
        },
        shipments: {
          create: [
            {
              carrier: "CDEK",
              trackingNumber: "TRK-987654321",
              status: "IN_TRANSIT",
              city: "Москва",
              address: "ул. Ленина, 10-45",
            },
          ],
        },
        documents: {
          create: [
            {
              documentType: "INVOICE",
              documentNumber: "INV-2026-001",
              fileUrl: "https://example.test/inv-001.pdf",
            },
          ],
        },
        messages: {
          create: [
            {
              senderType: "STAFF",
              isInternal: false,
              authorName: "Менеджер Анна",
              message: "Ваш заказ передан курьеру СДЭК.",
            },
            {
              senderType: "STAFF",
              isInternal: true, // INTERNAL NOTE
              authorName: "Менеджер Анна",
              message: "Внутренняя заметка: клиент просил скидку на следующий заказ.",
            },
          ],
        },
      },
    });
    orderIdA = orderA.id;

    // 8.2 Customer A lists orders
    const ordersA = await customerPortalService.listOrders(customerA.id);
    assert.equal(ordersA.length, 1);
    assert.equal(ordersA[0].id, orderIdA);
    assert.equal(ordersA[0].trackingNumber, "TRK-987654321");
    assert.equal(ordersA[0].carrier, "CDEK");

    // 8.3 Customer A gets order details
    const orderDetails = await customerPortalService.getOrderById(customerA.id, orderIdA);
    assert.equal(orderDetails.items.length, 1);
    assert.equal(orderDetails.items[0].salePrice, "4400");
    // Verify purchase and profit are strictly omitted
    assert.equal(orderDetails.items[0].purchasePrice, undefined);
    assert.equal(orderDetails.items[0].markup, undefined);
    assert.equal(orderDetails.items[0].grossProfit, undefined);

    // Verify messages: only 1 public message, internal note is stripped!
    assert.equal(orderDetails.messages.length, 1);
    assert.equal(orderDetails.messages[0].message, "Ваш заказ передан курьеру СДЭК.");

    // 8.4 Isolation check: Customer B cannot see Customer A's order
    const ordersB = await customerPortalService.listOrders(customerB.id);
    assert.equal(ordersB.length, 0);

    await assert.rejects(
      customerPortalService.getOrderById(customerB.id, orderIdA),
      (err) => err.status === 404
    );

    // 8.5 Customer can send a message
    const msg = await customerPortalService.sendOrderMessage(
      customerA.id,
      orderIdA,
      "Спасибо, ожидаю курьера!"
    );
    assert.equal(msg.senderType, "CUSTOMER");
    assert.equal(msg.isInternal, false);
  });
});
