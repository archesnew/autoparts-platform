import test from "node:test";
import assert from "node:assert/strict";
import { hasStaffPermission, isKnownStaffRole } from "./staff-rbac.ts";

test("SUPER_ADMIN receives full access, including permissions added later", () => {
  assert.equal(hasStaffPermission({ role: "SUPER_ADMIN", rolePermissions: new Set(), permission: "future.permission" }), true);
});

test("MANAGER receives CRM access but not employee or finance settings administration", () => {
  const permissions = new Set(["admin.access", "requests.read", "customers.contact.read", "finance.read"]);
  assert.equal(hasStaffPermission({ role: "MANAGER", rolePermissions: permissions, permission: "admin.access" }), true);
  assert.equal(hasStaffPermission({ role: "MANAGER", rolePermissions: permissions, permission: "finance.read" }), true);
  assert.equal(hasStaffPermission({ role: "MANAGER", rolePermissions: permissions, permission: "finance.settings.update" }), false);
  assert.equal(hasStaffPermission({ role: "MANAGER", rolePermissions: permissions, permission: "employees.manage" }), false);
});

test("ADMIN can manage CRM, staff and finance settings without SUPER_ADMIN system rights", () => {
  const permissions = new Set(["admin.access", "employees.read", "employees.manage", "finance.settings.read", "finance.settings.update"]);
  assert.equal(hasStaffPermission({ role: "ADMIN", rolePermissions: permissions, permission: "admin.access" }), true);
  assert.equal(hasStaffPermission({ role: "ADMIN", rolePermissions: permissions, permission: "finance.settings.update" }), true);
  assert.equal(hasStaffPermission({ role: "ADMIN", rolePermissions: permissions, permission: "system.manage" }), false);
});

test("LOGISTICS permissions do not expose CRM personal, internal or purchase data", () => {
  const permissions = new Set(["logistics.access", "orders.read", "shipments.read", "logistics.documents.read"]);
  for (const permission of ["admin.access", "customers.contact.read", "customers.internal.read", "suppliers.read", "quotes.purchase.read", "finance.read"]) {
    assert.equal(hasStaffPermission({ role: "LOGISTICS", rolePermissions: permissions, permission }), false, permission);
  }
  assert.equal(hasStaffPermission({ role: "LOGISTICS", rolePermissions: permissions, permission: "shipments.read" }), true);
});

test("individual DENY overrides role grants and individual GRANT adds a permission", () => {
  const grants = new Set(["requests.read", "finance.read"]);
  assert.equal(hasStaffPermission({ role: "MANAGER", rolePermissions: grants, overrides: [{ permissionCode: "finance.read", effect: "DENY" }], permission: "finance.read" }), false);
  assert.equal(hasStaffPermission({ role: "MANAGER", rolePermissions: grants, overrides: [{ permissionCode: "employees.read", effect: "GRANT" }], permission: "employees.read" }), true);
});

test("unknown roles fail closed unless an explicit permission is stored", () => {
  assert.equal(isKnownStaffRole("UNRECOGNIZED"), false);
  assert.equal(hasStaffPermission({ role: "UNRECOGNIZED", rolePermissions: new Set(), permission: "admin.access" }), false);
});
