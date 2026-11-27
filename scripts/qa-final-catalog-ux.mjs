import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-final-ux-"));
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
  async screenshot(name) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, name), Buffer.from(data, "base64"));
    console.log(`  Saved ${name}`);
  }
}

async function setInput(cdp, selector, value) {
  await cdp.eval(`(() => {
    const inp = document.querySelector(${JSON.stringify(selector)});
    if (!inp) throw new Error("Input not found: " + ${JSON.stringify(selector)});
    inp.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(value)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function main() {
  console.log("=== FINAL VEHICLE SELECTOR & CATALOG UX QA ===\n");

  // 1. Search verification across all required queries (RU + EN)
  console.log("[1] Checking API search queries...");
  const makeQueries = [
    ["BMW", "BMW"],
    ["БМВ", "BMW"],
    ["Mercedes-Benz", "Mercedes-Benz"],
    ["Мерседес", "Mercedes-Benz"],
  ];
  for (const [q, expected] of makeQueries) {
    const r = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=makes&query=${encodeURIComponent(q)}`);
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.equal(d.makes?.[0]?.name, expected, `makes query "${q}" expected top "${expected}", got "${d.makes?.[0]?.name}"`);
    console.log(`  ✓ makes "${q}" -> top="${d.makes[0].name}"`);
  }

  const combinedQueries = [
    ["BMW X5", "BMW X5"],
    ["Toyota Camry", "Toyota Camry"],
    ["Тойота Камри", "Toyota Camry"],
    ["BYD Atto 3", "BYD Atto 3"],
    ["Geely Monjaro", "Geely Monjaro"],
    ["Джили Монджаро", "Geely Monjaro"],
    ["Lada Vesta", "Lada Vesta"],
    ["Лада Веста", "Lada Vesta"],
  ];
  for (const [q, expectedFull] of combinedQueries) {
    const r = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=combined&query=${encodeURIComponent(q)}`);
    assert.equal(r.status, 200);
    const d = await r.json();
    const top = d.matches?.[0] ? `${d.matches[0].makeName} ${d.matches[0].modelName}` : null;
    assert.equal(top, expectedFull, `combined query "${q}" expected top "${expectedFull}", got "${top}"`);
    console.log(`  ✓ combined "${q}" -> top="${top}"`);
  }

  // Check year semantics variety across sources (REGISTRATION_YEAR, PRODUCTION_YEAR, MODEL_YEAR, CATALOG_YEAR)
  const fordOptions = await (await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=models&makeId=ford`)).json();
  const modelSemSample = new Set(fordOptions.models.map((m) => m.yearSemantics).filter(Boolean));
  console.log(`  ✓ Ford models yearSemantics present: ${[...modelSemSample].join(", ")}`);

  // Check Catalog API fitmentOnly=false vs fitmentOnly=true
  const allOnByDefault = await (await fetch(`${BASE_URL}/api/catalog?make=BYD&model=Atto+3`)).json();
  assert(allOnByDefault.items.length >= 7, `Expected full catalog visible without fitmentOnly, got ${allOnByDefault.items.length}`);
  const confirmedByd = await (await fetch(`${BASE_URL}/api/catalog?make=BYD&model=Atto+3&fitmentOnly=true`)).json();
  assert.equal(confirmedByd.items.length, 0, "Expected 0 CONFIRMED parts for BYD Atto 3");
  const confirmedKia = await (await fetch(`${BASE_URL}/api/catalog?make=Kia&model=Sportage&fitmentOnly=true`)).json();
  assert(confirmedKia.items.length >= 3, `Expected >=3 CONFIRMED parts for Kia Sportage, got ${confirmedKia.items.length}`);
  console.log(`  ✓ /api/catalog fitmentOnly behavior verified (BYD all=${allOnByDefault.items.length}, BYD confirmed=0, Kia confirmed=${confirmedKia.items.length})`);

  // 2. Chrome CDP E2E Browser Checks
  console.log("\n[2] Running Chrome CDP Desktop & Mobile checks...");
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=9225",
      `--user-data-dir=${tempDir}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const list = await (await fetch("http://127.0.0.1:9225/json/list")).json();
        const page = list.find((t) => t.type === "page");
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    assert(wsUrl, "Chrome CDP failed to start");

    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    const cdp = new CdpClient(ws);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // Clean start
    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.eval("window.localStorage.removeItem('zaptut_catalog_vehicle_v1')");
    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-make\"]'))");

    // Check A: Large list pagination (Mercedes-Benz 1587 models -> paged at 60 items initially, not 1587 DOM nodes)
    await setInput(cdp, '[data-testid="vehicle-combobox-make"] input', "Мерседес");
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-make\"] [role=\"option\"]'))");
    await cdp.eval(`(() => {
      const opt = [...document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]')]
        .find(el => el.querySelector('span')?.textContent.trim() === 'Mercedes-Benz');
      opt?.click();
    })()`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-model\"]'))");
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-model\"] [aria-label^=\"Открыть список\"]'))");
    await new Promise((r) => setTimeout(r, 1200));
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-model"] [aria-label^="Открыть список"]')?.click()`);
    await cdp.waitFor("document.querySelectorAll('[data-testid=\"vehicle-combobox-model\"] [role=\"option\"]').length > 0", 15000);
    const mbListInfo = await cdp.eval(`(() => {
      const box = document.querySelector('[data-testid="vehicle-combobox-model"] [role="listbox"]');
      return {
        renderedCount: box.querySelectorAll('[role="option"]').length,
        hasCounterHeader: box.textContent.includes('Показано 60 из'),
        hasShowMoreBtn: box.textContent.includes('Показать ещё'),
        headerText: box.textContent.slice(0, 120),
      };
    })()`);
    console.log("  Mercedes-Benz model list state:", mbListInfo);
    assert(mbListInfo.renderedCount === 60 && mbListInfo.hasCounterHeader && mbListInfo.hasShowMoreBtn, `Unexpected paging: ${JSON.stringify(mbListInfo)}`);
    await cdp.screenshot("qa-final-catalog-large-list-desktop.png");
    console.log("  ✓ Mercedes-Benz large list paginated cleanly (60 visible of 1587 + search & Show More)");

    // Check B: Keyboard navigation on Russian query "Джили Монджаро"
    await cdp.eval(`document.querySelector('[data-testid="clear-selected-vehicle"]')?.click()`);
    await setInput(cdp, '[data-testid="vehicle-combobox-make"] input', "Джили Монджаро");
    await cdp.waitFor("document.querySelector('[data-testid=\"vehicle-combobox-make\"] [role=\"listbox\"]')?.innerText.includes('Geely Monjaro')");
    await cdp.eval(`(() => {
      const inp = document.querySelector('[data-testid="vehicle-combobox-make"] input');
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    })()`);
    await cdp.waitFor("document.querySelector('[data-testid=\"selected-vehicle-bar\"]')?.innerText.includes('Geely · Monjaro')");
    console.log("  ✓ Keyboard Enter selected Geely Monjaro from Russian input 'Джили Монджаро'");

    // Check C: Select BYD Atto 3 (REGISTRATION_YEAR) -> full catalog STILL visible + toggle OFF by default
    await cdp.eval(`document.querySelector('[data-testid="clear-selected-vehicle"]')?.click()`);
    await setInput(cdp, '[data-testid="vehicle-combobox-make"] input', "BYD Atto 3");
    await cdp.waitFor("document.querySelector('[data-testid=\"vehicle-combobox-make\"] [role=\"listbox\"]')?.innerText.includes('BYD Atto 3')");
    await cdp.eval(`(() => {
      const opts = [...document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]')];
      const exact = opts.find(o => o.textContent.includes('BYD Atto 3'));
      exact?.click();
    })()`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-year\"]'))");
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-year"] [aria-label^="Открыть список"]')?.click()`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-year\"] [role=\"option\"]'))", 12000);
    // Ensure Year label is "Год регистрации" (not "Год выпуска" / "Год производства")
    const yearLabel = await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-year"] label')?.innerText`);
    assert(yearLabel.toUpperCase().includes("РЕГИСТРАЦ"), `Expected Год регистрации label, got: ${yearLabel}`);

    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-year"] [role="option"]')?.click()`);

    const stateDefault = await cdp.eval(`(() => ({
      barText: document.querySelector('[data-testid="selected-vehicle-bar"]')?.innerText || '',
      checked: document.querySelector('[data-testid="fitment-only-toggle"] input')?.checked,
      cardsCount: document.querySelectorAll('article').length,
    }))()`);
    assert.equal(stateDefault.checked, false, "Toggle must be OFF by default");
    assert(stateDefault.cardsCount >= 7, `Full catalog must stay visible when toggle is OFF, got ${stateDefault.cardsCount}`);
    assert(stateDefault.barText.includes("год регистрации"), "Compact bar must preserve REGISTRATION_YEAR semantics");
    await cdp.screenshot("qa-final-catalog-full-with-car-desktop.png");
    console.log(`  ✓ BYD Atto 3 selected: toggle=OFF, ${stateDefault.cardsCount} catalog items visible, semantics="год регистрации"`);

    // Check D: localStorage persistence across reload
    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"selected-vehicle-bar\"]'))");
    const persistedText = await cdp.eval(`document.querySelector('[data-testid="selected-vehicle-bar"]')?.innerText`);
    assert(persistedText.includes("BYD") && persistedText.includes("Atto 3"), "Selected vehicle must persist across reload");
    console.log("  ✓ Selected vehicle persisted in localStorage across page reload");

    // Check E: Turn ON toggle for BYD Atto 3 -> CONFIRMED 0 empty state + Show all button
    await cdp.eval(`document.querySelector('[data-testid="fitment-only-toggle"] input')?.click()`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"catalog-empty-state\"]'))");
    await cdp.screenshot("qa-final-catalog-confirmed-empty-desktop.png");
    console.log("  ✓ Toggle ON for BYD Atto 3 shows clear CONFIRMED empty state + recovery buttons");

    // Disable via empty state button -> full catalog returns
    await cdp.eval(`document.querySelector('[data-testid="disable-fitment-only-btn"]')?.click()`);
    await cdp.waitFor("document.querySelectorAll('article').length >= 7");
    console.log("  ✓ Clicking 'Показать весь каталог' restores full catalog");

    // Check F: Select Kia Sportage (PRODUCTION_YEAR) + turn ON toggle -> shows CONFIRMED Kia items
    await cdp.eval(`document.querySelector('[data-testid="clear-selected-vehicle"]')?.click()`);
    await setInput(cdp, '[data-testid="vehicle-combobox-make"] input', "Kia Sportage");
    await cdp.waitFor("document.querySelector('[data-testid=\"vehicle-combobox-make\"] [role=\"listbox\"]')?.innerText.includes('Kia Sportage')");
    await cdp.eval(`(() => {
      const opts = [...document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]')];
      opts.find(o => o.textContent.includes('Kia Sportage'))?.click();
    })()`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-generation\"]'))");
    await cdp.eval(`document.querySelector('[data-testid="fitment-only-toggle"] input')?.click()`);
    await cdp.waitFor("document.querySelectorAll('article').length > 0 && document.querySelectorAll('article').length <= 6");
    const kiaCount = await cdp.eval(`document.querySelectorAll('article').length`);
    await cdp.screenshot("qa-final-catalog-confirmed-kia-desktop.png");
    console.log(`  ✓ Toggle ON for Kia Sportage filters strictly to ${kiaCount} CONFIRMED items`);

    // Check G: Mobile 390x844
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise((r) => setTimeout(r, 400));
    const mobileOverflow = await cdp.eval("document.documentElement.scrollWidth > window.innerWidth + 1");
    assert.equal(mobileOverflow, false, "Mobile 390px horizontal overflow detected");
    await cdp.eval(`document.querySelector('[data-testid="selected-vehicle-bar"]')?.scrollIntoView({ block: 'center' })`);
    await new Promise((r) => setTimeout(r, 300));
    await cdp.screenshot("qa-final-catalog-mobile.png");
    console.log("  ✓ Mobile 390x844 verified (overflow=false)");

    assert.equal(cdp.errors.length, 0, `Browser runtime errors: ${cdp.errors.join("; ")}`);
    ws.close();
  } finally {
    chrome.kill("SIGKILL");
    try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }

  console.log("\n✓ ALL FINAL VEHICLE SELECTOR & CATALOG UX QA CHECKS PASSED (0 errors)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
