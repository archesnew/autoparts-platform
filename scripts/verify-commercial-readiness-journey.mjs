import { PrismaClient } from "@prisma/client";
import { notificationService } from "../src/lib/server/notification-service.js";
import { orderService } from "../src/lib/server/order-service.js";
import { catalogService } from "../src/lib/server/catalog-service.js";
import { analyzeSearchQuery, scoreProductRelevance } from "../src/lib/server/catalog-search-normalizer.js";

const prisma = new PrismaClient();

async function runEndToEndCommercialVerification() {
  console.log("================================================================================");
  console.log("🚀 ZAPTUT.PRO — END-TO-END COMMERCIAL LAUNCH READINESS VERIFICATION");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // STEP 1-4: Search & Catalog Normalization & Priority Ranking
    // -------------------------------------------------------------------------
    console.log("\n[STEP 1-4] Testing Search Normalization, Priority Ranking & Filters...");

    // Test A: Normalization of Cyrillic lookalike letters & symbols
    const searchA = analyzeSearchQuery("51712-С1А00"); // Contains Russian Cyrillic 'С' and 'А'
    assert(
      searchA.queryVariants.includes("51712C1A00"),
      "Normalized Cyrillic lookalikes to Latin alphanumeric variant '51712C1A00'"
    );

    // Test B: Brand transliteration
    const searchB = analyzeSearchQuery("диски киа спортейдж");
    assert(searchB.brandHints.includes("Kia"), "Detected brand alias 'киа' -> 'Kia'");
    assert(searchB.categoryHints.includes("Тормозная система"), "Detected category 'диски' -> 'Тормозная система'");

    // Test C: Search ranking in Catalog Service
    const searchResult = await catalogService.searchPublic({
      query: "51712-C1A00",
      take: 10,
    });
    assert(searchResult.items.length > 0, `Search returned ${searchResult.items.length} items for OEM 51712-C1A00`);
    assert(
      searchResult.items[0].primaryOem === "51712-C1A00",
      `Priority 1 verified: Exact OEM match ranked FIRST (${searchResult.items[0].canonicalName})`
    );

    // Test D: Security - Verify public DTO does NOT leak purchase prices
    const firstOffer = searchResult.items[0].offers[0];
    assert(firstOffer && typeof firstOffer.publicPrice === "number", "Public price is present and calculated");
    assert(!("purchasePrice" in firstOffer), "No purchasePrice exposed in PublicOfferDto");
    assert(!("supplierId" in firstOffer), "No internal supplierId exposed in PublicOfferDto");

    // -------------------------------------------------------------------------
    // STEP 5-8: Customer Intake & Request Creation
    // -------------------------------------------------------------------------
    console.log("\n[STEP 5-8] Testing Customer Request Creation & Notification Flow...");

    // Find or create test customer
    let customer = await prisma.customer.findFirst({
      where: { phone: "+7 (999) 000-20-26" },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: "Коммерческий Покупатель Тест",
          phone: "+7 (999) 000-20-26",
          normalizedPhone: "+79990002026",
          email: "buyer-test@zaptut.pro",
          normalizedEmail: "buyer-test@zaptut.pro",
        },
      });
    }

    const testReqNumber = `ZP-COMM-${Date.now().toString().slice(-4)}`;
    const newRequest = await prisma.request.create({
      data: {
        number: testReqNumber,
        customerId: customer.id,
        vehicleMake: "Kia",
        vehicleModel: "Sportage",
        vehicleYear: "2022",
        vin: "KNMBB8133N0199999",
        status: "NEW",
        comment: "Сквозной тест коммерческого запуска ZAPTUT.PRO",
        items: {
          create: [
            {
              name: "Диск тормозной передний",
              oem: "51712-C1A00",
              qty: 2,
              note: "Срочно, оригинальное качество",
            },
          ],
        },
      },
    });

    // Trigger notification
    await notificationService.notifyRequestCreated(newRequest.id, customer.id, newRequest.number);

    const custNotifications = await notificationService.getCustomerNotifications(customer.id);
    const reqNotification = custNotifications.find((n) => n.entityId === newRequest.id);
    assert(Boolean(reqNotification), "Customer received REQUEST_CREATED notification in Notification Center");
    assert(reqNotification?.type === "REQUEST_CREATED", "Notification type matches REQUEST_CREATED");

    // -------------------------------------------------------------------------
    // STEP 9-13: Manager Forms Offer & Customer Accepts -> Order Created
    // -------------------------------------------------------------------------
    console.log("\n[STEP 9-13] Testing Offer Formation, Acceptance & Automatic Order Creation...");

    const offer = await prisma.customerOffer.create({
      data: {
        requestId: newRequest.id,
        version: 1,
        status: "SENT",
        totalRetailRub: 13880,
        sharedLogisticsRub: 650,
        managerComment: "Оригинальные диски с европейского склада. Доставка СДЭК 3 дня.",
        items: {
          create: [
            {
              name: "Диск тормозной передний, вентилируемый NORTHLINE",
              oem: "51712-C1A00",
              qty: 2,
              customerPriceRub: 6940,
              condition: "NEW",
              deliveryDays: 3,
            },
          ],
        },
      },
    });

    await notificationService.notifyOfferReady(offer.id, customer.id, newRequest.number, newRequest.id);

    // Customer accepts offer
    const orderCreated = await orderService.createOrderFromRequest({
      requestId: newRequest.id,
      customerComment: "Оплачу переводом, доставка в пункт выдачи",
    });

    assert(Boolean(orderCreated && orderCreated.orderNumber), `Order created successfully: №${orderCreated?.orderNumber}`);
    assert(orderCreated?.status === "NEW", `Order initial status is NEW`);
    assert(orderCreated?.paymentStatus === "PENDING", `Order initial paymentStatus is PENDING`);

    await notificationService.notifyOfferAccepted(orderCreated.id, customer.id, orderCreated.orderNumber);

    // -------------------------------------------------------------------------
    // STEP 14-17: Payment Instructions, Customer Report & Manager Confirmation
    // -------------------------------------------------------------------------
    console.log("\n[STEP 14-17] Testing Payment Flow (Customer Report -> Manager Confirmation)...");

    // 1. Manager dispatches payment instruction
    await notificationService.notifyPaymentInstruction(orderCreated.id, customer.id, orderCreated.orderNumber, Number(orderCreated.grandTotal));

    // 2. Customer reports payment
    await prisma.activityLog.create({
      data: {
        entityType: "ORDER",
        entityId: orderCreated.id,
        orderId: orderCreated.id,
        action: "Покупатель сообщил об отправке платежа: Оплачено через СБП 15:40 / Иванов И.И.",
      },
    });
    await notificationService.notifyPaymentSubmitted(orderCreated.id, orderCreated.orderNumber);

    const staffNotifications = await prisma.notification.findMany({
      where: { recipientType: "STAFF", type: "PAYMENT_SUBMITTED" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    assert(staffNotifications.length > 0, "Staff received PAYMENT_SUBMITTED notification in CRM");

    // 3. Manager confirms payment (ONLY staff can set PAID!)
    const superAdmin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    const paidOrder = await orderService.recordPayment(
      orderCreated.id,
      {
        amount: Number(orderCreated.grandTotal),
        paymentMethod: "BANK_TRANSFER_SBP",
        notes: "Платёж зачислен, выписка банка сверена",
      },
      superAdmin ? { userId: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name, permissions: ["admin.access"] } : null
    );

    assert(paidOrder.paymentStatus === "PAID", "Order paymentStatus is now confirmed as PAID");

    // -------------------------------------------------------------------------
    // STEP 18-20: Dispatch & Shipment Tracking Assignment
    // -------------------------------------------------------------------------
    console.log("\n[STEP 18-20] Testing Delivery Dispatch & Tracking Assignment...");

    const shippedOrder = await orderService.updateShipment(
      orderCreated.id,
      {
        carrier: "СДЭК",
        trackingNumber: "1492026881",
        status: "IN_TRANSIT",
        city: "Москва",
        address: "ул. Ленина 10",
      },
      superAdmin ? { userId: superAdmin.id, email: superAdmin.email, role: superAdmin.role, name: superAdmin.name, permissions: ["admin.access"] } : null
    );

    assert(shippedOrder.deliveryStatus === "IN_TRANSIT", "Shipment deliveryStatus is IN_TRANSIT");
    assert(shippedOrder.status === "SHIPPED", "Order status escalated to SHIPPED");
    assert(shippedOrder.shipments[0]?.trackingNumber === "1492026881", "Tracking number 1492026881 assigned to shipment");

    const trackingNotifications = await prisma.notification.findMany({
      where: { recipientType: "CUSTOMER", customerId: customer.id, type: "SHIPMENT_DISPATCHED" },
    });
    assert(trackingNotifications.length > 0, "Customer received SHIPMENT_DISPATCHED notification with tracking number");

    // -------------------------------------------------------------------------
    // STEP 21-22: Security & Persistence Validation
    // -------------------------------------------------------------------------
    console.log("\n[STEP 21-22] Testing Security Isolation & Persistence...");

    const partner = await prisma.user.findFirst({ where: { role: "DEMO_VIEWER" } });
    assert(Boolean(partner), "DEMO_VIEWER account verified");

    // Verify database reload
    const reloaded = await prisma.order.findUnique({
      where: { id: orderCreated.id },
      include: { payments: true, shipments: true },
    });
    assert(reloaded !== null, "Order reloaded cleanly from PostgreSQL");
    assert(reloaded?.paymentStatus === "PAID", "Payment persistence verified");
    assert(reloaded?.shipments[0]?.trackingNumber === "1492026881", "Shipment persistence verified");

    console.log("\n================================================================================");
    console.log(`🎉 ALL CHECKS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Verification failed with exception:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runEndToEndCommercialVerification();
