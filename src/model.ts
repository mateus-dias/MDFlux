export type Kind =
  | "client"
  | "supplier"
  | "quote"
  | "proposal"
  | "contract"
  | "order"
  | "income"
  | "expense"
  | "product"
  | "ticket";
export type Row = {
  id: string;
  org_id: string;
  kind: Kind;
  name: string;
  status: string;
  amount: number;
  paid: number;
  due_date: string | null;
  data: Record<string, any>;
  version: number;
  created_at: string;
  archived?: boolean;
};
export type Org = {
  id: string;
  name: string;
  settings: Record<string, any>;
  role: string;
  subscription: {
    plan: "essencial" | "profissional" | "empresarial";
    status: string;
    trial_end: string;
    paid_until: string;
    suspended: boolean;
    purge_after: string;
  };
};
export const modules: Record<
  Kind,
  { name: string; single: string; group: string; statuses: string[] }
> = {
  client: {
    name: "Clientes",
    single: "Cliente",
    group: "Relacionamento",
    statuses: ["active", "inactive"],
  },
  supplier: {
    name: "Fornecedores",
    single: "Fornecedor",
    group: "Relacionamento",
    statuses: ["active", "inactive"],
  },
  quote: {
    name: "Orçamentos",
    single: "Orçamento",
    group: "Comercial",
    statuses: ["draft", "sent", "approved", "declined"],
  },
  proposal: {
    name: "Propostas",
    single: "Proposta",
    group: "Comercial",
    statuses: ["draft", "sent", "approved", "declined"],
  },
  contract: {
    name: "Contratos",
    single: "Contrato",
    group: "Comercial",
    statuses: ["draft", "sent", "approved", "canceled"],
  },
  order: {
    name: "Ordens de serviço",
    single: "Ordem de serviço",
    group: "Operação",
    statuses: [
      "open",
      "scheduled",
      "working",
      "waiting",
      "completed",
      "canceled",
    ],
  },
  income: {
    name: "Entradas e recebimentos",
    single: "Entrada",
    group: "Financeiro",
    statuses: ["pending", "partial", "paid"],
  },
  expense: {
    name: "Saídas e pagamentos",
    single: "Saída",
    group: "Financeiro",
    statuses: ["pending", "partial", "paid"],
  },
  product: {
    name: "Produtos e serviços",
    single: "Produto ou serviço",
    group: "Operação",
    statuses: ["active", "inactive"],
  },
  ticket: {
    name: "Suporte",
    single: "Chamado",
    group: "Conta",
    statuses: ["open", "analysis", "waiting", "resolved", "closed"],
  },
};
export const labels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  draft: "Rascunho",
  sent: "Enviado",
  approved: "Aprovado",
  declined: "Recusado",
  open: "Aberta",
  scheduled: "Agendada",
  working: "Em andamento",
  waiting: "Aguardando",
  completed: "Concluída",
  canceled: "Cancelado",
  pending: "Pendente",
  partial: "Parcial",
  paid: "Quitado",
  analysis: "Em análise",
  resolved: "Resolvido",
  closed: "Encerrado",
  trialing: "Em teste",
  trial_expired: "Teste encerrado",
  payment_pending: "Pagamento pendente",
  past_due: "Em atraso",
  expired: "Expirado",
  owner: "Titular",
  manager: "Gestor",
  operator: "Operacional",
  finance: "Financeiro",
  viewer: "Consulta",
};
export const documentKinds = ["quote", "proposal", "contract", "order"];
export function canWrite(org: Org, kind: Kind) {
  return (
    org.role !== "viewer" &&
    (["owner", "manager"].includes(org.role) ||
      (org.role === "finance" &&
        ["client", "supplier", "income", "expense", "ticket"].includes(kind)) ||
      (org.role === "operator" &&
        ["client", "quote", "proposal", "order", "product", "ticket"].includes(
          kind,
        )))
  );
}
