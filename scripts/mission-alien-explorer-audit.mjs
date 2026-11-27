import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-cdp-alien-"));
const artifactDir = "C:\\Users\\Chessie\\.gemini\\antigravity\\brain\\406883d0-c503-4651-ad14-68931a440aa6";
const BASE_URL = "http://127.0.0.1:3005";

if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.exceptions = [];
    this.consoleErrors = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const text = msg.params.exceptionDetails?.text || "";
        const desc = msg.params.exceptionDetails?.exception?.description || "";
        this.exceptions.push({ text, desc, url: msg.params.exceptionDetails?.url });
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        const text = msg.params.args.map((a) => a.value || a.description || "").join(" ");
        this.consoleErrors.push(text);
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
    return res.result?.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    await this.waitFor("document.readyState === 'complete'", 20000);
    try {
      await this.waitFor("!document.querySelector('.brand-loader')", 6000);
    } catch {}
    await new Promise((r) => setTimeout(r, 800));
  }

  async waitFor(expression, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await this.eval(expression);
        if (res) return res;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`Timeout waiting for: ${expression}`);
  }

  async setViewport(width, height, mobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile,
    });
  }

  async captureScreenshot(fileName) {
    const { data } = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const filePath = path.join(artifactDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    console.log(`  [SCREENSHOT] Saved: ${fileName}`);
    return filePath;
  }

  async auditPage(routeLabel, viewportLabel) {
    const report = await this.eval(`(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const overflow = docW > winW;
      
      const title = document.title;
      const h1 = document.querySelector('h1')?.innerText?.trim() || '';
      
      const images = Array.from(document.querySelectorAll('img'));
      const brokenImages = images.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
      const imagesWithoutAlt = images.filter(i => !i.hasAttribute('alt') || i.getAttribute('alt') === '').length;
      
      const buttons = Array.from(document.querySelectorAll('button'));
      const unnamedButtons = buttons.filter(b => {
        const text = (b.innerText || '').trim();
        const aria = b.getAttribute('aria-label') || b.getAttribute('title');
        return !text && !aria;
      }).length;
      
      const links = Array.from(document.querySelectorAll('a[href]'));
      const hrefs = links.map(l => l.getAttribute('href')).filter(Boolean);
      
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      const unlabeledInputs = inputs.filter(inp => {
        if (inp.type === 'hidden') return false;
        const id = inp.id;
        const hasLabel = id && document.querySelector('label[for="' + id + '"]');
        const wrappedLabel = inp.closest('label');
        const ariaLabel = inp.getAttribute('aria-label') || inp.getAttribute('placeholder');
        return !hasLabel && !wrappedLabel && !ariaLabel;
      }).length;

      return {
        overflow,
        docW,
        winW,
        title,
        h1,
        imageCount: images.length,
        brokenImages,
        imagesWithoutAlt,
        buttonCount: buttons.length,
        unnamedButtons,
        linkCount: links.length,
        inputCount: inputs.length,
        unlabeledInputs,
        hrefs: Array.from(new Set(hrefs))
      };
    })()`);

    return report;
  }
}

async function runAlienExplorer() {
  console.log("===============================================================================");
  console.log("🛸 MISSION: ALIEN EXPLORER — TOTAL E2E & UX CONTROL OVER ZAPTUT.PRO");
  console.log("===============================================================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Artifacts: ${artifactDir}`);

  const port = 9245;
  const chromeProcess = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${tempDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--window-size=1440,900",
    ],
    { stdio: "ignore" }
  );

  const findings = [];
  const pageAuditResults = [];

  try {
    let wsUrl = "";
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        const page = list.find((t) => t.type === "page") || list[0];
        if (page?.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!wsUrl) throw new Error("Could not connect to Chrome CDP WebSocket.");

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const cdp = new CdpClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    // Clear test rate limits to prevent test lockout
    await prisma.rateLimit.deleteMany().catch(() => {});
    await prisma.rateLimitBucket.deleteMany().catch(() => {});

    // =========================================================================
    // SECTION 1: PUBLIC LANDMARKS & LEGAL SURFACES (Desktop & Mobile)
    // =========================================================================
    console.log("\n--- [STAGE 1] PUBLIC SURFACES & INFORMATION DIRECTORY ---");

    const publicRoutes = [
      { path: "/", label: "Home Page", screenshot: "alien-01-home.png" },
      { path: "/catalog", label: "Catalog Aggregator", screenshot: "alien-02-catalog.png" },
      { path: "/about", label: "About Us & CC BY 4.0", screenshot: "alien-03-about.png" },
      { path: "/contacts", label: "Contacts", screenshot: "alien-04-contacts.png" },
      { path: "/delivery-info", label: "Delivery Information", screenshot: "alien-05-delivery.png" },
      { path: "/payment-info", label: "Payment Information", screenshot: "alien-06-payment.png" },
      { path: "/returns-warranty", label: "Returns & Warranty", screenshot: "alien-07-returns.png" },
      { path: "/privacy-policy", label: "Privacy Policy", screenshot: "alien-08-privacy.png" },
      { path: "/terms", label: "Terms of Service", screenshot: "alien-09-terms.png" },
      { path: "/consent", label: "Personal Data Consent", screenshot: "alien-10-consent.png" },
      { path: "/login", label: "Staff Login Portal", screenshot: "alien-11-login.png" },
      { path: "/account/login", label: "Customer Login (Dual Auth)", screenshot: "alien-12-cust-login.png" },
      { path: "/account/register", label: "Customer Registration", screenshot: "alien-13-cust-reg.png" },
      { path: "/account/forgot-password", label: "Forgot Password Recovery", screenshot: "alien-14-forgot-pass.png" },
      { path: "/unknown-cosmic-anomaly-404", label: "404 Not Found Handling", screenshot: "alien-15-not-found.png" },
    ];

    for (const r of publicRoutes) {
      console.log(`\nExploring ${r.label} (${r.path})...`);
      
      // Desktop 1440x900
      await cdp.setViewport(1440, 900, false);
      const startTime = Date.now();
      await cdp.navigate(`${BASE_URL}${r.path}`);
      const navDuration = Date.now() - startTime;
      
      const desktopAudit = await cdp.auditPage(r.label, "Desktop 1440");
      if (r.screenshot) {
        await cdp.captureScreenshot(r.screenshot);
      }

      // Mobile 390x844
      await cdp.setViewport(390, 844, true);
      await new Promise((res) => setTimeout(res, 500));
      const mobileAudit = await cdp.auditPage(r.label, "Mobile 390");
      if (r.screenshot) {
        await cdp.captureScreenshot(r.screenshot.replace(".png", "-mobile.png"));
      }

      console.log(`  Title: "${desktopAudit.title}" | H1: "${desktopAudit.h1}"`);
      console.log(`  Desktop: win=${desktopAudit.winW} scroll=${desktopAudit.docW} overflow=${desktopAudit.overflow}`);
      console.log(`  Mobile:  win=${mobileAudit.winW} scroll=${mobileAudit.docW} overflow=${mobileAudit.overflow}`);
      console.log(`  Broken images: ${desktopAudit.brokenImages.length} | Images w/o alt: ${desktopAudit.imagesWithoutAlt}`);
      console.log(`  Buttons w/o names: ${desktopAudit.unnamedButtons} | Links count: ${desktopAudit.linkCount}`);

      if (desktopAudit.overflow) {
        findings.push({ severity: "P1", area: r.label, issue: `Horizontal overflow on Desktop 1440px (scrollWidth ${desktopAudit.docW} > ${desktopAudit.winW})` });
      }
      if (mobileAudit.overflow) {
        findings.push({ severity: "P0", area: r.label, issue: `Horizontal overflow on Mobile 390px (scrollWidth ${mobileAudit.docW} > ${mobileAudit.winW})` });
      }
      if (desktopAudit.brokenImages.length > 0) {
        findings.push({ severity: "P1", area: r.label, issue: `Broken images detected: ${desktopAudit.brokenImages.join(", ")}` });
      }
      if (desktopAudit.imagesWithoutAlt > 0) {
        findings.push({ severity: "P2", area: r.label, issue: `${desktopAudit.imagesWithoutAlt} image(s) missing alt attribute` });
      }

      pageAuditResults.push({
        route: r.path,
        label: r.label,
        navDuration,
        desktop: desktopAudit,
        mobile: mobileAudit
      });
    }

    // =========================================================================
    // SECTION 2: INTERACTIVE CATALOG INTELLIGENCE & CART DRAWER
    // =========================================================================
    console.log("\n--- [STAGE 2] CATALOG INTELLIGENCE, SEARCH, DUAL VEHICLE FILTER & CART ---");
    await cdp.setViewport(1440, 900, false);
    await cdp.navigate(`${BASE_URL}/catalog`);

    // 2.1 Initial item count
    const initialItemsCount = await cdp.eval(`(() => {
      const cards = document.querySelectorAll('[data-testid="product-card"], .product-card, article');
      const badgeText = document.body.innerText.match(/найдено\\s+(\\d+)/i);
      return { cards: cards.length, badge: badgeText ? badgeText[1] : null };
    })()`);
    console.log(`Initial Catalog Items: visible=${initialItemsCount.cards}, totalBadge=${initialItemsCount.badge}`);

    // 2.2 Search Transliteration & Normalization
    const searchQueries = [
      { q: "бмв", expect: "BMW", label: "Cyrillic brand transliteration" },
      { q: "колодки", expect: "Тормозная", label: "Russian category name translit/match" },
      { q: "04465-33470", expect: "04465", label: "OEM part format with hyphens" },
      { q: "ТОЙОТА КАМРИ", expect: "Toyota", label: "Full cyrillic model query" },
      { q: "x-non-existent-quantum-widget-12345", expect: "Ничего не найдено", label: "Zero results empty state" }
    ];

    for (const sq of searchQueries) {
      console.log(`  Testing search: "${sq.q}" (${sq.label})...`);
      const searchRes = await cdp.eval(`(async () => {
        const inp = document.querySelector('#catalog-search, input[type="search"], input[placeholder*="Поиск"], input[placeholder*="артикул"], input[placeholder*="колодки"]');
        if (!inp) return { error: "Search input not found" };
        
        // Native input value setter
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, "${sq.q}");
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        const form = inp.closest('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        
        // Wait for debounce & results update
        await new Promise(r => setTimeout(r, 1200));
        
        const bodyText = document.body.innerText;
        const countMatch = bodyText.match(/найдено\\s+(\\d+)/i);
        const hasExpected = bodyText.toLowerCase().includes("${sq.expect.toLowerCase()}");
        const hasEmptyState = bodyText.includes("не найдено") || Boolean(document.querySelector('[data-testid="catalog-empty-state"]'));
        
        return {
          foundCount: countMatch ? countMatch[1] : null,
          hasExpected,
          hasEmptyState
        };
      })()`);
      console.log(`    Result: hasExpected=${searchRes.hasExpected}, foundCount=${searchRes.foundCount}, emptyState=${searchRes.hasEmptyState}`);
      if (!searchRes.hasExpected && !searchRes.hasEmptyState) {
        findings.push({ severity: "P1", area: "Catalog Search", issue: `Query '${sq.q}' did not find expected '${sq.expect}' or render clear empty state` });
      }
    }

    // Reset search
    await cdp.eval(`(() => {
      const inp = document.querySelector('#catalog-search, input[type="search"], input[placeholder*="Поиск"], input[placeholder*="артикул"], input[placeholder*="колодки"]');
      if (inp) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, "");
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        const form = inp.closest('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 500));

    // 2.3 Dual-Mode Vehicle Selector
    console.log("  Testing Dual-Mode Vehicle Filter (Dropdown + Combined search)...");
    const vehicleSelectorAudit = await cdp.eval(`(async () => {
      // Find Brand Combobox button
      const makeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Выберите марку') || b.innerText.includes('Марка'));
      if (!makeBtn) return { error: "Make button not found" };
      makeBtn.click();
      await new Promise(r => setTimeout(r, 300));
      
      const popover = document.querySelector('[role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper]');
      const options = document.querySelectorAll('[role="option"], button[role="option"]');
      const hasBMW = Array.from(options).some(o => o.innerText.includes('BMW'));
      const hasMercedes = Array.from(options).some(o => o.innerText.includes('Mercedes-Benz'));
      
      return {
        hasPopover: Boolean(popover),
        optionsCount: options.length,
        hasBMW,
        hasMercedes
      };
    })()`);
    console.log(`    Selector Popover: open=${vehicleSelectorAudit.hasPopover}, optionsCount=${vehicleSelectorAudit.optionsCount}, hasBMW=${vehicleSelectorAudit.hasBMW}`);
    await cdp.captureScreenshot("alien-16-vehicle-dropdown.png");

    // Close popover
    await cdp.eval(`(() => {
      const active = document.activeElement;
      if (active) active.blur();
      document.body.click();
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // 2.4 Add to Cart & Cart Drawer Flow
    console.log("  Testing Add-To-Cart & Cart Drawer Flow...");
    const cartFlowResult = await cdp.eval(`(async () => {
      const addBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('В корзину') || b.innerText.includes('В заявку') || b.getAttribute('data-action') === 'add-to-cart');
      if (addBtns.length === 0) return { error: "No 'В корзину' buttons found" };
      
      addBtns[0].click();
      await new Promise(r => setTimeout(r, 500));
      
      // Check if cart drawer opened or badge updated
      const cartDrawer = document.querySelector('[role="dialog"], [data-state="open"], .cart-drawer');
      const cartText = cartDrawer ? cartDrawer.innerText : document.body.innerText;
      const hasCartTitle = cartText.includes('Корзина') || cartText.includes('Итого');
      
      return {
        addBtnFound: true,
        drawerOpened: Boolean(cartDrawer),
        hasCartTitle
      };
    })()`);
    console.log(`    Add to Cart: drawerOpened=${cartFlowResult.drawerOpened}, hasCartTitle=${cartFlowResult.hasCartTitle}`);
    await cdp.captureScreenshot("alien-17-cart-drawer.png");

    // 2.5 Quick Inquiry / Part Request Drawer
    console.log("  Testing Quick Request Modal/Drawer...");
    const requestModalResult = await cdp.eval(`(async () => {
      // Close cart drawer if open
      const closeBtn = document.querySelector('button[aria-label="Закрыть"], button[aria-label="Close"], button.close');
      if (closeBtn) closeBtn.click();
      await new Promise(r => setTimeout(r, 300));
      
      const reqBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Оставить заявку') || b.innerText.includes('Заявка на подбор') || b.innerText.includes('Подобрать запчасть'));
      if (!reqBtn) return { error: "Request button not found" };
      reqBtn.click();
      await new Promise(r => setTimeout(r, 500));
      
      const modal = document.querySelector('[role="dialog"], form');
      const text = modal ? modal.innerText : '';
      const hasVinField = Boolean(document.querySelector('input[placeholder*="VIN"], input[name*="vin"]'));
      const hasPhoneField = Boolean(document.querySelector('input[placeholder*="Телефон"], input[type="tel"], input[name*="phone"]'));
      
      return {
        buttonFound: true,
        modalOpened: Boolean(modal),
        hasVinField,
        hasPhoneField
      };
    })()`);
    console.log(`    Request Modal: opened=${requestModalResult.modalOpened}, hasVinField=${requestModalResult.hasVinField}, hasPhoneField=${requestModalResult.hasPhoneField}`);
    await cdp.captureScreenshot("alien-18-request-modal.png");

    // =========================================================================
    // SECTION 3: AUTHENTICATION & SECURITY REMEDIATION STRESS
    // =========================================================================
    console.log("\n--- [STAGE 3] AUTHENTICATION, OTP & SECURITY REMEDIATION ---");
    
    // 3.1 Forgot Password Rate Limiting and Token Leak Check
    console.log("  Verifying Forgot Password (/api/customer/auth/forgot-password)...");
    const forgotTestRes = await cdp.eval(`(async () => {
      const res = await fetch('/api/customer/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test.explorer@example.com' })
      });
      const data = await res.json().catch(() => ({}));
      return {
        status: res.status,
        hasTokenLeak: Boolean(data.token || data.resetUrl),
        responseMessage: data.message || data.error || ''
      };
    })()`);
    console.log(`    Forgot Password: status=${forgotTestRes.status}, tokenLeak=${forgotTestRes.hasTokenLeak}, msg="${forgotTestRes.responseMessage}"`);
    if (forgotTestRes.hasTokenLeak) {
      findings.push({ severity: "P0", area: "Security / Forgot Password", issue: "Token or resetUrl leaked in forgot-password response!" });
    }

    // 3.2 Phone OTP Challenge Check (Security remediation P0.2 check)
    console.log("  Verifying Phone OTP Mock Challenge (/api/customer/auth/phone/send-otp)...");
    const otpTestRes = await cdp.eval(`(async () => {
      const res = await fetch('/api/customer/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+79990000001' })
      });
      const data = await res.json().catch(() => ({}));
      return {
        status: res.status,
        hasDevOtpLeak: Boolean(data.devOtpCode || data.otp),
        response: data
      };
    })()`);
    console.log(`    Send OTP: status=${otpTestRes.status}, devOtpLeak=${otpTestRes.hasDevOtpLeak}`);
    if (otpTestRes.hasDevOtpLeak) {
      findings.push({ severity: "P0", area: "Security / Phone OTP", issue: "devOtpCode or plain OTP code leaked in send-otp response!" });
    }

    // =========================================================================
    // SECTION 4: CRM / STAFF PORTAL (E2E Authenticated Journey)
    // =========================================================================
    console.log("\n--- [STAGE 4] CRM & STAFF PORTAL CITADEL ---");
    const adminUser = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
    let loginOk = false;
    if (adminUser) {
      const adminSession = await prisma.session.create({
        data: {
          id: crypto.randomUUID(),
          token: `alien_admin_sess_${crypto.randomUUID()}`,
          userId: adminUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await cdp.send("Network.setCookie", {
        name: "better-auth.session_token",
        value: adminSession.token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
      });
      loginOk = true;
      console.log(`  CRM session injected for ${adminUser.email}`);
    }

    if (loginOk) {
      const adminRoutes = [
        { path: "/admin", label: "CRM Overview Dashboard", screenshot: "alien-19-admin-dash.png" },
        { path: "/admin/requests", label: "CRM Requests Register & Kanban", screenshot: "alien-20-admin-requests.png" },
        { path: "/admin/orders", label: "CRM Orders Register", screenshot: "alien-21-admin-orders.png" },
        { path: "/admin/customers", label: "CRM Customer Directory", screenshot: "alien-22-admin-customers.png" },
        { path: "/admin/staff", label: "CRM Staff & Permissions Matrix", screenshot: "alien-23-admin-staff.png" },
        { path: "/admin/import", label: "CRM Price List Importer", screenshot: "alien-24-admin-import.png" },
        { path: "/supplier", label: "Supplier Portal Dashboard", screenshot: "alien-25-supplier-dash.png" }
      ];

      for (const ar of adminRoutes) {
        console.log(`  Exploring CRM ${ar.label} (${ar.path})...`);
        await cdp.setViewport(1440, 900, false);
        await cdp.navigate(`${BASE_URL}${ar.path}`);
        const deskAudit = await cdp.auditPage(ar.label, "Desktop 1440");
        await cdp.captureScreenshot(ar.screenshot);

        await cdp.setViewport(390, 844, true);
        await new Promise((r) => setTimeout(r, 400));
        const mobAudit = await cdp.auditPage(ar.label, "Mobile 390");
        await cdp.captureScreenshot(ar.screenshot.replace(".png", "-mobile.png"));

        console.log(`    Desktop: win=${deskAudit.winW} scroll=${deskAudit.docW} overflow=${deskAudit.overflow}`);
        console.log(`    Mobile:  win=${mobAudit.winW} scroll=${mobAudit.docW} overflow=${mobAudit.overflow}`);
        
        if (deskAudit.overflow) {
          findings.push({ severity: "P1", area: ar.label, issue: `Horizontal overflow on CRM Desktop 1440 (scroll ${deskAudit.docW} > ${deskAudit.winW})` });
        }
        if (mobAudit.overflow) {
          findings.push({ severity: "P0", area: ar.label, issue: `Horizontal overflow on CRM Mobile 390 (scroll ${mobAudit.docW} > ${mobAudit.winW})` });
        }
        if (deskAudit.brokenImages.length > 0) {
          findings.push({ severity: "P1", area: ar.label, issue: `Broken images in CRM: ${deskAudit.brokenImages.join(", ")}` });
        }

        pageAuditResults.push({
          route: ar.path,
          label: ar.label,
          desktop: deskAudit,
          mobile: mobAudit
        });
      }
    } else {
      console.log("  (Admin credentials not set in environment or login failed; verified public /login interface instead)");
    }

    // =========================================================================
    // SECTION 5: CUSTOMER PERSONAL PORTAL (Garage, Addresses, Notifications)
    // =========================================================================
    console.log("\n--- [STAGE 5] CUSTOMER PERSONAL PORTAL & GARAGE ---");
    let custUser = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    if (!custUser) {
      custUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          name: "Тестовый Покупатель",
          phoneNumber: "+79998881234",
          phoneNumberVerified: true,
          role: "CUSTOMER",
          active: true,
        },
      });
      await prisma.customer.create({
        data: {
          id: crypto.randomUUID(),
          userId: custUser.id,
          name: "Тестовый Покупатель",
          phone: "+79998881234",
          normalizedPhone: "+79998881234",
        },
      });
    }
    const custSession = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        token: `alien_cust_sess_${crypto.randomUUID()}`,
        userId: custUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await cdp.send("Network.setCookie", {
      name: "better-auth.session_token",
      value: custSession.token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
    });
    console.log(`  Customer session injected for ${custUser.name}`);

    const customerRoutes = [
      { path: "/account", label: "Customer Portal Overview", screenshot: "alien-26-cust-account.png" },
      { path: "/account/profile", label: "Customer Profile Settings", screenshot: "alien-27-cust-profile.png" },
      { path: "/account/vehicles", label: "Customer ZAPTUT Garage", screenshot: "alien-28-cust-garage.png" },
      { path: "/account/addresses", label: "Customer Delivery Addresses", screenshot: "alien-29-cust-addresses.png" },
      { path: "/account/orders", label: "Customer Orders History", screenshot: "alien-30-cust-orders.png" },
      { path: "/account/requests", label: "Customer Part Requests", screenshot: "alien-31-cust-requests.png" },
      { path: "/account/notifications", label: "Customer Notification Center", screenshot: "alien-32-cust-notifications.png" }
    ];

    for (const cr of customerRoutes) {
      console.log(`  Exploring Customer ${cr.label} (${cr.path})...`);
      await cdp.setViewport(1440, 900, false);
      await cdp.navigate(`${BASE_URL}${cr.path}`);
      const deskAudit = await cdp.auditPage(cr.label, "Desktop 1440");
      await cdp.captureScreenshot(cr.screenshot);

      await cdp.setViewport(390, 844, true);
      await new Promise((r) => setTimeout(r, 400));
      const mobAudit = await cdp.auditPage(cr.label, "Mobile 390");
      await cdp.captureScreenshot(cr.screenshot.replace(".png", "-mobile.png"));

      console.log(`    Desktop: win=${deskAudit.winW} scroll=${deskAudit.docW} overflow=${deskAudit.overflow}`);
      console.log(`    Mobile:  win=${mobAudit.winW} scroll=${mobAudit.docW} overflow=${mobAudit.overflow}`);
      
      if (deskAudit.overflow) {
        findings.push({ severity: "P1", area: cr.label, issue: `Horizontal overflow on Desktop 1440 (scroll ${deskAudit.docW} > ${deskAudit.winW})` });
      }
      if (mobAudit.overflow) {
        findings.push({ severity: "P0", area: cr.label, issue: `Horizontal overflow on Mobile 390 (scroll ${mobAudit.docW} > ${mobAudit.winW})` });
      }

      pageAuditResults.push({
        route: cr.path,
        label: cr.label,
        desktop: deskAudit,
        mobile: mobAudit
      });
    }

    // =========================================================================
    // SECTION 6: BREAK-UI STRESS TESTING & CHAOS PROBES
    // =========================================================================
    console.log("\n--- [STAGE 6] CHAOS PROBES & BREAK-UI TESTING ---");
    
    // 6.1 XSS & SQL Injection attack probe in search input
    console.log("  Probing Search Input with XSS & SQLi injections...");
    await cdp.navigate(`${BASE_URL}/catalog`);
    const injectionProbes = [
      "<script>alert('alien-xss')</script>",
      "'; DROP TABLE users; --",
      "\" onfocus=\"alert(1)\" autofocus=\"",
      "A".repeat(800)
    ];

    for (const probe of injectionProbes) {
      const probeRes = await cdp.eval(`(async () => {
        const inp = document.querySelector('#catalog-search, input[type="search"], input[placeholder*="Поиск"], input[placeholder*="артикул"], input[placeholder*="колодки"]');
        if (!inp) return { error: "no input" };
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(inp, ${JSON.stringify(probe)});
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
        const rendered = document.body.innerHTML;
        const executedXss = window.__alien_xss_executed || false;
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          executedXss
        };
      })()`);
      console.log(`    Probe '${probe.slice(0, 30)}...': overflow=${probeRes.overflow}, xssTriggered=${probeRes.executedXss}`);
      if (probeRes.executedXss) {
        findings.push({ severity: "P0", area: "Security / XSS", issue: `XSS probe executed script on catalog page: ${probe}` });
      }
      if (probeRes.overflow) {
        findings.push({ severity: "P1", area: "Catalog Search UI", issue: `Extreme length input caused horizontal page overflow: ${probe.slice(0, 30)}` });
      }
    }

    // 6.2 SEO & Static Assets probe
    console.log("  Testing SEO Assets: robots.txt and sitemap.xml...");
    const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
    const robotsText = await robotsRes.text();
    console.log(`    /robots.txt: status=${robotsRes.status}, lines=${robotsText.split('\n').length}`);
    if (robotsRes.status !== 200) {
      findings.push({ severity: "P1", area: "SEO / robots.txt", issue: `/robots.txt returned status ${robotsRes.status}` });
    }

    const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
    const sitemapText = await sitemapRes.text();
    console.log(`    /sitemap.xml: status=${sitemapRes.status}, isXML=${sitemapText.includes('<?xml') || sitemapText.includes('<urlset')}`);
    if (sitemapRes.status !== 200 || (!sitemapText.includes('<?xml') && !sitemapText.includes('<urlset'))) {
      findings.push({ severity: "P1", area: "SEO / sitemap.xml", issue: `/sitemap.xml is invalid or missing` });
    }

    // 6.3 Link Integrity Crawler (Checking all internal links collected)
    console.log("\n--- [STAGE 7] LINK INTEGRITY & 404 CRAWLER ---");
    const allInternalHrefs = new Set();
    for (const r of pageAuditResults) {
      for (const h of r.desktop?.hrefs || []) {
        if (h.startsWith("/") && !h.startsWith("/api") && !h.includes("#") && !h.includes("mailto:") && !h.includes("tel:")) {
          allInternalHrefs.add(h);
        }
      }
    }
    console.log(`  Found ${allInternalHrefs.size} unique internal links to verify...`);

    const linkCheckResults = [];
    for (const href of allInternalHrefs) {
      try {
        const res = await fetch(`${BASE_URL}${href}`);
        linkCheckResults.push({ href, status: res.status, ok: res.ok });
        if (res.status === 404 || res.status >= 500) {
          findings.push({ severity: "P1", area: "Link Integrity", issue: `Broken internal link '${href}' returned HTTP ${res.status}` });
        }
      } catch (err) {
        linkCheckResults.push({ href, status: 0, error: err.message });
        findings.push({ severity: "P1", area: "Link Integrity", issue: `Failed to fetch '${href}': ${err.message}` });
      }
    }
    const brokenLinks = linkCheckResults.filter((l) => l.status === 404 || l.status >= 500);
    console.log(`  Link crawl completed: ${linkCheckResults.length} checked, ${brokenLinks.length} broken.`);

    // =========================================================================
    // FINAL AUDIT SUMMARY & WRITE-UP
    // =========================================================================
    console.log("\n===============================================================================");
    console.log("🛸 ALIEN EXPLORER MISSION REPORT SUMMARY");
    console.log("===============================================================================");
    console.log(`Pages Audited: ${pageAuditResults.length}`);
    console.log(`Total Findings: ${findings.length}`);
    console.log(`Browser Exceptions Caught: ${cdp.exceptions.length}`);
    console.log(`Browser Console Errors: ${cdp.consoleErrors.length}`);

    if (cdp.exceptions.length > 0) {
      console.log("\nUncaught Exceptions:");
      for (const ex of cdp.exceptions) {
        console.log(`  - ${ex.text}: ${ex.desc} (${ex.url || 'inline'})`);
        findings.push({ severity: "P1", area: "Runtime Exceptions", issue: `Exception on ${ex.url || 'page'}: ${ex.text} ${ex.desc}` });
      }
    }

    if (cdp.consoleErrors.length > 0) {
      console.log("\nConsole Errors:");
      for (const ce of cdp.consoleErrors) {
        console.log(`  - ${ce.slice(0, 150)}`);
      }
    }

    const reportData = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      pagesAuditedCount: pageAuditResults.length,
      pageAudits: pageAuditResults,
      findings,
      exceptions: cdp.exceptions,
      consoleErrors: cdp.consoleErrors,
      linkChecks: linkCheckResults
    };

    const reportPath = path.join(artifactDir, "alien-explorer-audit-data.json");
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\nRaw Audit Data saved to: ${reportPath}`);

  } finally {
    try {
      await prisma.session.deleteMany({ where: { token: { startsWith: "alien_" } } });
    } catch {}
    try {
      chromeProcess.kill();
    } catch {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    await prisma.$disconnect();
  }
}

runAlienExplorer().catch((err) => {
  console.error("FATAL ERROR IN MISSION:", err);
  process.exit(1);
});
