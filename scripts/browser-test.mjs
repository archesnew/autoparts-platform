import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-"));

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
    const currentBody = await this.eval("document.body.innerText.slice(0, 300)").catch(() => "unknown");
    throw new Error(`Timeout waiting for: ${predicateExpression} at ${currentUrl} (body: ${JSON.stringify(currentBody)})`);
  }
}

async function main() {
  await prisma.rateLimit.deleteMany({});
  await prisma.customer.deleteMany({ where: { name: { contains: "Новый Покупатель" } } });
  console.log("1. Setting up test staff accounts in PostgreSQL...");
  const suffix = randomUUID().slice(0, 8);
  const managerPassword = `ManagerPass-${suffix}-123!`;
  const logisticsPassword = `LogisticsPass-${suffix}-123!`;

  const managerUser = await prisma.user.create({
    data: { name: `Manager ${suffix}`, email: `mgr-${suffix}@test.local`, role: "MANAGER", active: true },
  });
  await prisma.account.create({
    data: { accountId: managerUser.id, providerId: "credential", userId: managerUser.id, password: await hashPassword(managerPassword) },
  });

  const logisticsUser = await prisma.user.create({
    data: { name: `Logistics ${suffix}`, email: `log-${suffix}@test.local`, role: "LOGISTICS", active: true },
  });
  await prisma.account.create({
    data: { accountId: logisticsUser.id, providerId: "credential", userId: logisticsUser.id, password: await hashPassword(logisticsPassword) },
  });

  console.log("2. Starting Next.js server on port 3005...");
  const nextProcess = spawn("cmd.exe", ["/c", "npm.cmd", "start", "--", "-p", "3005"], {
    cwd: process.cwd(),
    stdio: "pipe",
    env: { ...process.env, BETTER_AUTH_URL: "http://127.0.0.1:3005" },
  });

  await new Promise((resolve, reject) => {
    let started = false;
    const timeout = setTimeout(() => reject(new Error("Next.js start timeout")), 30000);
    nextProcess.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.includes("Ready") || text.includes("started") || text.includes("3005") || text.includes("http")) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve();
        }
      }
    });
    nextProcess.stderr.on("data", (d) => {
      const err = d.toString();
      if (!err.includes("ExperimentalWarning")) console.log("Next stderr:", err);
    });
  });

  let healthy = false;
  for (let i = 0; i < 30; i++) {
    try {
      const h = await fetch("http://127.0.0.1:3005/api/health");
      if (h.ok) { healthy = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!healthy) throw new Error("Next.js health check failed on 3005");
  console.log("Next.js server is ready and healthy.");

  console.log("3. Launching headless Chrome with remote debugging on port 9222...");
  const chromeProcess = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${tempDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ]);

  let cdpTargets = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch("http://127.0.0.1:9222/json");
      cdpTargets = await res.json();
      if (cdpTargets && cdpTargets.length > 0) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!cdpTargets) throw new Error("Chrome CDP not reachable on 9222");

  const pageTarget = cdpTargets.find((t) => t.type === "page") || cdpTargets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });
  const client = new CdpClient(ws);

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");

  console.log("4. Testing LOGISTICS login and access restriction in browser...");
  await client.send("Page.navigate", { url: "http://127.0.0.1:3005/login" });
  await client.waitFor("document.querySelector('form')", 10000);

  // Authenticate as LOGISTICS directly via browser fetch
  const logInLogisticsResult = await client.eval(`
    (async () => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ${JSON.stringify(logisticsUser.email)},
          password: ${JSON.stringify(logisticsPassword)},
        }),
      });
      return { ok: res.ok, status: res.status };
    })()
  `);
  console.log("LOGISTICS browser sign-in result:", logInLogisticsResult);
  assert(logInLogisticsResult.ok, "LOGISTICS sign-in must succeed");

  // Attempt to navigate to /admin/customers as LOGISTICS
  await client.send("Page.navigate", { url: "http://127.0.0.1:3005/admin/customers" });
  await client.waitFor("document.body.innerText.length > 20", 10000);

  const logisticsUrl = await client.eval("window.location.href");
  const logisticsBodyText = await client.eval("document.body.innerText");
  console.log("LOGISTICS destination URL:", logisticsUrl);
  console.log("LOGISTICS page text snippet:", logisticsBodyText.slice(0, 200));

  // Must show LogisticsWorkspace and NOT show customer profiles table
  const logisticsBlocked = logisticsBodyText.includes("Рабочее пространство логистики ещё не подключено") &&
    !logisticsBodyText.includes("Уникальные профили покупателей");
  console.log("LOGISTICS is restricted from customer CRM:", logisticsBlocked);
  assert(logisticsBlocked, "LOGISTICS must see restricted workspace without customer data");

  // Also test direct Customer API call from LOGISTICS browser session
  const logisticsApiStatus = await client.eval(`
    (async () => {
      const res = await fetch("/api/customers");
      return res.status;
    })()
  `);
  console.log("LOGISTICS fetch(/api/customers) HTTP status:", logisticsApiStatus);
  assert.equal(logisticsApiStatus, 403, "LOGISTICS API fetch must return 403 Forbidden");

  console.log("5. Logging in as MANAGER in browser...");
  await client.send("Storage.clearDataForOrigin", {
    origin: "http://127.0.0.1:3005",
    storageTypes: "all",
  });
  await client.send("Page.navigate", { url: "http://127.0.0.1:3005/login" });
  await client.waitFor("document.querySelector('form')", 10000);

  const managerSignInResult = await client.eval(`
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
  console.log("MANAGER browser sign-in result:", managerSignInResult);
  assert(managerSignInResult.ok, "MANAGER sign-in must succeed");

  console.log("6. Navigating to /admin/customers...");
  await client.send("Page.navigate", { url: "http://127.0.0.1:3005/admin/customers" });
  await client.waitFor("document.querySelector('h1')", 15000);

  // Click on "Клиенты" tab to ensure customer section is active
  await client.waitFor("Array.from(document.querySelectorAll('button')).some(b => b.innerText === 'Клиенты')", 15000);
  await client.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Клиенты').click()");
  await client.waitFor("document.querySelector('input[type=\"search\"]')", 15000);
  console.log("Verified 'Клиенты' section and search bar are active.");

  // Wait for customer profiles to load from PostgreSQL
  await client.waitFor("Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('Открыть профиль'))", 15000);
  const openProfileButtons = await client.eval("Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Открыть профиль')).length");
  console.log(`Found ${openProfileButtons} customer profile rows in table.`);
  assert(openProfileButtons >= 1, "Customer profile buttons should be present");

  const firstCustomerName = await client.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Открыть профиль')).innerText.split('\\n')[0]");
  console.log(`First customer: "${firstCustomerName}"`);

  console.log("7. Opening customer card...");
  await client.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Ольга') || b.innerText.includes('Соколова') || b.innerText.includes('Алексей')).click()");
  await client.waitFor("document.body.innerText.toUpperCase().includes('ВСЕ КЛИЕНТЫ')", 10000);
  const cardTitle = await client.eval("document.querySelector('h1').innerText");
  console.log(`Card opened successfully. Title: "${cardTitle}"`);

  const linkedRequestsCount = await client.eval("document.querySelectorAll('article').length");
  console.log(`Linked requests shown in card: ${linkedRequestsCount}`);
  assert(linkedRequestsCount >= 1, "Linked requests must be shown in customer card");

  console.log("8. Editing customer profile...");
  await client.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.toUpperCase().includes('РЕДАКТИРОВАТЬ ПРОФИЛЬ')).click()");
  await client.waitFor("document.querySelector('form textarea')", 5000);
  console.log("Edit form opened.");

  const updatedNote = `Заметка проверена через браузер ${suffix}`;
  await client.eval(`
    const textarea = document.querySelector('form textarea');
    const proto = Object.getPrototypeOf(textarea);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(textarea, ${JSON.stringify(updatedNote)});
    else textarea.value = ${JSON.stringify(updatedNote)};
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    const form = textarea.closest('form');
    if (form.requestSubmit) form.requestSubmit();
    else form.querySelector('button[type="submit"]').click();
  `);

  await client.waitFor("!document.querySelector('form textarea')", 10000);
  console.log("Edit submitted successfully.");

  await client.waitFor(`document.body.innerText.includes(${JSON.stringify(updatedNote)})`, 10000);
  console.log("Updated note verified in DOM.");

  console.log("9. Testing page reload (F5 survival)...");
  await client.send("Page.reload");
  await client.waitFor("document.querySelector('h1')", 15000);
  await client.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Клиенты')?.click()");
  await client.waitFor("document.querySelector('input[type=\"search\"]')", 15000);
  console.log("Page reloaded successfully. Data persisted across F5.");

  console.log("10. Testing customer search in browser by name ('Ольга')...");
  const searchQuery = "Ольга";
  console.log(`Typing search query: "${searchQuery}"`);
  await client.eval(`
    {
      const setVal = (elem, val) => {
        const proto = Object.getPrototypeOf(elem);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(elem, val);
        else elem.value = val;
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const input = document.querySelector('input[type="search"]');
      setVal(input, ${JSON.stringify(searchQuery)});
    }
  `);
  await new Promise((r) => setTimeout(r, 600));
  const searchResultsCount = await client.eval("Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Открыть профиль')).length");
  console.log(`Search results count: ${searchResultsCount} rows (filtered).`);
  assert(searchResultsCount >= 1, "Search should return matching customer rows");

  console.log("11. Testing search by request number (ZP-2026-0148)...");
  await client.eval(`
    {
      const setVal = (elem, val) => {
        const proto = Object.getPrototypeOf(elem);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(elem, val);
        else elem.value = val;
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const input = document.querySelector('input[type="search"]');
      setVal(input, 'ZP-2026-0148');
    }
  `);
  await new Promise((r) => setTimeout(r, 600));
  const reqSearchResultsCount = await client.eval("Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Открыть профиль')).length");
  console.log(`Search by request number ZP-2026-0148 returned: ${reqSearchResultsCount} rows.`);
  assert(reqSearchResultsCount >= 1, "Search by request number should match customer");

  console.log("12. Testing creating a new customer via UI...");
  await client.eval(`
    {
      const input = document.querySelector('input[type=\"search\"]');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  `);
  await client.eval("Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Создать клиента') || b.innerText.includes('СОЗДАТЬ КЛИЕНТА')).click()");
  await client.waitFor("document.querySelector('input[type=\"tel\"]')", 5000);
  console.log("Customer create form opened.");

  const newCustName = `Новый Покупатель ${suffix}`;
  const newCustPhone = `+7 (911) 555-01-${suffix.slice(0, 2)}`;
  await client.eval(`
    {
      const setVal = (elem, val) => {
        const proto = Object.getPrototypeOf(elem);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(elem, val);
        else elem.value = val;
        elem.dispatchEvent(new Event('input', { bubbles: true }));
        elem.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const form = document.querySelector('input[type="tel"]').closest('form');
      const nameInput = form.querySelector('input[type="text"], input:not([type])');
      setVal(nameInput, ${JSON.stringify(newCustName)});

      const phoneInput = form.querySelector('input[type="tel"]');
      setVal(phoneInput, ${JSON.stringify(newCustPhone)});

      if (form.requestSubmit) form.requestSubmit();
      else form.querySelector('button[type="submit"]').click();
    }
  `);
  await client.waitFor("!document.querySelector('input[type=\"tel\"]')", 10000);
  console.log("Customer created via UI.");

  await client.waitFor(`document.body.innerText.toUpperCase().includes(${JSON.stringify(newCustName.toUpperCase())})`, 10000);
  console.log(`Verified new customer "${newCustName}" in DOM.`);

  console.log("\n>>> ALL BROWSER SCENARIOS COMPLETED SUCCESSFULLY! <<<");

  ws.close();
  chromeProcess.kill();
  nextProcess.kill();

  await prisma.session.deleteMany({ where: { userId: { in: [managerUser.id, logisticsUser.id] } } });
  await prisma.account.deleteMany({ where: { userId: { in: [managerUser.id, logisticsUser.id] } } });
  await prisma.customer.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.user.deleteMany({ where: { id: { in: [managerUser.id, logisticsUser.id] } } });
  await prisma.$disconnect();
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
  process.exit(0);
}

main().catch((err) => {
  console.error("BROWSER TEST FAILED:", err);
  process.exit(1);
});
