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

export const financeIntents = [
  "balances",
  "receivables",
  "payables",
  "overdue",
  "upcoming",
  "cash",
  "received",
  "paid",
  "expenses",
];

export function interpretFinance(text, previous) {
  const question = normalize(text).replace(/\bpra\b/g, "para");
  if (
    /\b(nao|nunca)\s+(?:quero|preciso|mostre|prepare|cadastre|crie|registre)\b/.test(
      question,
    )
  )
    return undefined;
  if (
    /\b(?:clientes?|fornecedores?|nota fiscal|estoque|imposto|vendas|faturamento)\b/.test(
      question,
    )
  )
    return undefined;
  const lastMonth = /\bmes (?:passado|anterior)\b/.test(question);
  const currentMonth =
    /\b(?:neste mes|nesse mes|deste mes|do mes|mes atual)\b/.test(question);
  if (
    /\b(?:ontem|amanha|ano passado|ano atual|semestre|trimestre|mes que vem|proximo mes|entre \d+|em \d{4})\b|\b\d{1,2}\/\d{1,2}\b/.test(
      question,
    )
  )
    return { unsupported: true };
  const followUp =
    /^\s*(?:e\s+)?(?:(?:no|do|neste|nesse|deste)\s+)?mes (?:passado|anterior|atual)\W*$/.test(
      question,
    );
  let intent;
  if (followUp) intent = previous?.intent;
  else if (
    /\b(?:atrasad[oa]s?|vencid[oa]s?|em atraso|inadimplencia)\b/.test(question)
  )
    intent = "overdue";
  else if (
    /\b(?:a vencer|vencem|vencimento[s]?|proxim[oa]s? (?:contas|dias|vencimentos))\b/.test(
      question,
    )
  )
    intent = "upcoming";
  else if (
    /\b(?:quanto (?:eu )?(?:gastei|paguei)|saiu|ja paguei|total pago|pagamentos realizados)\b/.test(
      question,
    )
  )
    intent = "paid";
  else if (
    /\b(?:recebi|ja entrou|quanto entrou|recebido|recebimentos realizados)\b/.test(
      question,
    )
  )
    intent = "received";
  else if (
    /\b(?:quanto devo|quanto (?:falta|preciso) pagar|(?:a|para) pagar|dividas|boletos em aberto|tenho que pagar)\b/.test(
      question,
    )
  )
    intent = "payables";
  else if (
    /\b(?:receber|vao me pagar|me devem|falta entrar|dinheiro para entrar|recebiveis)\b/.test(
      question,
    )
  )
    intent = "receivables";
  else if (
    /\b(?:categorias|maiores gastos|onde (?:mais )?gastei|com que gastei|despesas por|analise (?:as|minhas) despesas)\b/.test(
      question,
    )
  )
    intent = "expenses";
  else if (
    /\b(?:caixa|lucro|prejuizo|resultado|saude financeira|como (?:anda|esta) (?:a |minha )?empresa)\b/.test(
      question,
    )
  )
    intent = "cash";
  else if (
    /\b(?:contas|pendencias|valores) em aberto\b|\bresumo (?:da (?:minha |sua )?area )?financeir[oa]\b/.test(
      question,
    )
  )
    intent = "balances";
  if (!intent) return undefined;
  if (/\b(?:essa semana|esta semana|semana passada)\b/.test(question))
    return { unsupported: true };
  if (lastMonth && !["paid", "received", "cash"].includes(intent))
    return { unsupported: true };
  if (
    currentMonth &&
    ["payables", "overdue", "upcoming", "balances"].includes(intent)
  )
    return { unsupported: true };
  return {
    intent,
    period: lastMonth ? "previous" : currentMonth ? "month" : "default",
  };
}

export function smallTalk(text) {
  const message = normalize(text)
    .trim()
    .replace(/[!?.,]+$/g, "");
  if (
    /^(?:ola|oi|opa|e ai|bom dia|boa tarde|boa noite)(?:[ ,]+(?:tudo bem|como vai))?$/.test(
      message,
    )
  )
    return "Olá! Como posso ajudar? Você pode me perguntar sobre o financeiro da sua empresa ou pedir ajuda para usar o MD Flux.";
  if (/^(?:obrigad[oa]|muito obrigad[oa]|valeu|agradeco)$/.test(message))
    return "De nada! Se precisar de mais alguma coisa, é só me chamar.";
  if (/^(?:tudo bem|como vai)$/.test(message))
    return "Tudo bem por aqui! Como posso ajudar você no MD Flux?";
  if (
    /^(?:quem (?:e|eh) voce|o que voce (?:faz|consegue fazer)|como (?:voce funciona|usar o assistente))$/.test(
      message,
    )
  )
    return "Sou o assistente do MD Flux. Posso consultar contas a receber, contas a pagar e vencimentos. Os planos Profissional e Empresarial também permitem analisar o caixa e preparar cadastros e lançamentos.";
}
