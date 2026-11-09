import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-vehicle-db-"));
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
    return res.result?.value;
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

  async screenshot(filename) {
    const outPath = path.join(artifactDir, filename);
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(outPath, Buffer.from(data, "base64"));
    console.log(`  [SCREENSHOT] Saved -> ${filename}`);
  }
}

async function runTests() {
  console.log("==================================================================");
  console.log(" ZAPTUT.PRO — GLOBAL VEHICLE DATABASE E2E BROWSER QA");
  console.log("==================================================================\n");

  const baseUrl = "http://localhost:3000";

  // 1. API Verification
  console.log("--> 1. Verifying Database REST APIs...");

  // Check makes
  const makesRes = await fetch(`${baseUrl}/api/customer/vehicle-catalog?step=makes`);
  const makesData = await makesRes.json();
  console.log(`  [API] Total makes in DB: ${makesData.makes.length} (expected 51)`);
  assert.equal(makesData.makes.length, 51, "Expected 51 vehicle makes");

  // Check Cyrillic alias search
  const cyrillicRes = await fetch(`${baseUrl}/api/customer/vehicle-catalog?step=makes&query=${encodeURIComponent("Лада")}`);
  const cyrillicData = await cyrillicRes.json();
  console.log(`  [API] Search "Лада" returned: ${cyrillicData.makes.map((m) => m.name).join(", ")}`);
  assert.ok(cyrillicData.makes.some((m) => m.id === "lada"), "Expected 'lada' in search results for 'Лада'");

  // Check models
  const modelsRes = await fetch(`${baseUrl}/api/customer/vehicle-catalog?step=models&makeId=lada`);
  const modelsData = await modelsRes.json();
  console.log(`  [API] Lada models: ${modelsData.models.map((m) => m.name).join(", ")}`);
  assert.ok(modelsData.models.some((m) => m.id === "lada-vesta"), "Expected Lada Vesta model");

  // Check generations
  const genRes = await fetch(`${baseUrl}/api/customer/vehicle-catalog?step=generations&modelId=lada-vesta`);
  const genData = await genRes.json();
  console.log(`  [API] Vesta generations: ${genData.generations.map((g) => g.name).join(" | ")}`);
  assert.ok(genData.generations.length >= 2, "Expected Vesta NG and Vesta 1");

  // Check options
  const optRes = await fetch(`${baseUrl}/api/customer/vehicle-catalog?step=options&generationId=lada-vesta-ng`);
  const optData = await optRes.json();
  console.log(`  [API] Vesta NG years: ${optData.years.join(", ")}; bodyTypes: ${optData.bodyTypes.join(", ")}`);
  console.log(`  [API] Vesta NG engines: ${optData.engines.map((e) => e.name).join("; ")}`);
  assert.ok(optData.years.includes(2024), "Expected year 2024");
  assert.ok(optData.engines.length >= 2, "Expected at least 2 engines for Vesta NG");

  // 2. Check CRM Staff Vehicle Stats API
  console.log("\n--> 2. Verifying CRM Staff Vehicle Stats API...");
  const superAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });
  assert.ok(superAdmin, "Super Admin user exists");

  const staffToken = randomUUID();
  const staffSession = await prisma.session.create({
    data: {
      id: randomUUID(),
      token: staffToken,
      userId: superAdmin.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const adminStatsRes = await fetch(`${baseUrl}/api/admin/vehicles?view=stats`, {
    headers: {
      authorization: `Bearer ${staffToken}`,
    },
  });
  console.log("  [BEARER STATS STATUS]:", adminStatsRes.status);
  const adminStats = await adminStatsRes.json();
  console.log("  [CRM STATS] Database Overview:");
  console.log(`    - Data Sources: ${adminStats.sources?.length}`);
  console.log(`    - Makes: ${adminStats.counts?.makes}`);
  console.log(`    - Models: ${adminStats.counts?.models}`);
  console.log(`    - Generations: ${adminStats.counts?.generations}`);
  console.log(`    - Engines: ${adminStats.counts?.engines}`);
  console.log(`    - Modifications: ${adminStats.counts?.modifications}`);
  console.log(`    - Search Aliases: ${adminStats.counts?.aliases}`);
  console.log(`    - Body Types: ${adminStats.counts?.bodyTypes}`);
  assert.equal(adminStats.counts?.makes, 51);
  assert.equal(adminStats.counts?.models, 80);
  assert.equal(adminStats.counts?.generations, 33);
  assert.equal(adminStats.counts?.engines, 28);
  assert.equal(adminStats.counts?.modifications, 27);
  assert.equal(adminStats.counts?.bodyTypes, 11);

  // 3. Browser E2E Tests with Google Chrome
  console.log("\n--> 3. Launching Google Chrome for Browser QA...");

  // Clean up any test vehicle with test VIN
  await prisma.customerVehicle.deleteMany({ where: { vin: "XTA218070R0123456" } });

  // Customer session for +79874023545
  const customerUser = await prisma.user.findFirst({
    where: { phoneNumber: "+79874023545", role: "CUSTOMER" },
  });
  assert.ok(customerUser, "Customer user +79874023545 must exist in db");

  let custSession = await prisma.session.findFirst({
    where: { userId: customerUser.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!custSession) {
    custSession = await prisma.session.create({
      data: {
        id: randomUUID(),
        token: randomUUID(),
        userId: customerUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }

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
  let ws;
  try {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          connected = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.ok(connected, "Chrome debug port must respond");

    const targets = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    // 3.1. Customer Login via OTP
    console.log("--> 3.1. Performing Customer Phone OTP Login in Browser...");
    await cdp.send("Page.navigate", { url: `${baseUrl}/account/login` });
    await cdp.waitFor("document.readyState === 'complete'", 15000);
    await new Promise((r) => setTimeout(r, 1200));

    const otpResult = await cdp.eval(`
      (async () => {
        await fetch("/api/customer/auth/phone/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "+79874023545" })
        });
        const res = await fetch("/api/customer/auth/phone/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "+79874023545", code: "111111" })
        });
        return await res.json();
      })()
    `);
    console.log("  [OTP LOGIN RESULT]:", JSON.stringify(otpResult));
    await new Promise((r) => setTimeout(r, 800));

    // 3.2. Go to Vehicles Page
    console.log("--> 3.2. Navigating to /account/vehicles with active session...");
    await cdp.send("Page.navigate", { url: `${baseUrl}/account/vehicles` });
    await cdp.waitFor("document.readyState === 'complete'", 15000);
    await new Promise((r) => setTimeout(r, 1500));

    const currentUrl = await cdp.eval("window.location.href");
    console.log("  [CURRENT URL]:", currentUrl);
    assert.ok(currentUrl.includes("/account/vehicles"), "Should be on /account/vehicles");

    // Open "Добавить автомобиль" modal
    console.log("--> 3.3. Opening Add Vehicle Modal...");
    await cdp.eval(`
      const addBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Добавить автомобиль") || b.textContent.includes("+"));
      if (addBtn) addBtn.click();
    `);
    await cdp.waitFor("document.querySelectorAll('form select').length >= 4", 10000);
    await new Promise((r) => setTimeout(r, 800));

    // Check that 51 makes loaded in dropdown
    const makeOptionsCount = await cdp.eval(`(() => {
      const s = document.querySelector("select");
      return s ? s.options.length : 0;
    })()`);
    console.log(`  [UI] Makes in selector dropdown: ${makeOptionsCount} (includes prompt)`);
    assert.ok(makeOptionsCount >= 45, "Expected at least 45 makes in UI dropdown");

    // Test Cyrillic Search: Type "Лада"
    console.log("--> 3.3. Testing Cyrillic Search in Vehicle Cascading Selector...");
    await cdp.eval(`(() => {
      const searchInput = document.querySelector("input[placeholder*='Поиск марки']");
      if (searchInput) {
        searchInput.value = "Лада";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Select Lada
    await cdp.eval(`(() => {
      const s = document.querySelectorAll("select")[0];
      s.value = "lada";
      s.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    console.log("  [UI] Make 'lada' selected, waiting for models...");
    await cdp.waitFor("document.querySelectorAll('select')[1]?.options?.length > 1", 6000);
    const modelsCount = await cdp.eval("document.querySelectorAll('select')[1]?.options?.length");
    console.log(`  [UI] Models loaded: ${modelsCount}`);

    // Select Model: Vesta
    await cdp.eval(`(() => {
      const modelSelect = document.querySelectorAll("select")[1];
      modelSelect.value = "lada-vesta";
      modelSelect.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    console.log("  [UI] Model 'lada-vesta' selected, waiting for generations...");
    await cdp.waitFor("document.querySelectorAll('select')[2]?.options?.length > 1", 6000);

    // Select Generation: Vesta NG
    await cdp.eval(`(() => {
      const genSelect = document.querySelectorAll("select")[2];
      genSelect.value = "lada-vesta-ng";
      genSelect.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    console.log("  [UI] Generation 'lada-vesta-ng' selected, waiting for options...");
    await cdp.waitFor("document.querySelectorAll('select')[3]?.options?.length > 1", 6000);

    // Select Year: 2024
    await cdp.eval(`(() => {
      const yearSelect = document.querySelectorAll("select")[3];
      yearSelect.value = "2024";
      yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    // Select Body Type: SEDAN
    await cdp.eval(`(() => {
      const btSelect = document.querySelectorAll("select")[4];
      btSelect.value = "SEDAN";
      btSelect.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    // Select Engine: vaz-21129
    await cdp.eval(`(() => {
      const engSelect = document.querySelectorAll("select")[5];
      if (engSelect && engSelect.options.length > 1) {
        engSelect.selectedIndex = 1;
        engSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    // Select Modification: 1.6 MT Comfort
    await cdp.eval(`(() => {
      const modSelect = document.querySelectorAll("select")[6];
      if (modSelect && modSelect.options.length > 1) {
        modSelect.selectedIndex = 1;
        modSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    // Set VIN using React setter
    await cdp.eval(`(() => {
      const vinInput = document.querySelector("input[placeholder*='XWEPH811DM0014801']");
      if (vinInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(vinInput, 'XTA218070R0123456');
        vinInput.dispatchEvent(new Event('input', { bubbles: true }));
        vinInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);

    // Pick a color: Corall / Signal Orange (#FF6428)
    await cdp.eval(`(() => {
      const colorBtn = Array.from(document.querySelectorAll("button[title*='#FF6428']")).pop();
      if (colorBtn) colorBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // Capture desktop modal screenshot with Lada Vesta NG selected
    await cdp.screenshot("screenshot-vehicle-db-selector.png");

    const formSummary = await cdp.eval(`(() => {
      return Array.from(document.querySelectorAll("select")).map(s => s.value).join(" | ");
    })()`);
    console.log("  [FORM SELECT VALUES]:", formSummary);

    // Save Vehicle
    console.log("--> 3.4. Submitting Vehicle Save...");
    await cdp.eval(`(() => {
      const submitBtn = document.querySelector("button[type='submit']");
      if (submitBtn) {
        console.log("Found submit button:", submitBtn.textContent);
        submitBtn.click();
      }
    })()`);

    // Wait for modal to close
    console.log("  [UI] Waiting for vehicle modal to close...");
    await cdp.waitFor("!document.querySelector('form')", 12000);
    console.log("  [UI] Waiting for garage list to re-render with Vesta...");
    await cdp.waitFor("document.body.innerText.toLowerCase().includes('vesta')", 10000);

    const hasVesta = await cdp.eval(`
      document.body.innerText.toLowerCase().includes("vesta") || document.body.innerText.toLowerCase().includes("lada");
    `);
    console.log(`  [UI] Lada Vesta visible in garage list: ${hasVesta}`);
    assert.ok(hasVesta, "Saved Lada Vesta NG should be visible in garage list");

    // 3.5. Verify Database Record Linkage
    console.log("\n--> 3.5. Verifying CustomerVehicle PostgreSQL Record Linkage...");
    const savedCar = await prisma.customerVehicle.findFirst({
      where: {
        OR: [
          { vin: "XTA218070R0123456" },
          { make: "Lada", model: "Vesta" },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        vehicleMake: true,
        vehicleModel: true,
        vehicleGeneration: true,
      },
    });
    assert.ok(savedCar, "PostgreSQL CustomerVehicle record found");
    console.log(`  [DB RECORD] Vehicle ID: ${savedCar.id}`);
    console.log(`    - Make: ${savedCar.make} (linked makeId: ${savedCar.vehicleMakeId})`);
    console.log(`    - Model: ${savedCar.model} (linked modelId: ${savedCar.vehicleModelId})`);
    console.log(`    - Generation: ${savedCar.generation} (linked genId: ${savedCar.vehicleGenerationId})`);
    console.log(`    - Year: ${savedCar.year}`);
    console.log(`    - Body: ${savedCar.bodyType}`);
    console.log(`    - Engine: ${savedCar.engine}`);
    console.log(`    - Modification: ${savedCar.modification}`);
    assert.equal(savedCar.vehicleMakeId, "lada");
    assert.equal(savedCar.vehicleModelId, "lada-vesta");
    assert.equal(savedCar.vehicleGenerationId, "lada-vesta-ng");

    // 3.6. Mobile Viewport Verification (390x844)
    console.log("\n--> 3.6. Testing Mobile Viewport (390x844)...");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 600));

    const mobileScroll = await cdp.eval(`
      ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      })
    `);
    console.log(`  [MOBILE] scrollWidth=${mobileScroll.scrollWidth}, innerWidth=${mobileScroll.innerWidth}, overflow=${mobileScroll.hasHorizontalOverflow}`);
    assert.ok(!mobileScroll.hasHorizontalOverflow, "Mobile view must not have horizontal overflow");

    await cdp.screenshot("screenshot-vehicle-db-mobile.png");

    console.log(`  [ERRORS] Console errors count: ${cdp.consoleLogs.filter(c => c.type === "error").length}`);
    console.log(`  [EXCEPTIONS] Uncaught exceptions: ${cdp.exceptions.length}`);
    assert.equal(cdp.exceptions.length, 0, "No browser uncaught exceptions allowed");

    console.log("\n==================================================================");
    console.log(" ALL GLOBAL VEHICLE DATABASE QA CHECKS PASSED SUCCESSFULLY!");
    console.log("==================================================================\n");

  } catch (err) {
    console.error("  [ERROR IN TRY BLOCK]:", err);
    throw err;
  } finally {
    if (ws) {
      try { ws.close(); } catch {}
    }
    try { chromeProc.kill(); } catch {}
    await new Promise((r) => setTimeout(r, 600));
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST SCRIPT:", err);
  process.exit(1);
});
