import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/server/db";
import { auth } from "@/lib/server/auth";

export type SupplierContext = {
  userId: string;
  supplierUserId: string;
  supplierId: string;
  supplierName: string;
  supplierCountryCode: string;
  supplierStatus: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER";
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
};

export class SupplierAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message?: string) {
    super(
      message ||
        (status === 401
          ? "Требуется авторизация поставщика"
          : "Доступ к кабинету поставщика запрещён")
    );
    this.status = status;
    this.name = "SupplierAuthorizationError";
  }
}

export async function getSupplierContext(
  incomingHeaders?: Headers
): Promise<SupplierContext | null> {
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
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      supplierMembership: {
        select: {
          id: true,
          supplierId: true,
          role: true,
          status: true,
          supplier: {
            select: {
              id: true,
              name: true,
              countryCode: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.active || !user.email) return null;

  // A supplier user must have a valid supplierMembership
  const membership = user.supplierMembership;
  if (!membership) {
    return null;
  }

  // Check if supplier user account is active
  if (membership.status === "SUSPENDED") {
    return null;
  }

  return {
    userId: user.id,
    supplierUserId: membership.id,
    supplierId: membership.supplier.id,
    supplierName: membership.supplier.name,
    supplierCountryCode: membership.supplier.countryCode,
    supplierStatus: membership.supplier.status,
    name: user.name,
    email: user.email,
    role: membership.role as "OWNER" | "MANAGER",
    status: membership.status as "PENDING" | "ACTIVE" | "SUSPENDED",
  };
}

export async function authorizeSupplierApi(
  incomingHeaders?: Headers
): Promise<SupplierContext | Response> {
  const ctx = await getSupplierContext(incomingHeaders);
  if (!ctx) {
    return Response.json(
      { error: "Требуется авторизация в кабинете поставщика" },
      { status: 401 }
    );
  }

  if (ctx.supplierStatus === "SUSPENDED" || ctx.supplierStatus === "REJECTED") {
    return Response.json(
      {
        error: `Кабинет поставщика временно заблокирован (статус: ${ctx.supplierStatus}). Обратитесь к администрации ZAPTUT.PRO.`,
      },
      { status: 403 }
    );
  }

  return ctx;
}
