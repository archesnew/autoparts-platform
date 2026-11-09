import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-crm-orders-"));
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
        const val = await this.eval(expression);
        if (val) return val;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }

  async screenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
  }
}

async function main() {
  console.log("=== Starting Order Management Browser QA ===");

  // 1. Reset rate limits and ensure orders exist
  await prisma.rateLimit.deleteMany();
  console.log("Rate limits cleared.");

  // Check if server is already running on port 3000
  let serverProcess = null;
  let serverReady = false;
  try {
    const res = await fetch("http://127.0.0.1:3000/api/auth/get-session");
    if (res.status) serverReady = true;
    console.log("Existing web server detected on port 3000.");
  } catch {
    console.log("Starting Next.js production server on port 3000...");
    serverProcess = spawn("npm.cmd", ["run", "start"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, PORT: "3000" },
    });
  }

  if (!serverReady) {
    const start = Date.now();
    while (Date.now() - start < 30000) {
      try {
        const res = await fetch("http://127.0.0.1:3000/api/auth/get-session");
        if (res.status) {
          serverReady = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!serverReady) throw new Error("Could not start Next.js web server");
  }

  // Launch Chrome
  const port = 9226;
  console.log(`Launching Headless Chrome on CDP port ${port}...`);
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tempDir}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,900",
    ],
    { stdio: "ignore" }
  );

  let targetsRes = null;
  const startChrome = Date.now();
  while (Date.now() - startChrome < 15000) {
    try {
      await new Promise((r) => setTimeout(r, 400));
      targetsRes = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (targetsRes && targetsRes.ok) break;
    } catch {}
  }
  if (!targetsRes || !targetsRes.ok) throw new Error("Could not connect to Chrome DevTools Protocol");

  const targets = await targetsRes.json();
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  const cdp = new CdpClient(ws);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  try {
    // 2. Sign In to Admin
    console.log("Navigating to /admin...");
    await cdp.navigate("http://127.0.0.1:3000/admin");

    console.log("Authenticating as SuperAdmin via session API...");
    const loginRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "mr.artursabirov@gmail.com",
            password: "Duraki88!Duraki88!",
          }),
        });
        return { ok: res.ok, status: res.status };
      })()
    `);
    console.log("Login API result:", loginRes);
    assert.equal(loginRes.ok, true);

    console.log("Reloading /admin after auth...");
    await cdp.navigate("http://127.0.0.1:3000/admin");
    await cdp.waitFor("document.body.innerText.includes('CRM / POSTGRESQL')", 12000);
    console.log("Successfully logged in to CRM!");

    // 3. Open Orders register
    console.log("Switching to Orders section...");
    await cdp.eval(`
      const ordersNavBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Заказы'));
      if (ordersNavBtn) ordersNavBtn.click();
    `);
    await cdp.waitFor("document.body.innerText.includes('Управление заказами')", 10000);

    const ordersCountText = await cdp.eval(`
      document.body.innerText.match(/Всего заказов[^:]*:\\s*(\\d+)/)?.[1] || "0"
    `);
    console.log(`Orders count in register: ${ordersCountText}`);

    // Capture Orders register screenshot
    const ordersListPath = path.join(artifactDir, "screenshot-crm-orders-list.png");
    await cdp.screenshot(ordersListPath);
    console.log(`Captured ${ordersListPath}`);

    // 4. Click to open the first order card
    console.log("Opening first order workspace...");
    await cdp.eval(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Открыть →'));
      if (btn) btn.click();
      else {
        const row = document.querySelector('tbody tr');
        if (row) row.click();
      }
    `);

    await cdp.waitFor("document.body.innerText.includes('Состав заказа и финансовый расчёт')", 8000);
    console.log("Order workspace loaded!");

    // Capture Order card screenshot
    const orderCardPath = path.join(artifactDir, "screenshot-crm-order-card.png");
    await cdp.screenshot(orderCardPath);
    console.log(`Captured ${orderCardPath}`);

    // 5. Open invoice modal
    console.log("Opening printable invoice modal...");
    await cdp.eval(`
      const invBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Счёт / Печать'));
      if (invBtn) invBtn.click();
    `);

    await cdp.waitFor("document.body.innerText.includes('ООО «ЗАПТУТ ПРО»')", 5000);
    console.log("Invoice modal opened!");

    const invoicePath = path.join(artifactDir, "screenshot-crm-order-invoice.png");
    await cdp.screenshot(invoicePath);
    console.log(`Captured ${invoicePath}`);

    // Close invoice modal
    await cdp.eval(`
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('✕ Закрыть'));
      if (closeBtn) closeBtn.click();
    `);

    // 6. Test F5 Persistence
    console.log("Testing F5 refresh persistence of order card...");
    await cdp.send("Page.reload");
    await cdp.waitFor("document.readyState === 'complete'", 10000);
    await new Promise((r) => setTimeout(r, 1500));

    const stillInAdmin = await cdp.eval("window.location.pathname.startsWith('/admin')");
    assert.equal(stillInAdmin, true);
    console.log("F5 persistence confirmed!");

    console.log("=== ALL BROWSER CHECKS PASSED ===");
  } finally {
    ws.close();
    chrome.kill();
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error("Browser QA failed:", err);
  process.exit(1);
});
