import { NextRequest, NextResponse } from "next/server";
import { requireCustomerContext, CustomerAuthorizationError } from "@/lib/server/customer-session";
import { customerPortalService, CustomerServiceError } from "@/lib/server/customer-portal-service";
import { prisma } from "@/lib/server/db";

export async function GET(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const fullCustomer = await prisma.customer.findUnique({
      where: { id: customer.customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        normalizedPhone: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            phoneNumber: true,
            phoneNumberVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!fullCustomer) {
      return NextResponse.json({ error: "Профиль не найден" }, { status: 404 });
    }

    return NextResponse.json({
      customer: {
        id: fullCustomer.id,
        name: fullCustomer.name,
        email: fullCustomer.email,
        phone: fullCustomer.phone || fullCustomer.user?.phoneNumber || null,
        phoneNumberVerified: Boolean(fullCustomer.user?.phoneNumberVerified),
        createdAt: fullCustomer.createdAt,
        userCreatedAt: fullCustomer.user?.createdAt || fullCustomer.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка загрузки профиля" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const customer = await requireCustomerContext(req.headers);
    const body = await req.json().catch(() => ({}));

    const updated = await customerPortalService.updateProfile(customer.customerId, {
      name: typeof body.name === "string" ? body.name : undefined,
      email: typeof body.email === "string" ? body.email : body.email === null ? null : undefined,
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error) {
    if (error instanceof CustomerAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CustomerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Ошибка обновления профиля" }, { status: 500 });
  }
}
