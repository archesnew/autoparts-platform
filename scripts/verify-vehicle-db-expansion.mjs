/**
 * Verifies ZAPTUT Vehicle Database expansion coverage, regional checklist,
 * year semantics preservation, exclusion of motorcycles/buses/heavy trucks,
 * and source provenance records.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CHECKLIST = [
  // China
  ["BYD", ["Atto 3", "Seal", "Dolphin", "Song Plus", "Tang"]],
  ["Geely", ["Monjaro", "Tugella", "Coolray", "Atlas"]],
  ["Haval", ["Jolion", "F7", "Dargo"]],
  ["Chery", ["Tiggo 4", "Tiggo 7", "Tiggo 8"]],
  ["Exeed", ["TXL", "VX", "RX"]],
  ["Omoda", ["C5"]],
  ["Jaecoo", ["J7"]],
  ["Li Auto", ["L6", "L7", "L9"]],
  ["Zeekr", ["001", "007", "X"]],
  ["Voyah", ["Free"]],
  // Europe
  ["BMW", ["3 Series", "5 Series", "X3", "X5", "X7"]],
  ["Mercedes-Benz", ["C-Class", "E-Class", "GLC", "GLE", "Sprinter"]],
  ["Audi", ["A3", "A4", "A6", "Q5", "Q7"]],
  ["Volkswagen", ["Golf", "Passat", "Tiguan", "Touareg", "Transporter"]],
  ["Skoda", ["Octavia", "Superb", "Kodiaq"]],
  // Japan & Korea
  ["Toyota", ["Camry", "Corolla", "RAV4", "Land Cruiser", "Prado", "Hilux"]],
  ["Nissan", ["Qashqai", "X-Trail", "Patrol"]],
  ["Honda", ["CR-V", "Civic", "Accord"]],
  ["Mazda", ["3", "6", "CX-5"]],
  ["Kia", ["Rio", "Ceed", "Sportage", "Sorento"]],
  ["Hyundai", ["Solaris", "Elantra", "Tucson", "Santa Fe", "Creta"]],
  // Russia
  ["Lada", ["Granta", "Vesta", "Niva", "Largus"]],
  ["UAZ", ["Patriot"]],
  ["GAZ", ["GAZelle"]],
];

async function main() {
  const [makesCount, modelsCount, gensCount, aliasesCount, sourcesCount] = await Promise.all([
    prisma.vehicleMake.count(),
    prisma.vehicleModel.count(),
    prisma.vehicleGeneration.count(),
    prisma.vehicleAlias.count(),
    prisma.vehicleSourceRecord.count(),
  ]);

  console.log("=== DB Totals ===", { makesCount, modelsCount, gensCount, aliasesCount, sourcesCount });

  const bySource = await prisma.vehicleModel.groupBy({ by: ["primarySourceId"], _count: { id: true } });
  const byYearSem = await prisma.vehicleModel.groupBy({ by: ["yearSemantics"], _count: { id: true } });
  const byCategory = await prisma.vehicleModel.groupBy({ by: ["category"], _count: { id: true } });

  console.log("By primarySourceId:", Object.fromEntries(bySource.map((x) => [x.primarySourceId || "null", x._count.id])));
  console.log("By yearSemantics:", Object.fromEntries(byYearSem.map((x) => [x.yearSemantics || "null", x._count.id])));
  console.log("By category:", Object.fromEntries(byCategory.map((x) => [x.category, x._count.id])));

  // Ensure no heavy-duty / moto / bus makes leaked into passenger/LCV makes
  const leaked = await prisma.vehicleMake.findMany({
    where: { category: { notIn: ["PASSENGER", "COMMERCIAL"] } },
    select: { id: true, category: true },
  });
  console.log("Non-passenger/LCV makes:", leaked.length);

  let missingTotal = 0;
  for (const [makeName, reqModels] of CHECKLIST) {
    const make = await prisma.vehicleMake.findFirst({
      where: {
        OR: [
          { name: { equals: makeName, mode: "insensitive" } },
          { aliases: { some: { alias: makeName.toLowerCase() } } },
        ],
      },
      include: {
        models: {
          select: {
            id: true,
            name: true,
            nameRu: true,
            yearFrom: true,
            yearSemantics: true,
          },
        },
        aliases: { select: { alias: true } },
      },
    });
    if (!make) {
      console.log(`MISSING MAKE: ${makeName}`);
      missingTotal += reqModels.length;
      continue;
    }
    const missing = [];
    for (const rm of reqModels) {
      const rl = rm.toLowerCase();
      const hit = make.models.find(
        (m) =>
          m.name.toLowerCase().includes(rl) ||
          (m.nameRu && m.nameRu.toLowerCase().includes(rl)) ||
          (rm === "3 Series" && /(3er|3 series|3 серия|316|318|320|330)/i.test(m.name)) ||
          (rm === "5 Series" && /(5er|5 series|5 серия|520|525|530)/i.test(m.name)) ||
          (rm === "3" && /mazda\s*3|^3$/i.test(m.name)) ||
          (rm === "6" && /mazda\s*6|^6$/i.test(m.name)) ||
          (rm === "Ceed" && /cee'?d/i.test(m.name)) ||
          (rm === "GAZelle" && /gazelle|газель/i.test(m.name))
      );
      if (!hit) missing.push(rm);
    }
    if (missing.length > 0) {
      console.log(`MISSING in ${make.name} (${make.models.length} models):`, missing);
      missingTotal += missing.length;
    } else {
      console.log(`✓ ${make.name} (${make.models.length} total models) — all ${reqModels.length} checklist items found`);
    }
  }

  console.log(`\nChecklist missing count: ${missingTotal}`);
  if (missingTotal > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
