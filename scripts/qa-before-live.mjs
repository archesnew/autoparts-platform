import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-before-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";
const BASE_URL = "https://zaptut-staging.netlify.app";

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
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result?.value;
  }
  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 20000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 6000);
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
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
  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const out = path.join(artifactDir, name);
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    console.log(`Saved ${name}`);
  }
}

async function main() {
  const port = 9229;
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

    // 1. Desktop Home & Catalog
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/`);
    await cdp.screenshot("qa-before-home-desktop.png");

    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.screenshot("qa-before-catalog-desktop.png");

    // 2. Mobile Home & Catalog
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/`);
    const homeOverflow = await cdp.eval("document.documentElement.scrollWidth > window.innerWidth");
    console.log("Mobile Home overflow:", homeOverflow);
    await cdp.screenshot("qa-before-home-mobile.png");

    await cdp.navigate(`${BASE_URL}/catalog`);
    const catOverflow = await cdp.eval("document.documentElement.scrollWidth > window.innerWidth");
    console.log("Mobile Catalog overflow:", catOverflow);
    await cdp.screenshot("qa-before-catalog-mobile.png");

    // 3. Staff Login & CRM
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/login`);
    await cdp.screenshot("qa-before-login-desktop.png");

    const adminEmail = process.env.ZAPTUT_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ZAPTUT_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("Set ZAPTUT_ADMIN_EMAIL and ZAPTUT_ADMIN_PASSWORD in environment.");
    }

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
    await cdp.screenshot("qa-before-crm-desktop.png");

    await cdp.setViewport(390, 844, true);
    await new Promise((r) => setTimeout(r, 800));
    const crmMobileOverflow = await cdp.eval("document.documentElement.scrollWidth > window.innerWidth");
    console.log("Mobile CRM overflow:", crmMobileOverflow);
    await cdp.screenshot("qa-before-crm-mobile.png");

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
