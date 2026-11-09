import "server-only";

import { prisma } from "@/lib/server/db";
import { supplierPortalService } from "@/lib/server/supplier-portal-service";

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;

  try {
    const invitation = await prisma.supplierInvitation.findUnique({
      where: { token },
      include: {
        supplier: {
          select: { id: true, name: true, countryCode: true },
        },
      },
    });

    if (!invitation) {
      return Response.json({ error: "Приглашение не найдено" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return Response.json(
        { error: "Приглашение уже использовано или отозвано", status: invitation.status },
        { status: 400 }
      );
    }

    if (new Date() > invitation.expiresAt) {
      return Response.json(
        { error: "Срок действия приглашения истёк" },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      email: invitation.email,
      role: invitation.role,
      supplier: invitation.supplier,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка проверки приглашения";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;

  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return Response.json({ error: "Укажите имя представителя" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 12) {
      return Response.json(
        { error: "Пароль должен содержать не менее 12 символов" },
        { status: 400 }
      );
    }

    const result = await supplierPortalService.acceptInvitation({
      token,
      name: name.trim(),
      password,
    });

    return Response.json({
      ok: true,
      user: result,
      message: "Аккаунт представителя успешно активирован",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка активации приглашения";
    return Response.json({ error: message }, { status: 400 });
  }
}
