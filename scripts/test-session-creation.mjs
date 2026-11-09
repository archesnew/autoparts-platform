import { auth } from "../src/lib/server/auth.ts";
import { prisma } from "../src/lib/server/db.ts";

async function test() {
  const user = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
  console.log("Sample customer:", user?.id, user?.email);
  if (user) {
    try {
      const session = await auth.api.createSession({
        body: { userId: user.id },
        asResponse: true
      });
      console.log("Response headers:", session.headers.get("set-cookie"));
    } catch (e) {
      console.log("Error creating session:", e);
    }
  }
  await prisma.$disconnect();
}
test();
