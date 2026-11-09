import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./auth.ts";
import { hasStaffPermission } from "./staff-rbac.ts";

const prisma = new PrismaClient();

test("credential login, invalid password, no session, expiry, and logout", { timeout: 30_000 }, async () => {
  const suffix = randomUUID();
  const email = `auth-test-${suffix}@example.test`;
  const password = `Auth-Test-${suffix}-Aa9!`;
  const username = `198.51.100.${10 + (Number.parseInt(suffix.slice(0, 2), 16) % 200)}`;
  let userId;
  const call = async (path, method = "GET", body, cookie, origin = "http://127.0.0.1:3000") => auth.handler(new Request(`http://127.0.0.1:3000/api/auth${path}`, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": username,
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));

  try {
    for (const [role, allowed, denied] of [
      ["SUPER_ADMIN", ["finance.settings.update", "employees.manage", "system.manage", "quotes.purchase.read", "finance.read"], []],
      ["ADMIN", ["admin.access", "employees.read", "requests.read"], ["system.manage", "quotes.purchase.read", "finance.read", "finance.settings.update"]],
      ["MANAGER", ["admin.access", "requests.update", "customers.internal.read"], ["quotes.purchase.read", "finance.read", "finance.settings.update", "employees.manage"]],
      ["LOGISTICS", ["logistics.access", "orders.update", "shipments.read", "logistics.documents.read"], ["admin.access", "customers.contact.read", "customers.internal.read", "quotes.purchase.read", "finance.read"]],
    ]) {
      const grants = await prisma.rolePermission.findMany({ where: { roleCode: role }, select: { permissionCode: true } });
      const permissions = new Set(grants.map((entry) => entry.permissionCode));
      for (const permission of allowed) assert.equal(hasStaffPermission({ role, rolePermissions: permissions, permission }), true, `${role} allows ${permission}`);
      for (const permission of denied) assert.equal(hasStaffPermission({ role, rolePermissions: permissions, permission }), false, `${role} denies ${permission}`);
    }

    const user = await prisma.user.create({ data: { name: "Temporary Auth Test", email, role: "MANAGER", active: true }, select: { id: true } });
    userId = user.id;
    await prisma.account.create({ data: { accountId: user.id, providerId: "credential", userId: user.id, password: await hashPassword(password) } });
    await prisma.rateLimit.deleteMany({ where: { key: { contains: username } } });

    const missingSession = await call("/get-session");
    assert.equal(missingSession.status, 200);
    assert.equal(await missingSession.json(), null);

    const rejectedOrigin = await call("/sign-in/email", "POST", { email, password }, undefined, "http://untrusted.example");
    assert.equal(rejectedOrigin.status, 403);

    // The rejected-origin request counts towards the same per-IP limiter.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const wrongPassword = await call("/sign-in/email", "POST", { email, password: `${password}wrong` });
      assert.equal(wrongPassword.status, 401);
    }
    const rateLimited = await call("/sign-in/email", "POST", { email, password });
    assert.equal(rateLimited.status, 429);
    await prisma.rateLimit.deleteMany({ where: { key: { contains: username } } });

    const signedIn = await call("/sign-in/email", "POST", { email, password });
    assert.equal(signedIn.status, 200);
    const setCookies = signedIn.headers.getSetCookie();
    const sessionCookie = setCookies.find((value) => /session_token=/i.test(value));
    assert.ok(sessionCookie, "session cookie is returned");
    assert.match(sessionCookie, /httponly/i);
    assert.match(sessionCookie, /samesite=lax/i);
    const cookie = sessionCookie.split(";")[0];

    const currentSession = await call("/get-session", "GET", undefined, cookie);
    assert.equal(currentSession.status, 200);
    assert.equal((await currentSession.json()).user.email, email);

    await prisma.session.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    const expiredSession = await call("/get-session", "GET", undefined, cookie);
    assert.equal(await expiredSession.json(), null);

    const signedInAgain = await call("/sign-in/email", "POST", { email, password });
    assert.equal(signedInAgain.status, 200);
    const logoutCookieHeader = signedInAgain.headers.getSetCookie().find((value) => /session_token=/i.test(value));
    assert.ok(logoutCookieHeader);
    const logoutCookie = logoutCookieHeader.split(";")[0];
    const signedOut = await call("/sign-out", "POST", {}, logoutCookie);
    assert.equal(signedOut.status, 200);
    const afterLogout = await call("/get-session", "GET", undefined, logoutCookie);
    assert.equal(await afterLogout.json(), null);
  } finally {
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.account.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.rateLimit.deleteMany({ where: { key: { contains: username } } });
  }
});
