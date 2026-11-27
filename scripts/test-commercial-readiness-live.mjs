import https from "node:https";

const BASE_URL = "https://zaptut-staging.netlify.app";

function apiRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const reqHeaders = {
      ...headers,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
    };
    if (postData) {
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = https.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runLiveVerification() {
  console.log("================================================================================");
  console.log("🚀 LIVE NETLIFY COMMERCIAL READINESS VERIFICATION");
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    console.log("\n[1] Health Check...");
    const health = await apiRequest("GET", "/api/health");
    assert(health.status === 200, `/api/health returned 200 OK (${JSON.stringify(health.body)})`);

    // 2. Public Catalog Search by OEM
    console.log("\n[2] Catalog Search by OEM 51712-C1A00...");
    const catOem = await apiRequest("GET", "/api/catalog?q=51712-C1A00");
    assert(catOem.status === 200, `Catalog returned 200 OK, items count: ${catOem.body?.items?.length}`);
    if (catOem.body?.items?.length) {
      const first = catOem.body.items[0];
      assert(first.primaryOem === "51712-C1A00", `Found exact OEM match: ${first.canonicalName}`);
      assert(first.minPrice > 0, `Calculated public retail price: ${first.minPrice} RUB`);
      assert(!("purchasePrice" in first.offers[0]), "Security verified: purchasePrice NOT exposed in public API");
    }

    // 3. Catalog Filters
    console.log("\n[3] Catalog Filters (condition, country)...");
    const catFiltered = await apiRequest("GET", "/api/catalog?condition=NEW&country=RU");
    assert(catFiltered.status === 200, `Catalog filters returned 200 OK (count: ${catFiltered.body?.items?.length})`);

    const adminEmail = process.env.ZAPTUT_ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ZAPTUT_ADMIN_PASSWORD;
    const demoEmail = process.env.DEMO_VIEWER_EMAIL?.trim();
    const demoPassword = process.env.DEMO_VIEWER_PASSWORD;
    if (!adminEmail || !adminPassword || !demoEmail || !demoPassword) {
      throw new Error("Set ZAPTUT_ADMIN_EMAIL, ZAPTUT_ADMIN_PASSWORD, DEMO_VIEWER_EMAIL, and DEMO_VIEWER_PASSWORD.");
    }

    // 4. Staff Auth Login (SUPER_ADMIN)
    console.log(`\n[4] Staff CRM Authentication (${adminEmail})...`);
    const login = await apiRequest("POST", "/api/auth/sign-in/email", {
      email: adminEmail,
      password: adminPassword,
    });
    assert(login.status === 200, `Login successful: ${login.body?.user?.name} (Role: ${login.body?.user?.role})`);

    const setCookies = login.headers["set-cookie"] || [];
    const staffCookie = setCookies.map((c) => c.split(";")[0]).join("; ");

    // 5. CRM Requests via Staff Session
    console.log("\n[5] Fetching CRM Requests as SUPER_ADMIN...");
    const requests = await apiRequest("GET", "/api/requests", null, { Cookie: staffCookie });
    assert(requests.status === 200, `CRM Requests returned 200 OK (${requests.body?.requests?.length} requests found)`);

    // 6. CRM Orders via Staff Session
    console.log("\n[6] Fetching CRM Orders as SUPER_ADMIN...");
    const orders = await apiRequest("GET", "/api/orders", null, { Cookie: staffCookie });
    assert(orders.status === 200, `CRM Orders returned 200 OK (${orders.body?.orders?.length} orders found)`);

    // 7. Security: Partner Demo Viewer Check (DEMO_VIEWER)
    console.log("\n[7] Testing Partner DEMO_VIEWER Security Isolation...");
    const partnerLogin = await apiRequest("POST", "/api/auth/sign-in/email", {
      email: demoEmail,
      password: demoPassword,
    });
    assert(partnerLogin.status === 200, `Partner login: Role is ${partnerLogin.body?.user?.role}`);

    const partnerCookies = partnerLogin.headers["set-cookie"] || [];
    const partnerCookie = partnerCookies.map((c) => c.split(";")[0]).join("; ");

    const partnerReq = await apiRequest("GET", "/api/requests", null, { Cookie: partnerCookie });
    assert(partnerReq.status === 200, "Partner can read CRM requests in read-only mode");

    // Verify partner CANNOT mutate payments
    if (orders.body?.orders?.length) {
      const orderId = orders.body.orders[0].id;
      const partnerPayAttempt = await apiRequest(
        "POST",
        `/api/orders/${orderId}/payments`,
        { amount: 1000, paymentMethod: "HACK" },
        { Cookie: partnerCookie }
      );
      assert(
        partnerPayAttempt.status === 403,
        `Partner mutation blocked with 403 Forbidden: ${partnerPayAttempt.body?.error || "Access denied"}`
      );
    }

    console.log("\n================================================================================");
    console.log(`🎉 VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log("================================================================================");
  } catch (err) {
    console.error("Live verification failed:", err);
    process.exit(1);
  }
}

runLiveVerification();
