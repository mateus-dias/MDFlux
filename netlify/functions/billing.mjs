import { wrap, body, member, checked, limit, mp, result } from "../lib/core.mjs";
import { confirmSubscriptionPayment } from "./webhook.mjs";
export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const b = await body(req);
  const { d, user } = await member(req, b.org, true);
  if (b.action === "reconcile") {
    const attempt = await checked(d.from("checkout_attempts")
      .select("id, org_id, plan, provider_id")
      .eq("org_id", b.org).eq("status", "pending").not("provider_id", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (!attempt) return result({ checked: false });
    await limit(d, "billing:reconcile:" + user.id, 6, 60);
    const subscriptionId = attempt.provider_id;
    const invoices = await mp("/authorized_payments/search?preapproval_id=" + encodeURIComponent(subscriptionId));
    const invoice = invoices.results?.find((entry) =>
      entry.preapproval_id === subscriptionId && entry.payment?.status === "approved" &&
      /^[0-9]+$/.test(String(entry.payment.id)));
    if (!invoice) return result({ checked: true, approved: false });
    const payment = await mp("/v1/payments/" + encodeURIComponent(invoice.payment.id));
    if (payment.status !== "approved") return result({ checked: true, approved: false });
    return confirmSubscriptionPayment(d, payment, subscriptionId, attempt);
  }
  const s = await checked(
    d.from("subscriptions").select("*").eq("org_id", b.org).single(),
  );
  if (b.action !== "cancel" || !s.provider_id)
    throw new Error("Operação inválida");
  await mp("/preapproval/" + encodeURIComponent(s.provider_id), "PUT", {
    status: "cancelled",
  });
  await checked(
    d.from("subscriptions").update({ status: "canceled" }).eq("org_id", b.org),
  );
  await checked(
    d.from("audit").insert({
      org_id: b.org,
      actor: user.id,
      action: "subscription.canceled",
    }),
  );
  return result({ ok: true });
});
