import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.customerVehicle.count();
  console.log("Customer vehicles count:", count);
  // Add columns if not exist
  await prisma.$executeRawUnsafe(`ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS body_type TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS color_name TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS color_code TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE customer_vehicles ADD COLUMN IF NOT EXISTS color_hex TEXT;`);
  console.log("Columns successfully added!");
  await prisma.$disconnect();
}
main().catch(console.error);
