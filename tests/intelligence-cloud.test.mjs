import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/intelligence-cloud.mjs";

test("cloud chat sends only the submitted text and product instructions", async (t) => {
  const org = "12345678-1234-1234-1234-123456789abc";
  const message = "Como uso o MD Flux para organizar contratos?";
  const configuration = {
    MDFLUX_CLOUD_AI: "true",
    MDFLUX_CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    MDFLUX_CLOUDFLARE_AI_TOKEN: "fake-test-token",
    SUPABASE_URL: "https://database.example",
    SUPABASE_SERVICE_ROLE_KEY: "fake-test-key",
  };
  for (const [key, value] of Object.entries(configuration)) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    });
  }
  const external = [];
  const json = (data) => Response.json(data);
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "api.cloudflare.com") {
      external.push(JSON.parse(options.body));
      return json({
        choices: [{ message: { content: "Use o módulo de contratos." } }],
      });
    }
    if (url.pathname === "/auth/v1/user")
      return json({ id: org, email_confirmed_at: "2026-11-12T00:00:00Z" });
    if (url.pathname === "/rest/v1/memberships") return json({ role: "owner" });
    if (url.pathname.startsWith("/rest/v1/rpc/")) return json(true);
    throw new Error("Unexpected request " + url.pathname);
  });
  const call = (message) =>
    handler(
      new Request("https://mdflux.example", {
        method: "POST",
        headers: { Authorization: "Bearer fake-session" },
        body: JSON.stringify({ org, message }),
      }),
    );
  assert.equal((await call("")).status, 400);
  assert.deepEqual(external, []);
  const reply = await call(message);
  assert.equal(reply.status, 200);
  assert.equal((await reply.json()).reply, "Use o módulo de contratos.");
  assert.equal(external.length, 1);
  assert.deepEqual(
    external[0].messages.map((entry) => entry.role),
    ["system", "user"],
  );
  assert.equal(external[0].messages[1].content, message);
  assert.ok(!JSON.stringify(external).includes(org));
});
