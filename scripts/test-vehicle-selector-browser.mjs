import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-vehicle-qa-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.exceptions = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }

      if (msg.method === "Runtime.exceptionThrown") {
        this.exceptions.push(msg.params.exceptionDetails);
        console.error("  [BROWSER EXCEPTION]:", msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description || "");
      }
      if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
        const text = msg.params.args.map((a) => a.value || a.description).join(" ");
        this.consoleLogs.push({ type: msg.params.type, text });
        if (msg.params.type === "error") {
          console.error(`  [CONSOLE ERROR]:`, text);
        }
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
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    if (res.result?.type === "boolean") return res.result.value;
    if (res.result?.value !== undefined) return res.result.value;
    if (res.result?.type === "object") {
      if (res.result.subtype === "null") return null;
      return true;
    }
    if (res.result?.type === "undefined") return undefined;
    return res.result;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 15000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 8000);
    } catch {}
    await new Promise((r) => setTimeout(r, 1200));
  }

  async reload() {
    await this.send("Page.reload");
    await this.waitFor("document.readyState === 'complete'", 15000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 8000);
    } catch {}
    await new Promise((r) => setTimeout(r, 1200));
  }

  async waitFor(expression, timeoutMs = 12000) {
    const expr = expression.trim().startsWith("Boolean(")
      ? expression
      : `Boolean(${expression})`;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expr);
        if (val) return val;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }

  async screenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    console.log(`Saved screenshot: ${path.basename(filePath)}`);
  }

  async setViewport(width, height) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await this.send("Emulation.setVisibleSize", { width, height });
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main() {
  console.log("=== BROWSER QA: VEHICLE SELECTOR & COMPACT ZAPTUT GARAGE ===");

  // 1. Ensure user +79874023545 has active session
  const customerUser = await prisma.user.findFirst({
    where: { phoneNumber: "+79874023545", role: "CUSTOMER" },
  });
  assert.ok(customerUser, "Customer user +79874023545 must exist in db");

  let session = await prisma.session.findFirst({
    where: { userId: customerUser.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!session) {
    console.log("Creating active session for customer...");
    session = await prisma.session.create({
      data: {
        id: `sess_qa_${Date.now()}`,
        token: `tok_qa_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: customerUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log(`Using active customer session: token=${session.token.substring(0, 10)}...`);

  // 2. Launch Chrome
  const port = 9333;
  const chromeProc = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tempDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let cdp;
  try {
    // Wait for CDP endpoint
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          connected = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(connected, "Could not obtain Chrome DevTools version");

    const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    assert.ok(pageTarget, "No page target available");

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    // -------------------------------------------------------------------------
    // AUTHENTICATE: Sign in via Phone OTP (+79874023545, OTP 111111)
    // -------------------------------------------------------------------------
    console.log("\n--- Authenticating Customer (+79874023545) via Phone OTP ---");
    await cdp.navigate("http://localhost:3000/account/login");

    const otpResult = await cdp.eval(`
      (async () => {
        // 1. Send OTP
        await fetch("/api/customer/auth/phone/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "+79874023545" })
        });
        // 2. Verify OTP with dev master code
        const res = await fetch("/api/customer/auth/phone/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "+79874023545", code: "111111" })
        });
        return { status: res.status, ok: res.ok, data: await res.json() };
      })()
    `);
    console.log("Phone Auth OTP verification result:", otpResult);
    assert.ok(otpResult.ok, "OTP verification must succeed for +79874023545");

    // -------------------------------------------------------------------------
    // TEST 1: Check Customer Dashboard & Compact Zaptut Garage Card
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Dashboard ZaptutGarageCard Layout ---");
    await cdp.setViewport(1440, 900);
    await cdp.navigate("http://localhost:3000/account");

    const currentUrl = await cdp.eval("window.location.href");
    const bodyPreview = await cdp.eval("document.body.innerText");
    console.log("Current URL:", currentUrl);
    console.log("Body preview:", bodyPreview.substring(0, 300));

    const tags = await cdp.eval("Array.from(document.querySelectorAll('*')).map(e => e.tagName).filter((v,i,a) => a.indexOf(v)===i)");
    console.log("DOM Tags on page:", tags);

    const hasSection = await cdp.eval("Boolean(document.querySelector('section'))");
    console.log("hasSection:", hasSection);

    // Wait for garage card to render
    await cdp.waitFor("document.querySelector('section')", 10000);
    const cardText = await cdp.eval("document.body.innerText");
    assert.ok(cardText.includes("ZAPTUT GARAGE"), "Should contain ZAPTUT GARAGE header");
    assert.ok(!cardText.includes("ОФИЦИАЛЬНЫЙ БОКОВОЙ МАКЕТ"), "Must NOT contain old status badge");

    // Check car image size in DOM
    const carMetrics = await cdp.eval(`(() => {
      const svg = document.querySelector('section svg');
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    })()`);
    console.log("Dashboard car SVG dimensions:", carMetrics);
    if (carMetrics) {
      assert.ok(carMetrics.width <= 320, `Car SVG width (${carMetrics.width}px) should be compact <= 320px`);
    }

    const dashScreenshotPath = path.join(artifactDir, "screenshot-garage-card-compact.png");
    await cdp.screenshot(dashScreenshotPath);

    // -------------------------------------------------------------------------
    // TEST 2: Navigate to /account/vehicles and Open Cascading Selector
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Sequential Vehicle Selector Modal ---");
    await cdp.navigate("http://localhost:3000/account/vehicles");

    console.log("Vehicles page URL:", await cdp.eval("window.location.href"));
    console.log("Vehicles body:", (await cdp.eval("document.body.innerText")).substring(0, 400));
    console.log("All button texts:", await cdp.eval("Array.from(document.querySelectorAll('button')).map(b => b.innerText)"));

    // Click "+ Добавить автомобиль"
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('добавить автомобиль'));
      if (btn) btn.click();
    })()`);

    // Wait for modal to open
    await cdp.waitFor("document.querySelectorAll('form select').length >= 4", 10000);
    console.log("Vehicle selector modal opened.");

    // Step 1: Select Make -> Toyota
    await cdp.eval(`(() => {
      const select = document.querySelector('select'); // Make select is first
      select.value = 'toyota';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Verify Model dropdown now has options
    const modelOptions = await cdp.eval(`(() => {
      const selects = document.querySelectorAll('form select');
      if (selects.length < 2) return [];
      return Array.from(selects[1].options).map(o => o.text);
    })()`);
    console.log("Model options after selecting Toyota:", modelOptions);
    assert.ok(modelOptions.some(m => m.includes("Camry")), "Model options should include Camry");

    // Step 2: Select Model -> Camry
    await cdp.eval(`(() => {
      const selects = document.querySelectorAll('form select');
      const opt = Array.from(selects[1].options).find(o => o.text.includes('Camry'));
      if (opt) {
        selects[1].value = opt.value;
        selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Step 3: Select Generation -> VIII (XV70) Рестайлинг
    await cdp.eval(`(() => {
      const selects = document.querySelectorAll('form select');
      const opt = Array.from(selects[2].options).find(o => o.text.includes('XV70') || o.value);
      if (opt) {
        selects[2].value = opt.value;
        selects[2].dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Step 4: Select Year -> 2022
    await cdp.eval(`(() => {
      const selects = document.querySelectorAll('form select');
      const opt = Array.from(selects[3].options).find(o => o.value === '2022' || o.text.includes('2022')) || selects[3].options[1];
      if (opt) {
        selects[3].value = opt.value;
        selects[3].dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Step 5: Select Engine -> 2.5 л 200 л.с.
    await cdp.eval(`(() => {
      const selects = document.querySelectorAll('form select');
      if (selects[5] && selects[5].options.length > 1) {
        selects[5].value = selects[5].options[1].value;
        selects[5].dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Step 6: Select Modification
    await cdp.eval(`(() => {
      const selects = document.querySelectorAll('form select');
      if (selects[6] && selects[6].options.length > 1) {
        selects[6].value = selects[6].options[1].value;
        selects[6].dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Step 7: Select Color -> Белый перламутр
    await cdp.eval(`(() => {
      const colorBtns = Array.from(document.querySelectorAll('form button')).filter(b => b.innerText.toLowerCase().includes('белый'));
      if (colorBtns[0]) colorBtns[0].click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Step 8: Enter VIN (optional)
    await cdp.eval(`(() => {
      const vinInput = document.querySelector('form input[placeholder*=\"XWEPH\"]') || document.querySelector('form input[maxlength=\"25\"]');
      if (vinInput) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(vinInput, 'JTNB23HK4N0012345');
        vinInput.dispatchEvent(new Event('input', { bubbles: true }));
        vinInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Capture modal screenshot
    const modalScreenshotPath = path.join(artifactDir, "screenshot-vehicle-selector-modal.png");
    await cdp.screenshot(modalScreenshotPath);

    // Submit form: click "Добавить в гараж"
    console.log("Submitting new vehicle...");
    await cdp.eval(`(() => {
      const submitBtn = Array.from(document.querySelectorAll('form button')).find(b => b.innerText.toLowerCase().includes('добавить') || b.type === 'submit');
      if (submitBtn) submitBtn.click();
    })()`);

    // Wait for modal to close and list to update
    await cdp.waitFor("!document.querySelector('form')", 12000);
    await new Promise((r) => setTimeout(r, 1500));

    // Verify Toyota Camry in garage list
    const vehiclesPageText = (await cdp.eval("document.body.innerText")).toLowerCase();
    const hasCamry = vehiclesPageText.includes("toyota") && vehiclesPageText.includes("camry");
    console.log("Garage list updated. Contains Toyota Camry:", hasCamry);
    assert.ok(hasCamry, "New vehicle 'Toyota Camry' must be visible in vehicles list");

    // -------------------------------------------------------------------------
    // TEST 3: Mobile Viewport Verification (390x844)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Mobile Responsive Layout (390x844) ---");
    await cdp.setViewport(390, 844);
    await cdp.navigate("http://localhost:3000/account");
    await new Promise((r) => setTimeout(r, 1200));

    const mobileScreenshotPath = path.join(artifactDir, "screenshot-vehicle-selector-mobile.png");
    await cdp.screenshot(mobileScreenshotPath);

    // Verify no horizontal overflow on mobile
    const horizontalOverflow = await cdp.eval(`document.documentElement.scrollWidth > window.innerWidth`);
    console.log("Mobile horizontal overflow detected:", horizontalOverflow);
    assert.strictEqual(horizontalOverflow, false, "Mobile page must not horizontally overflow");

    console.log("\n>>> ALL VEHICLE SELECTOR & GARAGE BROWSER TESTS PASSED SUCCESSFULLY! <<<");
  } catch (err) {
    console.error("Test error in try block:", err);
    throw err;
  } finally {
    if (cdp) {
      try {
        await cdp.send("Browser.close");
      } catch {}
    }
    try {
      chromeProc.kill();
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
