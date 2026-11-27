import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-vehicle-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";
const BASE_URL = "http://127.0.0.1:3005";

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
    if (res.result?.value !== undefined) return res.result.value;
    if (res.result?.type === "object" && res.result?.subtype === "node") return true;
    return res.result?.value;
  }
  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 20000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 8000);
    } catch {}
    await new Promise((r) => setTimeout(r, 800));
  }
  async waitFor(expression, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expression);
        if (val) return val;
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
  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const out = path.join(artifactDir, name);
    fs.writeFileSync(out, Buffer.from(data, "base64"));
    console.log(`Saved ${name}`);
  }
}

async function main() {
  console.log("=== DUAL-MODE VEHICLE SELECTOR QA ===");

  // 1. API checks for all 8 required manual inputs
  console.log("\n[1] Verifying Backend Vehicle API for all manual & alias queries...");
  const singleMakeQueries = [
    { q: "BMW", expectedMake: "BMW" },
    { q: "БМВ", expectedMake: "BMW" },
  ];
  for (const tc of singleMakeQueries) {
    const res = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=makes&query=${encodeURIComponent(tc.q)}`);
    const data = await res.json();
    assert(res.ok && data.makes.some((m) => m.name === tc.expectedMake), `Make lookup failed for ${tc.q}`);
    console.log(`  ✓ API step=makes query="${tc.q}" -> matched ${tc.expectedMake}`);
  }

  const combinedQueries = [
    { q: "Toyota Camry", make: "Toyota", model: "Camry" },
    { q: "Тойота Камри", make: "Toyota", model: "Camry" },
    { q: "Kia Sportage", make: "Kia", model: "Sportage" },
    { q: "Киа Спортейдж", make: "Kia", model: "Sportage" },
    { q: "Lada Vesta", make: "Lada", model: "Vesta" },
    { q: "Лада Веста", make: "Lada", model: "Vesta" },
  ];
  for (const tc of combinedQueries) {
    const res = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=combined&query=${encodeURIComponent(tc.q)}`);
    const data = await res.json();
    const hit = data.matches?.find((m) => m.makeName === tc.make && m.modelName === tc.model);
    assert(res.ok && hit, `Combined lookup failed for "${tc.q}"`);
    console.log(`  ✓ API step=combined query="${tc.q}" -> matched ${hit.makeName} ${hit.modelName}`);
  }

  // Verify ALL makes load without typing & aren't restricted by product count
  const allMakesRes = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=makes`);
  const allMakesData = await allMakesRes.json();
  assert(allMakesData.makes.length >= 50, `Expected >= 50 makes in DB, got ${allMakesData.makes.length}`);
  console.log(`  ✓ API full makes list returned ${allMakesData.makes.length} makes (not restricted to catalog products)`);

  // 2. Chrome CDP Real UI Interaction Tests
  const port = 9235;
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

    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/catalog`);
    const bodyCheck = await cdp.eval(`document.body ? document.body.innerText.slice(0, 200) : 'NO BODY'`);
    console.log("  Catalog body preview:", JSON.stringify(bodyCheck));
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-make"] input'))`);

    // Scroll filters slightly into view
    await cdp.eval(`document.querySelector('[data-testid="dual-mode-vehicle-filter"]')?.scrollIntoView({ block: 'center' })`);
    await new Promise((r) => setTimeout(r, 300));

    // MODE A: Dropdown list selection WITHOUT typing
    console.log("\n[2] Testing Mode 1: Dropdown List Selection (Zero Typing)...");
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-make"] button[aria-label*="Открыть"]')?.click()`);
    const makeOptionsCount = await cdp.waitFor(`(() => {
      const opts = document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]');
      return opts.length >= 40 ? opts.length : 0;
    })()`);
    console.log(`  ✓ Opened Make dropdown without typing: ${makeOptionsCount} makes visible`);
    await cdp.screenshot("qa-vehicle-dropdown-makes-desktop.png");

    // Pick "Kia" from dropdown
    await cdp.eval(`(() => {
      const opts = Array.from(document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]'));
      const kia = opts.find(o => o.textContent && o.textContent.startsWith('Kia'));
      if (!kia) throw new Error('Kia option not found');
      kia.click();
    })()`);

    // Wait for Model combobox & open dropdown without typing
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-model"] input'))`);
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-model"] button[aria-label*="Открыть"]')?.click()`);
    const modelOptionsCount = await cdp.waitFor(`(() => {
      const opts = document.querySelectorAll('[data-testid="vehicle-combobox-model"] [role="option"]');
      return opts.length >= 2 ? opts.length : 0;
    })()`);
    console.log(`  ✓ Opened Model dropdown without typing: ${modelOptionsCount} models for Kia`);

    // Pick "Sportage"
    await cdp.eval(`(() => {
      const opts = Array.from(document.querySelectorAll('[data-testid="vehicle-combobox-model"] [role="option"]'));
      const sp = opts.find(o => o.textContent && o.textContent.startsWith('Sportage'));
      if (!sp) throw new Error('Sportage option not found');
      sp.click();
    })()`);

    // Wait for Generation & open dropdown
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-generation"] input'))`);
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-generation"] button[aria-label*="Открыть"]')?.click()`);
    await cdp.waitFor(`document.querySelectorAll('[data-testid="vehicle-combobox-generation"] [role="option"]').length > 0`);
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-generation"] [role="option"]').click()`);

    // Wait for dependent fields (Year, BodyType, Engine, Modification)
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-year"] input'))`);
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-engine"] input'))`);
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-modification"] input'))`);
    await new Promise((r) => setTimeout(r, 400));

    const catalogMatchCount = await cdp.eval(`document.querySelectorAll('article').length`);
    console.log(`  ✓ Selected Kia -> Sportage -> Generation -> all 7 fields ready. Matching catalog cards: ${catalogMatchCount}`);
    assert(catalogMatchCount > 0, "Expected Kia Sportage catalog products to match");
    await cdp.screenshot("qa-vehicle-dropdown-full-desktop.png");

    // MODE B: Manual Typing (Russian + Combined + Transliteration)
    console.log("\n[3] Testing Mode 2: Manual Typing (Тойота Камри, БМВ, Лада Веста)...");
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-make"] button[aria-label*="Очистить"]')?.click()`);
    await new Promise((r) => setTimeout(r, 200));

    // Type "Тойота Камри" via React input setter + InputEvent
    await cdp.eval(`(() => {
      const inp = document.querySelector('[data-testid="vehicle-combobox-make"] input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      inp.focus();
      setter.call(inp, 'Тойота Камри');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);

    await cdp.waitFor(`(() => {
      const opts = Array.from(document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]'));
      return opts.some(o => o.textContent && o.textContent.includes('Toyota Camry'));
    })()`, 8000);
    console.log(`  ✓ Manual typing "Тойота Камри" surfaced combined quick-pick "Toyota Camry"`);
    await cdp.screenshot("qa-vehicle-manual-typing-desktop.png");

    // Select Toyota Camry from combined options
    await cdp.eval(`(() => {
      const opts = Array.from(document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]'));
      const hit = opts.find(o => o.textContent && o.textContent.includes('Toyota Camry'));
      hit.click();
    })()`);
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-generation"] input'))`);
    const makeVal = await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-make"] input').value`);
    const modelVal = await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-model"] input').value`);
    assert.equal(makeVal, "Toyota");
    assert.equal(modelVal, "Camry");
    console.log(`  ✓ Selecting combined match auto-filled Make="${makeVal}" and Model="${modelVal}"`);

    // 3. Mobile 390x844 Check
    console.log("\n[4] Testing Mobile 390x844 Touch Layout...");
    await cdp.setViewport(390, 844, true);
    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.waitFor(`Boolean(document.querySelector('[data-testid="vehicle-combobox-make"] input'))`);
    await cdp.eval(`document.querySelector('[data-testid="dual-mode-vehicle-filter"]')?.scrollIntoView({ block: 'center' })`);
    await new Promise((r) => setTimeout(r, 300));
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-make"] button[aria-label*="Открыть"]')?.click()`);
    await cdp.waitFor(`document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]').length >= 40`);
    const mobileOverflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
    assert.equal(mobileOverflow, false, "Mobile horizontal overflow detected");
    console.log(`  ✓ Mobile 390px dropdown open without overflow (overflow=${mobileOverflow})`);
    await cdp.screenshot("qa-vehicle-mobile-dropdown.png");

    assert.equal(cdp.errors.length, 0, `Unexpected browser runtime errors: ${cdp.errors.join("; ")}`);
    console.log("\n✓ ALL DUAL-MODE VEHICLE SELECTOR QA CHECKS PASSED (0 errors)");
    ws.close();
  } finally {
    chrome.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => {
  console.error("QA FAILED:", e);
  process.exit(1);
});
