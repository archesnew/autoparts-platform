import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

async function run() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-admin-scr-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9226",
    `--user-data-dir=${tempDir}`
  ]);

  try {
    await new Promise(r => setTimeout(r, 2000));
    const list = await fetch("http://127.0.0.1:9226/json").then(r => r.json());
    const target = list.find(t => t.type === "page") || list[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((res) => {
      const curId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) { ws.removeEventListener("message", handler); res(msg.result); }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const adminEmail = process.env.ZAPTUT_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ZAPTUT_ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error("Set ZAPTUT_ADMIN_EMAIL and ZAPTUT_ADMIN_PASSWORD in environment.");
    }

    await send("Page.navigate", { url: "http://127.0.0.1:3000/login" });
    await new Promise(r => setTimeout(r, 2000));

    await send("Runtime.evaluate", {
      expression: `(async () => {
        await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: ${JSON.stringify(adminEmail)}, password: ${JSON.stringify(adminPassword)} })
        });
      })()`,
      awaitPromise: true
    });

    await send("Page.navigate", { url: "http://127.0.0.1:3000/admin" });
    await new Promise(r => setTimeout(r, 3500));

    const curUrl = await send("Runtime.evaluate", { expression: "window.location.href", returnByValue: true });
    console.log("Current URL:", curUrl.result.value);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    const artifactPath = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6\\screenshot-admin-live-check.png";
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, "base64"));
    console.log("Screenshot saved to", artifactPath);
  } finally {
    chrome.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
