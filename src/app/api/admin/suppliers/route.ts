import "server-only";

import { authorizeStaffApi } from "@/lib/server/staff-session";
import { prisma } from "@/lib/server/db";
import { COUNTRY_NAME_MAP } from "@/lib/server/request-service";

export async function GET(request: Request) {
  const staff = await authorizeStaffApi("suppliers.read", request.headers);
  if (staff instanceof Response) return staff;

  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            offers: true,
            importJobs: true,
          },
        },
        offers: {
          select: {
            status: true,
            lastSeenAt: true,
          },
        },
        importJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            fileName: true,
            fileFormat: true,
            status: true,
            totalRows: true,
            validRows: true,
            errorRows: true,
            createdAt: true,
          },
        },
      },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const dto = suppliers.map((s) => {
      const lastJob = s.importJobs[0] || null;
      const activeOffersCount = s.offers.filter(
        (o) => o.status === "IN_STOCK" || o.status === "ON_REQUEST"
      ).length;
      const archivedOffersCount = s.offers.filter(
        (o) => o.status === "ARCHIVED_SOLD"
      ).length;
      const staleOffersCount = s.offers.filter(
        (o) => new Date(o.lastSeenAt) < sevenDaysAgo
      ).length;

      return {
        id: s.id,
        name: s.name,
        country: COUNTRY_NAME_MAP[s.countryCode] || s.countryCode,
        contact: s.contactName || "—",
        phone: s.phone || "—",
        email: s.email || "—",
        specialty: s.specialization || "Автозапчасти",
        terms: s.terms || "Стандартные условия",
        status:
          s.status === "ACTIVE"
            ? "Активен"
            : s.status === "SUSPENDED"
            ? "Приостановлен"
            : "На проверке",
        lastContact: lastJob
          ? new Date(lastJob.createdAt).toLocaleDateString("ru-RU")
          : "—",
        lastImportDate: lastJob ? lastJob.createdAt.toISOString() : null,
        lastJobStatus: lastJob ? lastJob.status : null,
        lastJobFileName: lastJob ? lastJob.fileName : null,
        totalOffers: s._count.offers,
        activeOffersCount,
        archivedOffersCount,
        staleOffersCount,
        isPriceStale: s.offers.length > 0 && staleOffersCount === s.offers.length,
        internalNote: s.internalNote || "",
        events: [],
      };
    });

    return Response.json({ suppliers: dto });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить список поставщиков";
    return Response.json({ error: message }, { status: 500 });
  }
}
