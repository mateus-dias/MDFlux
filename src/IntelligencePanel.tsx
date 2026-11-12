import {
  classifyLocally,
  converseLocally,
  enableLocalModel,
} from "./intelligence-local";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { contactNumber } from "./commercial.mjs";
import { endpoint, rpc } from "./api";
import { money } from "./domain.mjs";
import {
  installments,
  interpretFinance,
  localDate,
  normalize,
  parseAmount,
  parseDue,
  smallTalk,
} from "./intelligence.mjs";
import type { Org, Row } from "./model";

type Entry = {
  kind: string;
  name: string;
  amount?: number;
  due_date?: string;
  installment?: number;
  import_row?: boolean;
};
type Message = { role: "Você" | "Assistente"; text: string };

export function Intelligence({
  org,
  reload,
  page,
  records,
}: {
  org: Org;
  reload: () => Promise<void>;
  page: string;
  records: Row[];
}) {
  const cloudAvailable =
    (import.meta as ImportMeta & { env?: { VITE_MDFLUX_CLOUD_AI?: string } })
      .env?.VITE_MDFLUX_CLOUD_AI === "true";

  const [local, setLocal] = useState(false);
  const lastQuery = useRef<{ intent: string; period: string } | undefined>(
    undefined,
  );
  const historyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ id: string; rows: Entry[] }>();
  const [report, setReport] = useState<any>();
  const [collections, setCollections] = useState<
    {
      id: string;
      name: string;
      phone: string;
      client: string;
      due_date: string;
      balance: number;
    }[]
  >([]);
  const [inbox, setInbox] = useState<{
    enabled: boolean;
    days_before: number;
    items: { name: string; due_date: string; read_at: string | null }[];
  }>();
  const [rule, setRule] = useState<{ days: number; enabled: boolean }>();
  const advanced = org.subscription.plan !== "essencial";
  const add = (role: Message["role"], content: string) =>
    setMessages((old) => [...old.slice(-49), { role, text: content }]);

  const financeRole = ["owner", "manager", "finance", "viewer"].includes(
    org.role,
  );
  useEffect(() => {
    if (!open || !advanced || !financeRole) return;
    let live = true;
    rpc("intelligence_inbox", { p_org: org.id })
      .then((data) => {
        if (live) setInbox(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, advanced, financeRole, org.id]);

  useEffect(() => {
    const history = historyRef.current;
    if (open && history) history.scrollTop = history.scrollHeight;
  }, [open, messages, busy, preview, rule]);

  async function run(prompt: string) {
    const value = prompt.trim();
    if (!value || busy || preview || rule) return;
    add("Você", value);
    setText("");
    setBusy(true);
    try {
      const greeting = smallTalk(value);
      if (greeting) {
        add("Assistente", greeting);
        return;
      }
      const command = normalize(value);
      const registration =
        /^(?:cadastre|crie|registre)\s+(?:um[a]?\s+)?(cliente|fornecedor|servi[cç]o)\s+(?:chamad[oa]\s+)?(.+)$/i.exec(
          value,
        );
      const finance =
        /^(?:cadastre|crie|registre)\s+(?:um[a]?\s+)?(despesa|receita|compra)\s+de\s+(R\$\s*)?([\d.,]+)(?:\s+em\s+(\d+)\s+parcelas(?:\s+mensais)?)?(?:,?\s+(?:come[cç]ando\s+em|para|em)\s+(\S+))?\.?$/i.exec(
          value,
        );
      if (/prepar.*cobranca/.test(command)) {
        if (!advanced)
          throw new Error(
            "Cobranças pelo chat exigem o plano Profissional ou Empresarial.",
          );
        const items = await rpc("intelligence_collections", { p_org: org.id });
        setCollections(items);
        add(
          "Assistente",
          items.length
            ? items.length + " cobrança(s) vencida(s) pronta(s) para revisar."
            : "Nenhum lançamento a receber vencido encontrado.",
        );
      } else if (/lembre|lembrete/.test(command)) {
        if (!advanced || !financeRole)
          throw new Error("Lembretes exigem plano e perfil compatíveis.");
        const days = /(?:^|\s)(\d{1,2})\s+dias?/.exec(command);
        const disable = /desativ/.test(command);
        if (!disable && (!days || Number(days[1]) > 30))
          throw new Error(
            "Informe de 0 a 30 dias. Exemplo: Me lembre das contas 2 dias antes de vencer.",
          );
        setRule({
          days: disable ? (inbox?.days_before ?? 2) : Number(days![1]),
          enabled: !disable,
        });
        add("Assistente", "Confirme a alteração do lembrete abaixo.");
      } else if (registration || finance) {
        if (!advanced)
          throw new Error(
            "Cadastros pelo chat estão disponíveis nos planos Profissional e Empresarial.",
          );
        let rows: Entry[];
        if (registration) {
          const kinds: Record<string, string> = {
            cliente: "client",
            fornecedor: "supplier",
            servico: "product",
          };
          const kind = kinds[normalize(registration[1])];
          rows = [{ kind, name: registration[2].trim() }];
        } else {
          const [, type, , amount, count, due] = finance!;
          if (!due)
            throw new Error(
              "Inclua o primeiro vencimento. Exemplo: Cadastre uma compra de R$ 1.500 em 3 parcelas para 10/12/2026.",
            );
          const date = parseDue(due.replace(/\.$/, ""));
          const cents = parseAmount(amount);
          if (type.toLowerCase() === "receita" && count)
            throw new Error(
              "O parcelamento pelo chat está disponível para despesas.",
            );
          rows = count
            ? installments("Compra", cents, Number(count), date)
            : [
                {
                  kind: type.toLowerCase() === "receita" ? "income" : "expense",
                  name: type[0].toUpperCase() + type.slice(1),
                  amount: cents / 100,
                  due_date: date,
                },
              ];
        }
        if (rows.some((row) => !row.name || row.name.length > 200))
          throw new Error("Informe um nome de até 200 caracteres.");
        setPreview({ id: crypto.randomUUID(), rows });
        add("Assistente", "Confira a prévia e confirme para gravar.");
      } else {
        let query = interpretFinance(value, lastQuery.current);
        if (!query && local) {
          const intent = await classifyLocally(value);
          if (intent) query = { intent, period: "default" };
        }
        if (query?.unsupported) {
          add(
            "Assistente",
            "Ainda não consigo consultar esse recorte. Posso mostrar as contas em aberto, os vencimentos dos próximos sete dias ou o caixa deste mês e do mês anterior.",
          );
          return;
        }
        if (!query?.intent) {
          if (cloudAvailable) {
            try {
              const response = await endpoint("intelligence-cloud", {
                org: org.id,
                message: value,
              });
              if (typeof response.reply === "string" && response.reply.trim()) {
                add("Assistente", response.reply);
                return;
              }
            } catch {
              add(
                "Assistente",
                "A IA em nuvem está indisponível neste momento.",
              );
            }
          }
          if (local) {
            const reply = await converseLocally(value);
            if (reply) {
              add("Assistente", reply);
              return;
            }
          }
          add(
            "Assistente",
            "O que você quer consultar: valores a receber, a pagar, contas vencidas ou resultado de caixa?",
          );
          return;
        }
        const { intent, period = "default" } = query;
        const detailed = ["cash", "received", "paid", "expenses"].includes(
          intent,
        );
        if (detailed && !advanced)
          throw new Error(
            "Análises financeiras estão disponíveis nos planos Profissional e Empresarial.",
          );
        const data = await rpc("intelligence_finance", {
          p_org: org.id,
          p_advanced: detailed,
        });
        setReport(data);
        lastQuery.current = { intent, period };
        const previous = period === "previous";
        const periodLabel = previous
          ? "No mês anterior"
          : "Neste mês até " + data.as_of;
        const received = Number(
          previous ? data.previous_received : data.received,
        );
        const paid = Number(previous ? data.previous_paid : data.paid);
        const answers: Record<string, () => string> = {
          balances: () =>
            "Em aberto: " +
            money(data.receivable) +
            " a receber e " +
            money(data.payable) +
            " a pagar.",
          receivables: () =>
            period === "month"
              ? "A receber com vencimento neste mês: " +
                money(data.receivable_month) +
                "."
              : "Você tem " +
                money(data.receivable) +
                " a receber, dos quais " +
                money(data.overdue_income) +
                " estão vencidos. Com vencimento neste mês: " +
                money(data.receivable_month) +
                ".",
          payables: () =>
            "Você tem " +
            money(data.payable) +
            " a pagar, dos quais " +
            money(data.overdue_expense) +
            " estão vencidos.",
          overdue: () =>
            "Valores vencidos: " +
            money(data.overdue_income) +
            " a receber e " +
            money(data.overdue_expense) +
            " a pagar.",
          upcoming: () =>
            data.due_soon +
            " lançamento(s) em aberto com vencimento de hoje até sete dias à frente.",
          received: () =>
            periodLabel + ", você recebeu " + money(received) + ".",
          paid: () => periodLabel + ", você pagou " + money(paid) + ".",
          expenses: () =>
            [
              periodLabel + ", você pagou " + money(paid) + ".",
              ...(data.categories.length
                ? data.categories.map(
                    (row: { category: string; paid: number }) =>
                      row.category + ": " + money(row.paid),
                  )
                : ["Nenhuma despesa paga por categoria nesse período."]),
            ].join("\n"),
          cash: () =>
            [
              periodLabel +
                ", o resultado de caixa foi " +
                money(received - paid) +
                ".",
              "Recebido: " + money(received) + ". Pago: " + money(paid) + ".",
              ...(!previous
                ? [
                    "Mês anterior completo: " +
                      money(
                        Number(data.previous_received) -
                          Number(data.previous_paid),
                      ) +
                      " de resultado.",
                    "Caixa registrado mais valores em aberto: " +
                      money(
                        Number(data.recorded_cash) +
                          Number(data.receivable) -
                          Number(data.payable),
                      ) +
                      ". Esse cenário supõe que todas as contas em aberto serão liquidadas.",
                  ]
                : []),
              "O resultado de caixa considera as baixas. Lucro contábil exige outros dados.",
            ].join("\n"),
        };
        add("Assistente", answers[intent]());
      }
    } catch (error) {
      add(
        "Assistente",
        error instanceof Error ? error.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!advanced || busy || preview || rule) return;
    add("Você", "Importar " + file.name);
    setBusy(true);
    try {
      const { readFinancialFile } = await import("./intelligence-import.mjs");
      const parsed = await readFinancialFile(file);
      const key = (row: {
        kind: string;
        name: string;
        amount?: number;
        due_date?: string | null;
      }) =>
        JSON.stringify([
          row.kind,
          normalize(row.name.trim()),
          Number(row.amount),
          row.due_date,
        ]);
      const existing = new Set(records.map(key));
      const rows = parsed.rows.filter((row: Entry) => !existing.has(key(row)));
      const duplicates = parsed.rows.length - rows.length;
      if (rows.length)
        setPreview({
          id: crypto.randomUUID(),
          rows: rows.map((row: Entry) => ({ ...row, import_row: true })),
        });
      add(
        "Assistente",
        [
          rows.length + " linha(s) válidas para revisar.",
          ...(duplicates
            ? [
                duplicates +
                  " possível(is) duplicidade(s) na empresa foram excluídas da prévia.",
              ]
            : []),
          ...parsed.issues.slice(0, 12),
          ...(parsed.issues.length > 12
            ? [
                "Outras " +
                  (parsed.issues.length - 12) +
                  " linhas precisam de correção.",
              ]
            : []),
          ...(parsed.issues.length
            ? [
                "Corrija o arquivo e importe novamente ou confirme somente as linhas válidas.",
              ]
            : []),
        ].join("\n"),
      );
    } catch (error) {
      add(
        "Assistente",
        error instanceof Error
          ? error.message
          : "Não foi possível ler a planilha.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const ids = await rpc("intelligence_create", {
        p_org: org.id,
        p_operation: preview.id,
        p_rows: preview.rows,
      });
      setPreview(undefined);
      add(
        "Assistente",
        ids.length +
          " registro(s) gravado(s). Abra o módulo correspondente para consultá-los.",
      );
      try {
        await reload();
      } catch {
        add(
          "Assistente",
          "Atualize a página para carregar os registros gravados.",
        );
      }
    } catch (error) {
      add(
        "Assistente",
        error instanceof Error ? error.message : "Falha ao gravar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveRule() {
    if (!rule || busy) return;
    setBusy(true);
    try {
      await rpc("intelligence_reminder", {
        p_org: org.id,
        p_days: rule.days,
        p_enabled: rule.enabled,
      });
      add(
        "Assistente",
        rule.enabled ? "Lembrete diário ativado." : "Lembrete desativado.",
      );
      setRule(undefined);
      setInbox(await rpc("intelligence_inbox", { p_org: org.id }));
    } catch (error) {
      add(
        "Assistente",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o lembrete.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="primary intelligence-launcher"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Sparkles size={18} aria-hidden="true" /> Assistente Inteligente
      </button>
      {open && (
        <aside className="intelligence-panel" aria-label="MD Flux Intelligence">
          <header>
            <div>
              <strong>MD Flux Intelligence</strong>
              <small>Área atual · {page || "Painel"}</small>
            </div>
            <button
              type="button"
              aria-label="Fechar assistente"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
          </header>
          <details className="intelligence-tools">
            <summary>Sugestões e ferramentas</summary>
            <div className="intelligence-suggestions">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (local) {
                    setLocal(false);
                    return;
                  }
                  setBusy(true);
                  try {
                    const available = await enableLocalModel();
                    setLocal(available);
                    add(
                      "Assistente",
                      available
                        ? "Interpretação local ativada para consultas."
                        : "IA local indisponível neste navegador. Os comandos continuam disponíveis.",
                    );
                  } catch {
                    add(
                      "Assistente",
                      "Não foi possível carregar o modelo local. Use os comandos ou sugestões.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {local
                  ? "Desativar IA local"
                  : "Ativar IA local (download pelo navegador)"}
              </button>
              {[
                "Quanto tenho para receber?",
                "Quais contas estão vencidas?",
                ...(advanced
                  ? ["Analise meu caixa", "Cadastre um cliente chamado "]
                  : []),
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={busy || !!preview || !!rule}
                  onClick={() =>
                    item.endsWith(" ") ? setText(item) : void run(item)
                  }
                >
                  {item.trim()}
                </button>
              ))}
            </div>
            {advanced && (
              <label className="intelligence-note">
                Importar planilha (XLSX ou CSV)
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  disabled={busy || !!preview || !!rule}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void importFile(file);
                  }}
                />
                <small>Colunas: tipo, descrição, valor, vencimento.</small>
              </label>
            )}
          </details>
          <div
            className="intelligence-history"
            ref={historyRef}
            role="log"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <p
                key={index}
                className={
                  message.role === "Você"
                    ? "intelligence-message intelligence-message-user"
                    : "intelligence-message intelligence-message-assistant"
                }
              >
                <strong>{message.role}</strong>
                {message.text}
              </p>
            ))}
            {busy && <p>Processando…</p>}
            {rule && (
              <section aria-label="Prévia do lembrete">
                <strong>
                  {rule.enabled
                    ? "Alertar até " + rule.days + " dia(s) antes do vencimento"
                    : "Desativar lembretes de vencimento"}
                </strong>
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => void saveRule()}
                >
                  Confirmar lembrete
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRule(undefined)}
                >
                  Cancelar
                </button>
              </section>
            )}
            {collections.length > 0 && (
              <section aria-label="Cobranças para revisar">
                {collections.map((item) => {
                  const phone = contactNumber(item.phone);
                  const message =
                    "Olá" +
                    (item.client ? ", " + item.client : "") +
                    "! Podemos verificar o pagamento de " +
                    item.name +
                    " (" +
                    money(item.balance) +
                    "), com vencimento em " +
                    item.due_date +
                    "? Se já foi pago, por favor desconsidere.";
                  return (
                    <div key={item.id}>
                      <p>{message}</p>
                      {phone && (
                        <a
                          href={
                            "https://wa.me/" +
                            phone +
                            "?text=" +
                            encodeURIComponent(message)
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Revisar no WhatsApp
                        </a>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
            {inbox && (
              <details>
                <summary>
                  Notificações (
                  {inbox.items.filter((item) => !item.read_at).length} não
                  lidas)
                </summary>
                <p>
                  {inbox.enabled
                    ? "Lembrete ativo · " + inbox.days_before + " dia(s) antes"
                    : "Lembretes desativados"}
                </p>
                <ul>
                  {inbox.items.map((item, index) => (
                    <li key={index}>
                      {item.name} · {item.due_date}
                    </li>
                  ))}
                </ul>
                {inbox.items.some((item) => !item.read_at) && (
                  <button
                    type="button"
                    onClick={() =>
                      rpc("intelligence_inbox", {
                        p_org: org.id,
                        p_mark_read: true,
                      })
                        .then(setInbox)
                        .catch(() =>
                          add(
                            "Assistente",
                            "Não foi possível marcar as notificações.",
                          ),
                        )
                    }
                  >
                    Marcar como lidas
                  </button>
                )}
              </details>
            )}
            {preview && (
              <section aria-label="Prévia da gravação">
                <strong>{preview.rows.length} registro(s)</strong>
                <ul>
                  {preview.rows.map((row, index) => (
                    <li key={index}>
                      {row.name}
                      {row.amount !== undefined && " · " + money(row.amount)}
                      {row.due_date && " · " + row.due_date}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => void confirm()}
                >
                  Confirmar gravação
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPreview(undefined)}
                >
                  Cancelar
                </button>
              </section>
            )}
          </div>
          {cloudAvailable && (
            <small className="intelligence-note">
              Algumas mensagens são processadas pela Cloudflare. Evite incluir
              dados pessoais ou confidenciais.
            </small>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(text);
            }}
          >
            <input
              aria-label="Mensagem para o assistente"
              placeholder="Pergunte sobre sua empresa"
              value={text}
              maxLength={500}
              disabled={busy || !!preview || !!rule}
              onChange={(event) => setText(event.target.value)}
            />
            <button
              className="primary"
              disabled={busy || !!preview || !!rule || !text.trim()}
            >
              Enviar
            </button>
          </form>
          {report?.overdue_income > 0 && (
            <small className="intelligence-note">
              Recebimentos vencidos · {money(report.overdue_income)}
            </small>
          )}
        </aside>
      )}
    </>
  );
}

export function FinancialAlerts({ rows }: { rows: Row[] }) {
  const today = localDate();
  const pending = rows.filter(
    (row) =>
      (row.kind === "income" || row.kind === "expense") &&
      row.due_date &&
      Number(row.amount) > Number(row.paid),
  );
  const late = pending.filter((row) => row.due_date! < today);
  const due = pending.filter((row) => row.due_date === today);
  return (
    <section
      className="intelligence-summary"
      aria-labelledby="summary-intelligence"
    >
      <h2 id="summary-intelligence">Seu resumo inteligente</h2>
      <p>
        {late.length
          ? late.length + " conta(s) vencida(s)."
          : "Nenhuma conta vencida."}{" "}
        {due.length
          ? due.length + " vencimento(s) hoje."
          : "Nenhum vencimento hoje."}
      </p>
      {late.some((row) => row.kind === "income") && (
        <p>Consulte as contas a receber no Assistente Inteligente.</p>
      )}
    </section>
  );
}
