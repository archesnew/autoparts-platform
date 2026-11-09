import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'verifications';
  `);
  console.log("Columns in verifications:", res);
  await prisma.$disconnect();
}
main().catch(console.error);
