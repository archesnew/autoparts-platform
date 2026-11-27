import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-cart-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\a2bd0cad-1827-4312-bca0-5a7eb185d8f8";
const BASE_URL = "http://127.0.0.1:3005";

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
    await this.waitFor("document.readyState === 'complete'");
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 6000);
    } catch {}
    await new Promise((r) => setTimeout(r, 600));
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
}

async function run() {
  const port = 9265;
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${tempDir}`,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1440,900"
  ]);

  try {
    let wsUrl = "";
    for (let i = 0; i < 20; i++) {
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

    await cdp.navigate(`${BASE_URL}/catalog`);

    // 1. Click "+ В заявку" on first item
    const addRes = await cdp.eval(`(async () => {
      const btn = document.querySelector('button[data-action="add-to-cart"]');
      if (!btn) return { error: "add-to-cart button not found" };
      btn.click();
      await new Promise(r => setTimeout(r, 600));
      const drawer = document.querySelector('[role="dialog"], .fixed');
      const text = document.body.innerText;
      const hasCart = text.includes("Корзина") || text.includes("деталей в заявке") || text.includes("Оформить заказ");
      return { clicked: true, hasCart, textSnippet: text.slice(0, 300) };
    })()`);
    console.log("Add-to-cart result:", addRes);

    const shot1 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "alien-06-cart-drawer-success.png"), Buffer.from(shot1.data, "base64"));
    console.log("Saved alien-06-cart-drawer-success.png");

    // 2. Click "Инфо" to open product detail modal
    await cdp.eval(`(() => {
      const close = document.querySelector('button[aria-label="Закрыть"], button.close');
      if (close) close.click();
      else document.body.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const infoRes = await cdp.eval(`(async () => {
      const infoBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === "Инфо");
      if (infoBtns.length === 0) return { error: "No Info buttons" };
      infoBtns[0].click();
      await new Promise(r => setTimeout(r, 600));
      const modal = document.querySelector('[role="dialog"]');
      const text = modal ? modal.innerText : '';
      return {
        clicked: true,
        modalOpen: Boolean(modal),
        hasOem: text.includes("OEM") || text.includes("Артикул"),
        hasAddButton: text.includes("+ Добавить деталь в заявку"),
        modalSnippet: text.slice(0, 200)
      };
    })()`);
    console.log("Product detail modal result:", infoRes);

    const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "alien-07-product-detail-modal.png"), Buffer.from(shot2.data, "base64"));
    console.log("Saved alien-07-product-detail-modal.png");

    // 3. Test Vehicle Combobox selection (exact flow from qa-final-catalog-ux)
    console.log("\nTesting DualModeVehicleFilter make and model selection...");
    await cdp.eval(`(() => {
      const close = document.querySelector('button[aria-label="Закрыть"]');
      if (close) close.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const vehicleFilterRes = await cdp.eval(`(async () => {
      const makeInput = document.querySelector('[data-testid="vehicle-combobox-make"] input');
      if (!makeInput) return { error: "makeInput not found" };

      // Type "Kia"
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(makeInput, "Kia");
      makeInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));

      const options = Array.from(document.querySelectorAll('[data-testid="vehicle-combobox-make"] [role="option"]'));
      const kiaOpt = options.find(o => o.innerText.includes("Kia"));
      if (!kiaOpt) return { error: "Kia option not found", optionsCount: options.length };
      kiaOpt.click();
      await new Promise(r => setTimeout(r, 600));

      const modelInput = document.querySelector('[data-testid="vehicle-combobox-model"] input');
      return {
        makeSelected: true,
        modelInputFound: Boolean(modelInput)
      };
    })()`);
    console.log("Vehicle filter test result:", vehicleFilterRes);

    const shot3 = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(artifactDir, "alien-08-vehicle-filter-kia.png"), Buffer.from(shot3.data, "base64"));
    console.log("Saved alien-08-vehicle-filter-kia.png");

  } finally {
    chrome.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch(console.error);
