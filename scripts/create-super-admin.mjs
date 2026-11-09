import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const email = process.env.ZAPTUT_ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ZAPTUT_ADMIN_NAME?.trim();
const password = process.env.ZAPTUT_ADMIN_PASSWORD;

try {
  if (!email || !name || !password) {
    console.error("Set ZAPTUT_ADMIN_EMAIL, ZAPTUT_ADMIN_NAME and ZAPTUT_ADMIN_PASSWORD in this PowerShell session first.");
    process.exitCode = 1;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2 || name.length > 120) {
    console.error("Email or name format is invalid.");
    process.exitCode = 1;
  } else if (password.length < 14 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    console.error("Password must be 14–128 characters and include upper/lowercase letters, a number and a symbol.");
    process.exitCode = 1;
  } else {
    const passwordHash = await hashPassword(password);
    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email }, select: { role: true } });
      if (existing) return existing.role === "SUPER_ADMIN" ? "same-admin" : "email-exists";
      if (await tx.user.count({ where: { role: "SUPER_ADMIN" } })) return "admin-exists";
      const user = await tx.user.create({
        data: { name, email, role: "SUPER_ADMIN", active: true, emailVerified: true },
        select: { id: true },
      });
      await tx.account.create({
        data: { accountId: user.id, providerId: "credential", userId: user.id, password: passwordHash },
      });
      return "created";
    }, { isolationLevel: "Serializable" });
    if (outcome === "created") console.info("First SUPER_ADMIN created. The supplied password was not logged.");
    else {
      const messages = {
        "same-admin": "A SUPER_ADMIN account already exists for this email; no changes made.",
        "email-exists": "This email already belongs to an employee; no changes made.",
        "admin-exists": "A SUPER_ADMIN already exists; refusing to create another first administrator.",
      };
      console.error(messages[outcome]);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error("Unable to create SUPER_ADMIN:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  delete process.env.ZAPTUT_ADMIN_PASSWORD;
}
