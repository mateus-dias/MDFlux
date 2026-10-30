import { wrap, body, db, checked, limit, hash, result } from "../lib/core.mjs";
export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const b = await body(req);
  if (
    ![
      "PageView",
      "ViewContent",
      "Lead",
      "CompleteRegistration",
      "StartTrial",
      "InitiateCheckout",
    ].includes(b.event) ||
    !/[a-f0-9-]{36}/i.test(b.id || "")
  )
    throw new Error("Evento inválido");
  const d = db();
  await limit(
    d,
    "event:" + hash(req.headers.get("x-nf-client-connection-ip") || "unknown"),
    60,
  );
  await checked(
    d.from("outbox").insert({
      id: b.id,
      event: b.event,
      consent: true,
      payload: {
        plan: ["essencial", "profissional", "empresarial"].includes(
          b.custom?.plan,
        )
          ? b.custom.plan
          : undefined,
      },
    }),
  );
  return result({ ok: true });
});
