import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const superAdmins = await prisma.user.findMany({
  where: { role: { in: ["SUPER_ADMIN", "MANAGER"] } },
  select: { id: true, email: true, name: true, role: true, accounts: { select: { id: true, providerId: true } } }
});
console.log(JSON.stringify(superAdmins, null, 2));
await prisma.$disconnect();
