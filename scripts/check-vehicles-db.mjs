import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.customerVehicle.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("All Customer Vehicles in DB:", all.length);
  for (const c of all) {
    console.log(`- ID: ${c.id}, Customer: ${c.customerId}, Make: ${c.make}, Model: ${c.model}, Vin: ${c.vin}, MakeId: ${c.vehicleMakeId}`);
  }
}

main().finally(() => prisma.$disconnect());
