import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
export const hash = (v) => createHash("sha256").update(v).digest("hex");
export const env = (k) => {
  if (!process.env[k]) throw new Error("Configuração pendente: " + k);
  return process.env[k];
};
export const db = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
export function result(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}
export async function checked(q) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
export async function identity(req) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("401");
  const d = db();
  const { data, error } = await d.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at)
    throw new Error("401");
  return { d, user: data.user, token };
}
export async function member(req, org, owner = false) {
  const a = await identity(req);
  const m = await checked(
    a.d
      .from("memberships")
      .select("*")
      .eq("org_id", org)
      .eq("user_id", a.user.id)
      .eq("active", true)
      .single(),
  );
  if (owner && m.role !== "owner") throw new Error("403");
  return { ...a, m };
}
export async function limit(d, key, n = 30, seconds = 60) {
  if (
    !(await checked(
      d.rpc("rate_limit", { p_key: hash(key), p_limit: n, p_seconds: seconds }),
    ))
  )
    throw new Error("429");
}
export async function body(req) {
  if (Number(req.headers.get("content-length")) > 120000)
    throw new Error("413");
  const t = await req.text();
  if (t.length > 120000) throw new Error("413");
  return JSON.parse(t || "{}");
}
export const wrap = (fn) => async (req, context) => {
  try {
    if (req.method !== "GET" && req.method !== "POST")
      return result({ error: "Método não permitido" }, 405);
    return await fn(req, context);
  } catch (e) {
    const msg = String(e.message);
    const code = /^(401|403|413|429)$/.test(msg) ? Number(msg) : 400;
    return result(
      {
        error:
          code === 401
            ? "Entre novamente na sua conta."
            : code === 403
              ? "Operação não autorizada."
              : code === 429
                ? "Aguarde antes de tentar novamente."
                : msg.startsWith("Configuração pendente")
                  ? msg
                  : "Não foi possível concluir. Verifique os dados ou tente novamente.",
      },
      code,
    );
  }
};
export async function mp(path, method = "GET", data, key) {
  const r = await fetch("https://api.mercadopago.com" + path, {
    method,
    headers: {
      authorization: "Bearer " + env("MERCADO_PAGO_ACCESS_TOKEN"),
      "content-type": "application/json",
      ...(key ? { "X-Idempotency-Key": key } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Mercado Pago: " + r.status);
  return r.json();
}
export function verifyWebhook(req, id, secret, now = Date.now()) {
  const parts = Object.fromEntries(
    (req.headers.get("x-signature") || "")
      .split(",")
      .map((s) => s.trim().split("=")),
  );
  const rid = req.headers.get("x-request-id");
  if (
    !id ||
    !rid ||
    !/^\d+$/.test(parts.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 || "")
  )
    return false;
  const ts = Number(parts.ts);
  if (Math.abs(now - (ts > 1e12 ? ts : ts * 1000)) > 300000) return false;
  const expected = createHmac("sha256", secret)
    .update(`id:${id.toLowerCase()};request-id:${rid};ts:${parts.ts};`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}
