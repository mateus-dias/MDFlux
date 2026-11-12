export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function parseAmount(value) {
  const raw = String(value)
    .trim()
    .replace(/^R\$\s*/i, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw))
    throw new Error("Use um valor como R$ 1.250,50.");
  const [whole, fraction = ""] = raw.replaceAll(".", "").split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 99999999999999)
    throw new Error("Informe um valor positivo dentro do limite.");
  return cents;
}

export function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return [get("year"), get("month"), get("day")].join("-");
}

export function parseDue(value, today = localDate()) {
  const text = String(value).trim();
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  let iso = slash ? [slash[3], slash[2], slash[1]].join("-") : text;
  if (normalize(text) === "hoje") iso = today;
  if (normalize(text) === "amanha") {
    const day = new Date(today + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() + 1);
    iso = day.toISOString().slice(0, 10);
  }
  const date = new Date(iso + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    !Number.isFinite(+date) ||
    date.toISOString().slice(0, 10) !== iso
  )
    throw new Error("Informe o vencimento em DD/MM/AAAA.");
  return iso;
}

export function installments(name, cents, count, due) {
  if (!Number.isInteger(count) || count < 1 || count > 300 || count > cents)
    throw new Error(
      "Use de 1 a 300 parcelas, com pelo menos um centavo por parcela.",
    );
  const date = new Date(parseDue(due) + "T00:00:00Z");
  const day = date.getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const first = new Date(date);
    first.setUTCDate(1);
    first.setUTCMonth(first.getUTCMonth() + index);
    const last = new Date(first);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    first.setUTCDate(Math.min(day, last.getUTCDate()));
    return {
      kind: "expense",
      name: name + (count > 1 ? " · " + (index + 1) + "/" + count : ""),
      amount: (Math.floor(cents / count) + Number(index < cents % count)) / 100,
      due_date: first.toISOString().slice(0, 10),
      installment: index + 1,
    };
  });
}
