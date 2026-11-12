import { body, checked, limit, member, result, wrap } from "../lib/core.mjs";

const instructions = [
  "Você é o assistente do MD Flux. Converse com naturalidade em português do Brasil.",
  "O MD Flux é um SaaS para pequenas empresas. Tem clientes, fornecedores, orçamentos, propostas, contratos, financeiro e relatórios.",
  "Para consultar valores, o chat usa os dados do sistema. Cadastros, importações, parcelamentos e lembretes exigem plano compatível, perfil autorizado e confirmação.",
  "Aqui você pode explicar como usar o sistema e conversar. Não tem acesso a dados da empresa nem a ferramentas. Nunca invente valores, telas ou ações executadas.",
  "Quando uma pergunta pedir dados da empresa que você não recebeu, diga qual informação falta. Responda em poucos parágrafos.",
].join(" ");

export default wrap(async (req) => {
  if (req.method !== "POST") return result({}, 405);
  const account = process.env.MDFLUX_CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.MDFLUX_CLOUDFLARE_AI_TOKEN;
  if (
    process.env.MDFLUX_CLOUD_AI !== "true" ||
    !/^[a-f0-9]{32}$/i.test(account || "") ||
    !token
  )
    return result(
      { error: "IA em nuvem ainda não configurada no servidor." },
      503,
    );
  const { org, message } = await body(req);
  if (
    typeof org !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(org) ||
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 500
  )
    return result({ error: "Mensagem inválida." }, 400);
  const { d, user } = await member(req, org);
  if (!(await checked(d.rpc("entitled", { o: org })))) throw new Error("403");
  await limit(d, "intelligence-cloud-user:" + user.id, 8, 60);
  await limit(d, "intelligence-cloud-global", 80, 86400);
  try {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" +
        account +
        "/ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: "@cf/google/gemma-4-26b-a4b-it",
          messages: [
            { role: "system", content: instructions },
            { role: "user", content: message.trim() },
          ],
          max_tokens: 350,
          stream: false,
        }),
      },
    );
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      console.warn(
        "Workers AI request rejected",
        response.status,
        failure?.errors?.[0]?.code,
      );
      return result(
        {
          error:
            "A Cloudflare não respondeu à solicitação (" +
            response.status +
            ").",
        },
        503,
      );
    }
    const content = (await response.json()).choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      return result({ error: "IA em nuvem sem resposta." }, 503);
    return result({ reply: content.trim().slice(0, 1200) });
  } catch (error) {
    console.warn("Workers AI request failed", error?.name);
    return result({ error: "IA em nuvem temporariamente indisponível." }, 503);
  }
});
