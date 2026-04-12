import http from "http";

function request(method, path, body, cookie = "") {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      {
        hostname: "localhost",
        port: 3000,
        path,
        method,
        timeout: 10000,
        headers: {
          ...(payload ? { "Content-Type": "application/json", "Content-Length": payload.length } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          if (data.length < 16000) data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error(`timeout: ${method} ${path}`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const routeResults = [];
  for (const path of [
    "/admin",
    "/clone/home",
    "/clone/support",
    "/clone/bestshop",
    "/clone/care-solutions",
    "/clone/category-tvs",
    "/clone-product?pageId=category-tvs",
  ]) {
    const result = await request("GET", path);
    routeResults.push({ path, status: result.status });
  }

  const llmStatus = await request("GET", "/api/llm/status");
  const llmStatusJson = JSON.parse(llmStatus.body || "{}");

  const loginId = `smoke_${Date.now()}`;
  const register = await request("POST", "/api/auth/register", {
    loginId,
    password: "demo1234",
    displayName: "Smoke User",
  });
  const cookie = String(register.headers["set-cookie"]?.[0] || "").split(";")[0];
  const llmChange = await request(
    "POST",
    "/api/llm/change",
    { prompt: 'home page title을 "[Demo] LGE.COM | LG전자" 로 변경해줘' },
    cookie
  );

  let llmChangeJson = {};
  try {
    llmChangeJson = JSON.parse(llmChange.body || "{}");
  } catch {
    llmChangeJson = { raw: llmChange.body || "" };
  }

  const summary = {
    routes: routeResults,
    llmStatus: {
      status: llmStatus.status,
      configured: Boolean(llmStatusJson.configured),
      demoFallbackActive: Boolean(llmStatusJson.demoFallbackActive),
      model: llmStatusJson.model || null,
    },
    llmChange: {
      registerStatus: register.status,
      cookie: Boolean(cookie),
      status: llmChange.status,
      summary: llmChangeJson.summary || null,
      operationCount: Array.isArray(llmChangeJson.operations) ? llmChangeJson.operations.length : 0,
      firstOperation: Array.isArray(llmChangeJson.operations) ? llmChangeJson.operations[0] || null : null,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const routeFailures = routeResults.filter((item) => ![200, 302].includes(Number(item.status)));
  if (routeFailures.length) process.exitCode = 1;
  if (llmStatus.status !== 200 || !llmStatusJson.configured) process.exitCode = 1;
  if (register.status !== 200 || llmChange.status !== 200) process.exitCode = 1;
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
