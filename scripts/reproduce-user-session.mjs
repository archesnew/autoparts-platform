import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-user-session-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9225",
    `--user-data-dir=${tempDir}`
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const list = await fetch("http://127.0.0.1:9225/json").then(r => r.json());
    const pageTarget = list.find(t => t.type === "page") || list[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const curId = id++;
        const handler = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id === curId) {
            ws.removeEventListener("message", handler);
            if (msg.error) reject(new Error(JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    const errors = [];
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === "Runtime.exceptionThrown") {
        console.error(">>> EXCEPTION THROWN:", JSON.stringify(msg.params.exceptionDetails, null, 2));
        errors.push(msg.params.exceptionDetails);
      }
      if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
        console.log(`>>> CONSOLE [${msg.params.type}]:`, msg.params.args.map(a => a.value || a.description).join(" "));
      }
    });

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Network.enable");

    // Set viewport
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log("1. Navigating to /login...");
    await send("Page.navigate", { url: "http://localhost:3000/login" });
    await new Promise(r => setTimeout(r, 2000));

    console.log("2. Filling login form...");
    await send("Runtime.evaluate", {
      expression: `(() => {
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
          return true;
        }
        return false;
      })()`,
      returnByValue: true
    });

    console.log("3. Waiting for login & redirect...");
    await new Promise(r => setTimeout(r, 4000));

    const curUrl = await send("Runtime.evaluate", { expression: "window.location.href", returnByValue: true });
    console.log("Current URL:", curUrl.result?.value);

    // If not redirected automatically to /admin, navigate there
    if (!curUrl.result?.value?.includes("/admin")) {
      console.log("Navigating to /admin manually...");
      await send("Page.navigate", { url: "http://localhost:3000/admin" });
      await new Promise(r => setTimeout(r, 4000));
    }

    const adminUrl = await send("Runtime.evaluate", { expression: "window.location.href", returnByValue: true });
    console.log("Admin URL:", adminUrl.result?.value);

    const bodyText = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
    console.log("Body text has 'Application error'?:", bodyText.result?.value?.includes("Application error"));
    console.log("Body text length:", bodyText.result?.value?.length);

    // Let's test clicking on every section in the navigation!
    console.log("4. Testing sidebar navigation clicks...");
    const navItems = ["Заявки", "Заказы", "Клиенты", "Сотрудники", "Поставщики", "Импорт", "Предложения", "Аналитика", "Финансы"];
    for (const item of navItems) {
      console.log(`Checking nav click: "${item}"...`);
      await send("Runtime.evaluate", {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('nav button, aside button')).find(b => b.textContent && b.textContent.includes('${item}'));
          if (btn) btn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1000));
      const textAfter = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
      if (textAfter.result?.value?.includes("Application error")) {
        console.error(`!!! CRASH OCCURRED ON CLICKING NAV ITEM "${item}" !!!`);
        break;
      }
      if (item === "Предложения") {
        const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";
        const quotesFixedPath = path.join(artifactDir, "screenshot-crm-quotes-fixed.png");
        const res = await send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(quotesFixedPath, Buffer.from(res.data, "base64"));
        console.log("[Screenshot saved] ->", quotesFixedPath);
      }
    }

    ws.close();
  } finally {
    chrome.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(console.error);
