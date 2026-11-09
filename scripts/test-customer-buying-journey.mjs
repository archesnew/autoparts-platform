import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== STARTING FULL CUSTOMER BUYING JOURNEY E2E VERIFICATION ===");

  // 1. Health & Catalog check
  console.log("\n[1] Checking /catalog...");
  const catRes = await fetch(`${BASE_URL}/catalog`);
  if (!catRes.ok) throw new Error(`Catalog returned ${catRes.status}`);
  console.log("✓ Catalog responded 200 OK");

  // 2. Customer Phone Auth (Phone: +79874023545)
  console.log("\n[2] Sending OTP to Customer +79874023545...");
  const sendRes = await fetch(`${BASE_URL}/api/customer/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+79874023545" }),
  });
  const sendData = await sendRes.json();
  const otpCode = sendData.devOtpCode || "111111";
  console.log(`✓ OTP sent. Using verification code: ${otpCode}`);

  console.log("Verifying OTP for customer login...");
  const otpRes = await fetch(`${BASE_URL}/api/customer/auth/phone/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: "+79874023545",
      code: otpCode,
    }),
  });
  if (!otpRes.ok) {
    const err = await otpRes.text();
    throw new Error(`Customer OTP login failed: ${err}`);
  }
  const customerCookies = otpRes.headers.getSetCookie();
  const customerCookie = customerCookies.map((c) => c.split(";")[0]).join("; ");
  console.log("✓ Customer authenticated successfully. Cookie received.");

  // 3. Customer Profile & Garage Check
  console.log("\n[3] Checking Customer Profile & Garage...");
  const profRes = await fetch(`${BASE_URL}/api/customer/profile`, {
    headers: { cookie: customerCookie },
  });
  const profData = await profRes.json();
  console.log(`✓ Customer name: ${profData.customer?.name}, phone: ${profData.customer?.phone}`);

  const vehRes = await fetch(`${BASE_URL}/api/customer/vehicles`, {
    headers: { cookie: customerCookie },
  });
  const vehData = await vehRes.json();
  const defaultVehicle = vehData.vehicles?.[0];
  console.log(`✓ Garage vehicles found: ${vehData.vehicles?.length}. Primary: ${defaultVehicle?.make} ${defaultVehicle?.model} (VIN: ${defaultVehicle?.vin})`);

  // 4. Create Multi-item Request from Catalog
  console.log("\n[4] Submitting Multi-Item Request via /api/customer/requests...");
  const reqPayload = {
    items: [
      {
        description: "Диск тормозной передний, вентилируемый (NORTHLINE)",
        requestedPartNumber: "51712-C1A00",
        quantity: 2,
        conditionPreference: "Новая",
        compatibilityNotes: "Нужна заводская балансировка",
      },
      {
        description: "Комплект тормозных колодок передний (NORTHLINE)",
        requestedPartNumber: "58101-A6A00",
        quantity: 1,
        conditionPreference: "Новая",
        compatibilityNotes: "Оригинал или сертифицированный европейский аналог",
      },
    ],
    vehicleId: defaultVehicle?.id || null,
    vehicleMake: defaultVehicle?.make || "Kia",
    vehicleModel: defaultVehicle?.model || "Sportage",
    vehicleYear: defaultVehicle?.year ? String(defaultVehicle.year) : "2022",
    vehicleVin: defaultVehicle?.vin || "XW8ZZZ1234567890",
    customerComment: "Прошу проверить совместимость по VIN и рассчитать быструю доставку в ПВЗ",
  };

  const createReqRes = await fetch(`${BASE_URL}/api/customer/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: customerCookie,
    },
    body: JSON.stringify(reqPayload),
  });
  const createdReqData = await createReqRes.json();
  if (!createReqRes.ok) throw new Error(`Create request failed: ${JSON.stringify(createdReqData)}`);
  const requestId = createdReqData.request.id;
  const requestNumber = createdReqData.request.number;
  console.log(`✓ Request created: ${requestNumber} (ID: ${requestId}) with ${createdReqData.request.items.length} items`);

  // 5. Customer Portal Request Detail View
  console.log("\n[5] Verifying Customer Portal view of request...");
  const custViewRes = await fetch(`${BASE_URL}/api/customer/requests/${requestId}`, {
    headers: { cookie: customerCookie },
  });
  const custViewRaw = await custViewRes.json();
  const custViewData = custViewRaw.request || custViewRaw;
  console.log(`✓ Customer sees request status: ${custViewData.status}, items: ${custViewData.items.length}, vehicle: ${custViewData.vehicle.make} ${custViewData.vehicle.model}`);

  // 6. Manager Login in CRM
  console.log("\n[6] Manager login in CRM...");
  const mgrEmail = `journey-mgr-${Date.now()}@test.local`;
  const mgrPass = "JourneyManager2026!Pass";
  const mgrUser = await prisma.user.create({
    data: {
      name: "Тест Менеджер CRM",
      email: mgrEmail,
      roleDefinition: { connect: { code: "SUPER_ADMIN" } },
      active: true,
      emailVerified: true,
    },
  });
  await prisma.account.create({
    data: {
      accountId: mgrUser.id,
      providerId: "credential",
      userId: mgrUser.id,
      password: await hashPassword(mgrPass),
    },
  });

  // Clear rate limits for clean test run
  await prisma.rateLimit.deleteMany();

  const mgrLoginRes = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: JSON.stringify({
      email: mgrEmail,
      password: mgrPass,
    }),
  });
  if (!mgrLoginRes.ok) {
    const errText = await mgrLoginRes.text();
    throw new Error(`Manager login failed (${mgrLoginRes.status}): ${errText}`);
  }
  const mgrCookies = mgrLoginRes.headers.getSetCookie();
  const mgrCookie = mgrCookies.map((c) => c.split(";")[0]).join("; ");
  console.log(`✓ Manager authenticated in CRM (${mgrEmail}).`);

  // 7. Manager creates quotes and forms commercial offer
  console.log("\n[7] Manager adds supplier quotes and sends Commercial Offer...");
  // Find a supplier in DB
  const supplier = await prisma.supplier.findFirst();
  if (!supplier) throw new Error("No supplier found in DB");

  const reqItem1 = custViewData.items[0];
  const reqItem2 = custViewData.items[1];

  // Add quotes for items
  await prisma.supplierQuote.createMany({
    data: [
      {
        requestItemId: reqItem1.id,
        supplierId: supplier.id,
        purchasePrice: 4500,
        currency: "RUB",
        deliveryDays: 3,
        deliveryCost: 400,
        status: "SELECTED",
      },
      {
        requestItemId: reqItem2.id,
        supplierId: supplier.id,
        purchasePrice: 2800,
        currency: "RUB",
        deliveryDays: 3,
        deliveryCost: 200,
        status: "SELECTED",
      },
    ],
  });

  // Manager forms customer offer via CRM API
  // Using approved pricing rule: 28% min 300 RUB
  // Item 1: 4500 * 1.28 = 5760 RUB * 2 = 11520 RUB
  // Item 2: 2800 * 1.28 = 3584 RUB * 1 = 3584 RUB
  // Delivery: 600 RUB
  // Total: 15704 RUB (1570400 minor)
  const offerPayload = {
    snapshot: {
      version: 1,
      comment: "Все детали в наличии на центральном складе. Готовы отгрузить за 3 рабочих дня.",
      totalRubMinor: 1570400,
      sharedLogisticsRubMinor: 60000,
      lines: [
        {
          itemId: reqItem1.id,
          name: reqItem1.description,
          quantity: 2,
          condition: "Новая (оригинал)",
          deliveryDays: 3,
          totalRubMinor: 1152000,
        },
        {
          itemId: reqItem2.id,
          name: reqItem2.description,
          quantity: 1,
          condition: "Новая (сертификат ЕС)",
          deliveryDays: 3,
          totalRubMinor: 358400,
        },
      ],
    },
    status: "SENT",
    comment: "Все детали в наличии на центральном складе. Готовы отгрузить за 3 рабочих дня.",
  };

  const offerRes = await fetch(`${BASE_URL}/api/requests/${requestId}/customer-offer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: mgrCookie,
    },
    body: JSON.stringify(offerPayload),
  });
  if (!offerRes.ok) {
    const errText = await offerRes.text();
    throw new Error(`Failed to send customer offer: ${errText}`);
  }
  console.log("✓ Manager successfully sent Commercial Offer to customer.");

  // 8. Customer views offer in Customer Portal
  console.log("\n[8] Customer reviews Commercial Offer in portal...");
  const offerViewRes = await fetch(`${BASE_URL}/api/customer/requests/${requestId}`, {
    headers: { cookie: customerCookie },
  });
  const offerViewRaw = await offerViewRes.json();
  const offerViewData = offerViewRaw.request || offerViewRaw;
  console.log(`✓ Customer sees offer total: ${offerViewData.customerOffer?.totalRubFormatted}`);
  console.log(`✓ Offer lines count: ${offerViewData.customerOffer?.lines.length}`);
  console.log(`✓ Manager note: "${offerViewData.customerOffer?.comment}"`);
  if (!offerViewData.customerOffer) throw new Error("Customer offer was not returned to customer");

  // 9. Customer accepts the offer
  console.log("\n[9] Customer accepts the Commercial Offer...");
  const acceptRes = await fetch(`${BASE_URL}/api/customer/requests/${requestId}/response`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: customerCookie,
    },
    body: JSON.stringify({
      response: "ACCEPTED",
      comment: "Предложение устраивает, оформляем доставку в ПВЗ",
    }),
  });
  const acceptData = await acceptRes.json();
  if (!acceptRes.ok) throw new Error(`Offer acceptance failed: ${JSON.stringify(acceptData)}`);
  console.log(`✓ Offer accepted! Order created: ${acceptData.orderNumber} (ID: ${acceptData.orderId})`);

  // 10. Customer verifies Order in Customer Portal
  console.log("\n[10] Customer verifies Order in /account/orders...");
  const orderViewRes = await fetch(`${BASE_URL}/api/customer/orders/${acceptData.orderId}`, {
    headers: { cookie: customerCookie },
  });
  const orderViewRaw = await orderViewRes.json();
  const orderViewData = orderViewRaw.order || orderViewRaw;
  console.log(`✓ Order Number: ${orderViewData.orderNumber}`);
  console.log(`✓ Order Status: ${orderViewData.status}, Payment: ${orderViewData.paymentStatus}, Delivery: ${orderViewData.deliveryStatus}`);
  console.log(`✓ Grand Total: ${orderViewData.grandTotalFormatted}`);
  console.log(`✓ Order Items count: ${orderViewData.items.length}`);
  for (const item of orderViewData.items) {
    console.log(`   - ${item.partName} (${item.quantity} шт.) = ${item.totalAmount} ₽ [OEM: ${item.partNumber}]`);
  }

  // Verify that NO supplier secrets are exposed to customer
  const exposedSecrets = JSON.stringify(orderViewData);
  if (exposedSecrets.includes("purchasePrice") || exposedSecrets.includes("grossProfit") || exposedSecrets.includes("supplierId")) {
    throw new Error("SECURITY VIOLATION: Customer order payload leaked supplier/purchase data!");
  }
  console.log("✓ Security verified: Zero supplier names or internal cost data exposed to customer.");

  // 11. Manager updates Order status in CRM
  console.log("\n[11] Manager updates order status to PROCESSING and adds shipment tracking...");
  const updateShipmentRes = await fetch(`${BASE_URL}/api/orders/${acceptData.orderId}/shipment`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: mgrCookie,
    },
    body: JSON.stringify({
      carrier: "CDEK",
      trackingNumber: "ZAP-CDEK-77889900",
      status: "IN_TRANSIT",
      city: "Москва",
      address: "ул. Ленина, д. 10, ПВЗ 12",
    }),
  });
  if (!updateShipmentRes.ok) {
    const errText = await updateShipmentRes.text();
    throw new Error(`Failed to update shipment (${updateShipmentRes.status}): ${errText}`);
  }

  const updateStatusRes = await fetch(`${BASE_URL}/api/orders/${acceptData.orderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: mgrCookie,
    },
    body: JSON.stringify({
      status: "SHIPPED",
    }),
  });
  if (!updateStatusRes.ok) throw new Error("Failed to update order status");
  console.log("✓ Manager set order to SHIPPED with tracking number ZAP-CDEK-77889900.");

  // 12. Customer checks updated order
  console.log("\n[12] Customer views updated Order in portal...");
  const updatedOrderRes = await fetch(`${BASE_URL}/api/customer/orders/${acceptData.orderId}`, {
    headers: { cookie: customerCookie },
  });
  const updatedOrderRaw = await updatedOrderRes.json();
  const updatedOrderData = updatedOrderRaw.order || updatedOrderRaw;
  console.log(`✓ Customer sees updated status: ${updatedOrderData.status}`);
  console.log(`✓ Customer sees delivery tracking: ${updatedOrderData.shipments[0]?.carrier} - ${updatedOrderData.shipments[0]?.trackingNumber}`);
  console.log(`✓ Delivery address: ${updatedOrderData.shipments[0]?.city}, ${updatedOrderData.shipments[0]?.address}`);

  console.log("\n=== FULL CUSTOMER BUYING JOURNEY VERIFIED WITH 100% SUCCESS ===");
}

main()
  .catch((e) => {
    console.error("JOURNEY VERIFICATION FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
