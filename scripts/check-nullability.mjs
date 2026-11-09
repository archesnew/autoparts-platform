import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'users';
  `);
  console.log("Nullability in users:", res);
  await prisma.$disconnect();
}
main().catch(console.error);
