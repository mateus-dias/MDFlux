import React, { useState } from "react";
import {
  customerStatus,
  customerStatuses,
  contactNumber,
} from "./commercial.mjs";
import { money } from "./domain.mjs";

const date = (value: string) =>
  value ? new Date(value).toLocaleString("pt-BR") : "Não registrado";

export default function AdminCustomers({ data }: { data: any }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const now = Date.parse(data.server_now);
  const customers = data.orgs.map((org: any) => {
    const subscription = data.subscriptions.find(
      (s: any) => s.org_id === org.id,
    );
    const owners = data.memberships
      .filter((m: any) => m.org_id === org.id && m.role === "owner")
      .map((m: any) => data.users.find((u: any) => u.id === m.user_id))
      .filter(Boolean);
    const payments = data.payments
      .filter((p: any) => p.org_id === org.id)
      .sort(
        (a: any, b: any) =>
          Date.parse(b.paid_at || b.created_at) -
          Date.parse(a.paid_at || a.created_at),
      );
    const status = customerStatus(
      subscription,
      now,
      data.exempt_org_ids.includes(org.id),
    );
    return { org, subscription, owners, payments, status };
  });
  const counts = (statuses: string[]) =>
    customers.filter((c: any) => statuses.includes(c.status)).length;
  const visible = customers.filter(
    (c: any) =>
      (!filter || c.status === filter) &&
      `${c.org.name} ${c.owners.map((u: any) => `${u.first_name || ""} ${u.last_name || ""} ${u.email} ${u.contact_phone}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel">
      <h2>Acompanhamento de clientes</h2>
      <div className="metric-grid">
        {[
          ["Em teste", counts(["trial"])],
          ["Testes encerrados", counts(["trial_ended"])],
          ["Assinaturas vigentes", counts(["active", "due_soon", "canceled"])],
          ["Vencem em até 7 dias", counts(["due_soon"])],
          ["Vencidas", counts(["overdue"])],
        ].map(([label, count]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>
      <div className="form-grid">
        <label>
          Buscar cliente
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Empresa, nome, e-mail ou telefone"
          />
        </label>
        <label>
          Situação
          <select
            aria-label="Situação"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(customerStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="hint">
        Situação na atualização: {date(data.server_now)}. Vencimento indica o
        prazo de acesso; pagamentos são confirmados pelo Mercado Pago. Não há
        garantia de renovação automática.
      </p>
      {visible.length === 0 && <p>Nenhum cliente encontrado.</p>}
      {visible.map(
        ({ org, subscription: s, owners, payments, status }: any) => (
          <article className="customer-card" key={org.id}>
            <h3>{org.name}</h3>
            <b>{customerStatuses[status as keyof typeof customerStatuses]}</b>
            <p>
              Cadastro: {date(org.created_at)} · Fim do teste:{" "}
              {date(s?.trial_end)}
              <br />
              Acesso pago até: {date(s?.paid_until)} · Plano:{" "}
              {s?.plan || "Não registrado"}
            </p>
            {owners.map((u: any) => {
              const phone = contactNumber(u.contact_phone);
              return (
                <div key={u.id}>
                  <strong>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                  </strong>
                  {" · "}
                  {u.email && <a href={`mailto:${u.email}`}>{u.email}</a>}
                  <p>
                    Telefone: {u.contact_phone || "Não informado"}{" "}
                    {phone && (
                      <a
                        href={`https://wa.me/${phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir WhatsApp
                      </a>
                    )}
                    <br />
                    Último login: {date(u.last_sign_in_at)}
                  </p>
                </div>
              );
            })}
            <details>
              <summary>Histórico de pagamentos ({payments.length})</summary>
              {payments.length === 0 ? (
                <p>Nenhum pagamento registrado.</p>
              ) : (
                payments.map((p: any) => (
                  <p key={p.id}>
                    {date(p.paid_at || p.created_at)} · {money(p.amount)} ·{" "}
                    {p.status === "approved" ? "Aprovado" : p.status} ·
                    Referência: {p.id}
                  </p>
                ))
              )}
              <p className="hint">
                Pagamentos aprovados:{" "}
                {payments.filter((p: any) => p.status === "approved").length}.
                Consulte o histórico para acompanhar as renovações.
              </p>
            </details>
          </article>
        ),
      )}
    </section>
  );
}
