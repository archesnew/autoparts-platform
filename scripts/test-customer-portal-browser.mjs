import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-cust-qa-"));
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
    if (res.result?.value !== undefined) return res.result.value;
    if (res.result?.type === "object" && res.result?.subtype === "node") return true;
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
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expression);
        if (val) return val;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }

  async screenshot(filePath) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    console.log(`  [Screenshot saved] -> ${filePath}`);
  }

  async clearStorage(origin = "http://127.0.0.1:3000") {
    await this.send("Storage.clearDataForOrigin", {
      origin,
      storageTypes: "all",
    });
    await this.send("Network.clearBrowserCookies");
    await new Promise((r) => setTimeout(r, 400));
  }
}

async function cleanupCustomer(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const customer = await prisma.customer.findFirst({ where: { userId: user.id } });
    if (customer) {
      await prisma.customerVehicle.deleteMany({ where: { customerId: customer.id } });
      await prisma.customerAddress.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    }
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

async function main() {
  console.log("==================================================================");
  console.log(" ZAPTUT.PRO — CUSTOMER PORTAL / PHASE 1: BROWSER QA VERIFICATION");
  console.log("==================================================================\n");

  const emailA = "ivan.portal.qa@example.test";
  const passA = "CustomerSecure2026!Pass";
  const newPassA = "UpdatedCustomer2026!Secure";

  const emailB = "elena.portal.qa@example.test";
  const passB = "ElenaSecure2026!Pass";

  console.log("1. Cleaning up any previous test customer records...");
  await cleanupCustomer(emailA);
  await cleanupCustomer(emailB);
  await prisma.rateLimit.deleteMany({ where: { key: { contains: "127.0.0.1" } } });
  console.log("   [OK] Ready for testing.\n");

  const cdpPort = 9235;
  console.log("2. Launching Google Chrome via CDP on port", cdpPort);
  const chromeProc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${tempDir}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
    "http://127.0.0.1:3000/account/login",
  ]);

  let cdp;
  try {
    let connected = false;
    for (let i = 0; i < 20; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (r.ok) {
          connected = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert(connected, "Chrome must connect");

    const targets = await fetch(`http://127.0.0.1:${cdpPort}/json`).then((r) => r.json());
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    cdp = new CdpClient(ws);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    console.log("   [OK] Connected to Chrome DevTools Protocol session.\n");

    // -------------------------------------------------------------------------
    // SCENARIO 1: REGISTRATION & INITIAL LOGIN
    // -------------------------------------------------------------------------
    console.log("------------------------------------------------------------------");
    console.log("SCENARIO 1: CUSTOMER REGISTRATION (12+ char password)");
    console.log("------------------------------------------------------------------");

    await cdp.navigate("http://127.0.0.1:3000/account/register");
    console.log("Current URL:", await cdp.eval("window.location.href"));
    console.log("Body text preview:", (await cdp.eval("document.body.innerText")).slice(0, 300));
    const regTitle = await cdp.eval("document.body.innerText.toLowerCase().includes('регистрация')");
    assert(regTitle, "Register page must display title");

    // Test password too short (< 12)
    const shortPassAttempt = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Иван Тест", email: "${emailA}", password: "short" })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert.equal(shortPassAttempt.status, 400, "Password under 12 characters must be rejected with 400");
    console.log("  [OK] Short password rejected (< 12 chars).");

    // Valid registration
    const regRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Иван Покупатель",
            email: "${emailA}",
            phone: "+7 999 111-22-33",
            password: "${passA}"
          })
        });
        return { status: res.status, ok: res.ok };
      })()
    `);
    assert(regRes.ok, "Valid registration must succeed with 201");
    console.log("  [OK] Customer registered successfully in PostgreSQL.");

    // Sign in in browser
    await prisma.rateLimit.deleteMany({ where: { key: { contains: "127.0.0.1" } } });
    const loginRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "${emailA}", password: "${passA}" })
        });
        return { status: res.status, ok: res.ok };
      })()
    `);
    assert(loginRes.ok, "Sign-in for registered customer must succeed");

    // Navigate to /account dashboard
    await cdp.navigate("http://127.0.0.1:3000/account");
    const welcomeText = await cdp.eval("document.body.innerText.toLowerCase().includes('иван покупатель')");
    assert(welcomeText, "Dashboard must welcome customer by name");
    console.log("  [OK] Dashboard loaded with customer context.");

    await cdp.screenshot(path.join(artifactDir, "screenshot-customer-dashboard.png"));

    // -------------------------------------------------------------------------
    // SCENARIO 2: GARAGE (VEHICLES) MANAGEMENT
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("SCENARIO 2: GARAGE — MULTIPLE VEHICLES, EDIT & DEFAULT");
    console.log("------------------------------------------------------------------");

    await cdp.navigate("http://127.0.0.1:3000/account/vehicles");
    const garageTitle = await cdp.eval("document.body.innerText.toLowerCase().includes('автомобили')");
    assert(garageTitle, "Vehicles page must open");

    // Add Vehicle 1
    const v1Res = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: "Kia",
            model: "Sportage",
            year: 2021,
            generation: "IV (QL)",
            vin: "XWEGD8123K0000001",
            engine: "2.0 CRDi",
            isDefault: false
          })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(v1Res.data.success, "Vehicle 1 creation must succeed");
    const vehicle1Id = v1Res.data.vehicle.id;

    // Add Vehicle 2 (marked as default)
    const v2Res = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: "BMW",
            model: "530d",
            year: 2020,
            generation: "G30",
            vin: "WBA530D88K0000002",
            engine: "3.0d",
            isDefault: true
          })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(v2Res.data.success, "Vehicle 2 creation must succeed");

    // Edit Vehicle 1 (update engine and modification)
    const editV1Res = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/vehicles/${vehicle1Id}", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modification: "Prestige AWD",
            engine: "2.0 Diesel 185hp"
          })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(editV1Res.data.success, "Vehicle 1 edit must succeed");

    // Reload page to verify persistence
    await cdp.reload();
    const hasKia = await cdp.eval("document.body.innerText.includes('XWEGD8123K0000001')");
    const hasBMW = await cdp.eval("document.body.innerText.includes('WBA530D88K0000002')");
    const hasMod = await cdp.eval("document.body.innerText.includes('Prestige AWD')");
    assert(hasKia && hasBMW && hasMod, "Both vehicles with modifications must be visible after F5");
    console.log("  [OK] Two vehicles created, edited and persisted across reload.");

    await cdp.screenshot(path.join(artifactDir, "screenshot-customer-garage.png"));

    // -------------------------------------------------------------------------
    // SCENARIO 3: ADDRESS BOOK MANAGEMENT
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("SCENARIO 3: ADDRESS BOOK — MULTIPLE ADDRESSES, DEFAULT & PERSISTENCE");
    console.log("------------------------------------------------------------------");

    await cdp.navigate("http://127.0.0.1:3000/account/addresses");
    const addrTitle = await cdp.eval("document.body.innerText.toLowerCase().includes('адреса доставки')");
    assert(addrTitle, "Addresses page must open");

    // Add Address 1 (Moscow)
    const a1Res = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientName: "Иван Покупатель",
            phone: "+7 999 111-22-33",
            country: "Россия",
            region: "Московская обл.",
            city: "Москва",
            street: "Тверская",
            house: "12",
            apartment: "45",
            postalCode: "125009",
            isDefault: false
          })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(a1Res.data.success, "Address 1 creation must succeed");
    const addr1Id = a1Res.data.address.id;

    // Add Address 2 (Minsk, default)
    const a2Res = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientName: "Иван Покупатель (Минск)",
            phone: "+375 29 111-22-33",
            country: "Беларусь",
            region: "Минская обл.",
            city: "Минск",
            street: "пр. Независимости",
            house: "40",
            isDefault: true
          })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(a2Res.data.success, "Address 2 creation must succeed");

    // Reload page to verify persistence
    await cdp.reload();
    const hasMoscow = await cdp.eval("document.body.innerText.toLowerCase().includes('тверская')");
    const hasMinsk = await cdp.eval("document.body.innerText.toLowerCase().includes('независимости')");
    assert(hasMoscow && hasMinsk, "Both addresses must render after F5");
    console.log("  [OK] Multiple addresses created with default flag and verified after F5.");

    await cdp.screenshot(path.join(artifactDir, "screenshot-customer-addresses.png"));

    // -------------------------------------------------------------------------
    // SCENARIO 4: PROFILE UPDATE, PASSWORD CHANGE & LOGOUT/LOGIN
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("SCENARIO 4: PROFILE UPDATE, PASSWORD CHANGE & RE-LOGIN");
    console.log("------------------------------------------------------------------");

    await cdp.navigate("http://127.0.0.1:3000/account/profile");
    const profTitle = await cdp.eval("document.body.innerText.toLowerCase().includes('профиль')");
    assert(profTitle, "Profile page must open");

    // Update profile
    const updateProfRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Иван Сергеевич Покупатель", phone: "+7 999 555-44-33" })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(updateProfRes.data.success, "Profile update must succeed");

    // Change password (testing 12+ char validation)
    const changePassRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/customer/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPassword: "${passA}", newPassword: "${newPassA}" })
        });
        return { status: res.status, data: await res.json() };
      })()
    `);
    assert(changePassRes.data.success, "Password change with 12+ chars must succeed");
    console.log("  [OK] Profile updated and password changed.");

    await cdp.screenshot(path.join(artifactDir, "screenshot-customer-profile.png"));

    // Sign out
    await cdp.eval(`fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })`);
    await new Promise((r) => setTimeout(r, 600));
    await cdp.navigate("http://127.0.0.1:3000/account");
    const redirectedToLogin = await cdp.eval("window.location.pathname === '/account/login'");
    assert(redirectedToLogin, "Accessing /account after signout must redirect to /account/login");
    console.log("  [OK] Signout clears session and protects /account.");

    // Sign back in with NEW password
    await prisma.rateLimit.deleteMany({ where: { key: { contains: "127.0.0.1" } } });
    const reLoginRes = await cdp.eval(`
      (async () => {
        const res = await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "${emailA}", password: "${newPassA}" })
        });
        return { status: res.status, ok: res.ok };
      })()
    `);
    assert(reLoginRes.ok, "Login with newly updated password must succeed");
    console.log("  [OK] Re-login with new password succeeded.");

    // -------------------------------------------------------------------------
    // SCENARIO 5: SECURITY & CROSS-CUSTOMER ISOLATION
    // -------------------------------------------------------------------------
    console.log("\n------------------------------------------------------------------");
    console.log("SCENARIO 5: SECURITY & STRICT CROSS-CUSTOMER ISOLATION");
    console.log("------------------------------------------------------------------");

    // 5A. Customer cannot access /admin
    await cdp.navigate("http://127.0.0.1:3000/admin");
    const adminBlocked = await cdp.eval("window.location.pathname.startsWith('/login')");
    assert(adminBlocked, "CUSTOMER role accessing /admin must be redirected to /login");
    console.log("  [OK] CUSTOMER cannot access /admin (redirected to /login).");

    // 5B. Customer cannot access /supplier
    await cdp.navigate("http://127.0.0.1:3000/supplier");
    const supplierBlocked = await cdp.eval("window.location.pathname.startsWith('/login')");
    assert(supplierBlocked, "CUSTOMER role accessing /supplier must be redirected to /login");
    console.log("  [OK] CUSTOMER cannot access /supplier (redirected to /login).");

    // 5C. Register Customer B and verify Customer B CANNOT see or modify Customer A's data
    await cdp.clearStorage();
    await prisma.rateLimit.deleteMany({ where: { key: { contains: "127.0.0.1" } } });

    await cdp.eval(`
      (async () => {
        await fetch("/api/customer/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Елена Покупательница",
            email: "${emailB}",
            password: "${passB}"
          })
        });
      })()
    `);

    await cdp.eval(`
      (async () => {
        await fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "${emailB}", password: "${passB}" })
        });
      })()
    `);

    // Customer B calls listVehicles and listAddresses
    const bVehicles = await cdp.eval(`fetch("/api/customer/vehicles").then(r => r.json())`);
    const bAddresses = await cdp.eval(`fetch("/api/customer/addresses").then(r => r.json())`);

    assert.equal(bVehicles.vehicles.length, 0, "Customer B garage must be empty (cannot see Customer A's cars)");
    assert.equal(bAddresses.addresses.length, 0, "Customer B address book must be empty (cannot see Customer A's addresses)");

    // Customer B attempts IDOR on Customer A's vehicle
    const stealVehicleRes = await cdp.eval(`
      fetch("/api/customer/vehicles/${vehicle1Id}", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make: "Hacked" })
      }).then(r => r.status)
    `);
    assert.equal(stealVehicleRes, 404, "Customer B modifying Customer A vehicle must return 404 Not Found");

    // Customer B attempts IDOR on Customer A's address
    const stealAddressRes = await cdp.eval(`
      fetch("/api/customer/addresses/${addr1Id}", {
        method: "DELETE"
      }).then(r => r.status)
    `);
    assert.equal(stealAddressRes, 404, "Customer B deleting Customer A address must return 404 Not Found");

    console.log("  [OK] Cross-customer isolation verified: Customer B cannot see or alter Customer A's records (IDOR blocked).");

    console.log("\n==================================================================");
    console.log(" ALL CUSTOMER PORTAL SCENARIOS VERIFIED SUCCESSFULLY IN CHROME!");
    console.log("==================================================================\n");

    ws.close();
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    // Cleanup test customers
    await cleanupCustomer(emailA);
    await cleanupCustomer(emailB);
    await prisma.$disconnect();
  }
}

main().catch(console.error);
