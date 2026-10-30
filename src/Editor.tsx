import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { Row, Kind, Org } from "./model";
import { modules, labels, documentKinds } from "./model";
import { total, money, today } from "./domain.mjs";
import { supabase } from "./api";
export default function Editor({
  kind,
  row,
  rows,
  org,
  onSave,
  onClose,
  demo,
}: {
  kind: Kind;
  row?: Partial<Row>;
  rows: Row[];
  org: Org;
  onSave: (r: Partial<Row>) => Promise<void>;
  onClose: () => void;
  demo: boolean;
}) {
  const [name, setName] = useState(row?.name || ""),
    [status, setStatus] = useState(row?.status || modules[kind].statuses[0]),
    [amount, setAmount] = useState(row?.amount || 0),
    [due, setDue] = useState(row?.due_date || ""),
    [data, setData] = useState<Record<string, any>>(row?.data || {}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const field = (key: string, value: any) =>
    setData((d) => ({ ...d, [key]: value }));
  const isDoc = documentKinds.includes(kind),
    financial = ["income", "expense"].includes(kind),
    contact = ["client", "supplier"].includes(kind),
    items: any[] = data.items || [];
  const value = items.length ? total(items, data.discount || 0) : amount;
  const paid = (data.settlements || []).reduce(
    (s: number, p: any) => s + Number(p.amount),
    0,
  );
  function input(key: string, label: string, type = "text") {
    return (
      <label>
        {label}
        <input
          type={type}
          value={data[key] || ""}
          onChange={(e) =>
            field(
              key,
              type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
      </label>
    );
  }
  async function upload(file: File) {
    if (demo) {
      setError(
        "Anexos reais ficam disponíveis na conta conectada. Não insira dados pessoais na demonstração.",
      );
      return;
    }
    if (!supabase) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(
        file.type,
      )
    ) {
      setError("Use PNG, JPEG, WebP ou PDF de até 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const path =
        org.id +
        "/" +
        crypto.randomUUID() +
        "/" +
        file.name.replace(/[^a-z0-9.\-]/gi, "_");
      const { error } = await supabase.storage
        .from("tenant-files")
        .upload(path, file);
      if (error) throw error;
      field("attachments", [
        ...(data.attachments || []),
        { name: file.name, path },
      ]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={modules[kind].single}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">
              {row?.id ? "EDITAR REGISTRO" : "NOVO REGISTRO"}
            </span>
            <h2>{modules[kind].single}</h2>
          </div>
          <button aria-label="Fechar formulário" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await onSave({
                ...row,
                kind,
                name,
                status: financial
                  ? paid >= value
                    ? "paid"
                    : paid > 0
                      ? "partial"
                      : "pending"
                  : status,
                amount: value,
                paid: financial ? paid : 0,
                due_date: due || null,
                data,
              });
              onClose();
            } catch (e) {
              setError(String((e as Error).message));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {contact ? "Nome ou razão social" : "Título / descrição"}
            <input
              autoFocus
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {modules[kind].statuses.map((s) => (
                  <option key={s} value={s}>
                    {labels[s]}
                  </option>
                ))}
              </select>
            </label>
            {!contact && (
              <label>
                {kind === "order"
                  ? "Previsão de conclusão"
                  : "Validade / vencimento"}
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
            )}
          </div>
          {!contact && kind !== "product" && (
            <label>
              Cliente vinculado
              <select
                value={data.client_id || ""}
                onChange={(e) => field("client_id", e.target.value)}
              >
                <option value="">Sem vínculo</option>
                {rows
                  .filter((r) => r.kind === "client")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {contact && (
            <>
              <div className="form-grid">
                {input("document", "CPF / CNPJ (opcional)")}
                {input("phone", "WhatsApp / telefone", "tel")}
                {input("email", "E-mail", "email")}
                {input("address", "Endereço")}
              </div>
            </>
          )}
          {isDoc && (
            <>
              <label>
                Escopo / descrição do serviço
                <textarea
                  rows={3}
                  value={data.scope || ""}
                  onChange={(e) => field("scope", e.target.value)}
                />
              </label>
              <div className="section-line">
                <h3>Produtos, materiais e serviços</h3>
                <button
                  type="button"
                  onClick={() =>
                    field("items", [...items, { name: "", qty: 1, price: 0 }])
                  }
                >
                  <Plus size={16} /> Item
                </button>
              </div>
              <select
                aria-label="Adicionar do catálogo"
                value=""
                onChange={(e) => {
                  const p = rows.find((r) => r.id === e.target.value);
                  if (p)
                    field("items", [
                      ...items,
                      { name: p.name, qty: 1, price: p.amount },
                    ]);
                }}
              >
                <option value="">Adicionar do catálogo…</option>
                {rows
                  .filter((r) => r.kind === "product")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {money(p.amount)}
                    </option>
                  ))}
              </select>
              {items.map((it, i) => (
                <div className="item-row" key={i}>
                  <input
                    required
                    placeholder="Descrição"
                    aria-label={"Descrição do item " + (i + 1)}
                    value={it.name}
                    onChange={(e) =>
                      field(
                        "items",
                        items.map((a, j) =>
                          j === i ? { ...a, name: e.target.value } : a,
                        ),
                      )
                    }
                  />
                  <input
                    required
                    aria-label="Quantidade"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={it.qty}
                    onChange={(e) =>
                      field(
                        "items",
                        items.map((a, j) =>
                          j === i ? { ...a, qty: Number(e.target.value) } : a,
                        ),
                      )
                    }
                  />
                  <input
                    required
                    aria-label="Preço unitário"
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.price}
                    onChange={(e) =>
                      field(
                        "items",
                        items.map((a, j) =>
                          j === i ? { ...a, price: Number(e.target.value) } : a,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remover item"
                    onClick={() =>
                      field(
                        "items",
                        items.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="form-grid">
                {input("discount", "Desconto em R$", "number")}
                {!items.length && (
                  <label>
                    Valor total
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>
              <strong className="total">Total {money(value)}</strong>
              <label>
                Condições comerciais / cláusulas
                <textarea
                  rows={4}
                  value={data.terms || ""}
                  onChange={(e) => field("terms", e.target.value)}
                />
              </label>
            </>
          )}
          {financial && (
            <>
              <div className="form-grid">
                <label>
                  Valor previsto (R$)
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </label>
                {input("category", "Categoria")}
              </div>
              <label>
                OS vinculada
                <select
                  value={data.order_id || ""}
                  onChange={(e) => field("order_id", e.target.value)}
                >
                  <option value="">Sem vínculo</option>
                  {rows
                    .filter((r) => r.kind === "order")
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
              <h3>Baixas e pagamentos parciais</h3>
              {(data.settlements || []).map((s: any, i: number) => (
                <div className="item-row" key={i}>
                  <input
                    aria-label="Valor da baixa"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={s.amount}
                    onChange={(e) =>
                      field(
                        "settlements",
                        data.settlements.map((a: any, j: number) =>
                          i === j
                            ? { ...a, amount: Number(e.target.value) }
                            : a,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Data da baixa"
                    type="date"
                    required
                    value={s.date}
                    onChange={(e) =>
                      field(
                        "settlements",
                        data.settlements.map((a: any, j: number) =>
                          i === j ? { ...a, date: e.target.value } : a,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      field(
                        "settlements",
                        data.settlements.filter((_: any, j: number) => i !== j),
                      )
                    }
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  field("settlements", [
                    ...(data.settlements || []),
                    { amount: Math.max(0, amount - paid), date: today() },
                  ])
                }
              >
                + Registrar baixa
              </button>
              <p className="hint">
                Baixado: {money(paid)} · Em aberto: {money(amount - paid)}
              </p>
              <label>
                Repetir mensalmente
                <select
                  value={data.recurrence_months || 0}
                  onChange={(e) =>
                    field("recurrence_months", Number(e.target.value))
                  }
                >
                  <option value={0}>Não repetir</option>
                  <option value={3}>Gerar mais 3 parcelas</option>
                  <option value={6}>Gerar mais 6 parcelas</option>
                  <option value={12}>Gerar mais 12 parcelas</option>
                </select>
              </label>
              <p className="hint">
                As parcelas futuras são criadas ao salvar um novo lançamento e
                não recebem baixas automaticamente.
              </p>
            </>
          )}
          {kind === "product" && (
            <>
              <div className="form-grid">
                <label>
                  Tipo
                  <select
                    value={data.type || "service"}
                    onChange={(e) => field("type", e.target.value)}
                  >
                    <option value="service">Serviço</option>
                    <option value="product">Produto</option>
                    <option value="material">Material</option>
                  </select>
                </label>
                {input("unit", "Unidade")}
                {input("cost", "Custo unitário (R$)", "number")}
                <label>
                  Preço de venda (R$)
                  <input
                    min="0"
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                </label>
                {input("category", "Categoria")}
              </div>
              {org.subscription.plan !== "essencial" && (
                <>
                  <label>
                    Movimentar estoque (entrada + / saída −)
                    <input
                      type="number"
                      step="0.001"
                      value={data.stock_delta || 0}
                      onChange={(e) =>
                        field("stock_delta", Number(e.target.value))
                      }
                    />
                  </label>
                  <p className="hint">
                    Estoque atual: {data.stock || 0}. O histórico é registrado
                    no salvamento.
                  </p>
                </>
              )}
            </>
          )}
          {kind === "order" && (
            <>
              <div className="form-grid">
                {input("responsible", "Responsável")}
                {input("address", "Local")}
                {input("scheduled", "Agendamento", "datetime-local")}
                {input("started", "Início", "date")}
                {input("completed", "Conclusão", "date")}
                <label>
                  Prioridade
                  <select
                    value={data.priority || "Normal"}
                    onChange={(e) => field("priority", e.target.value)}
                  >
                    {["Baixa", "Normal", "Alta", "Urgente"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                {input("estimated_cost", "Custo estimado (R$)", "number")}
              </div>
              <label>
                Checklist (uma etapa por linha)
                <textarea
                  value={data.checklist || ""}
                  onChange={(e) => field("checklist", e.target.value)}
                />
              </label>
              {input(
                "confirmation",
                "Confirmação do cliente (registro manual)",
              )}
              <label>
                Fotos ou documentos (até 5 MB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) =>
                    e.target.files?.[0] && upload(e.target.files[0])
                  }
                />
              </label>
              {data.attachments?.map((a: any) => (
                <p key={a.path}>{a.name}</p>
              ))}
            </>
          )}
          {kind === "ticket" && (
            <>
              <div className="form-grid">
                {input("category", "Categoria")}
                <label>
                  Prioridade
                  <select
                    value={data.priority || "Normal"}
                    onChange={(e) => field("priority", e.target.value)}
                  >
                    {["Baixa", "Normal", "Alta", "Crítica"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Descrição do problema
                <textarea
                  required
                  rows={5}
                  value={data.description || ""}
                  onChange={(e) => field("description", e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            Observações
            <textarea
              rows={2}
              value={data.notes || ""}
              onChange={(e) => field("notes", e.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="primary"
              disabled={busy || value < 0 || (financial && paid > amount)}
            >
              {busy ? "Salvando…" : "Salvar registro"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
