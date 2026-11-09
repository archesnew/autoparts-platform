import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-import-"));
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
  console.log("Checking DB connection...");
  const superAdmin = await prisma.user.findUnique({
    where: { email: "mr.artursabirov@gmail.com" },
  });
  if (!superAdmin) {
    throw new Error("SuperAdmin user mr.artursabirov@gmail.com not found!");
  }
  console.log("SuperAdmin user verified:", superAdmin.email, "role:", superAdmin.role);

  console.log("Launching headless Chrome...");
  const chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--remote-debugging-port=9223",
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
      targetsRes = await fetch("http://127.0.0.1:9223/json/list");
      if (targetsRes.ok) break;
    } catch {}
  }

  if (!targetsRes || !targetsRes.ok) {
    chromeProcess.kill();
    throw new Error("Could not connect to Chrome debugging port 9223");
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

  console.log("Signing in as SuperAdmin...");
  await cdp.navigate("http://127.0.0.1:3000/login");
  const loginRes = await cdp.eval(`
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
  console.log("Login result:", loginRes);

  console.log("Navigating to /admin/import...");
  await cdp.navigate("http://127.0.0.1:3000/admin/import");
  await new Promise((r) => setTimeout(r, 1500));

  const textSnippet = await cdp.eval("document.body.innerText.slice(0, 300)");
  console.log("Admin Import page snippet:", textSnippet);

  // Trigger test staging to demonstrate preview table in screenshot
  console.log("Staging a sample feed to display full KPI metrics & preview in UI...");
  const stageRes = await cdp.eval(`
    (async () => {
      const csvContent = "oem;title;brand;price;quantity;condition;external_id\\n" +
        "51712-C1A00;Диск тормозной передний вентилируемый;NORTHLINE;6800;5;NEW;feed-offer-live-01\\n" +
        "28231-2F100;Турбокомпрессор проверенный Б/У;HYUNDAI-OEM;34500;1;USED_GOOD;feed-offer-live-02\\n" +
        "99999-PREVIEW;Стойка стабилизатора усиленная;LEMFORDER;2200;10;NEW;feed-offer-live-03";
      
      const blob = new Blob([csvContent], { type: "text/csv" });
      const file = new File([blob], "dismantle_ru_stock.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("supplierId", "a0000000-0000-0000-0000-000000000001");
      formData.append("source", "RU_DISMANTLE");
      formData.append("forcedFormat", "CSV");

      const res = await fetch("/api/admin/import/upload", {
        method: "POST",
        body: formData,
      });
      return await res.json();
    })()
  `);
  console.log("Sample feed staging result:", stageRes?.ok ? "Success" : stageRes);

  // Refresh page or trigger UI reload to show the staged job
  await cdp.navigate("http://127.0.0.1:3000/admin/import");
  await new Promise((r) => setTimeout(r, 1500));

  // Click on the staged job from history to show preview table if needed
  await cdp.eval(`{
    const viewBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Просмотр') || b.textContent.includes('Превью'));
    if (viewBtn) viewBtn.click();
  }`);
  await new Promise((r) => setTimeout(r, 1200));

  console.log("Capturing screenshot of B2B Import Workspace...");
  const screenshotPath = path.join(artifactDir, "screenshot-admin-import.png");
  await cdp.captureScreenshot(screenshotPath);

  // Clean up test offers and rows
  console.log("Cleaning up test feed staging data...");
  await prisma.supplierOffer.deleteMany({
    where: { externalId: { in: ["feed-offer-live-01", "feed-offer-live-02", "feed-offer-live-03"] } },
  });
  await prisma.importRow.deleteMany({
    where: { externalId: { in: ["feed-offer-live-01", "feed-offer-live-02", "feed-offer-live-03"] } },
  });
  await prisma.importJob.deleteMany({
    where: { fileName: "dismantle_ru_stock.csv" },
  });
  await prisma.product.deleteMany({
    where: { primaryOem: "99999-PREVIEW" },
  });

  console.log("Closing browser...");
  ws.close();
  chromeProcess.kill();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log("B2B Import browser test complete!");
}

main()
  .catch((e) => {
    console.error("Browser test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
