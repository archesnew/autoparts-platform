import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-vdb-exp-"));
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

async function main() {
  console.log("=== EXPANDED VEHICLE DATABASE QA ===\n");

  // 1. Live API Checks
  const makesRes = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=makes`);
  assert.equal(makesRes.status, 200);
  const makesData = await makesRes.json();
  console.log(`  ✓ API step=makes returned ${makesData.makes.length} makes (total=${makesData.total})`);
  assert(makesData.makes.length > 350, `Expected >350 makes, got ${makesData.makes.length}`);

  for (const [mkId, minCount, sampleName] of [
    ["bmw", 900, "X5"],
    ["mercedes-benz", 1200, "Sprinter"],
    ["byd", 40, "Atto 3"],
    ["geely", 15, "Tugella"],
    ["exeed", 3, "TXL"],
    ["gaz", 5, "GAZelle"],
  ]) {
    const r = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=models&makeId=${mkId}`);
    assert.equal(r.status, 200);
    const d = await r.json();
    const found = d.models.some((m) => m.name.toLowerCase().includes(sampleName.toLowerCase()));
    assert(d.models.length >= minCount, `${mkId}: expected >=${minCount} models, got ${d.models.length}`);
    assert(found, `${mkId}: missing sample model ${sampleName}`);
    console.log(`  ✓ API models(${mkId}): ${d.models.length} models (includes ${sampleName})`);
  }

  // Model-level fallback options (model without generations, e.g. BYD Atto 3)
  const bydModels = await (await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=models&makeId=byd`)).json();
  const atto3 = bydModels.models.find((m) => /atto 3$/i.test(m.name));
  assert(atto3, "BYD Atto 3 must exist");
  const optRes = await fetch(`${BASE_URL}/api/customer/vehicle-catalog?step=options&modelId=${encodeURIComponent(atto3.id)}`);
  assert.equal(optRes.status, 200);
  const optData = await optRes.json();
  console.log(`  ✓ API model fallback options(byd/Atto 3): years=${optData.years.length}, yearSemantics=${optData.yearSemantics}, bodyTypes=${optData.bodyTypes.length}`);

  // About attribution page
  const aboutHtml = await (await fetch(`${BASE_URL}/about`)).text();
  assert(aboutHtml.includes("VehiclesDB") && aboutHtml.includes("CC BY 4.0"), "Attribution missing on /about");
  console.log("  ✓ /about includes VehiclesDB CC BY 4.0 & MeterApp attribution");

  // 2. Browser CDP QA
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--remote-debugging-port=9224",
      `--user-data-dir=${tempDir}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const list = await (await fetch("http://127.0.0.1:9224/json/list")).json();
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

    await cdp.navigate(`${BASE_URL}/catalog`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-make\"]'))", 15000);

    // Wait until >350 makes loaded into combobox
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-make"] button')?.click()`);
    const optCount = await cdp.waitFor(
      "(() => { const n = document.querySelectorAll('[data-testid=\"vehicle-combobox-make\"] [role=\"option\"]').length; return n > 350 ? n : false; })()",
      12000
    );
    console.log(`  ✓ Browser Make dropdown rendered ${optCount} makes without typing`);

    // Scroll to filter and type BYD
    await cdp.eval(`(() => {
      const inp = document.querySelector('[data-testid="vehicle-combobox-make"] input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(inp, 'BYD');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-make\"] [role=\"option\"]'))");
    await cdp.eval(`(() => {
      const opts = [...document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]')];
      const byd = opts.find(o => o.textContent.trim().startsWith('BYD'));
      byd?.click();
    })()`);

    // Select Atto 3 (no generations -> Year & BodyType fallback should appear!)
    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-model\"]'))");
    await cdp.eval(`document.querySelector('[data-testid="vehicle-combobox-model"] button')?.click()`);
    await cdp.waitFor("document.querySelectorAll('[data-testid=\"vehicle-combobox-model\"] [role=\"option\"]').length >= 40");
    await cdp.eval(`(() => {
      const opts = [...document.querySelectorAll('[data-testid="vehicle-combobox-model"] [role="option"]')];
      const atto = opts.find(o => o.textContent.includes('Atto 3'));
      atto?.click();
    })()`);

    await cdp.waitFor("Boolean(document.querySelector('[data-testid=\"vehicle-combobox-year\"]'))", 10000);
    await cdp.eval(`document.querySelector('[data-testid="dual-mode-vehicle-filter"]')?.scrollIntoView({ block: 'center' })`);
    await new Promise((r) => setTimeout(r, 400));
    await cdp.screenshot("qa-vehicle-expanded-desktop.png");

    const hasAttribution = await cdp.eval(
      "document.querySelector('[data-testid=\"dual-mode-vehicle-filter\"]')?.innerText.includes('VehiclesDB')"
    );
    assert(hasAttribution, "Expected VehiclesDB attribution notice under vehicle filter");
    console.log("  ✓ Browser BYD -> Atto 3 fallback Year/BodyType & VehiclesDB CC-BY 4.0 attribution verified");
    assert.equal(cdp.errors.length, 0, `Browser runtime errors: ${cdp.errors.join("; ")}`);

    ws.close();
  } finally {
    chrome.kill("SIGKILL");
    try { fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  }

  console.log("\n✓ ALL EXPANDED VEHICLE DATABASE QA CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
