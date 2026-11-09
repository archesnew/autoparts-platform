import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-journey-"));
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
      throw new Error(`Eval error: ${res.exceptionDetails.text} (${res.exceptionDetails.exception?.description || ""})`);
    }
    if (res.result?.value !== undefined) {
      return res.result.value;
    }
    if (res.result?.objectId || res.result?.subtype === "node") {
      return true;
    }
    return undefined;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'");
  }

  async waitFor(expression, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expression);
        if (val) return val;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  async screenshot(fileName) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    const targetPath = path.join(artifactDir, fileName);
    fs.writeFileSync(targetPath, Buffer.from(data, "base64"));
    console.log(`  [SCREENSHOT SAVED]: ${targetPath}`);
  }
}

async function main() {
  console.log("=== STARTING BROWSER CDP CUSTOMER BUYING JOURNEY VERIFICATION ===");

  const port = 9224;
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

    // 1. Visit Catalog & Add Items to Request
    console.log("\n--> 1. Navigating to /catalog...");
    await cdp.navigate("http://localhost:3000/catalog");
    await cdp.waitFor("document.querySelectorAll('article').length > 0", 10000);

    console.log("  [UI] Adding first item to request cart...");
    await cdp.waitFor("document.querySelectorAll('[data-action=\"add-to-cart\"]').length > 0", 10000);
    const firstClicked = await cdp.eval(`(() => {
      const btn = document.querySelector('[data-action="add-to-cart"]');
      if (btn) {
        btn.scrollIntoView({ block: 'center' });
        btn.click();
        return true;
      }
      return false;
    })()`);
    console.log("  [CLICK RESULT 1]:", firstClicked);
    await new Promise((r) => setTimeout(r, 800));

    console.log("  [UI] Closing drawer to add second item...");
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Закрыть корзину"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise((r) => setTimeout(r, 500));

    console.log("  [UI] Adding second item to request cart...");
    const secondClicked = await cdp.eval(`(() => {
      const btns = document.querySelectorAll('[data-action="add-to-cart"]');
      if (btns[1]) {
        btns[1].scrollIntoView({ block: 'center' });
        btns[1].click();
        return true;
      }
      return false;
    })()`);
    console.log("  [CLICK RESULT 2]:", secondClicked);
    await new Promise((r) => setTimeout(r, 1000));

    // Capture screenshot of cart drawer
    await cdp.screenshot("screenshot-journey-catalog-cart.png");

    // 2. Perform Customer Phone OTP login in browser
    console.log("\n--> 2. Performing Customer Phone OTP Login in Browser...");
    await cdp.navigate("http://localhost:3000/account/login?redirect=/catalog");
    await new Promise((r) => setTimeout(r, 1000));

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
    await new Promise((r) => setTimeout(r, 1000));

    console.log("  [UI] Waiting for redirect back to /catalog or /account...");
    await new Promise((r) => setTimeout(r, 2000));

    // Navigate to /catalog with cart intact
    await cdp.navigate("http://localhost:3000/catalog");
    await cdp.waitFor("document.querySelectorAll('article').length > 0", 10000);

    const debugInfo = await cdp.eval(`
      (async () => {
        const pRes = await fetch("/api/customer/profile");
        const pData = pRes.ok ? await pRes.json() : null;
        return {
          cookies: document.cookie,
          cartRaw: localStorage.getItem("zaptut_cart_items"),
          profileStatus: pRes.status,
          profileData: pData
        };
      })()
    `);
    console.log("  [DEBUG INFO]:", JSON.stringify(debugInfo));

    // Open Cart Drawer
    console.log("  [UI] Opening Cart Drawer as logged in customer...");
    await new Promise((r) => setTimeout(r, 1000));
    const toggleResult = await cdp.eval(`(() => {
      const btn = document.querySelector('#cart-drawer-toggle');
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.innerText };
      }
      return { clicked: false };
    })()`);
    console.log("  [TOGGLE RESULT]:", JSON.stringify(toggleResult));

    await new Promise((r) => setTimeout(r, 1000));

    const drawerDebug = await cdp.eval(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const submitBtn = document.querySelector('#cart-submit-btn');
      const loginBtn = document.querySelector('#cart-login-btn');
      return {
        dialogFound: Boolean(dialog),
        dialogText: dialog ? dialog.innerText.slice(0, 300) : null,
        submitBtnFound: Boolean(submitBtn),
        loginBtnFound: Boolean(loginBtn)
      };
    })()`);
    console.log("  [DRAWER DEBUG]:", JSON.stringify(drawerDebug));

    await cdp.waitFor("Boolean(document.querySelector('#cart-submit-btn'))", 10000);
    await new Promise((r) => setTimeout(r, 400));

    // Submit Request from drawer
    console.log("  [UI] Submitting Request via Cart Drawer...");
    await cdp.eval(`document.querySelector('#cart-submit-btn').click()`);

    await new Promise((r) => setTimeout(r, 2000));
    const submitState = await cdp.eval(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return {
        bodySnippet: document.body.innerText.slice(0, 300),
        drawerSnippet: dialog ? dialog.innerText.slice(0, 400) : null,
      };
    })()`);
    console.log("  [SUBMIT STATE]:", JSON.stringify(submitState));

    console.log("  [UI] Waiting for request creation confirmation...");
    await cdp.waitFor("document.body.innerText.toLowerCase().includes('создана')", 10000);
    console.log("  ✓ Request successfully created from UI!");

    // Navigate to Requests list in portal
    console.log("\n--> 3. Viewing Customer Portal Requests (/account/requests)...");
    await cdp.navigate("http://localhost:3000/account/requests");
    await cdp.waitFor("document.querySelectorAll('a').length > 5", 10000);

    // Get latest request ID from DB
    const latestReq = await prisma.request.findFirst({
      where: { customer: { phone: { contains: "9874023545" } } },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    assert.ok(latestReq, "Latest request must exist in DB");
    console.log(`  [DB] Latest request: ${latestReq.number} (ID: ${latestReq.id})`);

    // 4. Manager creates commercial offer for this request
    console.log("\n--> 4. Manager forms Commercial Offer in CRM...");
    const supplier = await prisma.supplier.findFirst();
    if (latestReq.items[0]) {
      await prisma.supplierQuote.create({
        data: {
          requestItemId: latestReq.items[0].id,
          supplierId: supplier.id,
          purchasePrice: 4800,
          currency: "RUB",
          deliveryDays: 2,
          deliveryCost: 500,
          status: "SELECTED",
        },
      });
    }

    // Save offer
    await prisma.customerOffer.create({
      data: {
        requestId: latestReq.id,
        version: 1,
        status: "SENT",
        responseStatus: "PENDING",
        currency: "RUB",
        customerNote: "Детали проверены на складе, готовы к отгрузке.",
        snapshot: {
          version: 1,
          comment: "Детали проверены на складе, готовы к отгрузке.",
          totalRubMinor: 1420000,
          sharedLogisticsRubMinor: 50000,
          lines: latestReq.items.map((i) => ({
            itemId: i.id,
            name: i.description,
            quantity: i.quantity,
            condition: "Новая (оригинал)",
            deliveryDays: 2,
            totalRubMinor: 710000,
          })),
        },
      },
    });

    await prisma.request.update({
      where: { id: latestReq.id },
      data: {
        customerOfferStatus: "SENT",
        customerResponseStatus: "SENT",
        status: "SENT_TO_CUSTOMER",
      },
    });
    console.log("  ✓ Commercial offer formed and sent to customer.");

    // 5. Customer views request detail with offer
    console.log("\n--> 5. Customer reviews Commercial Offer at /account/requests/[id]...");
    await cdp.navigate(`http://localhost:3000/account/requests/${latestReq.id}`);
    await cdp.waitFor("document.body.innerText.toLowerCase().includes('коммерческое предложение')", 10000);
    await new Promise((r) => setTimeout(r, 600));

    await cdp.screenshot("screenshot-journey-customer-offer.png");

    // Click "Принять предложение"
    console.log("  [UI] Customer clicks 'Принять предложение →'...");
    await cdp.waitFor("Boolean(document.querySelector('#accept-offer-btn'))", 10000);
    await cdp.eval(`document.querySelector('#accept-offer-btn').click()`);

    console.log("  [UI] Waiting for order page...");
    await new Promise((r) => setTimeout(r, 2500));

    // Find created order
    const createdOrder = await prisma.order.findFirst({
      where: { requestId: latestReq.id },
      include: { shipments: true },
    });
    assert.ok(createdOrder, "Order must be created in DB");
    console.log(`  ✓ Order created: ${createdOrder.orderNumber} (ID: ${createdOrder.id})`);

    // 6. Manager updates order status to SHIPPED with tracking in CRM
    console.log("\n--> 6. Manager marks order SHIPPED with CDEK tracking in CRM...");
    if (createdOrder.shipments[0]) {
      await prisma.shipment.update({
        where: { id: createdOrder.shipments[0].id },
        data: {
          carrier: "CDEK",
          trackingNumber: "ZAP-CDEK-2026-JOURNEY",
          status: "IN_TRANSIT",
          city: "Москва",
          address: "ул. Тверская, д. 7, ПВЗ 4",
        },
      });
    }
    await prisma.order.update({
      where: { id: createdOrder.id },
      data: {
        status: "SHIPPED",
        deliveryStatus: "IN_TRANSIT",
      },
    });
    console.log("  ✓ Order updated to SHIPPED in DB.");

    // 7. Customer views order detail at /account/orders/[id]
    console.log("\n--> 7. Customer views Order Detail at /account/orders/[id]...");
    await cdp.navigate(`http://localhost:3000/account/orders/${createdOrder.id}`);
    await cdp.waitFor("document.body.innerText.includes('ZAP-CDEK-2026-JOURNEY')", 10000);
    await new Promise((r) => setTimeout(r, 800));

    await cdp.screenshot("screenshot-journey-order-detail.png");

    console.log("\n==================================================================");
    console.log(" ALL BROWSER CUSTOMER BUYING JOURNEY CHECKS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
  } finally {
    if (ws) ws.close();
    chromeProc.kill("SIGKILL");
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("BROWSER JOURNEY TEST FAILED:", err);
  process.exit(1);
});
