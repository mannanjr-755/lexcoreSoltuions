/**
 * HTTP-level verification of customer create (uses AUTH_PASSWORD_ADMIN or default).
 * Run: node scripts/verify-customer-api.mjs
 */
import "./load-env.mjs";

const baseUrl = process.env.APP_URL?.trim() || "http://localhost:3000";
const email = "admin@lexcore.com";
const password =
  process.env.AUTH_PASSWORD_ADMIN?.trim() ||
  (!["Lexcore@2026!", "Lexcore@2026", "admin123", "Admin123!"].includes(
    process.env.SUPER_ADMIN_PASSWORD?.trim() || ""
  ) &&
  process.env.SUPER_ADMIN_PASSWORD?.trim()) ||
  "Admin@Lexcore1!";

async function post(path, body, cookie = "") {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify(body)
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, setCookie };
}

function cookieHeader(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const login = await post("/api/auth/login", { email, password });
  if (login.status !== 200 || !login.json?.success) {
    console.error("LOGIN_FAIL", login.status, login.json);
    process.exit(1);
  }
  const cookie = cookieHeader(login.setCookie);
  console.log("LOGIN_OK");

  const stamp = Date.now();
  const payload = {
    name: "QA Customer",
    phone: `0312${String(stamp).slice(-7)}`,
    projectName: "ERP Module",
    projectType: "Web Application",
    totalCost: 25000,
    advancePaid: 5000,
    paidAmount: 0,
    projectDeadline: "2026-12-31",
    priority: "high",
    status: "lead",
    notes: ""
  };

  const created = await post("/api/crm/customers", payload, cookie);
  console.log("CREATE", created.status, created.json?.customerId || created.json?.message);

  const dupPhone = await post(
    "/api/crm/customers",
    { ...payload, name: "Dup Phone" },
    cookie
  );
  console.log("DUP_PHONE", dupPhone.status, dupPhone.json?.message);

  const invalid = await post(
    "/api/crm/customers",
    { name: "X", phone: "1", projectName: "", projectType: "", totalCost: -1, projectDeadline: "" },
    cookie
  );
  console.log("INVALID", invalid.status, invalid.json?.message);

  if (created.status !== 201) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
