import { db, checked } from "../lib/core.mjs";
import { reconcileSubscriptionPayment } from "./webhook.mjs";

export default async () => {
  const d = db();
  await checked(d.rpc("lifecycle"));

  const now = new Date();
  const due = await checked(d.from("checkout_attempts")
    .select("id, created_at").eq("status", "pending").not("provider_id", "is", null)
    .lte("reconcile_after", now.toISOString())
    .order("reconcile_after").order("created_at").limit(12));
  const outcomes = await Promise.allSettled(due.map(async (candidate) => {
    const age = now.getTime() - Date.parse(candidate.created_at);
    const next = new Date(now.getTime() + (age >= 86_400_000 ? 86_400_000 : 3_600_000));
    const attempt = await checked(d.from("checkout_attempts")
      .update({ reconcile_after: next.toISOString() }).eq("id", candidate.id)
      .eq("status", "pending").lte("reconcile_after", now.toISOString())
      .select("id, org_id, plan, provider_id").maybeSingle());
    if (!attempt?.provider_id) return false;
    const response = await reconcileSubscriptionPayment(d, attempt);
    return (await response.json()).ok === true;
  }));
  console.info("Conciliação de assinaturas", {
    encontrados: due.length,
    confirmados: outcomes.filter((entry) => entry.status === "fulfilled" && entry.value).length,
    falhas: outcomes.filter((entry) => entry.status === "rejected").length,
  });
  return new Response("ok");
};

export const config = { schedule: "17 * * * *" };
