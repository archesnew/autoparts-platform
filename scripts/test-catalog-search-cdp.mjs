import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-search-"));
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
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }
}

async function test() {
  const port = 9255;
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
    console.log("Navigated to catalog.");

    // Direct API check first
    const apiRes = await cdp.eval(`fetch('/api/catalog?q=бмв').then(r => r.json())`);
    console.log("API /api/catalog?q=бмв count:", apiRes.items?.length);

    // Now test UI typing
    const typeRes = await cdp.eval(`(async () => {
      const inp = document.getElementById('catalog-search');
      if (!inp) return { error: "input not found" };
      
      inp.focus();
      // Set value with react tracker bypass
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(inp, 'BMW');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Wait for fetch
      await new Promise(r => setTimeout(r, 1000));
      const text = document.body.innerText;
      return {
        inputValue: inp.value,
        hasBMW: text.includes('BMW') || text.includes('БМВ'),
        bodyLength: text.length
      };
    })()`);
    console.log("UI Type 'BMW' result:", typeRes);

    // Test Quick Request Modal opening
    const modalRes = await cdp.eval(`(async () => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Оставить заявку') || b.innerText.includes('Подобрать'));
      if (!btn) return { error: "btn not found" };
      btn.click();
      await new Promise(r => setTimeout(r, 600));
      const hasDialog = Boolean(document.querySelector('[role="dialog"], form'));
      return { clicked: btn.innerText.trim(), hasDialog };
    })()`);
    console.log("Modal click result:", modalRes);

    // Test Dual Mode Vehicle Selector button
    const selectorRes = await cdp.eval(`(async () => {
      const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
      const brandBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Выберите марку') || b.innerText.includes('Марка'));
      if (brandBtn) {
        brandBtn.click();
        await new Promise(r => setTimeout(r, 500));
        const popover = document.querySelector('[role="listbox"], [data-radix-popper-content-wrapper]');
        return { brandBtnFound: true, popover: Boolean(popover) };
      }
      return { brandBtnFound: false, allBtns: allBtns.slice(0, 15) };
    })()`);
    console.log("Vehicle selector result:", selectorRes);

  } finally {
    chrome.kill();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test().catch(console.error);
