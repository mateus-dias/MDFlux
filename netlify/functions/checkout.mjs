import {
  wrap,
  body,
  member,
  checked,
  limit,
  mp,
  result,
  env,
} from "../lib/core.mjs";
import { plans } from "../../src/domain.mjs";
import {recoverReservedCheckout} from '../lib/checkout-recovery.mjs';
export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const b = await body(req);
  if (!plans[b.plan]) throw new Error("Plano inválido");
  const { d, user } = await member(req, b.org, true);
  await limit(d, "checkout:" + user.id, 5, 300);
  const current = await checked(
    d.from("subscriptions").select("*").eq("org_id", b.org).single(),
  );
  if (current.provider_id && current.status === "active")
    throw new Error(
      "Cancele a renovação atual antes de trocar o plano. O acesso já pago será preservado.",
    );
  const count = await checked(
    d
      .from("memberships")
      .select("user_id")
      .eq("org_id", b.org)
      .eq("active", true),
  );
  if (count.length > plans[b.plan].users)
    throw new Error("Desative usuários antes de reduzir o plano.");
  const old = await checked(
    d
      .from("checkout_attempts")
      .select("*")
      .eq("org_id", b.org)
      .in("status", ["creating", "pending"])
      .maybeSingle(),
  );
  if(old && old.plan!==b.plan) throw new Error('Existe um checkout de outro plano em andamento. Contate o suporte para cancelar essa tentativa antes de trocar.');
  if (old?.url) return result({ url: old.url });
  if (old) {
    const recovered=await recoverReservedCheckout(d,old,mp);
    if(recovered?.status==='pending' && recovered.url) return result({url:recovered.url});
    if(recovered?.status==='confirmed') return result({url:env('APP_URL')+'/app/plans'});
    if(recovered?.status==='failed') throw new Error('O checkout anterior foi cancelado. Escolha o plano novamente.');
    throw new Error(
      "Checkout em processamento. Contate o suporte se persistir.",
    );
  }
  const attempt = await checked(
    d
      .from("checkout_attempts")
      .insert({ org_id: b.org, plan: b.plan })
      .select()
      .single(),
  );
  try {
    const p = await mp(
      "/preapproval",
      "POST",
      {
        reason: "MD Flux " + plans[b.plan].name,
        external_reference: attempt.id,
        payer_email: user.email,
        back_url: env("APP_URL") + "/app/plans",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: plans[b.plan].price,
          currency_id: "BRL",
        },
        status: "pending",
      },
      attempt.id,
    );
    const url = new URL(p.init_point);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)mercadopago\.(com|com\.br)$/.test(url.hostname)
    )
      throw new Error("Checkout inválido");
    await checked(
      d
        .from("checkout_attempts")
        .update({ provider_id: p.id, url: url.href, status: "pending" })
        .eq("id", attempt.id),
    );
    return result({ url: url.href });
  } catch (e) {
    // An ambiguous timeout may already have created the remote subscription.
    // Keep the reservation so a retry cannot create a second recurring charge.
    if (
      /^Mercado Pago: 4[0-9]{2}$/.test(e.message) ||
      e.message.startsWith("Configuração pendente")
    )
      await d
        .from("checkout_attempts")
        .update({ status: "failed" })
        .eq("id", attempt.id);
    throw e;
  }
});
