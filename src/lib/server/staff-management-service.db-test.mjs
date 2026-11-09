import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { auth } from "./auth.ts";
import { staffManagementService } from "./staff-management-service.ts";
import { GET as getStaffList } from "../../app/api/admin/staff/route.ts";
import { GET as getStaffMember, PATCH as patchStaffMember } from "../../app/api/admin/staff/[id]/route.ts";
import { PATCH as patchStaffStatus } from "../../app/api/admin/staff/[id]/status/route.ts";
import { DELETE as deleteStaffSessions } from "../../app/api/admin/staff/[id]/sessions/route.ts";
import { GET as getInvitations, POST as postInvitation } from "../../app/api/admin/staff/invitations/route.ts";
import { DELETE as deleteInvitation } from "../../app/api/admin/staff/invitations/[id]/route.ts";
import { GET as getInvitationByToken, POST as postAcceptInvitation } from "../../app/api/staff/invitations/[token]/route.ts";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("Integration test requires DATABASE_URL from local .env");
const databaseUrl = new URL(configuredUrl);
if (!["127.0.0.1", "localhost"].includes(databaseUrl.hostname) || databaseUrl.pathname !== "/zaptut_dev") {
  throw new Error("Refusing integration tests outside the dedicated local zaptut_dev database");
}

const prisma = new PrismaClient();

async function createStaffSession(role) {
  const token = randomUUID();
  const email = `staff-test-${token}@example.test`;
  const password = `Test-Pass-${token}-123!`;
  const ip = `198.51.100.${20 + (Number.parseInt(token.slice(0, 2), 16) % 200)}`;

  const user = await prisma.user.create({
    data: { name: `Staff ${role} ${token.slice(0, 6)}`, email, role, active: true },
    select: { id: true, name: true, role: true, email: true },
  });

  await prisma.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await hashPassword(password),
    },
  });

  const response = await auth.handler(
    new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email, password }),
    }),
  );

  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error(`Could not sign in staff user for role ${role}`);

  return {
    user,
    headers: new Headers({
      cookie: cookie.split(";")[0],
      "x-forwarded-for": ip,
    }),
  };
}

test("Staff Management System: Comprehensive verification", async (t) => {
  let superAdminSession;
  let adminSession;
  let managerSession;

  t.before(async () => {
    superAdminSession = await createStaffSession("SUPER_ADMIN");
    adminSession = await createStaffSession("ADMIN");
    managerSession = await createStaffSession("MANAGER");
  });

  t.after(async () => {
    await prisma.$disconnect();
  });

  await t.test("1. SUPER_ADMIN can list all staff members", async () => {
    const res = await getStaffList(
      new Request("http://127.0.0.1:3000/api/admin/staff", {
        headers: superAdminSession.headers,
      }),
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.staff));
    assert.ok(data.staff.length >= 3);
    const superFound = data.staff.find((s) => s.id === superAdminSession.user.id);
    assert.ok(superFound);
    assert.equal(superFound.role, "SUPER_ADMIN");
    assert.equal(superFound.active, true);
  });

  let createdInvitation;

  await t.test("2. SUPER_ADMIN can create an employee invitation (7-day validity)", async () => {
    const inviteEmail = `new-emp-${randomUUID().slice(0, 8)}@example.test`;
    const res = await postInvitation(
      new Request("http://127.0.0.1:3000/api/admin/staff/invitations", {
        method: "POST",
        headers: new Headers({
          ...Object.fromEntries(superAdminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          name: "Василий Петров",
          email: inviteEmail,
          jobTitle: "Менеджер отдела подбора",
          role: "MANAGER",
          permissions: [{ permissionCode: "quotes.read", effect: "GRANT" }],
        }),
      }),
    );

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.success);
    assert.ok(data.invitation.token);
    assert.equal(data.invitation.status, "PENDING");
    assert.equal(data.invitation.role, "MANAGER");
    assert.equal(data.invitation.jobTitle, "Менеджер отдела подбора");
    createdInvitation = data.invitation;

    // Check expiry is ~7 days
    const expiresAt = new Date(data.invitation.expiresAt);
    const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    assert.ok(diffDays > 6.8 && diffDays <= 7.1);
  });

  await t.test("3. Security: Cannot invite SUPER_ADMIN through the form", async () => {
    const res = await postInvitation(
      new Request("http://127.0.0.1:3000/api/admin/staff/invitations", {
        method: "POST",
        headers: new Headers({
          ...Object.fromEntries(superAdminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          name: "Фейковый Админ",
          email: `fake-super-${randomUUID().slice(0, 8)}@example.test`,
          role: "SUPER_ADMIN",
        }),
      }),
    );

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("SUPER_ADMIN"));
  });

  await t.test("4. Security: Non-SUPER_ADMIN cannot create invitations", async () => {
    const res = await postInvitation(
      new Request("http://127.0.0.1:3000/api/admin/staff/invitations", {
        method: "POST",
        headers: new Headers({
          ...Object.fromEntries(adminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          name: "Несанкционированный",
          email: `unauth-${randomUUID().slice(0, 8)}@example.test`,
          role: "MANAGER",
        }),
      }),
    );

    // ADMIN has employees.manage permission code in role_permissions, but service layer strictly enforces caller.role === 'SUPER_ADMIN'
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("SUPER_ADMIN"));
  });

  await t.test("5. Public endpoint retrieves invitation info by token without passwords", async () => {
    const res = await getInvitationByToken(
      new Request(`http://127.0.0.1:3000/api/staff/invitations/${createdInvitation.token}`),
      { params: Promise.resolve({ token: createdInvitation.token }) },
    );

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.invitation.name, "Василий Петров");
    assert.equal(data.invitation.email, createdInvitation.email);
    assert.equal(data.invitation.role, "MANAGER");
    assert.equal(data.invitation.jobTitle, "Менеджер отдела подбора");
    assert.ok(!data.invitation.password);
  });

  let activatedEmployee;
  const newEmployeePassword = "SecurePassword123!Valid";

  await t.test("6. Employee accepts invitation and sets password", async () => {
    const res = await postAcceptInvitation(
      new Request(`http://127.0.0.1:3000/api/staff/invitations/${createdInvitation.token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Василий Петров",
          password: newEmployeePassword,
        }),
      }),
      { params: Promise.resolve({ token: createdInvitation.token }) },
    );

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.user.email, createdInvitation.email);
    activatedEmployee = data.user;

    // Check invitation is marked ACCEPTED in DB
    const dbInv = await prisma.staffInvitation.findUnique({
      where: { token: createdInvitation.token },
    });
    assert.equal(dbInv.status, "ACCEPTED");
    assert.ok(dbInv.acceptedAt);
  });

  let newEmployeeSession;

  await t.test("7. Newly activated employee can sign in and establish session", async () => {
    const response = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.99",
        },
        body: JSON.stringify({
          email: createdInvitation.email,
          password: newEmployeePassword,
        }),
      }),
    );

    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie");
    assert.ok(cookie);
    newEmployeeSession = {
      headers: new Headers({
        cookie: cookie.split(";")[0],
        "x-forwarded-for": "198.51.100.99",
      }),
    };

    // Employee can view staff list (has MANAGER -> requests.read, etc.)
    const checkUser = await staffManagementService.getStaffMember(
      activatedEmployee.id,
      superAdminSession.user,
    );
    assert.equal(checkUser.activeSessionCount, 1);
  });

  await t.test("8. SUPER_ADMIN can update employee details and role", async () => {
    const res = await patchStaffMember(
      new Request(`http://127.0.0.1:3000/api/admin/staff/${activatedEmployee.id}`, {
        method: "PATCH",
        headers: new Headers({
          ...Object.fromEntries(superAdminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          name: "Василий В. Петров",
          jobTitle: "Старший специалист по логистике",
          role: "LOGISTICS",
        }),
      }),
      { params: Promise.resolve({ id: activatedEmployee.id }) },
    );

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.success);
    assert.equal(data.staff.name, "Василий В. Петров");
    assert.equal(data.staff.jobTitle, "Старший специалист по логистике");
    assert.equal(data.staff.role, "LOGISTICS");
  });

  await t.test("9. SUPER_ADMIN can block employee (terminates sessions immediately)", async () => {
    const res = await patchStaffStatus(
      new Request(`http://127.0.0.1:3000/api/admin/staff/${activatedEmployee.id}/status`, {
        method: "PATCH",
        headers: new Headers({
          ...Object.fromEntries(superAdminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: activatedEmployee.id }) },
    );

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.active, false);

    // Verify all sessions were purged
    const dbSessions = await prisma.session.findMany({
      where: { userId: activatedEmployee.id },
    });
    assert.equal(dbSessions.length, 0);

    // Verify blocked employee can no longer use their old session cookie
    const testApi = await getStaffList(
      new Request("http://127.0.0.1:3000/api/admin/staff", {
        headers: newEmployeeSession.headers,
      }),
    );
    assert.equal(testApi.status, 401);
  });

  await t.test("10. SUPER_ADMIN can unblock employee", async () => {
    const res = await patchStaffStatus(
      new Request(`http://127.0.0.1:3000/api/admin/staff/${activatedEmployee.id}/status`, {
        method: "PATCH",
        headers: new Headers({
          ...Object.fromEntries(superAdminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ id: activatedEmployee.id }) },
    );

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.active, true);
  });

  await t.test("11. Audit history records staff actions", async () => {
    const logs = await staffManagementService.getStaffAuditHistory(
      activatedEmployee.id,
      superAdminSession.user,
    );
    assert.ok(logs.length >= 3);
    const actions = logs.map((l) => l.action);
    assert.ok(actions.includes("STAFF_REGISTERED"));
    assert.ok(actions.includes("STAFF_UPDATED"));
    assert.ok(actions.includes("STAFF_BLOCKED"));
    assert.ok(actions.includes("STAFF_UNBLOCKED"));
  });

  await t.test("12. Cannot block SUPER_ADMIN or self", async () => {
    const res = await patchStaffStatus(
      new Request(`http://127.0.0.1:3000/api/admin/staff/${superAdminSession.user.id}/status`, {
        method: "PATCH",
        headers: new Headers({
          ...Object.fromEntries(superAdminSession.headers.entries()),
          "content-type": "application/json",
        }),
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: superAdminSession.user.id }) },
    );

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("собственный аккаунт"));
  });
});
