process.env.SMS_PROVIDER = "mock";
process.env.NODE_ENV = "test";

import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { normalizeToE164, isValidE164 } from "../phone-utils.ts";
import { smsService } from "./sms/sms-service.ts";
import { customerPhoneAuthService } from "./customer-phone-auth-service.ts";
import { customerPortalService } from "./customer-portal-service.ts";

const prisma = new PrismaClient();

test("Customer Phone Auth & ZAPTUT GARAGE Suite", async (t) => {
  const uniqueSuffix = Date.now().toString().slice(-5);
  const testPhoneRu = `+7999${uniqueSuffix}01`;
  const testPhoneBy = `+37529${uniqueSuffix}01`;
  const testPhonePl = `+4850${uniqueSuffix}01`;

  t.after(async () => {
    // Cleanup created test records
    await prisma.customerVehicle.deleteMany({
      where: { customer: { phone: { in: [testPhoneRu, testPhoneBy, testPhonePl] } } },
    });
    await prisma.customerAddress.deleteMany({
      where: { customer: { phone: { in: [testPhoneRu, testPhoneBy, testPhonePl] } } },
    });
    await prisma.customer.deleteMany({
      where: { phone: { in: [testPhoneRu, testPhoneBy, testPhonePl] } },
    });
    await prisma.verification.deleteMany({
      where: { identifier: { contains: uniqueSuffix } },
    });
    await prisma.user.deleteMany({
      where: { phoneNumber: { in: [testPhoneRu, testPhoneBy, testPhonePl] } },
    });
    await prisma.$disconnect();
  });

  await t.test("1. Phone normalization into E.164 for RU, BY, PL", () => {
    assert.equal(normalizeToE164("8 (999) 123-45-67"), "+79991234567");
    assert.equal(normalizeToE164("+7 999 123-45-67"), "+79991234567");
    assert.equal(normalizeToE164("80 29 123-45-67"), "+375291234567");
    assert.equal(normalizeToE164("+375 (29) 123-45-67"), "+375291234567");
    assert.equal(normalizeToE164("+48 501 234 567"), "+48501234567");
  });

  await t.test("2. Send OTP with 60s cooldown and rate limiting", async () => {
    await smsService.resetRateLimits();

    // 1st send should succeed
    const res1 = await customerPhoneAuthService.sendOtp(testPhoneRu, "127.0.0.1");
    assert.equal(res1.success, true);
    if (res1.success) {
      assert.equal(res1.cooldownSeconds, 60);
      assert.equal(res1.normalizedPhone, testPhoneRu);
    }

    // 2nd send immediately should trigger cooldown
    const res2 = await customerPhoneAuthService.sendOtp(testPhoneRu, "127.0.0.1");
    assert.equal(res2.success, false);
    if (!res2.success) {
      assert.equal(res2.error, "RATE_LIMIT_COOLDOWN");
      assert.ok(Number(res2.retryAfterSeconds) > 0);
    }
  });

  await t.test("3. OTP Verification: invalid code increments attempts; 3rd attempt locks", async () => {
    // Inspect stored OTP in verification table
    const record = await prisma.verification.findFirst({
      where: { identifier: `phone_otp:${testPhoneRu}` },
    });
    assert.ok(record, "Verification record must exist");

    // 1st wrong attempt
    const v1 = await customerPhoneAuthService.verifyOtp({ rawPhone: testPhoneRu, code: "000000" });
    assert.equal(v1.success, false);
    if (!v1.success) {
      assert.equal(v1.error, "INVALID_CODE");
      assert.equal(v1.remainingAttempts, 2);
    }

    // 2nd wrong attempt
    const v2 = await customerPhoneAuthService.verifyOtp({ rawPhone: testPhoneRu, code: "000000" });
    assert.equal(v2.success, false);
    if (!v2.success) {
      assert.equal(v2.error, "INVALID_CODE");
      assert.equal(v2.remainingAttempts, 1);
    }

    // 3rd wrong attempt -> MAX_ATTEMPTS_EXCEEDED
    const v3 = await customerPhoneAuthService.verifyOtp({ rawPhone: testPhoneRu, code: "000000" });
    assert.equal(v3.success, false);
    if (!v3.success) {
      assert.equal(v3.error, "MAX_ATTEMPTS_EXCEEDED");
    }

    // Verification record should be invalidated / deleted
    const recordAfter = await prisma.verification.findFirst({
      where: { identifier: `phone_otp:${testPhoneRu}` },
    });
    assert.equal(recordAfter, null);
  });

  await t.test("4. New customer registration via correct OTP & Customer profile auto-creation", async () => {
    // Reset rate limits and send fresh OTP
    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(testPhoneRu, "127.0.0.1");

    const record = await prisma.verification.findFirst({
      where: { identifier: `phone_otp:${testPhoneRu}` },
    });
    assert.ok(record);
    const payload = JSON.parse(record.value);
    assert.equal(payload.code, undefined, "Plaintext OTP must NEVER be persisted in DB");
    assert.ok(payload.codeHash, "SHA-256 codeHash must be stored");

    const sentCode = smsService.getMockStore().getLatestOtp(testPhoneRu);
    assert.ok(sentCode);

    // Verify with actual code delivered via SMS transport
    const verifyRes = await customerPhoneAuthService.verifyOtp({
      rawPhone: testPhoneRu,
      code: sentCode,
    });
    assert.equal(verifyRes.success, true);
    if (verifyRes.success) {
      assert.equal(verifyRes.user.phoneNumber, testPhoneRu);
      assert.ok(verifyRes.customerId);

      // Verify User in DB has role CUSTOMER
      const user = await prisma.user.findUnique({ where: { id: verifyRes.user.id } });
      assert.equal(user?.role, "CUSTOMER");
      assert.equal(user?.phoneNumberVerified, true);

      // Verify Customer profile created and linked
      const customer = await prisma.customer.findUnique({ where: { id: verifyRes.customerId } });
      assert.equal(customer?.userId, user?.id);
      assert.equal(customer?.normalizedPhone, testPhoneRu);
    }

    // Test one-time use: re-using the same code must fail
    const replayRes = await customerPhoneAuthService.verifyOtp({
      rawPhone: testPhoneRu,
      code: sentCode,
    });
    assert.equal(replayRes.success, false);
    if (!replayRes.success) {
      assert.equal(replayRes.error, "EXPIRED_OR_NOT_FOUND");
    }
  });

  await t.test("5. Customer Profile Linking: exactly 1 unlinked match links safely", async () => {
    // Pre-create an unlinked customer profile in PostgreSQL (e.g. from CRM order)
    const unlinked = await prisma.customer.create({
      data: {
        name: "Иван Долгов",
        phone: testPhoneBy,
        normalizedPhone: testPhoneBy,
        userId: null,
      },
    });

    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(testPhoneBy, "127.0.0.1");
    const sentCodeBy = smsService.getMockStore().getLatestOtp(testPhoneBy);
    assert.ok(sentCodeBy);

    const verifyRes = await customerPhoneAuthService.verifyOtp({
      rawPhone: testPhoneBy,
      code: sentCodeBy,
    });
    assert.equal(verifyRes.success, true);
    if (verifyRes.success) {
      // Must have linked to the existing customer profile
      assert.equal(verifyRes.customerId, unlinked.id);
      const updated = await prisma.customer.findUnique({ where: { id: unlinked.id } });
      assert.equal(updated?.userId, verifyRes.user.id);
    }
  });

  await t.test("6. Customer Profile Linking: multiple matches stops auto-linking and logs conflict", async () => {
    // Pre-create 2 conflicting customer profiles with the same phone
    await prisma.customer.create({
      data: { name: "Профиль 1", phone: testPhonePl, normalizedPhone: testPhonePl, userId: null },
    });
    await prisma.customer.create({
      data: { name: "Профиль 2", phone: testPhonePl, normalizedPhone: testPhonePl, userId: null },
    });

    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(testPhonePl, "127.0.0.1");
    const sentCodePl = smsService.getMockStore().getLatestOtp(testPhonePl);
    assert.ok(sentCodePl);

    const verifyRes = await customerPhoneAuthService.verifyOtp({
      rawPhone: testPhonePl,
      code: sentCodePl,
    });
    assert.equal(verifyRes.success, true);
    if (verifyRes.success) {
      // Must NOT merge into either existing profile; creates safe isolated profile with conflict flag
      const customer = await prisma.customer.findUnique({ where: { id: verifyRes.customerId } });
      assert.ok(customer?.internalNote?.includes("[AUTO-CONFLICT]"));
    }
  });

  await t.test("7. ZAPTUT GARAGE: Add, Edit, Switch Default, and Recolor Vehicle", async () => {
    // Get test customer from step 4
    const user = await prisma.user.findFirst({ where: { phoneNumber: testPhoneRu } });
    assert.ok(user);
    const customer = await prisma.customer.findFirst({ where: { userId: user.id } });
    assert.ok(customer);

    // 1. Add Vehicle 1 (Kia Sportage SUV)
    const v1 = await customerPortalService.createVehicle(customer.id, {
      make: "Kia",
      model: "Sportage",
      generation: "IV (QL)",
      year: 2021,
      bodyType: "SUV",
      vin: `KIA${uniqueSuffix}01`,
      engine: "2.0 CRDi (185 hp)",
      colorName: "Черный перламутр",
      colorCode: "ABP",
      colorHex: "#151719",
      isDefault: true,
    });
    assert.ok(v1.id);
    assert.equal(v1.bodyType, "SUV");
    assert.equal(v1.colorHex, "#151719");
    assert.equal(v1.isDefault, true);

    // 2. Add Vehicle 2 (Toyota Camry Sedan)
    const v2 = await customerPortalService.createVehicle(customer.id, {
      make: "Toyota",
      model: "Camry",
      generation: "XV70",
      year: 2022,
      bodyType: "SEDAN",
      vin: `TOY${uniqueSuffix}02`,
      engine: "2.5 Dynamic Force (203 hp)",
      colorName: "Белый жемчуг",
      colorCode: "070",
      colorHex: "#EAECEE",
      isDefault: false,
    });
    assert.ok(v2.id);
    assert.equal(v2.bodyType, "SEDAN");
    assert.equal(v2.colorHex, "#EAECEE");
    assert.equal(v2.isDefault, false);

    // 3. Switch default vehicle: make v2 default -> v1 should become non-default
    await customerPortalService.updateVehicle(customer.id, v2.id, { isDefault: true });
    const list = await customerPortalService.listVehicles(customer.id);
    assert.equal(list.length, 2);
    const updatedV1 = list.find((v) => v.id === v1.id);
    const updatedV2 = list.find((v) => v.id === v2.id);
    assert.equal(updatedV2?.isDefault, true);
    assert.equal(updatedV1?.isDefault, false);

    // 4. Recolor vehicle: change v1 to Sapphire Blue
    const recolored = await customerPortalService.updateVehicle(customer.id, v1.id, {
      colorName: "Синий сапфир",
      colorHex: "#1A355B",
    });
    assert.equal(recolored.colorHex, "#1A355B");
    assert.equal(recolored.colorName, "Синий сапфир");
  });

  await t.test("8. Address Book: Multiple addresses and default switching", async () => {
    const user = await prisma.user.findFirst({ where: { phoneNumber: testPhoneRu } });
    const customer = await prisma.customer.findFirst({ where: { userId: user.id } });
    assert.ok(customer);

    const a1 = await customerPortalService.createAddress(customer.id, {
      recipientName: "Алексей Смирнов",
      phone: testPhoneRu,
      city: "Москва",
      street: "Тверская",
      house: "12",
      apartment: "45",
      isDefault: true,
    });
    assert.ok(a1.id);
    assert.equal(a1.isDefault, true);

    const a2 = await customerPortalService.createAddress(customer.id, {
      recipientName: "Алексей Смирнов",
      phone: testPhoneRu,
      city: "Санкт-Петербург",
      street: "Невский проспект",
      house: "25",
      isDefault: false,
    });
    assert.ok(a2.id);
    assert.equal(a2.isDefault, false);

    // Switch default
    await customerPortalService.updateAddress(customer.id, a2.id, { isDefault: true });
    const addresses = await customerPortalService.listAddresses(customer.id);
    assert.equal(addresses.find((a) => a.id === a2.id)?.isDefault, true);
    assert.equal(addresses.find((a) => a.id === a1.id)?.isDefault, false);
  });
});
