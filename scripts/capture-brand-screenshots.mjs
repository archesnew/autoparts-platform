import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-screenshots-"));
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

  async waitFor(predicateExpression, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(`Boolean(${predicateExpression})`);
        if (val === true) return true;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    const currentUrl = await this.eval("window.location.href").catch(() => "unknown");
    const currentBody = await this.eval("document.body?.innerText?.slice(0, 300)").catch(() => "unknown");
    throw new Error(`Timeout waiting for: ${predicateExpression} at ${currentUrl} (body: ${JSON.stringify(currentBody)})`);
  }

  async captureScreenshot(outputPath, fullPage = false) {
    const result = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: fullPage,
    });
    fs.writeFileSync(outputPath, Buffer.from(result.data, "base64"));
    console.log(`Saved screenshot: ${outputPath}`);
  }
}

async function main() {
  console.log("Preparing user for B2B cabinet screenshot...");
  const suffix = randomUUID().slice(0, 8);
  const managerPassword = `ManagerPass-${suffix}-123!`;
  const managerUser = await prisma.user.create({
    data: { name: `Менеджер ${suffix}`, email: `mgr-${suffix}@zaptut.pro`, role: "SUPER_ADMIN", active: true },
  });
  await prisma.account.create({
    data: { accountId: managerUser.id, providerId: "credential", userId: managerUser.id, password: await hashPassword(managerPassword) },
  });

  console.log("Launching headless Chrome...");
  const chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      "--remote-debugging-port=9223",
      `--user-data-dir=${tempDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,960",
      "--disable-gpu",
      "--force-device-scale-factor=1",
    ],
    { stdio: "ignore" }
  );

  let versionInfo;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9223/json/version");
      versionInfo = await res.json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (!versionInfo?.webSocketDebuggerUrl) {
    throw new Error("Could not connect to Chrome debugging port");
  }

  const targetsRes = await fetch("http://127.0.0.1:9223/json/list");
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

  // 1. Главная страница
  console.log("Navigating to Home (http://127.0.0.1:3000)...");
  await cdp.navigate("http://127.0.0.1:3000/");
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-home.png"));

  // 2. Поиск
  console.log("Interacting with Search on Home page...");
  await cdp.eval(`{
    const input = document.querySelector('input[type="text"]') || document.querySelector('input');
    if (input) {
      input.value = "51712-C1A00";
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  }`);
  await new Promise((r) => setTimeout(r, 600));
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-search.png"));

  // 3. Каталог
  console.log("Navigating to Catalog (http://127.0.0.1:3000/catalog)...");
  await cdp.navigate("http://127.0.0.1:3000/catalog");
  const catalogSnippet = await cdp.eval("document.body.innerText.slice(0, 200)");
  console.log("Catalog text snippet:", catalogSnippet);
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-catalog.png"));

  // 4. B2B-кабинет (/admin)
  console.log("Logging into CRM Admin for B2B cabinet screenshot...");
  await cdp.navigate("http://127.0.0.1:3000/login");
  const loginResult = await cdp.eval(`
    (async () => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ${JSON.stringify(managerUser.email)},
          password: ${JSON.stringify(managerPassword)},
        }),
      });
      return { ok: res.ok, status: res.status };
    })()
  `);
  console.log("Admin sign-in result:", loginResult);

  await cdp.navigate("http://127.0.0.1:3000/admin");
  const adminSnippet = await cdp.eval("document.body.innerText.slice(0, 200)");
  console.log("Admin text snippet before tab click:", adminSnippet);

  console.log("Switching to B2B Suppliers tab in Admin...");
  await cdp.eval(`{
    const btn = Array.from(document.querySelectorAll('aside nav button')).find(b => b.textContent.includes('Поставщики'));
    if (btn) btn.click();
  }`);
  await cdp.waitFor("document.body.innerText.toUpperCase().includes('СЕТЬ ПАРТНЁРОВ')", 10000);
  await new Promise((r) => setTimeout(r, 1200));
  const b2bSnippet = await cdp.eval("document.body.innerText.slice(0, 200)");
  console.log("B2B text snippet:", b2bSnippet);
  await cdp.captureScreenshot(path.join(artifactDir, "screenshot-b2b.png"));

  console.log("Closing Chrome...");
  ws.close();
  chromeProcess.kill();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  // Clean up test user
  await prisma.account.deleteMany({ where: { userId: managerUser.id } });
  await prisma.user.delete({ where: { id: managerUser.id } });
  await prisma.$disconnect();

  console.log("All screenshots successfully captured!");
}

main().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
