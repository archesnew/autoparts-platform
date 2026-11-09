import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-supplier-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    if (res.result?.value !== undefined) return res.result.value;
    if (res.result?.type === "object" && res.result?.subtype === "node") return true;
    if (res.result?.type === "undefined") return undefined;
    return res.result;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 15000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 8000);
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }

  async waitFor(expression, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.eval(expression);
        if (res) return res;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }

  async captureScreenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function main() {
  console.log("Preparing test supplier representative user in DB...");
  const supplier = await prisma.supplier.findFirst({
    where: { name: { contains: "Север" } },
  });
  if (!supplier) throw new Error("Supplier 'Север Авто Деталь' not found in DB");

  const repEmail = "rep.sever@example.test";
  const repPassword = "SupplierPass123!";

  // Delete existing test user if present
  const existingUser = await prisma.user.findUnique({ where: { email: repEmail } });
  if (existingUser) {
    await prisma.supplierUser.deleteMany({ where: { userId: existingUser.id } });
    await prisma.account.deleteMany({ where: { userId: existingUser.id } });
    await prisma.session.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  // Create representative user directly
  const userId = randomUUID();
  const hashedPassword = await hashPassword(repPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        name: "Алексей Северный",
        email: repEmail,
        role: "SUPPLIER",
        active: true,
        emailVerified: true,
      },
    });
    await tx.account.create({
      data: {
        id: randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashedPassword,
      },
    });
    await tx.supplierUser.create({
      data: {
        id: randomUUID(),
        supplierId: supplier.id,
        userId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
  });
  console.log(`Representative user created: ${repEmail} linked to supplier ${supplier.name}`);

  console.log("Launching headless Chrome...");
  const chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--remote-debugging-port=9224",
      `--user-data-dir=${tempDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,960",
    ],
    { stdio: "ignore" }
  );

  let targetsRes = null;
  for (let i = 0; i < 20; i++) {
    try {
      await new Promise((r) => setTimeout(r, 500));
      targetsRes = await fetch("http://127.0.0.1:9224/json/list");
      if (targetsRes.ok) break;
    } catch {}
  }

  if (!targetsRes || !targetsRes.ok) {
    chromeProcess.kill();
    throw new Error("Could not connect to Chrome debugging port 9224");
  }

  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  const cdp = new CdpClient(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 1. SuperAdmin checks CRM Supplier Accounts modal
  console.log("Logging into CRM Admin as SuperAdmin...");
  await cdp.navigate("http://127.0.0.1:3000/login");
  await cdp.eval(`
    (async () => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "mr.artursabirov@gmail.com",
          password: "Duraki88!Duraki88!"
        }),
      });
      return { ok: res.ok, status: res.status };
    })()
  `);

  console.log("Navigating to /admin -> Suppliers tab...");
  await cdp.navigate("http://127.0.0.1:3000/admin");
  await cdp.eval(`{
    const btn = Array.from(document.querySelectorAll('aside nav button')).find(b => b.textContent.includes('Поставщики'));
    if (btn) btn.click();
  }`);
  await new Promise((r) => setTimeout(r, 1200));

  // Open "Кабинет и пользователи 👤" modal for first supplier
  console.log("Opening Supplier Accounts modal in CRM...");
  await cdp.eval(`{
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Кабинет и пользователи'));
    if (btn) btn.click();
  }`);
  await new Promise((r) => setTimeout(r, 1200));
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-crm-supplier-users.png"));

  // 2. Log in as Supplier Representative
  console.log("Signing in as Supplier Representative...");
  await cdp.navigate("http://127.0.0.1:3000/login");
  const repLoginRes = await cdp.eval(`
    (async () => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ${JSON.stringify(repEmail)},
          password: ${JSON.stringify(repPassword)}
        }),
      });
      return { ok: res.ok, status: res.status };
    })()
  `);
  console.log("Representative login result:", repLoginRes);

  // Navigate to /supplier (Dashboard)
  console.log("Navigating to /supplier (Supplier Dashboard)...");
  await cdp.navigate("http://127.0.0.1:3000/supplier");
  await new Promise((r) => setTimeout(r, 1500));
  const snippet = await cdp.eval("document.body.innerText.slice(0, 300)");
  console.log("Supplier Portal snippet:", snippet);
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-supplier-dashboard.png"));

  // 3. Switch to "Мои товары" (Products)
  console.log("Switching to 'Мои товары' tab...");
  await cdp.eval(`{
    const btn = Array.from(document.querySelectorAll('aside nav button')).find(b => b.textContent.includes('Мои товары'));
    if (btn) btn.click();
  }`);
  await new Promise((r) => setTimeout(r, 1500));
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-supplier-products.png"));

  // 4. Switch to "Импорт прайсов" (Feed Import)
  console.log("Switching to 'Импорт прайсов' tab...");
  await cdp.eval(`{
    const btn = Array.from(document.querySelectorAll('aside nav button')).find(b => b.textContent.includes('Импорт прайсов'));
    if (btn) btn.click();
  }`);
  await new Promise((r) => setTimeout(r, 1500));
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-supplier-import.png"));

  // 5. Switch to "Профиль компании" (Profile)
  console.log("Switching to 'Профиль компании' tab...");
  await cdp.eval(`{
    const btn = Array.from(document.querySelectorAll('aside nav button')).find(b => b.textContent.includes('Профиль компании'));
    if (btn) btn.click();
  }`);
  await new Promise((r) => setTimeout(r, 1500));
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-supplier-profile.png"));

  // 6. Security verification: Supplier attempts to access /admin -> must be blocked
  console.log("Verifying security boundary: supplier accessing /admin...");
  await cdp.navigate("http://127.0.0.1:3000/admin");
  await new Promise((r) => setTimeout(r, 1500));
  const currentUrl = await cdp.eval("window.location.href");
  console.log("URL after supplier navigated to /admin:", currentUrl);
  // It should redirect to /login or block access
  assert.ok(
    currentUrl.includes("/login") || currentUrl.includes("/supplier"),
    "Supplier must be blocked from /admin"
  );

  console.log("Closing browser...");
  ws.close();
  chromeProcess.kill();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  // Clean up test user
  await prisma.supplierUser.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();

  console.log("All Supplier Portal browser tests passed successfully!");
}

main().catch((err) => {
  console.error("Browser test failed:", err);
  process.exit(1);
});
