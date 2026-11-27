import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-after-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";
const BASE_URL = "http://127.0.0.1:3000";

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.errors = [];
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") {
        this.errors.push(msg.params?.exceptionDetails?.text || "Runtime exception");
      }
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
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result?.value;
  }
  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 20000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 8000);
    } catch {}
    await new Promise((r) => setTimeout(r, 900));
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
  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile,
    });
  }
  async checkLayout(label) {
    const stats = await this.eval(`(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const brokenImages = Array.from(document.querySelectorAll('img')).filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
      return { overflow: docW > winW, docW, winW, brokenImages };
    })()`);
    console.log(`[LAYOUT] ${label}: width=${stats.winW} scrollWidth=${stats.docW} overflow=${stats.overflow} brokenImages=${stats.brokenImages.length}`);
    if (stats.overflow) {
      console.error(`  ! OVERFLOW DETECTED on ${label}: scrollWidth ${stats.docW} > innerWidth ${stats.winW}`);
    }
    if (stats.brokenImages.length > 0) {
      console.error(`  ! BROKEN IMAGES on ${label}:`, stats.brokenImages);
    }
    return stats;
  }
  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const out = path.join(artifactDir, name);
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    console.log(`Saved ${name}`);
  }
}

async function main() {
  const port = 9231;
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1440,900",
    "about:blank",
  ]);

  try {
    let wsUrl = "";
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        const page = list.find((t) => t.type === "page");
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!wsUrl) throw new Error("Failed to get CDP wsUrl");

    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    const cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // 1. Desktop (1440x900) & 1920x1080 Home + Catalog + Cart + Product Modal
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/`);
    await cdp.checkLayout("Home Desktop 1440");
    await cdp.screenshot("qa-after-home-desktop.png");

    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.checkLayout("Catalog Desktop 1440");
    await cdp.screenshot("qa-after-catalog-desktop.png");

    // Open first product card modal & add to cart
    await cdp.eval(`
      (() => {
        const btns = Array.from(document.querySelectorAll('article button'));
        const addBtn = btns.find(b => b.textContent && b.textContent.includes('В заявку'));
        if (addBtn) addBtn.click();
        const infoBtn = btns.find(b => b.textContent && b.textContent.includes('Инфо'));
        if (infoBtn) infoBtn.click();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await cdp.screenshot("qa-after-product-modal-desktop.png");
    await cdp.eval(`document.querySelector('[aria-label="Закрыть"]')?.click()`);
    await new Promise((r) => setTimeout(r, 200));
    await cdp.eval(`document.querySelector('#cart-drawer-toggle')?.click()`);
    await new Promise((r) => setTimeout(r, 350));
    await cdp.screenshot("qa-after-cart-drawer-desktop.png");

    // 2. Mobile 390x844 & 375x812 Home + Catalog
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/`);
    await cdp.checkLayout("Home Mobile 390");
    await cdp.screenshot("qa-after-home-mobile.png");

    await cdp.setViewport(375, 812, true);
    await cdp.navigate(`${BASE_URL}/`);
    await cdp.checkLayout("Home Mobile 375");

    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.checkLayout("Catalog Mobile 390");
    await cdp.screenshot("qa-after-catalog-mobile.png");

    // 3. Login Page
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/login`);
    await cdp.checkLayout("Login Desktop 1440");
    await cdp.screenshot("qa-after-login-desktop.png");

    // 4. Customer Portal Login via OTP (requires controlled test env or DB OTP retrieval)
    const testPhone = process.env.QA_TEST_PHONE || "+79990000001";
    const testOtpCode = process.env.PHONE_AUTH_TEST_OTP_CODE;
    if (testOtpCode) {
      await cdp.navigate(`${BASE_URL}/account/login`);
      await cdp.eval(`
        (async () => {
          await fetch('/api/customer/auth/phone/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: ${JSON.stringify(testPhone)} })
          });
          const r2 = await fetch('/api/customer/auth/phone/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: ${JSON.stringify(testPhone)}, code: ${JSON.stringify(testOtpCode)} })
          });
          return r2.status;
        })()
      `);
    }
    await cdp.navigate(`${BASE_URL}/account`);
    await cdp.checkLayout("Customer Account Desktop");
    await cdp.screenshot("qa-after-account-desktop.png");

    await cdp.navigate(`${BASE_URL}/account/notifications`);
    await cdp.checkLayout("Customer Notifications Desktop");
    await cdp.screenshot("qa-after-notifications-desktop.png");

    await cdp.navigate(`${BASE_URL}/account/requests`);
    await cdp.checkLayout("Customer Requests Desktop");

    await cdp.navigate(`${BASE_URL}/account/orders`);
    await cdp.checkLayout("Customer Orders Desktop");

    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/account`);
    await cdp.checkLayout("Customer Account Mobile");
    await cdp.screenshot("qa-after-account-mobile.png");

    // 5. Staff Login & CRM Screens
    const adminEmail = process.env.ZAPTUT_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ZAPTUT_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("Set ZAPTUT_ADMIN_EMAIL and ZAPTUT_ADMIN_PASSWORD in environment.");
    }
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/login`);
    await cdp.eval(`
      (async () => {
        const r = await fetch('/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ${JSON.stringify(adminEmail)}, password: ${JSON.stringify(adminPassword)} })
        });
        return r.status;
      })()
    `);
    await cdp.navigate(`${BASE_URL}/admin`);
    await new Promise((r) => setTimeout(r, 1500));
    await cdp.checkLayout("CRM Dashboard Desktop 1440");
    await cdp.screenshot("qa-after-crm-desktop.png");

    await cdp.navigate(`${BASE_URL}/admin/requests`);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.checkLayout("CRM Requests Desktop 1440");
    await cdp.screenshot("qa-after-crm-requests-desktop.png");

    await cdp.navigate(`${BASE_URL}/admin/orders`);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.checkLayout("CRM Orders Desktop 1440");
    await cdp.screenshot("qa-after-crm-orders-desktop.png");

    // Mobile CRM Dashboard & Orders
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/admin`);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.checkLayout("CRM Dashboard Mobile 390");
    await cdp.screenshot("qa-after-crm-mobile.png");

    await cdp.navigate(`${BASE_URL}/admin/orders`);
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.checkLayout("CRM Orders Mobile 390");
    await cdp.screenshot("qa-after-crm-orders-mobile.png");

    // Tablet 768x1024 CRM
    await cdp.setViewport(768, 1024, false);
    await cdp.navigate(`${BASE_URL}/admin`);
    await new Promise((r) => setTimeout(r, 1000));
    await cdp.checkLayout("CRM Dashboard Tablet 768");

    console.log("Runtime errors collected:", cdp.errors.length);
    if (cdp.errors.length > 0) console.error(cdp.errors);

    ws.close();
  } finally {
    chrome.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
