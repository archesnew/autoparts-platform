export const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "LOGISTICS", "DEMO_VIEWER"] as const;
export type StaffRoleCode = (typeof STAFF_ROLES)[number] | (string & {});

export const STAFF_PERMISSIONS = [
  "admin.access", "logistics.access",
  "requests.read", "requests.create", "requests.update", "requests.assign",
  "customers.read", "customers.update", "customers.contact.read", "customers.internal.read",
  "suppliers.read", "suppliers.manage", "quotes.read", "quotes.manage", "quotes.purchase.read",
  "analytics.read", "finance.read", "finance.settings.read", "finance.settings.update",
  "employees.read", "employees.manage", "audit.read",
  "orders.read", "orders.create", "orders.update", "orders.payment.manage", "orders.shipment.manage",
  "shipments.read", "shipments.update", "logistics.documents.read", "system.manage",
] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number] | (string & {});
export type PermissionOverride = { permissionCode: string; effect: "GRANT" | "DENY" };

/** Fail-closed permission evaluation; role grants are loaded from PostgreSQL. */
export function hasStaffPermission(input: {
  role: string;
  rolePermissions: ReadonlySet<string>;
  overrides?: readonly PermissionOverride[];
  permission: string;
}): boolean {
  if (input.role === "SUPER_ADMIN") return true;
  const override = input.overrides?.find((entry) => entry.permissionCode === input.permission);
  if (override) return override.effect === "GRANT";
  return input.rolePermissions.has(input.permission);
}

export function isKnownStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);
}
