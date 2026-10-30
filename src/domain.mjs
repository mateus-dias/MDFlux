export const plans = {
  essencial: { name: "Essencial", price: 69.9, users: 1 },
  profissional: { name: "Profissional", price: 99.9, users: 3 },
  empresarial: { name: "Empresarial", price: 129.9, users: 10 },
};
export const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n) || 0,
  );
export const today = () => new Date().toISOString().slice(0, 10);
export function total(items, discount = 0) {
  return (
    Math.round(
      (items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0) -
        Number(discount)) *
        100,
    ) / 100
  );
}
export function access(s, now = Date.now()) {
  return (
    !s.suspended &&
    ((s.status === "trialing" && Date.parse(s.trial_end) > now) ||
      (["active", "canceled"].includes(s.status) &&
        Date.parse(s.paid_until) > now))
  );
}
export function summarize(rows) {
  const incomes = rows.filter((r) => r.kind === "income"),
    expenses = rows.filter((r) => r.kind === "expense");
  const sum = (a, k) => a.reduce((s, r) => s + Number(r[k] || 0), 0);
  const received = sum(incomes, "paid"),
    paid = sum(expenses, "paid");
  return {
    received,
    paid,
    cash: received - paid,
    receivable: sum(incomes, "amount") - received,
    payable: sum(expenses, "amount") - paid,
    estimated: sum(incomes, "amount") - sum(expenses, "amount"),
    clients: rows.filter((r) => r.kind === "client").length,
    quotes: rows.filter((r) => r.kind === "quote" && r.status !== "approved")
      .length,
    orders: rows.filter(
      (r) =>
        r.kind === "order" && !["completed", "canceled"].includes(r.status),
    ).length,
  };
}
export const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
