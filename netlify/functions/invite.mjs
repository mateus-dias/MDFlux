import {
  wrap,
  body,
  member,
  checked,
  limit,
  result,
  env,
} from "../lib/core.mjs";
import { plans } from "../../src/domain.mjs";
export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const b = await body(req);
  const { d, user } = await member(req, b.org, true);
  await limit(d, "invite:" + user.id, 5, 300);
  const s = await checked(
    d.from("subscriptions").select("*").eq("org_id", b.org).single(),
  );
  if (!(await checked(d.rpc("entitled", { o: b.org })))) throw new Error("403");
  const members = await checked(
    d
      .from("memberships")
      .select("user_id")
      .eq("org_id", b.org)
      .eq("active", true),
  );
  if (members.length >= plans[s.plan].users)
    throw new Error("Limite de usuários");
  if (
    !["manager", "operator", "finance", "viewer"].includes(b.role) ||
    !/^\S+@\S+\.\S+$/.test(b.email)
  )
    throw new Error("Dados inválidos");
  const { data, error } = await d.auth.admin.inviteUserByEmail(b.email, {
    redirectTo: env("APP_URL") + "/auth",
  });
  if (error)
    throw new Error(
      "Não foi possível convidar. Use um e-mail ainda não cadastrado.",
    );
  await checked(
    d.rpc("attach_invited_user", {
      p_org: b.org,
      p_user: data.user.id,
      p_role: b.role,
    }),
  );
  await checked(
    d
      .from("audit")
      .insert({ org_id: b.org, actor: user.id, action: "member.invited" }),
  );
  return result({ ok: true });
});
