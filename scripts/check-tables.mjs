import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  console.log("Tables in DB:", res.map(r => r.table_name));
  await prisma.$disconnect();
}
main().catch(console.error);
