import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-staff-"));
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

  async waitFor(expression, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expression);
        if (val) return val;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }

  async screenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    console.log(`[Screenshot saved] -> ${filePath}`);
  }
}

async function main() {
  console.log("=== BROWSER QA: STAFF MANAGEMENT & QUOTES VERIFICATION ===");
  const cdpPort = 9225;

  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "http://127.0.0.1:3000/admin/login",
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));
    const versionRes = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
    const versionData = await versionRes.json();
    console.log("[Chrome CDP ready]");

    // Connect to page target
    const listRes = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const cdp = new CdpClient(ws);
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 1. Sign in as SuperAdmin via API (clear rate limits first for testing)
    console.log("1. Signing in as SuperAdmin...");
    await prisma.rateLimit.deleteMany({});
    await cdp.navigate("http://127.0.0.1:3000/login");

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
    console.log("[Login API result]:", loginRes);
    assert.equal(loginRes.ok, true, "SuperAdmin sign-in should succeed");

    await cdp.navigate("http://127.0.0.1:3000/admin");
    await cdp.waitFor("document.body.innerText.includes('CRM / POSTGRESQL')", 15000);
    console.log("[Auth successful, on admin page]");

    // 2. Open /admin/staff
    console.log("2. Navigating to /admin/staff...");
    await cdp.navigate("http://127.0.0.1:3000/admin/staff");
    await cdp.waitFor("document.body.innerText.includes('Сотрудники')", 10000);
    await cdp.waitFor("document.body.innerText.includes('SUPER_ADMIN') || document.body.innerText.includes('Главный администратор')", 10000);

    // Save screenshot of staff registry
    const staffListPath = path.join(artifactDir, "screenshot-crm-staff-list.png");
    await cdp.screenshot(staffListPath);

    // 3. Open "+ Создать сотрудника" modal and fill in invitation
    console.log("3. Testing employee invitation creation...");
    const clicked = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Создать сотрудника'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);
    console.log("[Create button clicked]:", clicked);

    await new Promise((r) => setTimeout(r, 1000));
    await cdp.waitFor("document.body.innerText.toLowerCase().includes('пригласить сотрудника')", 10000);

    const testStaffEmail = `browser-staff-${Date.now()}@zaptut.pro`;
    await cdp.eval(`(() => {
      function setReactVal(el, val) {
        const proto = el instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const nameInput = document.querySelector('input[placeholder="Иван Петров"]');
      const emailInput = document.querySelector('input[placeholder="ivan@zaptut.pro"]');
      const jobInput = document.querySelector('input[placeholder="Ведущий менеджер по закупкам"]');
      if (nameInput) setReactVal(nameInput, 'Алексей Мельников');
      if (emailInput) setReactVal(emailInput, '${testStaffEmail}');
      if (jobInput) setReactVal(jobInput, 'Старший логист направления Польша');
    })()`);

    // Screenshot of filled create modal
    const inviteModalPath = path.join(artifactDir, "screenshot-crm-staff-create-invite.png");
    await cdp.screenshot(inviteModalPath);

    // Submit invitation
    await cdp.eval(`(() => {
      const form = document.querySelector('form');
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Сформировать приглашение'));
      if (submitBtn) submitBtn.click();
      else if (form) form.requestSubmit();
    })()`);

    await cdp.waitFor("document.body.innerText.toLowerCase().includes('скопировать ссылку')", 12000);
    console.log("[Invitation created and link displayed]");

    // Extract invitation token from the generated URL
    const generatedUrl = await cdp.eval(`(() => {
      const codeBlock = document.querySelector('.break-all');
      return codeBlock ? codeBlock.textContent.trim() : '';
    })()`);
    console.log(`[Generated invite URL]: ${generatedUrl}`);
    assert.ok(generatedUrl.includes("/staff/invite/"));
    const token = generatedUrl.split("/staff/invite/")[1];

    // Close modal
    await cdp.eval(`(() => {
      const doneBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Готово'));
      if (doneBtn) doneBtn.click();
    })()`);

    // 4. Open public invitation page /staff/invite/${token}
    console.log("4. Navigating to public invite page...");
    await cdp.navigate(`http://127.0.0.1:3000/staff/invite/${token}`);
    await cdp.waitFor("document.body.innerText.toLowerCase().includes('активация аккаунта')", 10000);
    await cdp.waitFor(`document.body.innerText.toLowerCase().includes('${testStaffEmail.toLowerCase()}')`, 8000);

    const invitePagePath = path.join(artifactDir, "screenshot-staff-invite-page.png");
    await cdp.screenshot(invitePagePath);

    // Fill password and activate
    console.log("5. Activating employee account...");
    await cdp.eval(`(() => {
      function setReactVal(el, val) {
        const proto = window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        nativeSetter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const passInputs = document.querySelectorAll('input[type="password"]');
      if (passInputs[0]) setReactVal(passInputs[0], 'StrongPass2026!');
      if (passInputs[1]) setReactVal(passInputs[1], 'StrongPass2026!');
    })()`);

    await cdp.eval(`(() => {
      const activateBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Активировать аккаунт'));
      if (activateBtn) activateBtn.click();
    })()`);

    await cdp.waitFor("document.body.innerText.toLowerCase().includes('аккаунт успешно активирован')", 10000);
    console.log("[Account activation verified]");

    // 6. Test the "Предложения" button in the admin sidebar that was previously reported broken!
    console.log("6. Testing previously reported broken 'Предложения' button in sidebar...");
    await cdp.navigate("http://127.0.0.1:3000/login");
    await cdp.eval(`(() => {
      const emailInput = document.querySelector('input[type="email"]');
      const passInput = document.querySelector('input[type="password"]');
      const submitBtn = document.querySelector('button[type="submit"]');
      const setVal = (el, val) => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      if (emailInput && passInput && submitBtn) {
        setVal(emailInput, 'mr.artursabirov@gmail.com');
        setVal(passInput, 'Duraki88!Duraki88!');
        submitBtn.click();
      }
    })()`);
    await new Promise((r) => setTimeout(r, 2000));

    await cdp.navigate("http://127.0.0.1:3000/admin");
    await cdp.waitFor("document.querySelector('header')", 10000);

    // Click "Предложения"
    await cdp.eval(`(() => {
      const quotesBtn = Array.from(document.querySelectorAll('aside button, nav button')).find(b => b.textContent && b.textContent.includes('Предложения'));
      if (quotesBtn) quotesBtn.click();
    })()`);

    await new Promise((r) => setTimeout(r, 1500));

    // Verify it DID NOT crash with "Application error"
    const hasApplicationError = await cdp.eval(`document.body.innerText.includes('Application error')`);
    assert.equal(hasApplicationError, false, "Page should NOT crash with Application error when clicking Предложения!");

    const hasQuotesHeader = await cdp.eval(`document.body.innerText.includes('Предложения поставщиков')`);
    assert.equal(hasQuotesHeader, true, "Should display 'Предложения поставщиков' table header!");
    console.log("[Quotes section rendered perfectly without crashing!]");

    const quotesFixedPath = path.join(artifactDir, "screenshot-crm-quotes-fixed.png");
    await cdp.screenshot(quotesFixedPath);

    console.log("=== ALL BROWSER QA CHECKS PASSED SUCCESSFULLY ===");
    ws.close();
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("BROWSER TEST FAILED:", err);
  process.exit(1);
});
