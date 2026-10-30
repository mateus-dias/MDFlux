import { wrap, body, member, checked, mp, result } from "../lib/core.mjs";
export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const b = await body(req);
  const { d, user } = await member(req, b.org, true);
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
