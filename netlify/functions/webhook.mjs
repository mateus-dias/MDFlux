import {
  wrap,
  body,
  db,
  checked,
  verifyWebhook,
  env,
  mp,
  result,
} from "../lib/core.mjs";
export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const u = new URL(req.url),
    id = u.searchParams.get("data.id");
  if (!verifyWebhook(req, id, env("MERCADO_PAGO_WEBHOOK_SECRET")))
    return result({ error: "Assinatura inválida" }, 401);
  const b = await body(req);
  if (String(b.data?.id) !== id)
    return result({ error: "Identificador inválido" }, 400);
  const d = db();
  if (b.type === "subscription_preapproval") {
    const p = await mp("/preapproval/" + encodeURIComponent(id));
    const a = await checked(
      d
        .from("checkout_attempts")
        .select("*")
        .eq("id", p.external_reference)
        .eq("provider_id", p.id)
        .maybeSingle(),
    );
    if (!a) return result({ ok: true });
    if (["cancelled", "paused"].includes(p.status))
      await checked(
        d
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("org_id", a.org_id)
          .eq("provider_id", p.id),
      );
    return result({ ok: true });
  }
  if (!["payment", "subscription_authorized_payment"].includes(b.type))
    return result({ ok: true });
  let paymentId = id,
    preapproval;
  if (b.type === "subscription_authorized_payment") {
    const invoice = await mp("/authorized_payments/" + encodeURIComponent(id));
    paymentId = String(invoice.payment?.id || "");
    preapproval = invoice.preapproval_id;
    if (!paymentId) return result({ ok: true });
  }
  const p = await mp("/v1/payments/" + encodeURIComponent(paymentId));
  preapproval =
    preapproval ||
    p.metadata?.preapproval_id ||
    p.point_of_interaction?.transaction_data?.subscription_id;
  if (!preapproval) return result({ ok: true, ignored: "unlinked" });
  const a = await checked(
    d
      .from("checkout_attempts")
      .select("*")
      .eq("provider_id", preapproval)
      .maybeSingle(),
  );
  if (!a) return result({ ok: true });
  const sub = await mp("/preapproval/" + encodeURIComponent(preapproval));
  if (sub.external_reference !== a.id) throw new Error("Referência inválida");
  await checked(
    d.rpc("confirm_payment", {
      p_id: String(p.id),
      p_provider: preapproval,
      p_org: a.org_id,
      p_plan: a.plan,
      p_status: p.status,
      p_amount: p.transaction_amount,
      p_currency: p.currency_id,
      p_paid_at: p.date_approved || p.date_created,
    }),
  );
  return result({ ok: true });
});
