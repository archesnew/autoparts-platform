import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(process.cwd(), "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `backup-zaptut-staging-${timestamp}.json`);
  console.log(`=== STARTING LOGICAL BACKUP TO: ${backupFile} ===`);

  try {
    const [
      users,
      staffRoles,
      staffPermissions,
      rolePermissions,
      customers,
      customerVehicles,
      customerAddresses,
      requests,
      requestItems,
      suppliers,
      supplierOffers,
      products,
      orders,
      orderItems,
      payments,
      shipments,
      notifications,
      activityLog,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.staffRole.findMany(),
      prisma.staffPermission.findMany(),
      prisma.rolePermission.findMany(),
      prisma.customer.findMany(),
      prisma.customerVehicle.findMany(),
      prisma.customerAddress.findMany(),
      prisma.request.findMany(),
      prisma.requestItem.findMany(),
      prisma.supplier.findMany(),
      prisma.supplierOffer.findMany(),
      prisma.product.findMany(),
      prisma.order.findMany(),
      prisma.orderItem.findMany(),
      prisma.payment.findMany(),
      prisma.shipment.findMany(),
      prisma.notification.findMany(),
      prisma.activityLog.findMany({ take: 500 }),
    ]);

    const backupData = {
      meta: {
        timestamp,
        version: "1.0",
        platform: "ZAPTUT.PRO Staging",
        tablesCount: 18,
      },
      data: {
        users: users.length,
        staffRoles: staffRoles.length,
        customers: customers.length,
        requests: requests.length,
        suppliers: suppliers.length,
        products: products.length,
        orders: orders.length,
        payments: payments.length,
        shipments: shipments.length,
        notifications: notifications.length,
      },
      dump: {
        users,
        staffRoles,
        staffPermissions,
        rolePermissions,
        customers,
        customerVehicles,
        customerAddresses,
        requests,
        requestItems,
        suppliers,
        supplierOffers,
        products,
        orders,
        orderItems,
        payments,
        shipments,
        notifications,
        activityLog,
      },
    };

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
    console.log(`✓ Backup successfully created! File size: ${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB`);
    console.log("Summary of dumped entities:", backupData.data);
  } catch (err) {
    console.error("Backup failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
