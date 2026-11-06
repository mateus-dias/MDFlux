import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4179"],
  { stdio: "ignore" },
);
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch("http://127.0.0.1:4179")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = {
    server_now: "2026-11-06T12:00:00Z",
    exempt_org_ids: [],
    orgs: [{ id: "o1", name: "Empresa de teste", created_at: "2026-11-01" }],
    users: [
      {
        id: "u1",
        first_name: "Cliente",
        email: "cliente@example.com",
        contact_phone: "(11) 99999-9999",
      },
    ],
    memberships: [{ org_id: "o1", user_id: "u1", role: "owner", active: true }],
    subscriptions: [
      {
        org_id: "o1",
        plan: "profissional",
        status: "active",
        paid_until: "2026-11-10",
        trial_end: "2026-11-04",
      },
    ],
    payments: [
      {
        id: "p1",
        org_id: "o1",
        status: "approved",
        amount: 99.9,
        paid_at: "2026-10-10",
      },
    ],
    activity: [],
    tickets: [],
    audit: [],
  };
  await page.route("**/.netlify/functions/admin", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("http://127.0.0.1:4179/admin", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page
    .getByRole("heading", { name: "Acompanhamento de clientes" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("link", { name: "Abrir WhatsApp" })
      .getAttribute("href"),
    "https://wa.me/5511999999999",
  );
  await page.getByLabel("Situação", { exact: true }).selectOption("trial");
  await page.getByText("Nenhum cliente encontrado.").waitFor();
  await page.getByLabel("Situação", { exact: true }).selectOption("due_soon");
  await page.getByRole("heading", { name: "Empresa de teste" }).waitFor();
  await page.getByLabel("Buscar cliente").fill("cliente@example.com");
  await page.getByText("Histórico de pagamentos (1)").click();
  await page.getByText(/Aprovado · Referência: p1/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto("http://127.0.0.1:4179/auth?signup=1", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.getByLabel("Telefone / WhatsApp de contato (opcional)").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS admin contacts, status filters, payment history, mobile layout and signup phone",
  );
} finally {
  await browser?.close();
  server.kill();
}
