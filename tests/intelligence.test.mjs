import test from "node:test";
import assert from "node:assert/strict";
import {
  installments,
  interpretFinance,
  parseAmount,
  parseDue,
} from "../src/intelligence.mjs";
import { readFinancialFile } from "../src/intelligence-import.mjs";

test("Brazilian amounts and impossible dates are validated", () => {
  assert.equal(parseAmount("R$ 45.000,01"), 4500001);
  assert.throws(() => parseAmount("3.14"));
  assert.throws(() => parseDue("31/02/2026"));
  assert.equal(parseDue("amanhã", "2026-12-31"), "2027-01-01");
});

test("installments retain every cent and the original day where possible", () => {
  const rows = installments("Compra", 1001, 3, "2026-01-31");
  assert.deepEqual(
    rows.map((r) => r.due_date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.deepEqual(
    rows.map((r) => r.amount),
    [3.34, 3.34, 3.33],
  );
  assert.equal(installments("Compra", 4500000, 90, "2026-12-10").length, 90);
});

test("CSV import keeps quoted labels and surfaces duplicates and invalid rows", async () => {
  const csv =
    'tipo;descrição;valor;vencimento\nreceita;"Contrato; A";12,50;01/12/2026\nreceita;"Contrato; A";12,50;01/12/2026\ndespesa;B;20;31/02/2026';
  const result = await readFinancialFile({
    name: "contas.csv",
    size: csv.length,
    text: async () => csv,
  });
  assert.deepEqual(result.rows, [
    {
      kind: "income",
      name: "Contrato; A",
      amount: 12.5,
      due_date: "2026-12-01",
    },
  ]);
  assert.equal(result.issues.length, 2);
});

test("financial questions support paraphrases, follow-ups and bounded periods", () => {
  assert.deepEqual(interpretFinance("Quanto ainda falta entrar?"), {
    intent: "receivables",
    period: "default",
  });
  assert.deepEqual(interpretFinance("Quanto tenho pra pagar?"), {
    intent: "payables",
    period: "default",
  });
  const last = interpretFinance("Quanto eu gastei nesse mês?");
  assert.deepEqual(last, { intent: "paid", period: "month" });
  assert.deepEqual(interpretFinance("E no mês passado?", last), {
    intent: "paid",
    period: "previous",
  });
  assert.deepEqual(interpretFinance("Quanto recebi ontem?"), {
    unsupported: true,
  });
  assert.equal(
    interpretFinance("Quanto o cliente João tem a pagar?"),
    undefined,
  );
  assert.equal(interpretFinance("Não quero que mostre o caixa"), undefined);
});
