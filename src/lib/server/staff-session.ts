import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/server/db";
import { auth } from "@/lib/server/auth";
import { hasStaffPermission, type StaffPermission } from "@/lib/server/staff-rbac";

export type StaffContext = {
  userId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
};

export class StaffAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? "Authentication required" : "Permission denied");
    this.status = status;
    this.name = "StaffAuthorizationError";
  }
}

export async function getStaffContext(incomingHeaders?: Headers): Promise<StaffContext | null> {
  let reqHeaders: Headers;
  if (incomingHeaders) {
    reqHeaders = incomingHeaders;
  } else {
    try {
      reqHeaders = await headers();
    } catch {
      return null;
    }
  }
  const session = await auth.api.getSession({ headers: reqHeaders });
  let userId = session?.user?.id;

  if (!userId) {
    const authHeader = reqHeaders.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const dbSession = await prisma.session.findFirst({
        where: { token, expiresAt: { gt: new Date() } },
        select: { userId: true },
      });
      if (dbSession) {
        userId = dbSession.userId;
      }
    }
  }

  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      roleDefinition: { select: { permissions: { select: { permissionCode: true } } } },
      permissionOverrides: { select: { permissionCode: true, effect: true } },
    },
  });
  if (!user || !user.active || !user.email) return null;
  if (user.role === "SUPPLIER" || user.role === "CUSTOMER") return null;

  const rolePermissions = new Set(user.roleDefinition?.permissions?.map((grant) => grant.permissionCode) ?? []);
  const permissionCodes = new Set(rolePermissions);
  for (const override of user.permissionOverrides ?? []) {
    if (override.effect === "GRANT") permissionCodes.add(override.permissionCode);
    else permissionCodes.delete(override.permissionCode);
  }
  if (user.role === "SUPER_ADMIN") {
    const all = await prisma.staffPermission.findMany({ select: { code: true } });
    for (const permission of all) permissionCodes.add(permission.code);
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: [...permissionCodes],
  };
}

export function staffHasPermission(staff: StaffContext, permission: StaffPermission): boolean {
  const overrides = staff.permissions.map((permissionCode) => ({ permissionCode, effect: "GRANT" as const }));
  return hasStaffPermission({
    role: staff.role,
    rolePermissions: new Set(staff.permissions),
    overrides,
    permission,
  });
}

/** Use at the start of every protected Route Handler or Server Action. */
export async function requireStaffPermission(permission: StaffPermission, incomingHeaders?: Headers): Promise<StaffContext> {
  const staff = await getStaffContext(incomingHeaders);
  if (!staff) throw new StaffAuthorizationError(401);
  if (!staffHasPermission(staff, permission)) throw new StaffAuthorizationError(403);
  return staff;
}

/** JSON-safe guard for Route Handlers; returns a 401/403 Response or the employee context. */
export async function authorizeStaffApi(permission: StaffPermission, incomingHeaders?: Headers): Promise<StaffContext | Response> {
  try {
    return await requireStaffPermission(permission, incomingHeaders);
  } catch (error) {
    if (error instanceof StaffAuthorizationError) {
      return Response.json({ error: error.status === 401 ? "unauthorized" : "forbidden" }, { status: error.status });
    }
    throw error;
  }
}
