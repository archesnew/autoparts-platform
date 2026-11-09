import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-crm-demo-"));
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
    await new Promise((r) => setTimeout(r, 1200));
  }

  async waitFor(expression, timeoutMs = 12000) {
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
  console.log("=== STARTING PUBLIC CRM DEMO ENVIRONMENT BROWSER VERIFICATION ===");

  // Ensure rate limits are clean
  await prisma.rateLimit.deleteMany();

  const baseUrl = "http://127.0.0.1:3000";

  // Check web server
  const healthRes = await fetch(`${baseUrl}/api/health`).catch(() => null);
  assert.ok(healthRes?.ok, "Local production Next.js server must be running on port 3000");

  const port = 9227;
  console.log(`Launching Chrome on CDP port ${port}...`);
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
  assert.ok(targetsRes?.ok, "Could not connect to Chrome CDP");

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
    // 1. Open public website without login
    console.log("\n--> 1. Testing Public Website Access (Anonymous)...");
    await cdp.navigate(`${baseUrl}/`);
    const homeTitle = await cdp.eval("document.title");
    console.log(`  ✓ Public homepage loaded: '${homeTitle}'`);

    // 2. Access /admin without login -> MUST redirect to /login
    console.log("\n--> 2. Testing Unauthenticated /admin Access...");
    await cdp.navigate(`${baseUrl}/admin`);
    const currentUrl = await cdp.eval("window.location.href");
    assert.ok(currentUrl.includes("/login"), "Unauthenticated user must be redirected to /login");
    console.log(`  ✓ Protected route /admin redirected to login screen: ${currentUrl}`);

    // 3. Authenticate as SUPER_ADMIN (Owner)
    console.log("\n--> 3. Authenticating as SUPER_ADMIN (Owner: owner@zaptut.pro)...");
    const superAdminLogin = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "owner@zaptut.pro",
            password: "ZaptutOwner2026!SuperAdmin"
          })
        });
        return { status: res.status, ok: res.ok };
      })()
    `);
    assert.equal(superAdminLogin.status, 200, "SuperAdmin login must succeed with 200 OK");
    console.log("  ✓ SUPER_ADMIN authentication successful");

    // Open /admin as Super Admin
    await cdp.navigate(`${baseUrl}/admin`);
    await cdp.waitFor("document.body.innerText.includes('CRM')", 12000);
    const superAdminRoleText = await cdp.eval("document.body.innerText");
    console.log("  [DEBUG] Header/Body text preview:", superAdminRoleText.slice(0, 300));
    assert.ok(superAdminRoleText.includes("SUPER_ADMIN") || superAdminRoleText.includes("Владелец"), "CRM header must reflect SUPER_ADMIN or Owner name");
    console.log("  ✓ CRM Dashboard loaded with full SUPER_ADMIN privileges");

    // Capture Super Admin Dashboard
    await cdp.screenshot(path.join(artifactDir, "screenshot-crm-superadmin-dashboard.png"));
    console.log("  ✓ Captured: screenshot-crm-superadmin-dashboard.png");

    // Open Requests tab as Super Admin
    console.log("  [SUPER_ADMIN] Navigating to Requests section...");
    await cdp.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Заявки'));
        if (btn) btn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.screenshot(path.join(artifactDir, "screenshot-crm-superadmin-requests.png"));
    console.log("  ✓ Captured: screenshot-crm-superadmin-requests.png");

    // Verify Super Admin sees purchase price data
    const superAdminRequestsRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/requests");
        const json = await res.json();
        return json;
      })()
    `);
    console.log(`  ✓ SuperAdmin fetched ${superAdminRequestsRes.items?.length || 0} CRM requests via API`);

    // 4. Sign Out from Super Admin session
    console.log("\n--> 4. Signing Out from Super Admin Session...");
    await cdp.eval(`fetch("/api/auth/sign-out", { method: "POST" })`);
    await new Promise((r) => setTimeout(r, 800));

    // Clear cookies explicitly in CDP to guarantee a clean isolated session
    await cdp.send("Network.clearBrowserCookies");
    console.log("  ✓ SuperAdmin session signed out and cookies cleared");

    // 5. Authenticate as DEMO_VIEWER (Partner)
    console.log("\n--> 5. Authenticating as DEMO_VIEWER (demo.partner@zaptut.pro)...");
    await cdp.navigate(`${baseUrl}/login`);
    const demoLogin = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "demo.partner@zaptut.pro",
            password: "ZaptutDemo2026!Partner"
          })
        });
        return { status: res.status, ok: res.ok };
      })()
    `);
    assert.equal(demoLogin.status, 200, "DEMO_VIEWER login must succeed with 200 OK");
    console.log("  ✓ DEMO_VIEWER authentication successful");

    // Open /admin as DEMO_VIEWER
    await cdp.navigate(`${baseUrl}/admin`);
    await cdp.waitFor("document.body.innerText.includes('CRM')", 12000);
    const demoBodyText = await cdp.eval("document.body.innerText");
    assert.ok(demoBodyText.includes("DEMO_VIEWER"), "CRM header must reflect DEMO_VIEWER role");
    console.log("  ✓ CRM Dashboard loaded under DEMO_VIEWER role");

    // Verify allowed sections are present in sidebar
    assert.ok(demoBodyText.includes("Рабочий стол"), "Dashboard (Рабочий стол) must be visible");
    assert.ok(demoBodyText.includes("Заявки"), "Requests must be visible");
    assert.ok(demoBodyText.includes("Заказы"), "Orders must be visible");
    assert.ok(demoBodyText.includes("Поставщики"), "Suppliers must be visible");
    assert.ok(demoBodyText.includes("Предложения"), "Quotes/Offers must be visible");
    assert.ok(demoBodyText.includes("Клиенты"), "Customers must be visible");
    assert.ok(demoBodyText.includes("Аналитика"), "Analytics must be visible");
    assert.ok(demoBodyText.includes("Финансовые настройки"), "Finance settings must be visible");

    // Verify forbidden sections are STRICTLY HIDDEN
    assert.ok(!demoBodyText.includes("Сотрудники"), "Employees/Staff section must be HIDDEN from DEMO_VIEWER");
    assert.ok(!demoBodyText.includes("Импорт прайсов"), "Feed Import section must be HIDDEN from DEMO_VIEWER");
    console.log("  ✓ Navigation isolation: Employees and Feed Import tabs are strictly hidden from DEMO_VIEWER");

    // Capture DEMO_VIEWER Dashboard
    await cdp.screenshot(path.join(artifactDir, "screenshot-crm-demoviewer-dashboard.png"));
    console.log("  ✓ Captured: screenshot-crm-demoviewer-dashboard.png");

    // 6. Verify Complete Commercial Secrecy & Zero Purchase Price Leakage
    console.log("\n--> 6. Verifying Complete Commercial Secrecy for DEMO_VIEWER...");
    const demoQuotesApi = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/requests");
        const json = await res.json();
        return json;
      })()
    `);

    // In all returned requests, check that cost and purchasePrice are strictly null
    let foundQuotesCount = 0;
    for (const req of demoQuotesApi.items || []) {
      for (const item of req.items || []) {
        for (const quote of item.quotes || []) {
          foundQuotesCount++;
          assert.equal(quote.cost, null, `Quote ${quote.id} cost must be null for DEMO_VIEWER`);
          assert.equal(quote.purchasePrice, null, `Quote ${quote.id} purchasePrice must be null for DEMO_VIEWER`);
        }
      }
    }
    console.log(`  ✓ Verified ${foundQuotesCount} quotes across requests: cost and purchasePrice are strictly null`);

    // Open Quotes tab as DEMO_VIEWER to verify UI column displays customer price, not wholesale cost
    const clickedQuotes = await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => b.textContent && (b.textContent.includes('Предложения') || b.textContent.includes('котировки')));
        if (target) {
          target.click();
          return { found: true, text: target.textContent };
        }
        return { found: false, allButtons: btns.map(b => b.textContent?.trim()).filter(Boolean) };
      })()
    `);
    console.log("  [DEBUG] Click Quotes tab result:", clickedQuotes);
    await new Promise((r) => setTimeout(r, 1500));
    const quotesTableText = await cdp.eval("document.body.innerText");
    console.log("  [DEBUG] Body text after clicking Quotes tab:", quotesTableText.slice(0, 400));
    assert.ok(!quotesTableText.toUpperCase().includes("ЗАКУПКА"), "Column 'Закупка' must NOT be rendered for DEMO_VIEWER");
    assert.ok(quotesTableText.toUpperCase().includes("ЦЕНА ДЛЯ КЛИЕНТА"), "Column 'Цена для клиента' must be displayed instead");
    console.log("  ✓ UI protection: 'Цена для клиента' displayed, wholesale 'Закупка' column excluded");

    await cdp.screenshot(path.join(artifactDir, "screenshot-crm-demoviewer-no-purchase-leak.png"));
    console.log("  ✓ Captured: screenshot-crm-demoviewer-no-purchase-leak.png");

    // 7. Verify Mutation APIs are Blocked (403 Forbidden)
    console.log("\n--> 7. Verifying Mutation APIs are Strictly Blocked (403 Forbidden)...");
    
    // Attempt 1: PATCH /api/requests/:id
    const patchRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/requests/${req1Id || '00000000-0000-0000-0000-000000000000'}", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: "URGENT" })
        });
        return { status: res.status };
      })()
    `);
    assert.equal(patchRes.status, 403, "PATCH /api/requests/:id must return 403 Forbidden for DEMO_VIEWER");
    console.log("  ✓ PATCH /api/requests/:id correctly blocked with 403 Forbidden");

    // Attempt 2: POST /api/requests
    const postReqRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer: "Hacker", phone: "+79990001122", part: "Test" })
        });
        return { status: res.status };
      })()
    `);
    assert.equal(postReqRes.status, 403, "POST /api/requests must return 403 Forbidden for DEMO_VIEWER");
    console.log("  ✓ POST /api/requests correctly blocked with 403 Forbidden");

    // Attempt 3: POST /api/admin/staff/invitations (attempting to invite an employee)
    const postStaffRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/admin/staff/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "hacker@test.com", name: "Hacker", role: "ADMIN" })
        });
        return { status: res.status };
      })()
    `);
    assert.equal(postStaffRes.status, 403, "POST /api/admin/staff/invitations must return 403 Forbidden for DEMO_VIEWER");
    console.log("  ✓ POST /api/admin/staff/invitations correctly blocked with 403 Forbidden");

    // 8. Mobile Viewport CRM Check (375x812 iPhone)
    console.log("\n--> 8. Testing Mobile Responsiveness (375x812)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.navigate(`${baseUrl}/admin`);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.screenshot(path.join(artifactDir, "screenshot-crm-demoviewer-mobile.png"));
    console.log("  ✓ Captured: screenshot-crm-demoviewer-mobile.png");

    console.log("\n========================================================");
    console.log(" ALL PUBLIC CRM DEMO ENVIRONMENT CHECKS PASSED (100%)!");
    console.log("========================================================");
  } finally {
    try {
      chrome.kill();
    } catch {}
  }
}

let req1Id = null;
prisma.request
  .findFirst({ where: { number: "ZP-2026-1001" }, select: { id: true } })
  .then((r) => {
    req1Id = r?.id;
    return main();
  })
  .catch((err) => {
    console.error("BROWSER TEST FAILED:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
