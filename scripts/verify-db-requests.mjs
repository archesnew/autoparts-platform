import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== CHECKING POSTGRESQL CANONICAL DATA FOR CRM REQUESTS ===");
  const req = await prisma.request.findUnique({
    where: { number: "ZP-2026-0148" },
    include: {
      customer: true,
      items: {
        include: { supplierQuotes: { include: { supplier: true } } },
      },
      tasks: true,
      activityEvents: true,
      offers: true,
    },
  });

  if (!req) {
    throw new Error("Request ZP-2026-0148 not found in PostgreSQL!");
  }

  console.log("Request Number:", req.number);
  console.log("Database ID:", req.id);
  console.log("Status:", req.status);
  console.log("Priority:", req.priority);
  console.log("Customer:", req.customer.name, `(${req.customer.email})`);
  console.log("Vehicle:", `${req.vehicleMake} ${req.vehicleModel} ${req.vehicleYear}, VIN: ${req.vehicleVin}`);
  console.log("Items Count:", req.items.length);

  for (const item of req.items) {
    console.log(`- Item [${item.id}]: ${item.name} (OEM: ${item.oem}), Qty: ${item.quantity}`);
    console.log(`  Quotes count: ${item.supplierQuotes.length}`);
    for (const q of item.supplierQuotes) {
      console.log(`    * Quote [${q.id}]: Supplier: ${q.supplier.name} (${q.supplier.country}), Price: ${q.purchasePrice} ${q.currency}, Shipping: ${q.shippingCost}, Status: ${q.status}`);
    }
  }

  console.log("Tasks Count:", req.tasks.length);
  for (const t of req.tasks) {
    console.log(`- Task [${t.id}]: ${t.title} (Status: ${t.status}, Due: ${t.dueAt})`);
  }

  console.log("Activity Logs Count:", req.activityEvents.length);

  // Financial verification of qt-148-1
  console.log("\n=== FINANCIAL VERIFICATION FOR qt-148-1 ===");
  const q1 = await prisma.supplierQuote.findFirst({
    where: {
      supplier: { name: { contains: "Север" } },
      currency: "USD",
      purchasePrice: 82,
    },
    include: { supplier: true, requestItem: true },
  });

  if (q1) {
    console.log("Quote ID:", q1.id);
    console.log("Supplier:", q1.supplier.name, "Country:", q1.supplier.country);
    console.log("Part Number:", q1.partNumber);
    console.log("Unit Purchase Price:", q1.purchasePrice.toString(), q1.currency);
    console.log("Quantity:", q1.requestItem.quantity);
    console.log("Shipping Cost:", q1.deliveryCost?.toString());

    // Tariff Russia: 28% (2800 bp), FX 92 RUB/USD, Min markup 300 RUB per physical part
    const unitPrice = Number(q1.purchasePrice);
    const qty = q1.requestItem.quantity;
    const purchaseTotal = unitPrice * qty; // 82 * 2 = 164 USD
    const unitPercentMarkup = unitPrice * 0.28; // 22.96 USD per part
    const unitMinMarkupUSD = 300 / 92; // 300 RUB / 92 = 3.26 USD per part
    const unitAppliedMarkup = Math.max(unitPercentMarkup, unitMinMarkupUSD); // 22.96 USD
    const totalMarkup = unitAppliedMarkup * qty; // 45.92 USD
    const retailTotal = purchaseTotal + totalMarkup; // 209.92 USD
    const marginPercent = ((totalMarkup / retailTotal) * 100).toFixed(2);

    console.log("Financial Calculation Result:");
    console.log("- Purchase Total:", purchaseTotal, q1.currency);
    console.log("- Percentage Markup (28%):", (unitPercentMarkup * qty).toFixed(2), q1.currency);
    console.log("- Minimum Markup (300 RUB @ 92):", (unitMinMarkupUSD * qty).toFixed(2), q1.currency);
    console.log("- Effective Markup:", totalMarkup.toFixed(2), q1.currency);
    console.log("- Retail Customer Total (without shipping):", retailTotal.toFixed(2), q1.currency);
    console.log("- Margin:", marginPercent, "%");
  }

  const allRequestsCount = await prisma.request.count();
  const allQuotesCount = await prisma.supplierQuote.count();
  const allTasksCount = await prisma.task.count();
  console.log(`\nTotal in DB: Requests = ${allRequestsCount}, SupplierQuotes = ${allQuotesCount}, Tasks = ${allTasksCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
