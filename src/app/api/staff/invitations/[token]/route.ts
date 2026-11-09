import "server-only";

import { staffManagementService } from "@/lib/server/staff-management-service.ts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const invitation = await staffManagementService.getInvitationByToken(token);
    return Response.json({ invitation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Приглашение не найдено";
    return Response.json({ error: message }, { status: 404 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const { password, name } = body;
  if (!password || typeof password !== "string" || password.length < 8) {
    return Response.json(
      { error: "Пароль должен содержать не менее 8 символов" },
      { status: 400 },
    );
  }

  try {
    const user = await staffManagementService.acceptInvitation({
      token,
      name,
      password,
    });
    return Response.json({ success: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка принятия приглашения";
    return Response.json({ error: message }, { status: 400 });
  }
}
