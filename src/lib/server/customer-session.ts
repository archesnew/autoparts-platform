import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/server/db";
import { auth } from "@/lib/server/auth";

export type CustomerContext = {
  userId: string;
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneNumberVerified?: boolean;
};

export class CustomerAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message?: string) {
    super(message || (status === 401 ? "Customer authentication required" : "Access denied"));
    this.status = status;
    this.name = "CustomerAuthorizationError";
  }
}

/**
 * Resolves the authenticated customer context from the session cookie / headers.
 * Ensures the user has role 'CUSTOMER' and has a linked Customer profile in PostgreSQL.
 */
export async function getCustomerContext(incomingHeaders?: Headers): Promise<CustomerContext | null> {
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
      phoneNumber: true,
      phoneNumberVerified: true,
      role: true,
      active: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!user || !user.active) return null;

  // Strict role verification: only CUSTOMER accounts can enter the customer portal
  if (user.role !== "CUSTOMER") return null;

  // If customer record is not directly linked yet, search by phone or email or create one
  let customer = user.customer;
  if (!customer) {
    const normPhone = user.phoneNumber;
    const cleanEmail = user.email ? user.email.trim().toLowerCase() : null;

    let existing = null;
    if (normPhone) {
      existing = await prisma.customer.findFirst({
        where: {
          userId: null,
          normalizedPhone: normPhone,
        },
      });
    }

    if (!existing && cleanEmail) {
      existing = await prisma.customer.findFirst({
        where: {
          userId: null,
          OR: [
            { normalizedEmail: cleanEmail },
            { email: cleanEmail },
          ],
        },
      });
    }

    if (existing) {
      customer = await prisma.customer.update({
        where: { id: existing.id },
        data: { userId: user.id },
        select: { id: true, name: true, phone: true, email: true },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: user.name,
          phone: normPhone,
          normalizedPhone: normPhone,
          email: cleanEmail,
          normalizedEmail: cleanEmail,
          userId: user.id,
        },
        select: { id: true, name: true, phone: true, email: true },
      });
    }
  }

  return {
    userId: user.id,
    customerId: customer.id,
    name: customer.name || user.name,
    email: user.email,
    phone: customer.phone || user.phoneNumber,
    phoneNumberVerified: Boolean(user.phoneNumberVerified),
  };
}

/**
 * Asserts the request is authenticated as a CUSTOMER. Throws CustomerAuthorizationError on failure.
 */
export async function requireCustomerContext(incomingHeaders?: Headers): Promise<CustomerContext> {
  const customer = await getCustomerContext(incomingHeaders);
  if (!customer) {
    throw new CustomerAuthorizationError(401, "Customer login required");
  }
  return customer;
}
