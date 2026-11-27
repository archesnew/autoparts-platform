import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  await prisma.rateLimit.deleteMany({ where: { key: { contains: '127.0.0.1' } } });
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-debug-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9224",
    `--user-data-dir=${tempDir}`
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await fetch("http://127.0.0.1:9224/json").then(r => r.json());
  const pageTarget = list.find(t => t.type === "page") || list[0];
  const wsUrl = pageTarget.webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);

  await new Promise(r => ws.onopen = r);
  let id = 1;
  function send(method, params = {}) {
    return new Promise((res, rej) => {
      const curId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) {
          ws.removeEventListener("message", handler);
          res(msg.result);
        }
      };
      ws.addEventListener("message", handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === "Runtime.exceptionThrown") {
      console.log("CRASH EXCEPTION:", JSON.stringify(msg.params.exceptionDetails, null, 2));
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("CONSOLE:", msg.params.type, msg.params.args.map(a => a.value || a.description).join(" "));
    }
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Sign in as superadmin
  console.log("Navigating to /login...");
  await send("Page.navigate", { url: "http://127.0.0.1:3000/login" });
  await new Promise(r => setTimeout(r, 2000));
  const curUrl = await send("Runtime.evaluate", { expression: "window.location.href", returnByValue: true });
  console.log("Current URL:", curUrl);

  const adminEmail = process.env.ZAPTUT_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.ZAPTUT_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("Set ZAPTUT_ADMIN_EMAIL and ZAPTUT_ADMIN_PASSWORD in environment.");
  }

  console.log("Submitting sign-in...");
  const authRes = await send("Runtime.evaluate", {
    expression: `(async () => {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ${JSON.stringify(adminEmail)}, password: ${JSON.stringify(adminPassword)} })
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, ok: res.ok, data };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log("Auth result:", authRes);

  console.log("Navigating to /admin...");
  await send("Page.navigate", { url: "http://127.0.0.1:3000/admin" });
  await new Promise(r => setTimeout(r, 4000));

  const pageHtml = await send("Runtime.evaluate", {
    expression: "document.body.innerText",
    returnByValue: true
  });
  console.log("Page text on /admin:", pageHtml?.result?.value?.slice(0, 300));
  chrome.kill();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
