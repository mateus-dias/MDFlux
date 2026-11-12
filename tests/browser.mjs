import http from "node:http";
import path from "node:path";
const server = http.createServer(async (req, res) => {
  let f = path.join(
    process.cwd(),
    "dist",
    decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  try {
    if (!(await fs.stat(f)).isFile()) throw 0;
  } catch {
    f = path.join(process.cwd(), "dist/index.html");
  }
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".png": "image/png",
    ".json": "application/json",
  };
  try {
    res.setHeader(
      "content-type",
      mime[path.extname(f)] || "application/octet-stream",
    );
    res.end(await fs.readFile(f));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(4173, "127.0.0.1", resolve));
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const report = [];
await fs.mkdir("test-results", { recursive: true });
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("heading", { name: /Seu negócio/ }).waitFor();
  var overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map((el) => [el.tagName, el.className, el.getBoundingClientRect().right])
      .slice(0, 20),
  );
  if (overflow.length) console.log("OVERFLOW", viewport.width, overflow);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  const comparison = page.getByRole("table", { name: "Compare os planos e escolha o ideal para sua empresa" });
  assert.equal(await comparison.locator("tbody tr").count(), 11);
  assert.equal(await comparison.getByRole("row", { name: /Cadastros pelo chat/ }).getByRole("img", { name: "Incluído" }).count(), 2);
  assert.equal(await comparison.getByRole("button", {name:"Escolher Profissional"}).count(),1);
  const showcase = page.getByRole("region",{name:"Conheça o MD Flux Intelligence"});
  assert.ok(await showcase.getByText(/valores ilustrativos/).isVisible());
  assert.equal(await page.locator(".intelligence-showcase").evaluate((node) =>
    Boolean(node.compareDocumentPosition(document.querySelector("#planos")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
  await page.screenshot({
    path: `test-results/site-${viewport.width}.png`,
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:4173/demo");
  await page
    .getByRole("heading", { name: "Olá! O que deseja fazer hoje?" })
    .waitFor();
  var overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map((el) => [el.tagName, el.className, el.getBoundingClientRect().right])
      .slice(0, 20),
  );
  if (overflow.length) console.log("OVERFLOW", viewport.width, overflow);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "Criar cliente", exact: true })
    .click();
  await page
    .getByLabel("Nome ou razão social")
    .fill("Cliente teste automatizado");
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  if (viewport.width <= 800)
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await page
    .getByRole("button", { name: "Cliente teste automatizado", exact: true })
    .waitFor();
  await page
    .getByPlaceholder("Buscar pelo nome…")
    .fill("Cliente teste automatizado");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page
    .getByRole("button", {
      name: "Editar Cliente teste automatizado",
      exact: true,
    })
    .click();
  await page.getByLabel("Nome ou razão social").fill("Cliente atualizado");
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByPlaceholder("Buscar pelo nome…").fill("Cliente atualizado");
  await page
    .getByRole("button", { name: "Cliente atualizado", exact: true })
    .waitFor();
  await page.screenshot({
    path: `test-results/app-${viewport.width}.png`,
    fullPage: true,
  });
  if (viewport.width <= 800)
    await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  assert.ok((await download).suggestedFilename().endsWith(".csv"));
  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF A4", exact: true }).click();
  assert.ok((await pdf).suggestedFilename().endsWith(".pdf"));
  const xlsx = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar XLSX", exact: true })
    .click();
  assert.ok((await xlsx).suggestedFilename().endsWith(".xlsx"));
  const second = await browser.newContext({ viewport });
  const p2 = await second.newPage();
  await p2.goto("http://127.0.0.1:4173/demo/client");
  assert.equal(
    await p2
      .getByRole("button", { name: "Cliente atualizado", exact: true })
      .count(),
    0,
  );
  await second.close();
  assert.deepEqual(errors, []);
  report.push({
    viewport,
    checks:
      "landing, no overflow, demo, create, edit, search, CSV, PDF, XLSX, isolated contexts, no JS errors",
    passed: true,
  });
  console.log("PASS browser", viewport.width);
  await context.close();
}
await fs.writeFile(
  "test-results/browser.json",
  JSON.stringify(report, null, 2),
);
await browser.close();
server.close();
