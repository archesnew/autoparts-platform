import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./db.ts";
import { auth } from "./auth.ts";
import { smsService } from "./sms/sms-service.ts";
import { customerPhoneAuthService } from "./customer-phone-auth-service.ts";
import { customerPortalService } from "./customer-portal-service.ts";
import { getCustomerContext } from "./customer-session.ts";
import { parseFeedBuffer } from "./import/feed-parser.ts";
import { importService } from "./import/import-service.ts";
import { initialFinancialConfig } from "../financial-config.ts";
import { sha256Hex, clearRateLimitBuckets } from "./security/rate-limiter.ts";
import { POST as forgotPasswordPost } from "../../app/api/customer/auth/forgot-password/route.ts";
import { POST as sendOtpPost } from "../../app/api/customer/auth/phone/send-otp/route.ts";
import { POST as orderPaymentPost } from "../../app/api/orders/[id]/payments/route.ts";

test("Security Remediation Phase 1 — Mandatory Regression Suite", async (t) => {
  const runId = Date.now();
  const suffix7 = String(runId).slice(-7);

  const custEmail = `sec-cust-${runId}@test.example`;
  const staffEmail = `sec-staff-${runId}@test.example`;
  const demoEmailTemp = `sec-demo-${runId}@test.example`;
  const unlinkedEmail = `sec-victim-${runId}@test.example`;

  const phone1 = `+7991${suffix7}`;
  const phone2 = `+7992${suffix7}`;
  const phone3 = `+7993${suffix7}`;
  const phone4 = `+7994${suffix7}`;
  const phone5 = `+7995${suffix7}`;
  const phoneAllowlisted = `+7996${suffix7}`;
  const phoneNotAllowlisted = `+7997${suffix7}`;

  const createdUserIds = [];
  const createdCustomerIds = [];
  const createdJobIds = [];

  const cleanup = async () => {
    try {
      for (const jobId of createdJobIds) {
        await prisma.importRow.deleteMany({ where: { jobId } });
        await prisma.importJob.deleteMany({ where: { id: jobId } });
      }
      await prisma.verification.deleteMany({
        where: {
          OR: [
            { identifier: { contains: suffix7 } },
            { identifier: { contains: String(runId) } },
          ],
        },
      });
      if (createdCustomerIds.length > 0) {
        await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.customer.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.account.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      await prisma.customer.deleteMany({ where: { email: unlinkedEmail } });
      await clearRateLimitBuckets("pwd_reset:");
      await smsService.resetRateLimits();
    } catch {
      // Best-effort teardown
    }
  };

  t.after(cleanup);

  await clearRateLimitBuckets("pwd_reset:");
  await smsService.resetRateLimits();

  // Helper to create a user + credential account cleanly
  const createUserWithPassword = async ({ email, role, name }) => {
    const pass = `${randomBytes(12).toString("hex")}!Aa1`;
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        role,
        active: true,
        emailVerified: true,
      },
    });
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: await hashPassword(pass),
      },
    });
    createdUserIds.push(user.id);
    return { user, pass };
  };

  await t.test("1. Customer forgot-password leaks NO token/resetUrl and returns identical response", async () => {
    const { user } = await createUserWithPassword({
      email: custEmail,
      role: "CUSTOMER",
      name: "Security Customer",
    });
    const c = await prisma.customer.create({
      data: { name: "Security Customer", email: custEmail, userId: user.id },
    });
    createdCustomerIds.push(c.id);

    const reqExisting = new NextRequest("http://localhost:3000/api/customer/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.10" },
      body: JSON.stringify({ email: custEmail }),
    });
    const resExisting = await forgotPasswordPost(reqExisting);
    assert.equal(resExisting.status, 200);
    const jsonExisting = await resExisting.json();

    assert.equal("token" in jsonExisting, false);
    assert.equal("resetUrl" in jsonExisting, false);
    assert.equal(jsonExisting.success, true);

    const reqUnknown = new NextRequest("http://localhost:3000/api/customer/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.10" },
      body: JSON.stringify({ email: `nonexistent-${runId}@test.example` }),
    });
    const resUnknown = await forgotPasswordPost(reqUnknown);
    assert.equal(resUnknown.status, 200);
    const jsonUnknown = await resUnknown.json();

    assert.deepEqual(jsonExisting, jsonUnknown);
  });

  await t.test("2. Public password reset rejects SUPER_ADMIN and STAFF", async () => {
    const { user: staffUser, pass: originalStaffPass } = await createUserWithPassword({
      email: staffEmail,
      role: "SUPER_ADMIN",
      name: "Security SuperAdmin",
    });

    const resStaffForgot = await customerPortalService.requestPasswordReset(staffEmail, "198.51.100.11");
    assert.equal("token" in resStaffForgot, false);
    assert.equal("resetUrl" in resStaffForgot, false);

    // Ensure no pwd_reset verification row was created for SUPER_ADMIN
    const staffVerif = await prisma.verification.findFirst({
      where: { identifier: `pwd_reset:${staffEmail}` },
    });
    assert.equal(staffVerif, null);

    // Even if a verification token existed for SUPER_ADMIN, resetPassword must reject it
    const forgedRawToken = randomBytes(32).toString("hex");
    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: `pwd_reset:${staffEmail}`,
        value: sha256Hex(`${staffEmail}:${forgedRawToken}`),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await assert.rejects(
      () =>
        customerPortalService.resetPassword({
          email: staffEmail,
          token: forgedRawToken,
          newPassword: "AttackerNewPassword123!",
        }),
      /Недействительный|истёкший/
    );

    // Original SUPER_ADMIN password must still work
    const signIn = await auth.api.signInEmail({
      body: { email: staffUser.email, password: originalStaffPass },
      asResponse: true,
    });
    assert.equal(signIn.status, 200);
  });

  await t.test("3. Invalid OTP denies login", async () => {
    await smsService.resetRateLimits();
    const sent = await customerPhoneAuthService.sendOtp(phone1, "198.51.100.20");
    assert.equal(sent.success, true);

    const realCode = smsService.getMockStore().getLatestOtp(phone1);
    assert.ok(realCode);
    const wrongCode = realCode === "999999" ? "888888" : "999999";

    const res = await customerPhoneAuthService.verifyOtp({ rawPhone: phone1, code: wrongCode });
    assert.equal(res.success, false);
    if (!res.success) {
      assert.equal(res.error, "INVALID_CODE");
    }
  });

  await t.test("4. Universal '111111' bypass is permanently rejected", async () => {
    await smsService.resetRateLimits();
    // 4a. Without any requested OTP
    const noChallenge = await customerPhoneAuthService.verifyOtp({ rawPhone: phone2, code: "111111" });
    assert.equal(noChallenge.success, false);

    // 4b. With an active OTP challenge generated (unless randomly 111111, guard that too)
    await customerPhoneAuthService.sendOtp(phone2, "198.51.100.21");
    const generated = smsService.getMockStore().getLatestOtp(phone2);
    if (generated !== "111111") {
      const bypassAttempt = await customerPhoneAuthService.verifyOtp({ rawPhone: phone2, code: "111111" });
      assert.equal(bypassAttempt.success, false);
      if (!bypassAttempt.success) {
        assert.equal(bypassAttempt.error, "INVALID_CODE");
      }
    }
  });

  await t.test("5. OTP is strictly single-use and cannot be replayed (including concurrent attempts)", async () => {
    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(phone3, "198.51.100.22");
    const code = smsService.getMockStore().getLatestOtp(phone3);
    assert.ok(code);

    // Concurrent verify attempts for the same challenge: exactly 1 succeeds
    const concurrentResults = await Promise.all([
      customerPhoneAuthService.verifyOtp({ rawPhone: phone3, code }),
      customerPhoneAuthService.verifyOtp({ rawPhone: phone3, code }),
      customerPhoneAuthService.verifyOtp({ rawPhone: phone3, code }),
    ]);

    const successes = concurrentResults.filter((r) => r.success);
    assert.equal(successes.length, 1, "Only 1 concurrent OTP verification may succeed");
    if (successes[0]?.success) {
      createdUserIds.push(successes[0].user.id);
      createdCustomerIds.push(successes[0].customerId);
    }

    // Sequential replay must also fail
    const replay = await customerPhoneAuthService.verifyOtp({ rawPhone: phone3, code });
    assert.equal(replay.success, false);
  });

  await t.test("6. Expired OTP is rejected", async () => {
    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(phone4, "198.51.100.23");
    const code = smsService.getMockStore().getLatestOtp(phone4);
    assert.ok(code);

    // Force challenge expiration in DB
    await prisma.verification.updateMany({
      where: { identifier: `phone_otp:${phone4}` },
      data: { expiresAt: new Date(Date.now() - 5_000) },
    });

    const expiredRes = await customerPhoneAuthService.verifyOtp({ rawPhone: phone4, code });
    assert.equal(expiredRes.success, false);
    if (!expiredRes.success) {
      assert.equal(expiredRes.error, "EXPIRED_OR_NOT_FOUND");
    }
  });

  await t.test("7. OTP rate limits & attempt limits hold under concurrent Promise.all requests", async () => {
    await smsService.resetRateLimits();

    // 5 concurrent sendOtp requests for same phone: cooldown (1 / 60s) must allow ONLY 1
    const sends = await Promise.all(
      Array.from({ length: 5 }, () => customerPhoneAuthService.sendOtp(phone5, "198.51.100.24"))
    );
    const allowedSends = sends.filter((r) => r.success);
    assert.equal(allowedSends.length, 1, "PostgreSQL atomic rate limit must allow only 1 send within cooldown");

    // 3 invalid attempts -> 3rd attempt locks/deletes the OTP challenge
    const realCode = smsService.getMockStore().getLatestOtp(phone5);
    const wrong = realCode === "000000" ? "000001" : "000000";
    const a1 = await customerPhoneAuthService.verifyOtp({ rawPhone: phone5, code: wrong });
    const a2 = await customerPhoneAuthService.verifyOtp({ rawPhone: phone5, code: wrong });
    const a3 = await customerPhoneAuthService.verifyOtp({ rawPhone: phone5, code: wrong });
    assert.equal(a1.success, false);
    assert.equal(a2.success, false);
    assert.equal(a3.success, false);
    if (!a3.success) assert.equal(a3.error, "MAX_ATTEMPTS_EXCEEDED");

    // Even the real code must now fail after lockout
    if (realCode) {
      const afterLock = await customerPhoneAuthService.verifyOtp({ rawPhone: phone5, code: realCode });
      assert.equal(afterLock.success, false);
    }
  });

  await t.test("8. Controlled test OTP allowlist works ONLY for allowed numbers and never leaks in API", async () => {
    await smsService.resetRateLimits();
    const prevProvider = process.env.SMS_PROVIDER;
    const prevPhones = process.env.PHONE_AUTH_TEST_PHONES;
    const prevCode = process.env.PHONE_AUTH_TEST_OTP_CODE;

    process.env.SMS_PROVIDER = "mock";
    process.env.PHONE_AUTH_TEST_PHONES = phoneAllowlisted;
    process.env.PHONE_AUTH_TEST_OTP_CODE = "246810";

    try {
      // HTTP route must not expose devOtpCode
      const reqAllowed = new NextRequest("http://localhost:3000/api/customer/auth/phone/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.25" },
        body: JSON.stringify({ phone: phoneAllowlisted }),
      });
      const resAllowed = await sendOtpPost(reqAllowed);
      assert.equal(resAllowed.status, 200);
      const jsonAllowed = await resAllowed.json();
      assert.equal("devOtpCode" in jsonAllowed, false);

      // Non-allowlisted number must NOT accept 246810
      await customerPhoneAuthService.sendOtp(phoneNotAllowlisted, "198.51.100.26");
      const notAllowedVerify = await customerPhoneAuthService.verifyOtp({
        rawPhone: phoneNotAllowlisted,
        code: "246810",
      });
      assert.equal(notAllowedVerify.success, false);

      // Allowlisted number accepts configured 246810 once, then rejects replay
      const okVerify = await customerPhoneAuthService.verifyOtp({
        rawPhone: phoneAllowlisted,
        code: "246810",
      });
      assert.equal(okVerify.success, true);
      if (okVerify.success) {
        createdUserIds.push(okVerify.user.id);
        createdCustomerIds.push(okVerify.customerId);
      }

      const replayAllowed = await customerPhoneAuthService.verifyOtp({
        rawPhone: phoneAllowlisted,
        code: "246810",
      });
      assert.equal(replayAllowed.success, false);
    } finally {
      if (prevProvider === undefined) delete process.env.SMS_PROVIDER;
      else process.env.SMS_PROVIDER = prevProvider;
      if (prevPhones === undefined) delete process.env.PHONE_AUTH_TEST_PHONES;
      else process.env.PHONE_AUTH_TEST_PHONES = prevPhones;
      if (prevCode === undefined) delete process.env.PHONE_AUTH_TEST_OTP_CODE;
      else process.env.PHONE_AUTH_TEST_OTP_CODE = prevCode;
    }
  });

  await t.test("9. No profile linking by unverified email & GET getCustomerContext has zero write side effects", async () => {
    // Pre-create victim Customer profile with unlinked email and NO matching verified phone
    const victimCustomer = await prisma.customer.create({
      data: {
        name: "Victim Existing Customer",
        email: unlinkedEmail,
        phone: "+79001112233",
        normalizedPhone: "+79001112233",
        userId: null,
      },
    });
    createdCustomerIds.push(victimCustomer.id);

    // 9a. Registering with the same email MUST NOT claim victimCustomer
    const attackerEmail = unlinkedEmail;
    const reg = await customerPortalService.register({
      name: "Attacker Reg",
      email: attackerEmail,
      password: "AttackerPassword123!",
    });
    createdUserIds.push(reg.user.id);
    createdCustomerIds.push(reg.customer.id);
    assert.notEqual(reg.customer.id, victimCustomer.id);

    const victimAfterReg = await prisma.customer.findUnique({ where: { id: victimCustomer.id } });
    assert.equal(victimAfterReg?.userId, null);

    // 9b. Sign in as a CUSTOMER user with NO Customer record & NO verified phone: GET context returns null and creates/links NOTHING
    const { user: orphanUser, pass: orphanPass } = await createUserWithPassword({
      email: `orphan-${runId}@test.example`,
      role: "CUSTOMER",
      name: "Orphan Customer User",
    });
    await prisma.user.update({
      where: { id: orphanUser.id },
      data: { email: `orphan-${runId}@test.example` },
    });

    const signInRes = await auth.api.signInEmail({
      body: { email: `orphan-${runId}@test.example`, password: orphanPass },
      asResponse: true,
    });
    assert.equal(signInRes.status, 200);
    const cookie = signInRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

    const ctx = await getCustomerContext(new Headers({ cookie }));
    assert.equal(ctx, null, "GET getCustomerContext must not create a missing Customer profile");

    const orphanCustomer = await prisma.customer.findFirst({ where: { userId: orphanUser.id } });
    assert.equal(orphanCustomer, null);

    // 9c. updateProfile rejects silent email modification without dedicated verification
    await assert.rejects(
      () =>
        customerPortalService.updateProfile(reg.customer.id, {
          name: "Attacker Reg Updated",
          email: `changed-${runId}@test.example`,
        }),
      /Смена email требует отдельного подтверждения/
    );
  });

  await t.test("10. changePhone updates current User/Customer without creating duplicates and blocks conflicts", async () => {
    const startPhone = `+7998${suffix7}`;
    const newPhone = `+7999${suffix7}`;
    const takenPhone = `+7990${suffix7}`;

    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(startPhone, "198.51.100.30");
    const c1 = smsService.getMockStore().getLatestOtp(startPhone);
    const v1 = await customerPhoneAuthService.verifyOtp({ rawPhone: startPhone, code: c1 });
    assert.equal(v1.success, true);
    if (!v1.success) throw new Error("Setup verify failed");
    createdUserIds.push(v1.user.id);
    createdCustomerIds.push(v1.customerId);

    // Create another existing user holding takenPhone
    const conflictCustomer = await prisma.customer.create({
      data: { name: "Other Owner", phone: takenPhone, normalizedPhone: takenPhone, userId: null },
    });
    createdCustomerIds.push(conflictCustomer.id);

    const beforeUsersCount = await prisma.user.count({ where: { role: "CUSTOMER" } });
    const beforeCustomersCount = await prisma.customer.count();

    // Conflict rejection
    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(takenPhone, "198.51.100.31");
    const cTaken = smsService.getMockStore().getLatestOtp(takenPhone);
    const conflictRes = await customerPhoneAuthService.changePhone({
      userId: v1.user.id,
      rawNewPhone: takenPhone,
      code: cTaken,
    });
    assert.equal(conflictRes.success, false);

    // Valid phone change
    await smsService.resetRateLimits();
    await customerPhoneAuthService.sendOtp(newPhone, "198.51.100.32");
    const cNew = smsService.getMockStore().getLatestOtp(newPhone);
    const changed = await customerPhoneAuthService.changePhone({
      userId: v1.user.id,
      rawNewPhone: newPhone,
      code: cNew,
    });
    assert.equal(changed.success, true);

    const afterUsersCount = await prisma.user.count({ where: { role: "CUSTOMER" } });
    const afterCustomersCount = await prisma.customer.count();
    assert.equal(afterUsersCount, beforeUsersCount, "changePhone must NOT create a duplicate User");
    assert.equal(afterCustomersCount, beforeCustomersCount, "changePhone must NOT create a duplicate Customer");

    const updatedUser = await prisma.user.findUnique({ where: { id: v1.user.id } });
    const updatedCustomer = await prisma.customer.findUnique({ where: { id: v1.customerId } });
    assert.equal(updatedUser?.phoneNumber, newPhone);
    assert.equal(updatedCustomer?.normalizedPhone, newPhone);
  });

  await t.test("11. ExcelJS XLSX feed import preserves Cyrillic strings, empty cells, formulas, and stages without xlsx package", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Прайс");
    ws.addRow(["oem", "name", "brand", "price", "quantity", "condition", "city"]);
    ws.addRow(["SEC-OEM-01", "Диск тормозной передний", "BREMBO", 4900, 3, "Новая", "Москва"]);
    ws.addRow(["", "Позиция без OEM (ошибка)", "BOSCH", 1200, null, "Б/У", "Минск"]);
    ws.addRow(["SEC-OEM-03", "Фильтр масляный", "MANN", { formula: "100+200", result: 950 }, 5, "Новая", ""]);

    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseFeedBuffer("security-check.xlsx", buf);
    assert.equal(parsed.format, "XLSX");
    assert.equal(parsed.rawRowCount, 3);
    assert.equal(parsed.rows[0].name, "Диск тормозной передний");
    assert.equal(parsed.rows[1].quantity, "");
    assert.equal(parsed.rows[2].price, "950");

    const supplier = await prisma.supplier.findFirst({ select: { id: true } });
    assert.ok(supplier, "At least one supplier must exist for stageImportJob verification");

    const staged = await importService.stageImportJob({
      supplierId: supplier.id,
      fileName: "security-check.xlsx",
      buffer: buf,
      source: "RU_DISMANTLE",
    });
    createdJobIds.push(staged.job.id);
    assert.equal(staged.job.validRows, 2);
    assert.equal(staged.job.errorRows, 1);
  });

  await t.test("12. Financial config integrity (RU/BY 28% min 300, PL 55% min 1700) remains intact", async () => {
    assert.equal(initialFinancialConfig.tariffs["Россия"].markupBasisPoints, 2800);
    assert.equal(initialFinancialConfig.tariffs["Россия"].minimumMarkupRubMinor, "30000");
    assert.equal(initialFinancialConfig.tariffs["Беларусь"].markupBasisPoints, 2800);
    assert.equal(initialFinancialConfig.tariffs["Беларусь"].minimumMarkupRubMinor, "30000");
    assert.equal(initialFinancialConfig.tariffs["Польша"].markupBasisPoints, 5500);
    assert.equal(initialFinancialConfig.tariffs["Польша"].minimumMarkupRubMinor, "170000");
  });

  await t.test("13. Existing SUPER_ADMIN (owner@zaptut.pro) & DEMO_VIEWER (demo.partner@zaptut.pro) remain intact", async () => {
    const owner = await prisma.user.findUnique({
      where: { email: "owner@zaptut.pro" },
      select: { id: true, role: true, active: true },
    });
    assert.ok(owner, "owner@zaptut.pro must remain in database");
    assert.equal(owner.role, "SUPER_ADMIN");
    assert.equal(owner.active, true);

    const demo = await prisma.user.findUnique({
      where: { email: "demo.partner@zaptut.pro" },
      select: { id: true, role: true, active: true },
    });
    assert.ok(demo, "demo.partner@zaptut.pro must remain in database");
    assert.equal(demo.role, "DEMO_VIEWER");
    assert.equal(demo.active, true);
  });

  await t.test("14. DEMO_VIEWER read-only isolation: mutation endpoint rejects with 403 Forbidden", async () => {
    const { pass: demoTempPass } = await createUserWithPassword({
      email: demoEmailTemp,
      role: "DEMO_VIEWER",
      name: "Temp Demo Viewer",
    });

    const signInRes = await auth.api.signInEmail({
      body: { email: demoEmailTemp, password: demoTempPass },
      asResponse: true,
    });
    assert.equal(signInRes.status, 200);
    const cookie = signInRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

    const reqMutation = new NextRequest("http://localhost:3000/api/orders/fake-order-id/payments", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ amount: 500, paymentMethod: "CARD" }),
    });
    const resMutation = await orderPaymentPost(reqMutation, {
      params: Promise.resolve({ id: "fake-order-id" }),
    });
    assert.equal(resMutation.status, 403, "DEMO_VIEWER must receive 403 Forbidden on payment mutations");
  });
});
