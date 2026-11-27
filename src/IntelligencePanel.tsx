import {
  classifyLocally,
  converseLocally,
  enableLocalModel,
} from "./intelligence-local";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import { contactNumber } from "./commercial.mjs";
import { endpoint, rpc } from "./api";
import { money, summarize } from "./domain.mjs";
import {
  installments,
  interpretFinance,
  localDate,
  normalize,
  parseAmount,
  parseDue,
  smallTalk,
} from "./intelligence.mjs";
import type { Kind, Org, Row } from "./model";

type Entry = {
  kind: string;
  name: string;
  amount?: number;
  due_date?: string;
  installment?: number;
  import_row?: boolean;
};
type Message = { role: "Você" | "Assistente"; text: string };

const creationCommands: { kind: Kind; label: string; phrase: RegExp }[] = [
  { kind: "client", label: "Cadastrar cliente", phrase: /^(?:cadastrar|cadastre|criar|crie) (?:um |novo )?cliente$/ },
  { kind: "quote", label: "Criar orçamento", phrase: /^(?:criar|crie|gerar|gere|fazer|faca) (?:um |novo )?orcamento$/ },
  { kind: "proposal", label: "Gerar proposta", phrase: /^(?:criar|crie|gerar|gere) (?:uma |nova )?proposta(?: comercial)?$/ },
  { kind: "contract", label: "Gerar contrato", phrase: /^(?:criar|crie|gerar|gere) (?:um |novo )?contrato$/ },
  { kind: "order", label: "Criar OS", phrase: /^(?:criar|crie|abrir|abra|gerar|gere) (?:uma |nova )?(?:os|o\.s\.|ordem de servico)$/ },
  { kind: "income", label: "Registrar entrada", phrase: /^(?:registrar|registre|cadastrar|cadastre) (?:uma )?(?:entrada|receita|conta a receber)$/ },
  { kind: "expense", label: "Registrar saída", phrase: /^(?:registrar|registre|cadastrar|cadastre) (?:uma )?(?:saida|despesa|conta a pagar)$/ },
];

type BrowserSpeech = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeech;
  webkitSpeechRecognition?: new () => BrowserSpeech;
};

export function Intelligence({
  org,
  reload,
  page,
  records,
  demo = false,
  embedded = false,
  openRecordForm,
  firstName,
  canOpenRecordForm,
  recordForm,
}: {
  org: Org;
  reload: () => Promise<void>;
  page: string;
  records: Row[];
  demo?: boolean;
  embedded?: boolean;
  openRecordForm: (kind: Kind) => boolean;
  firstName: string;
  canOpenRecordForm: (kind: Kind) => boolean;
  recordForm?: ReactNode;
}) {
  const cloudAvailable = !demo &&
    (import.meta as ImportMeta & { env?: { VITE_MDFLUX_CLOUD_AI?: string } })
      .env?.VITE_MDFLUX_CLOUD_AI === "true";

  const [local, setLocal] = useState(false);
  const lastQuery = useRef<{ intent: string; period: string } | undefined>(
    undefined,
  );
  const historyRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const open = embedded || drawerOpen;
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");
  const speech = useRef<BrowserSpeech | null>(null);
  const speechWindow = window as SpeechWindow;
  const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

  useEffect(() => {
    return () => {
      const capture = speech.current;
      speech.current = null;
      capture?.abort();
    };
  }, []);

  function stopVoice() {
    const capture = speech.current;
    speech.current = null;
    setListening(false);
    capture?.abort();
  }

  useEffect(() => {
    if (!open && speech.current) stopVoice();
  }, [open]);

  function startVoice() {
    if (speech.current) {
      stopVoice();
      setVoiceNotice("Captação cancelada.");
      return;
    }
    if (!SpeechRecognition) return;
    const capture = new SpeechRecognition();
    capture.lang = "pt-BR";
    capture.onresult = (event) => {
      if (speech.current !== capture) return;
      const transcript = event.results[0]?.[0]?.transcript.trim();
      if (!transcript) return;
      setText((current) => [current.trim(), transcript].filter(Boolean).join(" ").slice(0, 500));
      setVoiceNotice("Revise a transcrição antes de enviar.");
    };
    capture.onerror = ({ error }) => {
      if (speech.current !== capture) return;
      setVoiceNotice(error === "not-allowed" || error === "service-not-allowed"
        ? "Acesso ao microfone bloqueado. Revise a permissão do navegador ou digite sua mensagem."
        : "Não foi possível transcrever. Tente novamente ou digite sua mensagem.");
    };
    capture.onend = () => {
      if (speech.current !== capture) return;
      speech.current = null;
      setListening(false);
      setVoiceNotice((notice) => notice || "Nenhuma fala foi reconhecida. Tente novamente ou digite.");
    };
    speech.current = capture;
    setVoiceNotice("");
    setListening(true);
    try {
      capture.start();
    } catch {
      speech.current = null;
      setListening(false);
      setVoiceNotice("Não foi possível abrir o microfone. Digite sua mensagem.");
    }
  }
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
  const advanced = !demo && org.subscription.plan !== "essencial";
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
  }, [open, messages, busy, preview, rule, Boolean(recordForm)]);

  async function run(prompt: string) {
    const value = prompt.trim();
    if (!value || busy || listening || preview || rule || recordForm) return;
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
      const creation = command.replace(/^(?:quero|preciso|gostaria de)\s+/, "").replace(/[.!?]+$/, "");
      const action = creationCommands.find(({ phrase }) => phrase.test(creation));
      if (action) {
        const opened = openRecordForm(action.kind);
        add("Assistente", opened
          ? "Abri o formulário. Preencha os dados e revise antes de salvar."
          : "Seu perfil não permite cadastrar esse tipo de registro.");
        return;
      }
      if (demo) {
        const query = interpretFinance(value, lastQuery.current);
        const summary = summarize(records);
        if (query && !query.unsupported && ["default", undefined].includes(query.period)) {
          const answers: Record<string, string> = {
            balances: "Em aberto: " + money(summary.receivable) + " a receber e " + money(summary.payable) + " a pagar.",
            receivables: "Você tem " + money(summary.receivable) + " a receber.",
            payables: "Você tem " + money(summary.payable) + " a pagar.",
          };
          if (answers[query.intent]) {
            lastQuery.current = { intent: query.intent, period: "default" };
            add("Assistente", "Dados fictícios. " + answers[query.intent]);
            return;
          }
        }
        add("Assistente", "Na demonstração, pergunte quanto há para receber ou pagar. Use as ações da tela inicial para registrar uma movimentação fictícia.");
        return;
      }
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
            } catch (error) {
              add(
                "Assistente",
                error instanceof Error
                  ? error.message
                  : "A IA em nuvem está indisponível neste momento.",
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
      {!embedded && <button
        type="button"
        className="primary intelligence-launcher"
        aria-expanded={open}
        onClick={() => {
          if (open) stopVoice();
          setDrawerOpen(!drawerOpen);
        }}
      >
        <Sparkles size={18} aria-hidden="true" /> Assistente Inteligente
      </button>}
      {open && (
        <aside className={"intelligence-panel" + (embedded ? " intelligence-panel-embedded" : "")} aria-label="MD Flux Intelligence">
          <header>
            <div>
              {embedded ? <h1>Assistente Inteligente</h1> : <h2>Assistente Inteligente</h2>}
              <small>{demo ? "Demonstração · dados fictícios" : "Área atual · " + (page || "Painel")}</small>
            </div>
            {!embedded && <button
              type="button"
              aria-label="Fechar assistente"
              onClick={() => {
                stopVoice();
                setDrawerOpen(false);
              }}
            >
              <X size={20} />
            </button>}
          </header>
          <details className="intelligence-tools">
            <summary>Sugestões e ferramentas</summary>
            <div className="intelligence-suggestions">
              {!demo && (
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
                  } catch (error) {
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
              )}
              {[
                "Quanto tenho para receber?",
                "Quanto tenho para pagar?",
                ...(!demo ? ["Quais contas estão vencidas?"] : []),
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
            {embedded && (
              <section className="intelligence-opening" aria-label="Mensagem inicial do assistente">
                <strong>Assistente</strong>
                <OpeningSummary firstName={firstName} records={records} financeRole={financeRole} />
                <h2>Como posso ajudar você agora?</h2>
                <div className="intelligence-suggestions" aria-label="Ações do assistente">
                  {[...creationCommands.filter(({ kind }) => canOpenRecordForm(kind)).map(({ label }) => label),
                    ...(financeRole ? ["Quanto tenho para receber?", "Quanto tenho para pagar?"] : []),
                  ].map((label) => (
                    <button key={label} type="button" disabled={busy || listening || !!preview || !!rule || !!recordForm} onClick={() => void run(label)}>
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            )}
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
            {recordForm}
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
              if (!listening) void run(text);
            }}
          >
            <input
              aria-label="Mensagem para o assistente"
              placeholder="Digite o que você precisa"
              value={text}
              maxLength={500}
              disabled={busy || !!preview || !!rule || !!recordForm}
              onChange={(event) => setText(event.target.value)}
            />
            {SpeechRecognition && (
              <button
                type="button"
                aria-label={listening ? "Cancelar captação de voz" : "Ditado por voz"}
                aria-pressed={listening}
                disabled={!listening && (busy || !!preview || !!rule || !!recordForm)}
                onClick={startVoice}
              >
                {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
              </button>
            )}
            <button
              className="primary"
              disabled={busy || !!preview || !!rule || listening || !!recordForm || !text.trim()}
            >
              Enviar
            </button>
          </form>
          <small className="intelligence-note" role="status">
            {listening
              ? "Ouvindo… Pressione o microfone para cancelar."
              : voiceNotice || (SpeechRecognition
                ? "O ditado pode usar o serviço de reconhecimento de voz do navegador."
                : "Ditado indisponível neste navegador. Digite sua mensagem.")}
          </small>
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

function OpeningSummary({ firstName, records, financeRole }: {
  firstName: string;
  records: Row[];
  financeRole: boolean;
}) {
  const now = new Date();
  const zone = "America/Sao_Paulo";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, dateStyle: "short" }).format(now);
  const month = today.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, month: "long", year: "numeric" }).format(now);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: zone, dateStyle: "long" }).format(now);
  const formatDay = (date: string) => date.slice(0, 10).split("-").reverse().join("/");
  const cents = (amount: unknown) => Math.round((Number(amount) || 0) * 100);
  const active = records.filter((row) => !["canceled", "archived"].includes(row.status));
  const finance = financeRole ? active.filter((row) => row.kind === "income" || row.kind === "expense") : [];
  let received = 0, paid = 0, receivable = 0, payable = 0, projected = 0;
  const commitments: { id: string; name: string; date: string; label: string; balance?: number }[] = [];

  for (const row of finance) {
    const income = row.kind === "income";
    for (const payment of row.data?.settlements || []) {
      const date = String(payment.date);
      if (!date.startsWith(month) || date > today) continue;
      if (income) received += cents(payment.amount);
      else paid += cents(payment.amount);
    }
    const balance = Math.max(0, cents(row.amount) - cents(row.paid));
    if (!balance) continue;
    if (income) receivable += balance;
    else payable += balance;
    if (row.due_date?.startsWith(month)) projected += income ? balance : -balance;
    if (row.due_date) commitments.push({
      id: row.id, name: row.name, date: row.due_date, label: income ? "Receber" : "Pagar", balance,
    });
  }
  for (const row of active) {
    if (row.kind !== "order" || row.status === "completed") continue;
    const date = String(row.data?.scheduled || row.due_date || "");
    if (date.slice(0, 10) >= today) commitments.push({ id: row.id, name: row.name, date, label: "Serviço" });
  }
  const late = commitments.filter(({ date }) => date.slice(0, 10) < today);
  const upcoming = commitments.filter(({ date }) => date.slice(0, 10) >= today)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const cash = received - paid;
  const quotes = active.filter((row) => row.kind === "quote" && ["draft", "sent", "pending"].includes(row.status)).length;
  const orders = active.filter((row) => row.kind === "order" && row.status !== "completed").length;
  const metrics = [
    ["Receitas recebidas", received], ["Despesas pagas", paid], ["Resultado de caixa", cash],
    ["Em aberto a receber", receivable], ["Em aberto a pagar", payable], ["Caixa projetado no mês", cash + projected],
  ] as const;

  return (
    <>
      <p className="opening-greeting">Olá{firstName ? ", " + firstName : ""}! Hoje é {todayLabel}.</p>
      {financeRole && (
        <>
          <h2>Resumo financeiro de {monthLabel}</h2>
          <dl className="opening-metrics">
            {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value / 100)}</dd></div>)}
          </dl>
          <p>A projeção soma o caixa realizado e as contas em aberto com vencimento neste mês.</p>
          {late.length > 0 && <p>Você tem {late.length} {late.length === 1 ? "conta vencida" : "contas vencidas"}.</p>}
        </>
      )}
      <h2>Próximos compromissos</h2>
      {upcoming.length > 0 ? (
        <ul className="opening-commitments">
          {upcoming.map(({ id, name, date, label, balance }) => (
            <li key={id}>
              <span><strong>{name}</strong><small>{formatDay(date)}{date.length > 10 ? " às " + date.slice(11, 16) : ""} · {label}</small></span>
              {balance !== undefined && <b>{money(balance / 100)}</b>}
            </li>
          ))}
        </ul>
      ) : <p>Não encontrei próximos compromissos nos registros disponíveis.</p>}
      {(quotes > 0 || orders > 0) && <p>Para acompanhar: {quotes} orçamento(s) em andamento e {orders} ordem(ns) de serviço aberta(s).</p>}
    </>
  );
}
