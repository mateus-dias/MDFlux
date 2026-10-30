import { createClient } from "@supabase/supabase-js";
import type { Row, Org, Kind } from "./model";
const env = (import.meta as any).env;
export const configured =
  !!env.VITE_SUPABASE_URL && !!env.VITE_SUPABASE_ANON_KEY;
export const supabase = configured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;
export async function rpc(name: string, args?: any) {
  if (!supabase)
    throw new Error(
      "Configure o Supabase para usar uma conta real. A demonstração está disponível.",
    );
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
export async function endpoint(name: string, data?: any) {
  const session = await supabase?.auth.getSession();
  const r = await fetch("/.netlify/functions/" + name, {
    method: data ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(session?.data.session
        ? { Authorization: "Bearer " + session.data.session.access_token }
        : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Não foi possível concluir");
  return body;
}
export async function loadRows(org: string) {
  if (!supabase) return [];
  let rows: Row[] = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("org_id", org)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
export async function save(row: Partial<Row>, org: string) {
  return rpc("save_record", {
    p_org: org,
    p_kind: row.kind,
    p_name: row.name,
    p_status: row.status,
    p_amount: row.amount || 0,
    p_paid: row.paid || 0,
    p_due: row.due_date || null,
    p_data: row.data || {},
    p_id: row.id || null,
    p_version: row.version || null,
  });
}
export const demoOrg: Org = {
  id: "demo",
  name: "Empresa Demonstração MD Flux",
  role: "owner",
  settings: {
    contact: "contato@exemplo.invalid",
    address: "Cidade Exemplo · Brasil",
  },
  subscription: {
    plan: "empresarial",
    status: "active",
    paid_until: "2099-01-01",
    trial_end: "2099-01-01",
    suspended: false,
    purge_after: "2099-01-01",
  },
};
export function demoRows(): Row[] {
  const base = (
    kind: Kind,
    name: string,
    amount = 0,
    data: any = {},
    status = "active",
    paid = 0,
  ): Row => ({
    id: crypto.randomUUID(),
    org_id: "demo",
    kind,
    name,
    amount,
    paid,
    data,
    status,
    due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    version: 1,
    created_at: new Date().toISOString(),
  });
  const c = base("client", "Cliente Exemplo — Oficina Horizonte", 0, {
    phone: "",
    email: "cliente@exemplo.invalid",
  });
  return [
    c,
    base("client", "Cliente Exemplo — Estúdio Aurora"),
    base("supplier", "Fornecedor Exemplo — Materiais Central"),
    base("product", "Instalação de equipamento", 350, {
      type: "service",
      unit: "serviço",
      cost: 120,
      stock: 0,
    }),
    base("product", "Cabo de conexão", 25, {
      type: "material",
      unit: "metro",
      cost: 12,
      stock: 40,
    }),
    base(
      "quote",
      "Instalação e revisão",
      1050,
      {
        client_id: c.id,
        items: [{ name: "Instalação", qty: 3, price: 350 }],
        scope: "Instalação de três equipamentos e testes de funcionamento.",
        terms: "50% na aprovação e 50% na conclusão.",
        discount: 0,
      },
      "sent",
    ),
    base(
      "proposal",
      "Manutenção preventiva",
      800,
      {
        client_id: c.id,
        scope: "Inspeção e manutenção preventiva.",
        items: [{ name: "Manutenção", qty: 1, price: 800 }],
      },
      "approved",
    ),
    base(
      "contract",
      "Contrato de manutenção",
      800,
      {
        client_id: c.id,
        scope: "Prestação de serviços de manutenção.",
        terms:
          "Execução mediante agendamento. Revisar condições antes de enviar.",
      },
      "draft",
    ),
    base(
      "order",
      "Revisão de equipamentos",
      480,
      {
        client_id: c.id,
        responsible: "Equipe de demonstração",
        priority: "Normal",
        address: "Local fictício",
        checklist: "Inspecionar equipamentos\nRealizar testes",
      },
      "working",
    ),
    base(
      "income",
      "Serviço recebido",
      4200,
      {
        client_id: c.id,
        settlements: [
          { amount: 4200, date: new Date().toISOString().slice(0, 10) },
        ],
      },
      "paid",
      4200,
    ),
    base(
      "income",
      "Manutenção a receber",
      1800,
      { client_id: c.id },
      "pending",
    ),
    base(
      "expense",
      "Materiais de instalação",
      920,
      {
        settlements: [
          { amount: 920, date: new Date().toISOString().slice(0, 10) },
        ],
      },
      "paid",
      920,
    ),
    base("expense", "Despesas operacionais", 380, {}, "pending"),
  ];
}
