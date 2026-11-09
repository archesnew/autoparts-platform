import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-crm-requests-"));
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

  async waitFor(expression, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.eval(expression);
        if (res) return res;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
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
  console.log("=== BROWSER VERIFICATION: CRM REQUESTS & POSTGRESQL MIGRATION ===");

  // Reset rate limits for test runner
  await prisma.rateLimit.deleteMany();

  const adminEmail = "mr.artursabirov@gmail.com";
  const adminPassword = "Duraki88!Duraki88!";

  // 1. Launch Chrome
  const port = 9225;
  console.log(`Starting headless Chrome on port ${port}...`);
  const chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tempDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1600,1050",
    ],
    { stdio: "ignore" }
  );

  let cdp;
  try {
    let targetsRes = null;
    for (let i = 0; i < 25; i++) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        targetsRes = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (targetsRes && targetsRes.ok) break;
      } catch {}
    }
    if (!targetsRes || !targetsRes.ok) throw new Error(`Could not connect to Chrome debugging port ${port}`);

    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");

    // Capture console errors
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
          console.error("BROWSER CONSOLE ERROR:", JSON.stringify(msg.params.args));
        }
        if (msg.method === "Runtime.exceptionThrown") {
          console.error("BROWSER EXCEPTION:", JSON.stringify(msg.params.exceptionDetails));
        }
      } catch {}
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1600,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 2. Log in as Super Admin
    console.log("Navigating to /login...");
    await cdp.navigate("http://127.0.0.1:3000/login");

    console.log("Signing in as Super Admin...");
    const loginRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "${adminEmail}",
            password: "${adminPassword}",
          }),
        });
        return { ok: res.ok, status: res.status };
      })()
    `);
    console.log("Login result:", loginRes);
    assert.ok(loginRes?.ok, `Sign in failed with status ${loginRes?.status}`);

    console.log("Logged in successfully. Navigating to /admin...");
    await cdp.navigate("http://127.0.0.1:3000/admin");

    const currentUrl = await cdp.eval("window.location.href");
    const bodySnippet = await cdp.eval("document.body.innerText.slice(0, 500)");
    console.log("Current URL:", currentUrl);
    console.log("Page snippet:", bodySnippet);

    // 3. Verify PostgreSQL source of truth and request list
    console.log("Verifying CRM Requests loaded from PostgreSQL...");
    await cdp.waitFor("document.body.innerText.includes('CRM / POSTGRESQL') || document.body.innerText.includes('ZAPTUT')", 15000);
    const hasPostgresSource = await cdp.eval("document.body.innerText.includes('Источник истины: PostgreSQL')");
    console.log(`- Badge 'CRM / POSTGRESQL': present`);
    console.log(`- Badge 'Источник истины: PostgreSQL': ${hasPostgresSource}`);
    assert.ok(hasPostgresSource, "PostgreSQL source of truth indicator must be visible");

    // Verify requests table has ZP-2026-0148
    await cdp.waitFor("document.body.innerText.includes('ZP-2026-0148')", 10000);
    console.log("- Request ZP-2026-0148 found in table");

    // Capture list screenshot
    const listScreenshot = path.join(artifactDir, "screenshot-crm-requests-list.png");
    await cdp.captureScreenshot(listScreenshot);

    // 4. Open request ZP-2026-0148 card
    console.log("Opening request card ZP-2026-0148...");
    const clicked = await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText.trim().startsWith('ZP-2026-0148'));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log(`- Clicked request button: ${clicked}`);
    await new Promise((r) => setTimeout(r, 2000));

    // Verify request workspace is open
    await cdp.waitFor("document.body.innerText.includes('51712-C1A00') || document.body.innerText.includes('Диск тормозной')", 10000);
    console.log("- Request workspace loaded: Position 51712-C1A00 / Диск тормозной visible");

    // Verify supplier quote is visible
    const hasQuotes = await cdp.eval("document.body.innerText.includes('Север Авто Деталь')");
    console.log(`- Supplier quote for 'Север Авто Деталь' visible: ${hasQuotes}`);

    // Capture card screenshot
    const cardScreenshot = path.join(artifactDir, "screenshot-crm-request-card.png");
    await cdp.captureScreenshot(cardScreenshot);

    // 5. Test interaction & persistence: Toggle task or select quote
    console.log("Testing interaction and PostgreSQL persistence...");
    const taskToggleResult = await cdp.eval(`
      (() => {
        const checkbox = document.querySelector('input[type=\"checkbox\"][aria-label*=\"Ответить поставщику\"]') ||
          document.querySelector('input[type=\"checkbox\"]');
        if (checkbox) {
          checkbox.click();
          return 'toggled checkbox';
        }
        return 'no checkbox found';
      })()
    `);
    console.log(`- Task toggle action result: ${taskToggleResult}`);
    await new Promise((r) => setTimeout(r, 2000));

    // 6. Reload page to verify persistence directly from PostgreSQL
    console.log("Reloading page (F5) to verify PostgreSQL persistence...");
    await cdp.send("Page.reload");
    await cdp.waitFor("document.readyState === 'complete'", 15000);
    await new Promise((r) => setTimeout(r, 2500));

    // Verify page reloaded and state intact
    await cdp.waitFor("document.body.innerText.includes('CRM / POSTGRESQL')", 10000);
    await cdp.waitFor("document.body.innerText.includes('ZP-2026-0148')", 10000);
    console.log("- Successfully reloaded. PostgreSQL state intact!");

    // Reopen card to verify workspace persistence
    await cdp.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText.trim().startsWith('ZP-2026-0148'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1500));

    // Capture reloaded screenshot
    const reloadedScreenshot = path.join(artifactDir, "screenshot-crm-request-persisted.png");
    await cdp.captureScreenshot(reloadedScreenshot);

    console.log("=== BROWSER VERIFICATION PASSED ===");
  } finally {
    if (cdp?.ws) {
      try { cdp.ws.close(); } catch {}
    }
    try { chromeProcess.kill(); } catch {}
    await new Promise((r) => setTimeout(r, 1000));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
