import { randomBytes } from "node:crypto";
import {
  wrap,
  body,
  member,
  db,
  checked,
  hash,
  limit,
  result,
  env,
} from "../lib/core.mjs";
export default wrap(async (req) => {
  const u = new URL(req.url);
  if (req.method === "GET") {
    const token = u.searchParams.get("token") || "";
    const d = db();
    await limit(d, "document:" + hash(token), 60);
    const l = await checked(
      d
        .from("document_links")
        .select("*")
        .eq("token_hash", hash(token))
        .eq("revoked", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle(),
    );
    if (!l || !(await checked(d.rpc("entitled", { o: l.org_id }))))
      return result({ error: "Link expirado ou indisponível" }, 404);
    const accepted = await checked(
      d
        .from("document_acceptances")
        .select("decision,signer,created_at,digest")
        .eq("link_id", l.id)
        .maybeSingle(),
    );
    return result({ snapshot: l.snapshot, digest: l.digest, accepted });
  }
  const b = await body(req);
  if (b.action === "respond") {
    if (b.consent !== true)
      throw new Error("Confirme a leitura e sua resposta.");
    const d = db();
    await limit(d, "accept:" + hash(b.token || ""), 5, 300);
    await checked(
      d.rpc("accept_document", {
        p_hash: hash(b.token || ""),
        p_decision: b.decision,
        p_signer: b.signer,
        p_evidence: {
          user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
          consent: b.consent === true,
          ip_hash: hash(
            req.headers.get("x-nf-client-connection-ip") || "unknown",
          ),
        },
      }),
    );
    return result({ ok: true });
  }
  const { d, m } = await member(req, b.org);
  if (
    !["owner", "manager"].includes(m.role) ||
    !(await checked(d.rpc("entitled", { o: b.org })))
  )
    throw new Error("403");
  if (b.action === "revoke") {
    await checked(
      d
        .from("document_links")
        .update({ revoked: true })
        .eq("org_id", b.org)
        .eq("record_id", b.id),
    );
    return result({ ok: true });
  }
  const r = await checked(
    d
      .from("records")
      .select("*")
      .eq("id", b.id)
      .eq("org_id", b.org)
      .eq("archived", false)
      .single(),
  );
  if (!["quote", "proposal", "contract", "order"].includes(r.kind))
    throw new Error("Documento inválido");
  const org = await checked(
    d.from("organizations").select("name,settings").eq("id", b.org).single(),
  );
  const c = r.data.client_id
    ? await checked(
        d
          .from("records")
          .select("name,data")
          .eq("id", r.data.client_id)
          .eq("org_id", b.org)
          .single(),
      )
    : null;
  const snapshot = {
    name: r.name,
    kind: r.kind,
    status: r.status,
    amount: r.amount,
    due_date: r.due_date,
    data: {
      items: r.data.items,
      discount: r.data.discount,
      scope: r.data.scope,
      terms: r.data.terms,
      notes: r.data.notes,
    },
    company: {
      name: org.name,
      contact: org.settings.contact,
      address: org.settings.address,
      ...(typeof org.settings.logo === "string" &&
      org.settings.logo.length <= 12000 &&
      /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(org.settings.logo)
        ? { logo: org.settings.logo }
        : {}),
    },
    client: c ? { name: c.name } : null,
  };
  const digest = hash(JSON.stringify(snapshot)),
    token = randomBytes(32).toString("hex");
  await checked(
    d.from("document_links").insert({
      org_id: b.org,
      record_id: r.id,
      token_hash: hash(token),
      snapshot,
      digest,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }),
  );
  return result({ url: env("APP_URL") + "/document?token=" + token });
});
