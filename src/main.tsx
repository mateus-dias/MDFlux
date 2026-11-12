import { FinancialAlerts, Intelligence } from "./IntelligencePanel";
import { IntelligenceShowcase, PlanComparison } from "./IntelligenceMarketing";
import Captcha, { captchaKey } from "./Captcha";
import AdminCustomers from "./AdminCustomers";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  Wallet,
  Package,
  LifeBuoy,
  Settings,
  BarChart3,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Check,
  ShieldCheck,
  Download,
  Eye,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building2,
} from "lucide-react";
import {
  supabase,
  rpc,
  endpoint,
  configured,
  demoOrg,
  demoRows,
  loadRows,
  save,
} from "./api";
import { money, plans, summarize, access, today } from "./domain.mjs";
import { modules, labels, documentKinds, canWrite } from "./model";
import type { Kind, Row, Org } from "./model";
import { companyLogo, exportCSV, exportXLSX, pdf, prepareCompanyLogo } from "./exports";
import { track, consent } from "./tracking";
import Editor from "./Editor";
import "./styles.css";
const icons: Record<string, any> = {
  dashboard: LayoutDashboard,
  client: Users,
  supplier: Building2,
  quote: FileText,
  proposal: FileText,
  contract: FileText,
  order: ClipboardList,
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  product: Package,
  reports: BarChart3,
  ticket: LifeBuoy,
  settings: Settings,
  plans: Wallet,
};
const wa =
  "https://wa.me/" +
  ((import.meta as any).env.VITE_WHATSAPP || "5516997754245");
function go(path: string) {
  // Leave the public document before opening authenticated or private routes.
  // A previously loaded third-party measurement script must not survive there.
  if (
    (location.pathname === "/") !==
    (new URL(path, location.origin).pathname === "/")
  ) {
    location.assign(path);
    return;
  }
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function Logo({ image, name = "MD Flux" }: { image?: string; name?: string } = {}) {
  return (
    <a
      className="logo"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        go("/");
      }}
    >
      <img src={image || "/brand/md-flux.png"} alt={image ? name : "MD Flux"} style={image ? { objectFit: "contain", width: 140, height: 44, background: "#fff", borderRadius: 4 } : undefined} />
      <span>
        MD <b>Flux</b>
      </span>
    </a>
  );
}
function Plans({ choose }: { choose: (p: string) => void }) {
  return (
    <div className="plan-grid">
      {Object.entries(plans).map(([key, p]) => (
        <article
          className={"plan " + (key === "profissional" ? "featured" : "")}
          key={key}
        >
          {key === "profissional" && (
            <span className="recommended">RECOMENDADO</span>
          )}
          <span className="eyebrow">{p.name}</span>
          <h2>
            {money(p.price)}
            <small>/mês</small>
          </h2>
          <p>
            {key === "essencial"
              ? "Para organizar sua rotina."
              : key === "profissional"
                ? "Para crescer com sua equipe."
                : "Para uma gestão mais completa."}
          </p>
          <ul>
            {[
              `${p.users} usuário${p.users > 1 ? "s" : ""}`,
              "Clientes, orçamentos e propostas",
              "Contratos e controle financeiro",
              "Relatórios e suporte",
              ...(key !== "essencial"
                ? ["Ordens de serviço e estoque", "Permissões de equipe"]
                : []),
              ...(key === "empresarial"
                ? ["Auditoria da empresa", "Exportações e suporte prioritário"]
                : []),
            ].map((s) => (
              <li key={s}>
                <Check size={16} />
                {s}
              </li>
            ))}
          </ul>
          <button
            className={key === "profissional" ? "primary" : "secondary"}
            onClick={() => choose(key)}
          >
            Escolher {p.name}
          </button>
        </article>
      ))}
    </div>
  );
}
function Landing() {
  const [cookies, setCookies] = useState(
    !localStorage.getItem("mdflux:consent"),
  );
  return (
    <>
      <nav className="landing-nav">
        <Logo />
        <div>
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <button onClick={() => go("/demo")}>Demonstração</button>
          <button onClick={() => go("/auth")}>Entrar</button>
          <button className="primary" onClick={() => go("/auth?signup=1")}>
            Teste grátis <ArrowUpRight size={16} />
          </button>
        </div>
      </nav>
      <main className="landing">
        <section className="hero">
          <div>
            <span className="pill">
              <span /> GESTÃO SIMPLES. NEGÓCIOS MAIS LEVES.
            </span>
            <h1>
              Seu negócio
              <br />
              organizado.
              <br />
              <em>Seu tempo de volta.</em>
            </h1>
            <p>
              Do primeiro orçamento ao serviço concluído. Cuide dos clientes,
              contratos e finanças em um só lugar — pelo computador ou celular.
            </p>
            <div className="actions">
              <button
                className="primary large"
                onClick={() => go("/auth?signup=1")}
              >
                Começar gratuitamente <ArrowUpRight size={18} />
              </button>
              <button className="secondary large" onClick={() => go("/demo")}>
                Conhecer o sistema
              </button>
            </div>
            <div className="hero-notes">
              <span>
                <CheckCircle2 size={16} /> 3 dias grátis
              </span>
              <span>
                <CheckCircle2 size={16} /> Sem cartão no teste
              </span>
              <span>
                <CheckCircle2 size={16} /> Acesso pelo celular
              </span>
            </div>
          </div>
          <div className="hero-preview">
            <div className="preview-top">
              <span className="mini-logo">M</span> MD Flux{" "}
              <span className="dot green" />
            </div>
            <div className="preview-body">
              <p className="eyebrow">SEU NEGÓCIO EM MOVIMENTO</p>
              <h2>Olá! Vamos simplificar o dia?</h2>
              <p>Uma visão clara para suas próximas decisões.</p>
              <div className="preview-cards">
                <article>
                  <Wallet size={20} />
                  <small>Resultado de caixa</small>
                  <strong>R$ 3.280,00</strong>
                  <span>Recebido − pago</span>
                </article>
                <article>
                  <Users size={20} />
                  <small>Clientes organizados</small>
                  <strong>Em um só lugar</strong>
                  <span>Histórico sempre à mão</span>
                </article>
              </div>
              <div className="preview-chart">
                <div style={{ height: "32%" }} />
                <div style={{ height: "52%" }} />
                <div style={{ height: "41%" }} />
                <div style={{ height: "72%" }} />
                <div style={{ height: "61%" }} />
                <div style={{ height: "88%" }} />
              </div>
              <small>Ilustração com dados fictícios</small>
            </div>
            <div className="floating-card">
              <CheckCircle2 color="#179a6e" />
              <div>
                <b>Do orçamento à execução</b>
                <small>Menos retrabalho. Mais clareza.</small>
              </div>
            </div>
          </div>
        </section>
        <section id="recursos">
          <div className="section-heading">
            <span className="eyebrow">TUDO CONECTADO</span>
            <h2>
              Uma rotina mais simples.
              <br />
              Uma gestão mais profissional.
            </h2>
          </div>
          <div className="benefits">
            {[
              [
                Users,
                "Clientes por perto",
                "Centralize contatos e o histórico de cada relacionamento.",
              ],
              [
                FileText,
                "Documentos que impressionam",
                "Crie orçamentos, propostas e contratos com sua identidade.",
              ],
              [
                ClipboardList,
                "Serviços no controle",
                "Organize prazos, responsáveis e etapas das ordens de serviço.",
              ],
              [
                Wallet,
                "Clareza nas finanças",
                "Separe o previsto do realizado e acompanhe cada recebimento.",
              ],
            ].map(([Icon, title, text]: any) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="how">
          <span className="eyebrow">COMO FUNCIONA</span>
          <h2>Comece pequeno. Organize tudo.</h2>
          <div className="benefits">
            {[
              "Crie sua conta em poucos passos",
              "Cadastre seu primeiro cliente",
              "Envie um orçamento profissional",
              "Escolha seu plano para continuar",
            ].map((s, i) => (
              <article key={s}>
                <span className="step">0{i + 1}</span>
                <h3>{s}</h3>
              </article>
            ))}
          </div>
        </section>
        <IntelligenceShowcase />
        <section id="planos">
          <div className="section-heading">
            <span className="eyebrow">PLANOS QUE ACOMPANHAM SEU NEGÓCIO</span>
            <h2>Escolha seu próximo passo.</h2>
            <p>Teste por 72 horas. Cancele a renovação pela sua conta.</p>
          </div>
          <Plans choose={(p) => go("/auth?signup=1&plan=" + p)} />
          <PlanComparison choose={(p) => go("/auth?signup=1&plan=" + p)} />
        </section>
        <section className="custom">
          <div>
            <span className="eyebrow">SEU PROCESSO É ÚNICO?</span>
            <h2>
              Um sistema exclusivo
              <br />
              para a sua empresa.
            </h2>
            <p>
              Além da assinatura MD Flux, desenvolvemos sistemas sob medida para
              necessidades específicas. Escopo e orçamento contratados
              separadamente.
            </p>
          </div>
          <a
            className="primary large"
            href={
              wa +
              "?text=" +
              encodeURIComponent(
                "Olá! Quero solicitar um orçamento para um sistema personalizado.",
              )
            }
            target="_blank"
            rel="noreferrer"
            onClick={() => track("Lead")}
          >
            Conversar pelo WhatsApp <ArrowUpRight size={18} />
          </a>
        </section>
        <section className="faq">
          <h2>Ficou alguma dúvida?</h2>
          {[
            [
              "Preciso instalar alguma coisa?",
              "Não. Acesse pelo navegador ou instale o atalho do aplicativo no celular.",
            ],
            [
              "O que acontece depois dos 3 dias?",
              "As operações são bloqueadas. Seus dados de teste elegíveis são mantidos por mais 7 dias para você contratar.",
            ],
            [
              "A demonstração é minha conta real?",
              "A demonstração usa dados fictícios e fica isolada nesta aba. Reinicie quando quiser.",
            ],
            [
              "Posso contratar algo personalizado?",
              "Sim. Sistemas exclusivos têm proposta e escopo próprios, separados da assinatura.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className="site-footer">
        <Logo />
        <span>Gestão simples para o seu dia a dia.</span>
        <button onClick={() => go("/privacy")}>Privacidade</button>
        <button onClick={() => go("/terms")}>Termos</button>
        <button
          onClick={() => {
            consent(false);
            setCookies(true);
          }}
        >
          Preferências de cookies
        </button>
      </footer>
      {cookies && (
        <aside className="cookie">
          <p>
            Podemos usar cookies opcionais para medir o interesse no MD Flux.
            Você pode recusar e continuar normalmente.
          </p>
          <button
            onClick={() => {
              consent(false);
              setCookies(false);
            }}
          >
            Recusar
          </button>
          <button
            className="primary"
            onClick={() => {
              consent(true);
              setCookies(false);
            }}
          >
            Permitir medição
          </button>
        </aside>
      )}
    </>
  );
}
function Auth() {
  const [captchaToken, setCaptchaToken] = useState(""),
    [captchaVersion, setCaptchaVersion] = useState(0);
  const [signup, setSignup] = useState(location.search.includes("signup=1")),
    [recovery, setRecovery] = useState(false),
    [reset, setReset] = useState(location.hash.includes("type=recovery")),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const sub = supabase?.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReset(true);
    });
    return () => sub?.data.subscription.unsubscribe();
  }, []);
  return (
    <div className="auth">
      <Logo />
      <section className="auth-card">
        <span className="eyebrow">BEM-VINDO AO MD FLUX</span>
        <h1>
          {reset
            ? "Defina sua nova senha"
            : recovery
              ? "Recupere seu acesso"
              : signup
                ? "Seu próximo passo começa aqui."
                : "Bom ter você de volta."}
        </h1>
        <p>
          {signup
            ? "Organize seu negócio. Teste grátis por 3 dias."
            : "Acesse seu espaço de trabalho."}
        </p>
        {!configured && (
          <p className="notice">
            O acesso real precisa da configuração do Supabase.{" "}
            <button onClick={() => go("/demo")}>Explorar demonstração</button>
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setMessage("");
            setBusy(true);
            const f = new FormData(e.currentTarget),
              email = String(f.get("email")),
              password = String(f.get("password"));
            try {
              if (!supabase)
                throw new Error(
                  "Configure as variáveis do Supabase antes de criar contas reais.",
                );
              if (captchaKey && !reset && !captchaToken)
                throw new Error("Confirme a verificação de segurança.");
              if (reset) {
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                go("/app");
              } else if (recovery) {
                const { error } = await supabase.auth.resetPasswordForEmail(
                  email,
                  {
                    redirectTo: location.origin + "/auth?reset=1",
                    captchaToken,
                  },
                );
                if (error) throw error;
                setMessage(
                  "Se o endereço estiver cadastrado, você receberá um link de recuperação.",
                );
              } else if (signup) {
                const { error } = await supabase.auth.signUp({
                  email,
                  password,
                  options: {
                    captchaToken,
                    emailRedirectTo: location.origin + "/auth",
                    data: {
                      first_name: f.get("first_name"),
                      last_name: f.get("last_name"),
                      contact_phone: String(
                        f.get("contact_phone") || "",
                      ).trim(),
                    },
                  },
                });
                if (error) throw error;
                track("CompleteRegistration");
                track("StartTrial");
                setMessage(
                  "Cadastro recebido. Confirme seu e-mail para entrar. O teste de 72 horas começa no cadastro.",
                );
              } else {
                const { error } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                  options: { captchaToken },
                });
                if (error) throw error;
                go("/app");
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              setCaptchaToken("");
              setCaptchaVersion((v) => v + 1);
            }
          }}
        >
          {signup && !recovery && (
            <div className="form-grid">
              <label>
                Nome
                <input name="first_name" required autoComplete="given-name" />
              </label>
              <label>
                Sobrenome
                <input name="last_name" required autoComplete="family-name" />
              </label>
            </div>
          )}
          {!reset && (
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="email" />
            </label>
          )}
          {signup && !recovery && !reset && (
            <label>
              Telefone / WhatsApp de contato (opcional)
              <input
                name="contact_phone"
                type="tel"
                autoComplete="tel"
                maxLength={25}
                pattern="[+0-9 ()-]{10,25}"
                placeholder="(11) 99999-9999"
              />
              <small>
                Usaremos este número apenas para contato sobre o MD Flux,
                suporte e assinatura.
              </small>
            </label>
          )}
          {!recovery && (
            <label>
              Senha
              <input
                name="password"
                type="password"
                minLength={10}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
          )}
          {signup && !recovery && (
            <label className="check">
              <input type="checkbox" required /> Li os{" "}
              <a href="/terms" target="_blank">
                termos
              </a>{" "}
              e a{" "}
              <a href="/privacy" target="_blank">
                política de privacidade
              </a>
              .
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
          {!reset && (
            <Captcha version={captchaVersion} onToken={setCaptchaToken} />
          )}
          <button className="primary large" disabled={busy}>
            {busy
              ? "Aguarde…"
              : reset
                ? "Salvar senha"
                : recovery
                  ? "Enviar link"
                  : signup
                    ? "Criar minha conta grátis"
                    : "Entrar no sistema"}
          </button>
        </form>
        <div className="auth-links">
          <button
            onClick={() => {
              setRecovery(false);
              setSignup(!signup);
            }}
          >
            {signup ? "Já tenho uma conta" : "Criar conta grátis"}
          </button>
          <button
            onClick={() => {
              setRecovery(true);
              setSignup(false);
            }}
          >
            Esqueci minha senha
          </button>
        </div>
      </section>
    </div>
  );
}
function Dashboard({
  rows,
  org,
  create,
}: {
  rows: Row[];
  org: Org;
  create: (k: Kind) => void;
}) {
  const s = summarize(rows);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5 + i);
    const m = d.toISOString().slice(0, 7);
    let income = 0,
      expense = 0;
    for (const r of rows.filter((r) => ["income", "expense"].includes(r.kind)))
      for (const p of r.data.settlements || [])
        if (String(p.date).startsWith(m)) {
          if (r.kind === "income") income += Number(p.amount);
          else expense += Number(p.amount);
        }
    return { m, income, expense };
  });
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">SEU NEGÓCIO, EM UMA VISÃO</span>
          <h1>Olá! O que deseja fazer hoje?</h1>
          <p>Menos tarefas espalhadas. Mais tempo para o que importa.</p>
        </div>
        <span className="date-chip">
          {new Date().toLocaleDateString("pt-BR", {
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
      <div className="quick-actions">
        {(
          [
            "quote",
            "proposal",
            "contract",
            "order",
            "income",
            "expense",
            "client",
          ] as Kind[]
        )
          .filter(
            (k) =>
              canWrite(org, k) &&
              (k !== "order" || org.subscription.plan !== "essencial"),
          )
          .map((k) => {
            const Icon = icons[k];
            return (
              <button key={k} onClick={() => create(k)}>
                <span>
                  <Icon size={19} />
                </span>
                {k === "income"
                  ? "Registrar entrada"
                  : k === "expense"
                    ? "Registrar saída"
                    : "Criar " + modules[k].single.toLowerCase()}
                <Plus size={14} />
              </button>
            );
          })}
      </div>
      <div className="metric-grid">
        {[
          ["Recebido", s.received, "Baixas registradas", "positive"],
          ["Pago", s.paid, "Despesas efetivamente pagas", ""],
          ["Resultado de caixa", s.cash, "Recebido menos pago", "blue"],
          ["A receber", s.receivable, "Valores ainda em aberto", ""],
          ["A pagar", s.payable, "Compromissos pendentes", ""],
          [
            "Resultado previsto",
            s.estimated,
            "Receitas previstas − despesas",
            "",
          ],
        ].map(([label, value, sub, cls]) => (
          <article className={"metric " + cls} key={label}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
            <small>{sub}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-line">
            <div>
              <h3>Seu fluxo de caixa</h3>
              <p>Recebimentos e pagamentos por data de baixa</p>
            </div>
            <span className="legend">
              <i /> Recebido <i /> Pago
            </span>
          </div>
          <div className="bar-chart">
            {months.map((m) => (
              <div className="bar-month" key={m.m}>
                <div className="bar-pair">
                  <i
                    style={{ height: Math.max(2, (m.income / max) * 160) }}
                    title={money(m.income)}
                  />
                  <i
                    style={{ height: Math.max(2, (m.expense / max) * 160) }}
                    title={money(m.expense)}
                  />
                </div>
                <small>
                  {new Date(m.m + "-15").toLocaleDateString("pt-BR", {
                    month: "short",
                  })}
                </small>
              </div>
            ))}
          </div>
          <p className="hint">
            Resultado de caixa considera as baixas. Não representa lucro
            contábil.
          </p>
        </section>
        <section className="panel">
          <h3>O negócio em movimento</h3>
          {[
            ["Clientes cadastrados", s.clients],
            ["Orçamentos pendentes", s.quotes],
            ["Ordens de serviço abertas", s.orders],
            [
              "Propostas aprovadas",
              rows.filter(
                (r) => r.kind === "proposal" && r.status === "approved",
              ).length,
            ],
          ].map(([label, value]) => (
            <div className="stat-row" key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
          <div className="soft-callout">
            <ShieldCheck />
            <p>
              Seus dados ficam organizados em um espaço exclusivo da sua
              empresa.
            </p>
          </div>
        </section>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <h3>Próximos compromissos</h3>
          {rows
            .filter(
              (r) =>
                ["income", "expense", "order"].includes(r.kind) &&
                Number(r.amount) > Number(r.paid) &&
                r.due_date,
            )
            .sort((a, b) =>
              String(a.due_date).localeCompare(String(b.due_date)),
            )
            .slice(0, 5)
            .map((r) => (
              <div className="stat-row" key={r.id}>
                <div>
                  <b>{r.name}</b>
                  <small>{r.due_date}</small>
                </div>
                <strong>{money(Number(r.amount) - Number(r.paid))}</strong>
              </div>
            ))}
          {!rows.length && <p>Seus próximos vencimentos aparecerão aqui.</p>}
        </section>
        <section className="panel">
          <h3>Atividades recentes</h3>
          {rows.slice(0, 5).map((r) => (
            <div className="stat-row" key={r.id}>
              <span>
                {r.name}
                <small>{modules[r.kind].single}</small>
              </span>
              <span className="badge">{labels[r.status] || r.status}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function Records({
  kind,
  rows,
  org,
  edit,
  detail,
  archive,
}: {
  kind: Kind;
  rows: Row[];
  org: Org;
  edit: (r?: Partial<Row>) => void;
  detail: (r: Row) => void;
  archive: (r: Row) => void;
}) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("name"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(0);
  const filtered = rows
    .filter(
      (r) =>
        r.kind === kind &&
        r.name.toLowerCase().includes(search.toLowerCase()) &&
        (!status || r.status === status) &&
        (!from || String(r.due_date || r.created_at.slice(0, 10)) >= from) &&
        (!to || String(r.due_date || r.created_at.slice(0, 10)) <= to),
    )
    .sort((a, b) =>
      sort === "amount"
        ? Number(b.amount) - Number(a.amount)
        : sort === "date"
          ? String(a.due_date).localeCompare(String(b.due_date))
          : a.name.localeCompare(b.name, "pt-BR"),
    );
  const set = filtered.filter((r) => selected.includes(r.id));
  const visible = filtered.slice(page * 20, page * 20 + 20);
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">{modules[kind].group}</span>
          <h1>{modules[kind].name}</h1>
          <p>Informações organizadas. Decisões mais simples.</p>
        </div>
        {canWrite(org, kind) && (
          <button className="primary" onClick={() => edit()}>
            <Plus size={18} /> Novo registro
          </button>
        )}
      </div>
      {kind === "ticket" && org.subscription.status === "trialing" ? (
        <section className="panel">
          <LifeBuoy size={32} />
          <h2>Suporte especializado para assinantes MD Flux</h2>
          <p>
            O suporte completo está disponível nos planos pagos. Para falhas de
            acesso, pagamentos ou privacidade, use o canal essencial.
          </p>
          <button className="primary" onClick={() => go("/app/plans")}>
            Conhecer planos
          </button>{" "}
          <a href={wa} target="_blank" rel="noreferrer">
            Canal essencial
          </a>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search size={18} />
              <input
                placeholder="Buscar pelo nome…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <select
              aria-label="Filtrar status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Todos os status</option>
              {modules[kind].statuses.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Ordenar"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name">Nome A–Z</option>
              <option value="amount">Maior valor</option>
              <option value="date">Vencimento</option>
            </select>
            <button onClick={() => exportCSV(filtered)}>
              <Download size={16} /> CSV
            </button>
          </div>
          <div className="filters">
            <label>
              De
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <span>
              {filtered.length} registros · Total{" "}
              {money(filtered.reduce((s, r) => s + Number(r.amount), 0))}
              {set.length > 0 &&
                ` · Selecionados: ${set.length} / ${money(set.reduce((s, r) => s + Number(r.amount), 0))}`}
            </span>
          </div>
          <section className="table-panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="Selecionar página"
                        type="checkbox"
                        checked={
                          visible.length > 0 &&
                          visible.every((r) => selected.includes(r.id))
                        }
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [
                                  ...new Set([
                                    ...selected,
                                    ...visible.map((r) => r.id),
                                  ]),
                                ]
                              : selected.filter(
                                  (id) => !visible.some((r) => r.id === id),
                                ),
                          )
                        }
                      />
                    </th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          aria-label={"Selecionar " + r.name}
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, r.id]
                                : selected.filter((id) => id !== r.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => detail(r)}
                        >
                          {r.name}
                        </button>
                        <small>
                          {r.data.client_id &&
                            rows.find((c) => c.id === r.data.client_id)?.name}
                        </small>
                      </td>
                      <td>
                        <span className={"badge " + r.status}>
                          {labels[r.status] || r.status}
                        </span>
                      </td>
                      <td>
                        {r.due_date
                          ? new Date(
                              r.due_date + "T12:00:00",
                            ).toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td>
                        {money(r.amount)}
                        {["income", "expense"].includes(kind) && (
                          <small>Baixado {money(r.paid)}</small>
                        )}
                      </td>
                      <td className="row-actions">
                        <button
                          title="Ver detalhes"
                          aria-label={"Ver " + r.name}
                          onClick={() => detail(r)}
                        >
                          <Eye size={17} />
                        </button>
                        {canWrite(org, kind) && (
                          <button
                            title="Editar"
                            aria-label={"Editar " + r.name}
                            onClick={() => edit(r)}
                          >
                            <Pencil size={17} />
                          </button>
                        )}
                        {["owner", "manager"].includes(org.role) && (
                          <button
                            title="Arquivar"
                            aria-label={"Arquivar " + r.name}
                            onClick={() => archive(r)}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="empty">
                <FileText size={34} />
                <h3>Nenhum registro por aqui</h3>
                <p>
                  Comece criando seu primeiro{" "}
                  {modules[kind].single.toLowerCase()}.
                </p>
                {canWrite(org, kind) && (
                  <button className="primary" onClick={() => edit()}>
                    Criar registro
                  </button>
                )}
              </div>
            )}
            <footer className="pagination">
              <span>
                Página {page + 1} de{" "}
                {Math.max(1, Math.ceil(filtered.length / 20))}
              </span>
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <button
                disabled={(page + 1) * 20 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </footer>
          </section>
        </>
      )}
    </>
  );
}
function SettingsPage({
  org,
  rows,
  demo,
  reload,
  notify,
}: {
  org: Org;
  rows: Row[];
  demo: boolean;
  reload: () => void;
  notify: (s: string) => void;
}) {
  const [members, setMembers] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [factor, setFactor] = useState<any>(null);
  const [logoDraft, setLogoDraft] = useState<string | null>();
  const [preparingLogo, setPreparingLogo] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const currentLogo = logoDraft === undefined ? companyLogo(org.settings.logo) : logoDraft;
  useEffect(() => {
    if (!demo && supabase) {
      supabase
        .from("memberships")
        .select("*")
        .eq("org_id", org.id)
        .then((r) => setMembers(r.data || []));
      supabase
        .from("audit")
        .select("*")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(100)
        .then((r) => setAudit(r.data || []));
    }
  }, [org.id]);
  async function run(fn: () => Promise<any>) {
    try {
      await fn();
      notify("Alteração concluída.");
      reload();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>Configurações</h1>
          <p>Empresa, equipe e segurança em um lugar.</p>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <h3>Dados da empresa</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () => {
                if (demo)
                  throw new Error(
                    "Dados da empresa são somente leitura na demonstração.",
                  );
                if (org.role !== "owner" || preparingLogo || savingCompany) return;
                const settings = {
                  ...org.settings,
                  contact: f.get("contact"),
                  address: f.get("address"),
                  hide_orders: f.get("hide_orders") === "on",
                  marketing_consent: f.get("marketing") === "on",
                  document_terms: f.get("terms"),
                  logo: currentLogo || null,
                };
                if (JSON.stringify(settings).length > 19500) {
                  throw new Error("As preferências excedem o limite. Reduza o texto das condições comerciais ou troque o logotipo.");
                }
                setSavingCompany(true);
                try {
                  await rpc("update_settings", {
                    p_org: org.id,
                    p_name: f.get("name"),
                    p_settings: settings,
                  });
                } finally {
                  setSavingCompany(false);
                }
              });
            }}
          >
            <label>
              Empresa
              <input name="name" required defaultValue={org.name} />
            </label>
            <label>
              Contato
              <input name="contact" defaultValue={org.settings.contact || ""} />
            </label>
            <label>
              Endereço
              <input name="address" defaultValue={org.settings.address || ""} />
            </label>
            <fieldset disabled={demo || org.role !== "owner" || preparingLogo || savingCompany}>
              <legend>Logotipo da empresa</legend>
              {currentLogo && (
                <img src={currentLogo} alt="Prévia do logotipo" style={{ maxWidth: 180, maxHeight: 80, objectFit: "contain", background: "#fff" }} />
              )}
              <label>
                Selecionar logotipo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = "";
                    if (!file) return;
                    setPreparingLogo(true);
                    try {
                      setLogoDraft(await prepareCompanyLogo(file));
                    } catch (error) {
                      notify(error instanceof Error ? error.message : "Não foi possível ler a imagem.");
                    } finally {
                      setPreparingLogo(false);
                    }
                  }}
                />
              </label>
              <p className="hint">
                PNG, JPG ou WebP de até 5 MB. Salve as preferências para aplicar o logotipo ao sistema e aos documentos.
              </p>
              {currentLogo && <button type="button" onClick={() => setLogoDraft(null)}>Remover logotipo</button>}
            </fieldset>
            <label>
              Modelo de condições comerciais
              <textarea
                name="terms"
                rows={4}
                defaultValue={org.settings.document_terms || ""}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="hide_orders"
                defaultChecked={org.settings.hide_orders}
              />{" "}
              Ocultar ordens de serviço no menu
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="marketing"
                defaultChecked={org.settings.marketing_consent}
              />{" "}
              Permitir medição de conversões de assinatura
            </label>
            <button className="primary" disabled={demo || org.role !== "owner" || preparingLogo || savingCompany}>
              {preparingLogo ? "Preparando imagem..." : savingCompany ? "Salvando..." : "Salvar preferências"}
            </button>
          </form>
        </section>
        <section className="panel">
          <h3>Segurança da conta</h3>
          <p>
            Reforce o acesso com um aplicativo autenticador. O painel global
            exige MFA.
          </p>
          <button
            onClick={() =>
              run(async () => {
                if (!supabase || demo)
                  throw new Error("Disponível apenas em contas reais.");
                const { data, error } = await supabase.auth.mfa.enroll({
                  factorType: "totp",
                  friendlyName: "MD Flux " + Date.now(),
                });
                if (error) throw error;
                setFactor(data);
              })
            }
          >
            Configurar autenticação em duas etapas
          </button>
          {factor && (
            <>
              <img
                className="qr"
                src={factor.totp.qr_code}
                alt="QR para aplicativo autenticador"
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const code = String(
                    new FormData(e.currentTarget).get("code"),
                  );
                  run(async () => {
                    const r = await supabase!.auth.mfa.challengeAndVerify({
                      factorId: factor.id,
                      code,
                    });
                    if (r.error) throw r.error;
                    setFactor(null);
                  });
                }}
              >
                <label>
                  Código do aplicativo
                  <input name="code" pattern="[0-9]{6}" required />
                </label>
                <button className="primary">Confirmar MFA</button>
              </form>
            </>
          )}
          <hr />
          <h3>Privacidade e retenção</h3>
          <p>
            Dados elegíveis de teste são mantidos por 7 dias após a expiração.
            Registros financeiros, contratos aceitos e pagamentos passam por
            análise de retenção.
          </p>
          <button
            onClick={() =>
              run(async () => {
                if (demo)
                  throw new Error("A demonstração é apagada ao fechar a aba.");
                await rpc("request_deletion", { p_org: org.id });
              })
            }
          >
            Solicitar exclusão dos dados
          </button>
          <p>
            <a href={wa} target="_blank" rel="noreferrer">
              Canal de acesso, pagamentos e privacidade
            </a>
          </p>
        </section>
      </div>
      <section className="panel">
        <h3>Equipe e permissões</h3>
        <p>
          Seu plano permite até {plans[org.subscription.plan].users} usuário(s).
          Convites são enviados por e-mail.
        </p>
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              if (demo)
                throw new Error(
                  "Convites externos estão desativados na demonstração.",
                );
              await endpoint("invite", {
                org: org.id,
                email: f.get("email"),
                role: f.get("role"),
              });
            });
          }}
        >
          <input
            required
            name="email"
            type="email"
            placeholder="E-mail do novo usuário"
            aria-label="E-mail para convite"
          />
          <select name="role" aria-label="Perfil">
            {["manager", "finance", "operator", "viewer"].map((r) => (
              <option key={r} value={r}>
                {labels[r]}
              </option>
            ))}
          </select>
          <button className="primary" disabled={org.role !== "owner"}>
            Convidar usuário
          </button>
        </form>
        {members.map((m) => (
          <div className="stat-row" key={m.user_id}>
            <span>
              {m.user_id.slice(0, 8)} · {labels[m.role]} ·{" "}
              {m.active ? "Ativo" : "Inativo"}
            </span>
            {m.role !== "owner" && (
              <button
                onClick={() =>
                  run(() =>
                    rpc("manage_member", {
                      p_org: org.id,
                      p_user: m.user_id,
                      p_role: m.role,
                      p_active: !m.active,
                    }),
                  )
                }
              >
                {m.active ? "Desativar" : "Ativar"}
              </button>
            )}
          </div>
        ))}
      </section>
      {org.subscription.plan === "empresarial" && (
        <section className="panel">
          <h3>Auditoria da empresa</h3>
          {audit.length ? (
            audit.map((a) => (
              <div className="stat-row" key={a.id}>
                <span>{a.action}</span>
                <small>{new Date(a.created_at).toLocaleString("pt-BR")}</small>
              </div>
            ))
          ) : (
            <p>As alterações da sua empresa aparecerão aqui.</p>
          )}
        </section>
      )}
    </>
  );
}
function Admin() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [factors, setFactors] = useState<any[]>([]);
  async function load() {
    try {
      setData(await endpoint("admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      const r = await supabase?.auth.mfa.listFactors();
      setFactors(r?.data?.totp || []);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function action(b: any) {
    try {
      await endpoint("admin", b);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="admin-page">
      <Logo />
      <button onClick={() => go("/app/settings")}>
        Voltar à conta / configurar MFA
      </button>
      <h1>Administração MD Flux</h1>
      {error && (
        <p className="error">
          {error} O painel exige administrador cadastrado no banco e sessão MFA.
        </p>
      )}
      {factors.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await supabase!.auth.mfa.challengeAndVerify({
              factorId: factors[0].id,
              code: String(new FormData(e.currentTarget).get("code")),
            });
            if (r.error) setError(r.error.message);
            else load();
          }}
        >
          <label>
            Código MFA
            <input name="code" required pattern="[0-9]{6}" />
          </label>
          <button>Verificar</button>
        </form>
      )}
      {data && (
        <>
          <div className="metric-grid">
            {[
              ["Empresas", data.orgs.length],
              [
                "Assinaturas ativas",
                data.subscriptions.filter(
                  (s: any) =>
                    !data.exempt_org_ids.includes(s.org_id) &&
                    access(s, Date.parse(data.server_now)) &&
                    s.status !== "trialing",
                ).length,
              ],
              [
                "Mensalidade dos acessos vigentes",
                money(
                  data.subscriptions
                    .filter(
                      (s: any) =>
                        !data.exempt_org_ids.includes(s.org_id) &&
                        s.status === "active" &&
                        access(s, Date.parse(data.server_now)),
                    )
                    .reduce(
                      (n: number, s: any) =>
                        n + plans[s.plan as keyof typeof plans].price,
                      0,
                    ),
                ),
              ],
              [
                "Receita aprovada",
                money(
                  data.payments
                    .filter((p: any) => p.status === "approved")
                    .reduce((n: number, p: any) => n + Number(p.amount), 0),
                ),
              ],
            ].map(([l, v]) => (
              <article className="metric" key={l}>
                <span>{l}</span>
                <strong>{v}</strong>
              </article>
            ))}
          </div>
          <AdminCustomers data={data} />
          <section className="panel">
            <h3>Usuários e atividade aproximada</h3>
            <input
              aria-label="Pesquisar usuários"
              placeholder="Pesquisar nome ou e-mail…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {data.users
              .filter((u: any) =>
                `${u.email} ${u.first_name} ${u.last_name}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((u: any) => {
                const a = data.activity.find((a: any) => a.user_id === u.id);
                const active =
                  a && Date.now() - Date.parse(a.last_seen) < 120000;
                return (
                  <div className="stat-row" key={u.id}>
                    <div>
                      <b>
                        {u.first_name} {u.last_name}
                      </b>
                      <small>
                        {u.email} ·{" "}
                        {active
                          ? "Ativo recentemente"
                          : a
                            ? "Última atividade: " +
                              new Date(a.last_seen).toLocaleString("pt-BR")
                            : "Sem atividade observada"}
                      </small>
                      <small>
                        Último login:{" "}
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                          : "Não registrado"}{" "}
                        · Uso aproximado:{" "}
                        {Math.round((a?.active_seconds || 0) / 60)} min
                      </small>
                    </div>
                    <button
                      onClick={() =>
                        action({ action: "reset_password", user: u.id })
                      }
                    >
                      Enviar redefinição
                    </button>
                  </div>
                );
              })}
            <p className="hint">
              Presença e tempo são estimativas; ausência de sinal não comprova
              logout.
            </p>
            <h3>Empresas e assinaturas</h3>
            {data.orgs.map((o: any) => {
              const s = data.subscriptions.find((s: any) => s.org_id === o.id);
              return (
                <div className="stat-row" key={o.id}>
                  <div>
                    <b>{o.name}</b>
                    <small>
                      {s?.plan} · {labels[s?.status] || s?.status}
                    </small>
                  </div>
                  <button
                    onClick={() =>
                      action({
                        action: "suspend",
                        org: o.id,
                        suspended: !s.suspended,
                      })
                    }
                  >
                    {s.suspended ? "Reativar" : "Suspender"}
                  </button>
                  <button
                    onClick={() => action({ action: "extend", org: o.id })}
                  >
                    Conceder 72h de teste
                  </button>
                  <select
                    aria-label={"Plano de " + o.name}
                    value={s?.plan}
                    onChange={(e) =>
                      action({
                        action: "set_plan",
                        org: o.id,
                        plan: e.target.value,
                      })
                    }
                  >
                    {Object.entries(plans).map(([k, p]) => (
                      <option key={k} value={k}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </section>
          <section className="panel">
            <h3>Chamados</h3>
            {data.tickets.map((t: any) => (
              <div className="ticket-admin" key={t.id}>
                <h4>{t.name}</h4>
                <p>{t.data.description}</p>
                {t.data.messages?.map((m: any, i: number) => (
                  <p key={i}>
                    <b>{m.by}:</b> {m.text}
                  </p>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    action({
                      action: "ticket",
                      org: t.org_id,
                      id: t.id,
                      message: f.get("message"),
                      status: f.get("status"),
                    });
                  }}
                >
                  <input
                    required
                    name="message"
                    placeholder="Responder chamado"
                  />
                  <select name="status">
                    {modules.ticket.statuses.map((s) => (
                      <option value={s} key={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                  <button>Enviar resposta</button>
                </form>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3>Eventos administrativos</h3>
            {data.audit.map((a: any) => (
              <div className="stat-row" key={a.id}>
                <span>{a.action}</span>
                <small>{new Date(a.created_at).toLocaleString("pt-BR")}</small>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
function Workspace({ demo, path }: { demo: boolean; path: string }) {
  const [org, setOrg] = useState<Org | null>(demo ? demoOrg : null),
    [orgs, setOrgs] = useState<Org[]>([]),
    [rows, setRows] = useState<Row[]>(() =>
      demo
        ? JSON.parse(sessionStorage.getItem("mdflux:demo") || "null") ||
          demoRows()
        : [],
    ),
    [user, setUser] = useState<any>(null),
    [admin, setAdmin] = useState(false),
    [busy, setBusy] = useState(!demo),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [nav, setNav] = useState(false),
    [editor, setEditor] = useState<{ kind: Kind; row?: Partial<Row> } | null>(
      null,
    ),
    [detail, setDetail] = useState<Row | null>(null),
    [serverDelta, setServerDelta] = useState(0),
    [tick, setTick] = useState(Date.now()),
    [reportFrom, setReportFrom] = useState(""),
    [reportTo, setReportTo] = useState("");
  const page = demo
    ? path.split("/")[2] || "dashboard"
    : path.split("/")[2] || "dashboard";
  const base = demo ? "/demo" : "/app";
  function notify(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 5500);
  }
  async function reload() {
    if (demo) return;
    setBusy(true);
    try {
      const { data } = await supabase!.auth.getSession();
      if (!data.session) {
        go("/auth");
        return;
      }
      setUser(data.session.user);
      const c = await rpc("account_context");
      setServerDelta(Date.parse(c.server_now) - Date.now());
      setOrgs(c.organizations);
      const current =
        c.organizations.find(
          (o: Org) => o.id === sessionStorage.getItem("mdflux:org"),
        ) || c.organizations[0];
      if (!current)
        throw new Error("Nenhuma empresa disponível para esta conta.");
      setOrg(current);
      setAdmin(c.admin || c.platform_owner);
      setRows(await loadRows(current.id));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!demo) {
      if (!configured) {
        go("/auth");
        return;
      }
      reload();
    }
  }, [demo]);
  useEffect(() => {
    if (demo) sessionStorage.setItem("mdflux:demo", JSON.stringify(rows));
  }, [demo, rows]);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    setDetail(null);
    setNav(false);
  }, [path]);
  useEffect(() => {
    if (demo || !org) return;
    const beat = () => {
      if (document.visibilityState === "visible")
        rpc("heartbeat", { p_org: org.id }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 60000);
    return () => clearInterval(timer);
  }, [demo, org?.id]);
  if (!org)
    return (
      <div className="loading">
        {error || "Carregando sua empresa…"}
        <button onClick={reload}>Tentar novamente</button>
      </div>
    );
  const allowed = demo || access(org.subscription, tick + serverDelta);
  const expired = !allowed && !["plans", "settings", "ticket"].includes(page);
  const title =
    page === "dashboard"
      ? "Visão geral"
      : modules[page as Kind]?.name ||
        (
          {
            reports: "Relatórios",
            plans: "Minha assinatura",
            settings: "Configurações",
          } as any
        )[page] ||
        "Visão geral";
  function navigate(p: string) {
    go(base + "/" + p);
  }
  function create(k: Kind, r?: Partial<Row>) {
    if (!canWrite(org!, k)) {
      notify("Seu perfil não permite esta ação.");
      return;
    }
    setEditor({
      kind: k,
      row: r || { data: { terms: org?.settings.document_terms || "" } },
    });
  }
  async function persist(r: Partial<Row>) {
    if (!org) return;
    const months = Number(r.data?.recurrence_months || 0);
    if (demo) {
      const next = {
        ...r,
        id: r.id || crypto.randomUUID(),
        org_id: "demo",
        version: (r.version || 0) + 1,
        created_at: r.created_at || new Date().toISOString(),
      } as Row;
      if (r.kind === "product") {
        const delta = Number(r.data?.stock_delta || 0);
        next.data = {
          ...r.data,
          stock: Number(r.data?.stock || 0) + delta,
          stock_delta: 0,
          movements: [
            ...(r.data?.movements || []),
            ...(delta ? [{ delta, at: new Date().toISOString() }] : []),
          ],
        };
      }
      setRows((a) => [next, ...a.filter((x) => x.id !== next.id)]);
    } else {
      await save(r, org.id);
      await reload();
    }
    notify("Registro salvo.");
    if (!r.id && months && ["income", "expense"].includes(r.kind || "")) {
      for (let i = 1; i <= months; i++) {
        const date = new Date((r.due_date || today()) + "T12:00:00");
        const day = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + i);
        date.setDate(
          Math.min(
            day,
            new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
          ),
        );
        const next = {
          ...r,
          id: undefined,
          name: r.name + ` · Parcela ${i + 1}`,
          paid: 0,
          status: "pending",
          due_date: date.toISOString().slice(0, 10),
          data: { ...r.data, settlements: [], recurrence_months: 0 },
        };
        if (demo)
          setRows((a) => [
            {
              ...next,
              id: crypto.randomUUID(),
              org_id: "demo",
              version: 1,
              created_at: new Date().toISOString(),
            } as Row,
            ...a,
          ]);
        else await save(next, org.id);
      }
      if (!demo) await reload();
      notify("Lançamento e parcelas futuras salvos.");
    }
  }
  async function archive(r: Row) {
    if (!confirm("Arquivar “" + r.name + "”? O histórico será mantido."))
      return;
    try {
      if (demo) setRows((a) => a.filter((x) => x.id !== r.id));
      else {
        await rpc("archive_record", { p_id: r.id, p_version: r.version });
        await reload();
      }
      notify("Registro arquivado.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function choose(plan: string) {
    if (demo) {
      go("/auth?signup=1&plan=" + plan);
      return;
    }
    try {
      track("InitiateCheckout", { plan });
      const r = await endpoint("checkout", { org: org!.id, plan });
      location.assign(r.url);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function share(r: Row) {
    if (demo) {
      notify(
        "Links públicos ficam disponíveis na conta real. A demonstração permite exportar PDF.",
      );
      return;
    }
    try {
      const b = await endpoint("documents", { org: org!.id, id: r.id });
      await navigator.clipboard.writeText(b.url);
      notify("Link seguro copiado. Válido por 7 dias.");
      window.open(
        wa + "?text=" + encodeURIComponent("Olá! Veja o documento: " + b.url),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const moduleKeys = (Object.keys(modules) as Kind[]).filter(
    (k) =>
      (k !== "order" ||
        (!org.settings.hide_orders && org.subscription.plan !== "essencial")) &&
      (org.role !== "finance" ||
        ["client", "supplier", "income", "expense", "ticket"].includes(k)) &&
      (org.role !== "operator" ||
        ["client", "quote", "proposal", "order", "product", "ticket"].includes(
          k,
        )),
  );
  const reportRows = rows.filter(
    (r) =>
      (!reportFrom ||
        String(r.due_date || r.created_at.slice(0, 10)) >= reportFrom) &&
      (!reportTo ||
        String(r.due_date || r.created_at.slice(0, 10)) <= reportTo),
  );
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (nav ? "shown" : "")}>
        <Logo image={companyLogo(org.settings.logo)} name={org.name} />
        <button className="company-switch" onClick={() => navigate("settings")}>
          <span className="company-avatar">{org.name[0]}</span>
          <span>
            {org.name}
            <small>
              {demo
                ? "Demonstração privada"
                : plans[org.subscription.plan].name}
            </small>
          </span>
        </button>
        <span className="nav-label">ESPAÇO DE TRABALHO</span>
        <button
          className={"nav-item " + (page === "dashboard" ? "selected" : "")}
          onClick={() => navigate("dashboard")}
        >
          <LayoutDashboard size={19} />
          Visão geral
        </button>
        {["Comercial", "Relacionamento", "Financeiro", "Operação"].map(
          (group) => (
            <React.Fragment key={group}>
              <span className="nav-label">{group.toUpperCase()}</span>
              {moduleKeys
                .filter((k) => modules[k].group === group)
                .map((k) => {
                  const Icon = icons[k];
                  return (
                    <button
                      key={k}
                      className={"nav-item " + (page === k ? "selected" : "")}
                      onClick={() => navigate(k)}
                    >
                      <Icon size={18} />
                      {modules[k].name}
                    </button>
                  );
                })}
            </React.Fragment>
          ),
        )}
        <span className="nav-label">SUA CONTA</span>
        {["reports", "ticket", "plans", "settings"].map((k) => {
          const Icon = icons[k];
          return (
            <button
              className={"nav-item " + (page === k ? "selected" : "")}
              key={k}
              onClick={() => navigate(k)}
            >
              <Icon size={18} />
              {
                (
                  {
                    reports: "Relatórios",
                    ticket: "Suporte",
                    plans: "Minha assinatura",
                    settings: "Configurações",
                  } as any
                )[k]
              }
            </button>
          );
        })}
        {admin && (
          <button className="nav-item" onClick={() => go("/admin")}>
            <ShieldCheck size={18} />
            Administração global
          </button>
        )}
        <div className="sidebar-bottom">
          <span className="avatar">
            {demo ? "D" : (user?.user_metadata.first_name || "U")[0]}
          </span>
          <div>
            <b>
              {demo
                ? "Visitante"
                : user?.user_metadata.first_name || "Minha conta"}
            </b>
            <small>{labels[org.role]}</small>
          </div>
          <button
            aria-label="Sair"
            onClick={async () => {
              if (demo) {
                sessionStorage.removeItem("mdflux:demo");
                go("/");
              } else {
                await supabase?.auth.signOut();
                go("/auth");
              }
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {nav && <div className="nav-overlay" onClick={() => setNav(false)} />}
      <div className="app-main">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Abrir menu"
            onClick={() => setNav(!nav)}
          >
            <Menu />
          </button>
          <span>
            Meu espaço <ChevronRight size={14} /> <b>{title}</b>
          </span>
          <div>
            {orgs.length > 1 && (
              <select
                aria-label="Trocar empresa"
                value={org.id}
                onChange={(e) => {
                  sessionStorage.setItem("mdflux:org", e.target.value);
                  reload();
                }}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            <span className="online">
              <i /> {demo ? "Modo demonstração" : "Conexão protegida"}
            </span>
            <button
              aria-label="Atualizar dados"
              onClick={() =>
                demo ? notify("Dados disponíveis nesta aba.") : reload()
              }
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {demo ? (
          <div className="demo-banner">
            <span>Dados fictícios · Alterações ficam somente nesta aba.</span>
            <div>
              <button
                onClick={() => {
                  setRows(demoRows());
                  notify("Demonstração reiniciada.");
                }}
              >
                Reiniciar
              </button>
              <button onClick={() => go("/auth?signup=1")}>
                Criar minha conta grátis <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          org.subscription.status === "trialing" && (
            <div className="trial-banner">
              <Clock size={16} />
              <span>
                Seu teste termina em{" "}
                {Math.max(
                  0,
                  Math.floor(
                    (Date.parse(org.subscription.trial_end) -
                      tick -
                      serverDelta) /
                      86400000,
                  ),
                )}{" "}
                dias e{" "}
                {Math.max(
                  0,
                  Math.floor(
                    (Date.parse(org.subscription.trial_end) -
                      tick -
                      serverDelta) /
                      3600000,
                  ) % 24,
                )}{" "}
                horas.
              </span>
              <button onClick={() => navigate("plans")}>
                Conhecer planos <ChevronRight size={14} />
              </button>
            </div>
          )
        )}
        <main className="workspace">
          {busy && (
            <p className="notice" role="status">
              Atualizando dados…
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {expired ? (
            <section className="expired panel">
              <Clock size={44} />
              <span className="eyebrow">CONTINUE DE ONDE PAROU</span>
              <h1>Seu teste gratuito chegou ao fim.</h1>
              <p>
                Clientes, documentos, serviços e finanças organizados em um só
                lugar. Escolha um plano para continuar.
              </p>
              <button
                className="primary large"
                onClick={() => navigate("plans")}
              >
                Quero continuar usando o MD Flux
              </button>
              <p className="hint">
                Dados elegíveis mantidos até{" "}
                {new Date(org.subscription.purge_after).toLocaleString("pt-BR")}
                . Depois desse prazo, seguem a política de retenção e exclusão.
              </p>
            </section>
          ) : page === "plans" ? (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">SEU PRÓXIMO PASSO</span>
                  <h1>Mais organização. Todos os dias.</h1>
                  <p>
                    Atual: {plans[org.subscription.plan].name} ·{" "}
                    {labels[org.subscription.status] || org.subscription.status}
                    . O acesso pago é liberado após confirmação do pagamento.
                  </p>
                </div>
              </div>
              <Plans choose={choose} />
              {!demo && org.subscription.paid_until && (
                <section className="panel">
                  <h3>Sua assinatura</h3>
                  <p>
                    Acesso pago até{" "}
                    {new Date(org.subscription.paid_until).toLocaleString(
                      "pt-BR",
                    )}
                    . Reduções de plano exigem ajustar a equipe ao limite e não
                    apagam registros.
                  </p>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          "Cancelar a renovação? O período já pago será preservado.",
                        )
                      )
                        return;
                      try {
                        await endpoint("billing", {
                          org: org.id,
                          action: "cancel",
                        });
                        reload();
                        notify("Renovação cancelada.");
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Cancelar renovação
                  </button>
                </section>
              )}
            </>
          ) : page === "settings" ? (
            <SettingsPage
              key={org.id}
              org={org}
              rows={rows}
              demo={demo}
              reload={reload}
              notify={notify}
            />
          ) : page === "reports" ? (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">DADOS PARA DECIDIR</span>
                  <h1>Relatórios</h1>
                  <p>Exporte os registros autorizados ao seu perfil.</p>
                </div>
              </div>
              <section className="panel">
                <div className="toolbar">
                  <label>
                    De
                    <input
                      type="date"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Até
                    <input
                      type="date"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                    />
                  </label>
                  <button onClick={() => exportCSV(reportRows)}>
                    Exportar CSV
                  </button>
                  <button
                    onClick={() =>
                      exportXLSX(reportRows).catch((e) => notify(e.message))
                    }
                  >
                    Exportar XLSX
                  </button>
                  <button
                    className="primary"
                    onClick={() =>
                      pdf(reportRows, org).catch((e) => notify(e.message))
                    }
                  >
                    PDF A4
                  </button>
                </div>
                <p className="hint">
                  Filtro por vencimento ou data de criação. O dashboard usa as
                  datas das baixas para caixa realizado.
                </p>
              </section>
              <Dashboard
                rows={reportRows}
                org={org}
                create={(k) => create(k)}
              />
            </>
          ) : modules[page as Kind] ? (
            <Records
              key={page}
              kind={page as Kind}
              rows={rows}
              org={org}
              edit={(r) => create(page as Kind, r)}
              detail={setDetail}
              archive={archive}
            />
          ) : (
            <>
              {!demo && ["owner", "manager", "finance", "viewer"].includes(org.role) && <FinancialAlerts rows={rows} />}
              <Dashboard rows={rows} org={org} create={(k) => create(k)} />
            </>
          )}
        </main>
      </div>
      {!demo && allowed && <Intelligence key={org.id} org={org} reload={reload} page={title} records={rows} />}
      {editor && (
        <Editor
          kind={editor.kind}
          row={editor.row}
          rows={rows}
          org={org}
          demo={demo}
          onSave={persist}
          onClose={() => setEditor(null)}
        />
      )}{" "}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="modal detail"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do registro"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">
                  {modules[detail.kind].single} · {detail.id.slice(0, 8)}
                </span>
                <h2>{detail.name}</h2>
              </div>
              <button
                aria-label="Fechar detalhes"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
            </header>
            <span className={"badge " + detail.status}>
              {labels[detail.status]}
            </span>
            <h2>{money(detail.amount)}</h2>
            {detail.data.client_id && (
              <p>
                Cliente:{" "}
                {rows.find((r) => r.id === detail.data.client_id)?.name}
              </p>
            )}
            {[
              "scope",
              "terms",
              "notes",
              "description",
              "address",
              "responsible",
              "scheduled",
              "checklist",
              "confirmation",
            ]
              .filter((k) => detail.data[k])
              .map((k) => (
                <p className="pre" key={k}>
                  {detail.data[k]}
                </p>
              ))}
            {detail.data.items?.map((i: any, n: number) => (
              <div className="stat-row" key={n}>
                <span>
                  {i.qty} × {i.name}
                </span>
                <b>{money(i.qty * i.price)}</b>
              </div>
            ))}
            {detail.kind === "client" && (
              <>
                <h3>Histórico do cliente</h3>
                {rows
                  .filter((r) => r.data.client_id === detail.id)
                  .map((r) => (
                    <button
                      className="history-row"
                      key={r.id}
                      onClick={() => setDetail(r)}
                    >
                      {modules[r.kind].single} · {r.name} · {money(r.amount)}
                    </button>
                  ))}
              </>
            )}
            {detail.data.attachments?.map((a: any) => (
              <button
                key={a.path}
                onClick={async () => {
                  const r = await supabase?.storage
                    .from("tenant-files")
                    .createSignedUrl(a.path, 60);
                  if (r?.data)
                    window.open(
                      r.data.signedUrl,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  else notify("Não foi possível abrir o arquivo.");
                }}
              >
                {a.name}
              </button>
            ))}
            {detail.data.messages?.map((m: any, i: number) => (
              <div className="soft-callout" key={i}>
                <p>
                  <b>{m.by}</b>
                  <br />
                  {m.text}
                </p>
              </div>
            ))}
            {detail.kind === "ticket" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget),
                    next = {
                      ...detail,
                      data: {
                        ...detail.data,
                        messages: [
                          ...(detail.data.messages || []),
                          {
                            text: f.get("message"),
                            by: "Cliente",
                            at: new Date().toISOString(),
                          },
                        ],
                      },
                    };
                  try {
                    await persist(next);
                    setDetail(next);
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <label>
                  Mensagem
                  <input required name="message" maxLength={5000} />
                </label>
                <button>Adicionar mensagem</button>
              </form>
            )}
            <div className="actions wrap">
              {documentKinds.includes(detail.kind) && (
                <>
                  <button
                    onClick={() =>
                      pdf([detail], org, true).catch((e) => notify(e.message))
                    }
                  >
                    <Download size={16} /> PDF A4
                  </button>
                  <button onClick={() => share(detail)}>
                    <ExternalLink size={16} /> Compartilhar link
                  </button>
                  {!demo && (
                    <button
                      onClick={async () => {
                        try {
                          await endpoint("documents", {
                            action: "revoke",
                            org: org.id,
                            id: detail.id,
                          });
                          notify("Links revogados.");
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      Revogar links
                    </button>
                  )}
                </>
              )}
              {canWrite(org, detail.kind) && (
                <button
                  onClick={() => {
                    create(detail.kind, detail);
                    setDetail(null);
                  }}
                >
                  Editar
                </button>
              )}
              {detail.kind === "quote" && detail.status === "approved" && (
                <button
                  onClick={() => {
                    create("order", {
                      name: detail.name,
                      status: "open",
                      amount: detail.amount,
                      data: { ...detail.data, source_id: detail.id },
                    });
                    setDetail(null);
                  }}
                >
                  Gerar OS
                </button>
              )}
              {detail.kind === "quote" && (
                <button
                  onClick={() => {
                    create("proposal", {
                      name: detail.name,
                      status: "draft",
                      amount: detail.amount,
                      data: { ...detail.data, source_id: detail.id },
                    });
                    setDetail(null);
                  }}
                >
                  Gerar proposta
                </button>
              )}
              {detail.kind === "proposal" && detail.status === "approved" && (
                <button
                  onClick={() => {
                    create("contract", {
                      name: detail.name,
                      status: "draft",
                      amount: detail.amount,
                      data: { ...detail.data, source_id: detail.id },
                    });
                    setDetail(null);
                  }}
                >
                  Gerar contrato
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
function PublicDocument() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const token = new URLSearchParams(location.search).get("token") || "";
  useEffect(() => {
    fetch("/.netlify/functions/documents?token=" + encodeURIComponent(token))
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setData(b);
      })
      .catch((e) => setError(e.message));
  }, [token, done]);
  return (
    <main className="public-document">
      <Logo image={companyLogo(data?.snapshot.company.logo)} name={data?.snapshot.company.name} />
      {error && <p className="error">{error}</p>}
      {data && (
        <section className="panel">
          <span className="eyebrow">{data.snapshot.company.name}</span>
          <h1>{data.snapshot.name}</h1>
          {data.snapshot.client && (
            <p>Preparado para {data.snapshot.client.name}</p>
          )}
          <p className="pre">{data.snapshot.data.scope}</p>
          {data.snapshot.data.items?.map((i: any, n: number) => (
            <div className="stat-row" key={n}>
              <span>
                {i.qty} × {i.name}
              </span>
              <b>{money(i.price * i.qty)}</b>
            </div>
          ))}
          <h2>{money(data.snapshot.amount)}</h2>
          <p className="pre">{data.snapshot.data.terms}</p>
          <p className="pre">{data.snapshot.data.notes}</p>
          <p className="digest">Integridade SHA-256: {data.digest}</p>
          {data.accepted ? (
            <p className="success">
              {labels[data.accepted.decision]} por {data.accepted.signer} em{" "}
              {new Date(data.accepted.created_at).toLocaleString("pt-BR")}.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await endpoint("documents", {
                    action: "respond",
                    token,
                    signer: f.get("signer"),
                    decision: f.get("decision"),
                    consent: true,
                  });
                  setDone(true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                Nome de quem responde
                <input required name="signer" minLength={3} maxLength={200} />
              </label>
              <label>
                Resposta
                <select name="decision">
                  <option value="approved">Aprovar / aceitar</option>
                  <option value="declined">Recusar</option>
                </select>
              </label>
              <label className="check">
                <input type="checkbox" required /> Li este documento e confirmo
                minha resposta. O aceite e evidências técnicas serão
                registrados.
              </label>
              <button className="primary">Confirmar resposta</button>
            </form>
          )}
          <p className="hint">
            Aceite eletrônico simples. Não utiliza certificado digital ou
            verificação de identidade avançada.
          </p>
        </section>
      )}
    </main>
  );
}
function Legal({ terms }: { terms: boolean }) {
  return (
    <main className="legal">
      <Logo />
      <h1>{terms ? "Termos de uso" : "Política de privacidade e retenção"}</h1>
      <p className="notice">
        Documento operacional inicial. Antes da comercialização, o responsável
        pelo MD Flux deve revisar, identificar o controlador e preencher os
        canais e prazos legais aplicáveis.
      </p>
      {terms ? (
        <>
          <h2>Uso e contratação</h2>
          <p>
            O MD Flux oferece gestão de clientes, documentos, serviços e
            finanças. O cadastro inicia um teste de 72 horas, sem cartão.
            Depois, operações exigem uma assinatura elegível. O plano Essencial
            permite 1 usuário, Profissional 3 e Empresarial 10.
          </p>
          <h2>Assinatura e cancelamento</h2>
          <p>
            A cobrança mensal é processada pelo Mercado Pago. A liberação
            depende de confirmação no servidor. Você pode cancelar a renovação
            na conta; o período já pago é preservado. A mudança de plano exige
            adequar a equipe ao novo limite e não apaga registros. Valores
            comerciais: R$ 69,90, R$ 99,90 e R$ 129,90 ao mês.
          </p>
          <h2>Documentos e responsabilidades</h2>
          <p>
            Revise os dados e condições dos documentos antes do envio. O aceite
            simples registra resposta e integridade, sem substituir soluções de
            assinatura avançada ou qualificada quando necessárias. O sistema não
            substitui aconselhamento contábil ou jurídico.
          </p>
          <h2>Disponibilidade</h2>
          <p>
            Manutenções e falhas podem ocorrer. Sistemas personalizados são
            contratados separadamente. O usuário deve manter seus dados de
            acesso protegidos e não inserir dados reais na demonstração pública.
          </p>
        </>
      ) : (
        <>
          <h2>Dados tratados</h2>
          <p>
            Tratamos nome, e-mail, associação à empresa, cadastros comerciais,
            documentos, dados financeiros e registros mínimos de segurança para
            prestar o serviço. Senhas são gerenciadas pelo Supabase Auth. Dados
            completos de cartão e CVV não são armazenados pelo MD Flux. O
            telefone informado opcionalmente no cadastro é usado para contato
            sobre o MD Flux, suporte e assinatura, inclusive por WhatsApp.
          </p>
          <h2>Provedores e medição</h2>
          <p>
            Supabase armazena dados e arquivos; Netlify hospeda a aplicação;
            Mercado Pago processa cobranças. A medição Meta é opcional e depende
            de consentimento. Você pode revogar a medição no rodapé do site e
            nas configurações da empresa.
          </p>
          <h2>Retenção e exclusão</h2>
          <p>
            O teste dura 72 horas; seus dados elegíveis são mantidos por mais 7
            dias. A rotina de exclusão preserva registros financeiros,
            pagamentos, auditoria e documentos com aceite para análise de
            obrigações aplicáveis. Pagamentos pendentes impedem eliminação
            automática. Solicitações de exclusão são registradas e passam por
            revisão. Backups seguem os prazos do provedor e não têm eliminação
            imediata garantida.
          </p>
          <h2>Seus direitos</h2>
          <p>
            Solicite acesso, correção, exportação ou exclusão nas configurações
            e pelo canal de privacidade. Solicitações são verificadas para
            proteger sua identidade. O prazo legal e os dados do controlador
            devem ser formalizados antes do lançamento.
          </p>
        </>
      )}
      <a href={wa} target="_blank" rel="noreferrer">
        Falar com o responsável
      </a>
      <p>
        <button onClick={() => go("/")}>Voltar ao site</button>
      </p>
    </main>
  );
}
function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    if (localStorage.getItem("mdflux:consent") === "yes") consent(true);
    return () => window.removeEventListener("popstate", on);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  if (path.startsWith("/document")) return <PublicDocument />;
  if (path === "/admin") return <Admin />;
  if (path === "/terms" || path === "/privacy")
    return <Legal terms={path === "/terms"} />;
  if (path === "/auth") return <Auth />;
  if (path.startsWith("/demo"))
    return <Workspace key="demo" demo path={path} />;
  if (path.startsWith("/app"))
    return <Workspace key="real" demo={false} path={path} />;
  return <Landing />;
}
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="legal">
        <h1>Não foi possível abrir esta tela.</h1>
        <p>Atualize a página. Se persistir, entre em contato com o suporte.</p>
        <button onClick={() => location.assign("/")}>Voltar ao início</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
