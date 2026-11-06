import { createClient } from "@supabase/supabase-js";
import { wrap, identity, checked, body, result, env } from "../lib/core.mjs";
async function allRows(d, table, columns = "*") {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const key =
      table === "subscriptions"
        ? "org_id"
        : ["memberships", "user_activity"].includes(table)
          ? "user_id"
          : "id";
    let query = d.from(table).select(columns).order(key);
    if (table === "memberships") query = query.order("org_id");
    const page = await checked(query.range(offset, offset + 999));
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
export default wrap(async (req) => {
  const { d, user, token } = await identity(req);
  const scoped = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false },
  });
  if (!(await checked(scoped.rpc("is_global_admin")))) throw new Error("403");
  if (req.method === "GET") {
    const orgs = await allRows(d, "organizations", "id,name,created_at");
    const subscriptions = await allRows(d, "subscriptions");
    const payments = await allRows(
      d,
      "payments",
      "id,org_id,amount,status,created_at,paid_at",
    );
    const audit = await checked(
      d
        .from("audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    );
    const tickets = await checked(
      d.from("records").select("*").eq("kind", "ticket").eq("archived", false),
    );
    const activity = await allRows(d, "user_activity");
    const authUsers = [];
    for (let page = 1; ; page++) {
      const { data, error } = await d.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw error;
      authUsers.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const users = authUsers.map((u) => ({
      id: u.id,
      email: u.email,
      first_name: u.user_metadata.first_name,
      last_name: u.user_metadata.last_name,
      contact_phone: String(u.user_metadata.contact_phone || "").slice(0, 25),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      banned_until: u.banned_until,
    }));
    const memberships = await allRows(d, "memberships");
    const owners = await checked(d.from("platform_owner").select("user_id"));
    const exempt_org_ids = memberships
      .filter(
        (m) =>
          m.role === "owner" &&
          m.active &&
          owners.some((o) => o.user_id === m.user_id),
      )
      .map((m) => m.org_id);
    return result({
      server_now: new Date().toISOString(),
      exempt_org_ids,
      orgs,
      subscriptions,
      payments,
      audit,
      tickets,
      users,
      memberships,
      activity,
    });
  }
  const b = await body(req);
  if (b.action === "reset_password") {
    const { data: target, error } = await d.auth.admin.getUserById(b.user);
    if (error || !target.user.email) throw new Error("Usuário inválido");
    const { error: mailError } = await d.auth.resetPasswordForEmail(
      target.user.email,
      { redirectTo: env("APP_URL") + "/auth?reset=1" },
    );
    if (mailError) throw mailError;
  } else if (b.action === "set_plan") {
    if (!["essencial", "profissional", "empresarial"].includes(b.plan))
      throw new Error("Plano inválido");
    const members = await checked(
      d
        .from("memberships")
        .select("user_id")
        .eq("org_id", b.org)
        .eq("active", true),
    );
    if (
      members.length >
      { essencial: 1, profissional: 3, empresarial: 10 }[b.plan]
    )
      throw new Error("Equipe excede limite");
    await checked(
      d.from("subscriptions").update({ plan: b.plan }).eq("org_id", b.org),
    );
  } else if (b.action === "suspend")
    await checked(
      d
        .from("subscriptions")
        .update({ suspended: b.suspended === true })
        .eq("org_id", b.org),
    );
  else if (b.action === "extend") {
    await checked(
      d
        .from("subscriptions")
        .update({
          status: "trialing",
          trial_end: new Date(Date.now() + 72 * 3600000).toISOString(),
          purge_after: new Date(Date.now() + 10 * 86400000).toISOString(),
          suspended: false,
        })
        .eq("org_id", b.org)
        .in("status", ["trialing", "trial_expired", "expired"]),
    );
  } else if (b.action === "ticket") {
    const r = await checked(
      d
        .from("records")
        .select("data")
        .eq("id", b.id)
        .eq("kind", "ticket")
        .single(),
    );
    const messages = [
      ...(r.data.messages || []),
      {
        text: String(b.message).slice(0, 5000),
        by: "Suporte MD Flux",
        at: new Date().toISOString(),
      },
    ];
    await checked(
      d
        .from("records")
        .update({
          status: b.status,
          data: { ...r.data, messages },
          updated_at: new Date().toISOString(),
        })
        .eq("id", b.id)
        .eq("kind", "ticket"),
    );
  } else throw new Error("Ação inválida");
  await checked(
    d
      .from("audit")
      .insert({ org_id: b.org, actor: user.id, action: "admin." + b.action }),
  );
  return result({ ok: true });
});
