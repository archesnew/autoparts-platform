import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-alien2-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\a2bd0cad-1827-4312-bca0-5a7eb185d8f8";
const BASE_URL = "http://127.0.0.1:3005";

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.exceptions = [];
    this.consoleErrors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const text = msg.params.exceptionDetails?.text || "";
        const desc = msg.params.exceptionDetails?.exception?.description || "";
        this.exceptions.push({ text, desc, url: msg.params.exceptionDetails?.url });
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        const text = msg.params.args.map((a) => a.value || a.description || "").join(" ");
        this.consoleErrors.push(text);
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
      throw new Error(`Eval error: ${res.exceptionDetails.text} (${res.exceptionDetails.exception?.description || ""})`);
    }
    return res.result?.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 20000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 6000);
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
  }

  async waitFor(expression, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.eval(expression);
        if (res) return res;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
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

  async screenshot(fileName) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const filePath = path.join(artifactDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    console.log(`  [SCREENSHOT] ${fileName}`);
    return filePath;
  }

  async checkLayout(label) {
    const stats = await this.eval(`(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const brokenImages = Array.from(document.querySelectorAll('img'))
        .filter(i => i.complete && i.naturalWidth === 0)
        .map(i => i.src);
      return { overflow: docW > winW, docW, winW, brokenImages };
    })()`);
    return stats;
  }
}

async function main() {
  console.log("=== MISSION ALIEN EXPLORER: DEEP INTERACTIVE E2E + UX AUDIT ===");
  const port = 9260;
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1440,900"
  ]);

  const auditLog = {
    catalogInteractions: {},
    cartDrawer: {},
    quickRequest: {},
    vehicleSelector: {},
    responsiveAudits: [],
    brokenImages: [],
    findings: []
  };

  try {
    let wsUrl = "";
    for (let i = 0; i < 25; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await r.json();
        const p = list.find((x) => x.type === "page") || list[0];
        if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }

    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    const cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // 1. Interactive Catalog Journey:
    console.log("\n[1] Catalog Search & Interactive Form...");
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/catalog`);

    // Reset localStorage
    await cdp.eval("window.localStorage.removeItem('zaptut_catalog_vehicle_v1')");
    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.screenshot("alien-audit-01-catalog-init.png");

    // Test search typing + submission
    const searchTest = await cdp.eval(`(async () => {
      const inp = document.getElementById('catalog-search');
      const submitBtn = document.querySelector('form button[type="submit"]');
      if (!inp || !submitBtn) return { error: "Search form elements not found" };

      // Type "колодки"
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(inp, "колодки");
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Submit form
      submitBtn.click();
      await new Promise(r => setTimeout(r, 800));

      const countText = document.body.innerText.match(/найдено\\s+(\\d+)/i);
      const hasBrakeItems = document.body.innerText.includes("колодок") || document.body.innerText.includes("Тормозная");

      return {
        submittedQuery: inp.value,
        hasBrakeItems,
        foundCount: countText ? countText[1] : null
      };
    })()`);
    console.log("  Search 'колодки' result:", searchTest);
    auditLog.catalogInteractions.searchBrakePads = searchTest;
    await cdp.screenshot("alien-audit-02-search-result.png");

    // 2. Interactive Vehicle Filter
    console.log("\n[2] Vehicle Selector Dual-Mode Cascading Test...");
    const hasMakeCombobox = await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-make\"]'))");
    console.log("  Vehicle make combobox present:", hasMakeCombobox);

    const vehicleStepTest = await cdp.eval(`(async () => {
      const makeContainer = document.querySelector('[data-testid="vehicle-combobox-make"]');
      const input = makeContainer ? makeContainer.querySelector('input') : null;
      if (!input) return { error: "Make input not found" };

      // Type "BMW" in make combobox
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, "BMW");
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));

      // Click BMW option
      const options = Array.from(document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]'));
      const bmwOption = options.find(o => o.innerText.includes("BMW"));
      if (!bmwOption) return { error: "BMW option not found in dropdown", optionsFound: options.length };
      bmwOption.click();
      await new Promise(r => setTimeout(r, 600));

      // Check if Model combobox appeared
      const modelContainer = document.querySelector('[data-testid="vehicle-combobox-model"]');
      return {
        bmwSelected: true,
        modelContainerPresent: Boolean(modelContainer)
      };
    })()`);
    console.log("  Vehicle make select result:", vehicleStepTest);
    auditLog.vehicleSelector.makeSelect = vehicleStepTest;
    await cdp.screenshot("alien-audit-03-vehicle-selected.png");

    // 3. Add to Cart & Cart Drawer
    console.log("\n[3] Add to Cart & Drawer Interaction...");
    const cartInteraction = await cdp.eval(`(async () => {
      // Find first "В корзину" button
      const addBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes("В корзину"));
      if (addBtns.length === 0) return { error: "No 'В корзину' button found" };
      addBtns[0].click();
      await new Promise(r => setTimeout(r, 600));

      // Check drawer elements
      const drawer = document.querySelector('[role="dialog"], [data-state="open"], .cart-drawer');
      const text = drawer ? drawer.innerText : document.body.innerText;
      const hasCart = text.includes("Корзина") || text.includes("Итого");
      
      // Check quantity buttons inside drawer
      const plusBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === "+" || b.getAttribute('aria-label') === "Увеличить");
      if (plusBtn) plusBtn.click();
      await new Promise(r => setTimeout(r, 300));

      return {
        clickedAdd: true,
        drawerVisible: Boolean(drawer),
        hasCartText: hasCart,
        hasPlusBtn: Boolean(plusBtn)
      };
    })()`);
    console.log("  Cart interaction result:", cartInteraction);
    auditLog.cartDrawer = cartInteraction;
    await cdp.screenshot("alien-audit-04-cart-drawer-open.png");

    // Close cart drawer
    await cdp.eval(`(() => {
      const close = document.querySelector('button[aria-label="Закрыть"], button.close');
      if (close) close.click();
      else document.body.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // 4. Quick Request Drawer / Modal
    console.log("\n[4] Quick Request Modal...");
    const requestTest = await cdp.eval(`(async () => {
      // Find "ЗАЯВКА" header button
      const reqBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === "ЗАЯВКА" || b.innerText.includes("Оставить заявку"));
      if (!reqBtn) return { error: "Request button not found" };
      reqBtn.click();
      await new Promise(r => setTimeout(r, 600));

      const modal = document.querySelector('[role="dialog"], form');
      const text = modal ? modal.innerText : '';
      const hasVin = Boolean(document.querySelector('input[placeholder*="VIN"], input[name*="vin"]'));
      const hasSubmit = Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes("Отправить заявку")));

      return {
        btnText: reqBtn.innerText.trim(),
        modalOpen: Boolean(modal),
        hasVin,
        hasSubmit,
        textSnippet: text.slice(0, 150)
      };
    })()`);
    console.log("  Quick Request modal result:", requestTest);
    auditLog.quickRequest = requestTest;
    await cdp.screenshot("alien-audit-05-request-modal.png");

    // 5. Responsive Heuristics & Visual Check across all Key Routes
    console.log("\n[5] Comprehensive Viewport Check (1440px desktop & 390px mobile)...");
    const testPages = [
      { url: "/", label: "Home" },
      { url: "/catalog", label: "Catalog" },
      { url: "/about", label: "About" },
      { url: "/contacts", label: "Contacts" },
      { url: "/delivery-info", label: "Delivery" },
      { url: "/payment-info", label: "Payment" },
      { url: "/returns-warranty", label: "Returns" },
      { url: "/privacy-policy", label: "Privacy" },
      { url: "/terms", label: "Terms" },
      { url: "/consent", label: "Consent" },
      { url: "/login", label: "Staff Login" },
      { url: "/account/login", label: "Customer Login" },
      { url: "/account/register", label: "Customer Register" },
      { url: "/account/forgot-password", label: "Forgot Password" },
      { url: "/account", label: "Customer Dashboard" },
      { url: "/account/vehicles", label: "Customer Garage" },
      { url: "/account/addresses", label: "Customer Addresses" },
      { url: "/account/orders", label: "Customer Orders" },
      { url: "/account/requests", label: "Customer Requests" },
      { url: "/account/notifications", label: "Customer Notifications" },
    ];

    for (const p of testPages) {
      await cdp.setViewport(1440, 900, false);
      await cdp.navigate(`${BASE_URL}${p.url}`);
      const deskLayout = await cdp.checkLayout(`${p.label} (1440)`);

      await cdp.setViewport(390, 844, true);
      await new Promise((r) => setTimeout(r, 400));
      const mobLayout = await cdp.checkLayout(`${p.label} (390)`);

      console.log(`  ${p.label.padEnd(20)} | Desktop: ovf=${deskLayout.overflow} (${deskLayout.docW}/${deskLayout.winW}) | Mobile: ovf=${mobLayout.overflow} (${mobLayout.docW}/${mobLayout.winW}) | BrokenImg=${deskLayout.brokenImages.length}`);

      if (deskLayout.overflow) {
        auditLog.findings.push({ severity: "P1", page: p.label, issue: `Desktop horizontal overflow (${deskLayout.docW} > ${deskLayout.winW})` });
      }
      if (mobLayout.overflow) {
        auditLog.findings.push({ severity: "P0", page: p.label, issue: `Mobile horizontal overflow (${mobLayout.docW} > ${mobLayout.winW})` });
      }
      if (deskLayout.brokenImages.length > 0) {
        auditLog.brokenImages.push(...deskLayout.brokenImages);
      }

      auditLog.responsiveAudits.push({
        page: p.label,
        url: p.url,
        desktop: deskLayout,
        mobile: mobLayout
      });
    }

    console.log("\n[6] Audit Completed. Saving JSON summary...");
    const summaryFile = path.join(artifactDir, "alien-audit-summary.json");
    fs.writeFileSync(summaryFile, JSON.stringify(auditLog, null, 2));
    console.log(`Saved summary to: ${summaryFile}`);

  } finally {
    try {
      chrome.kill();
    } catch {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
