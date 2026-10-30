import { db, checked, env, hash } from "../lib/core.mjs";
export default async () => {
  if (!process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN)
    return new Response("not configured");
  const d = db();
  const events = await checked(
    d
      .from("outbox")
      .select("*")
      .eq("consent", true)
      .is("sent_at", null)
      .lt("attempts", 8)
      .order("created_at")
      .limit(50),
  );
  for (const e of events) {
    if (e.org_id) {
      const org = await checked(
        d.from("organizations").select("settings").eq("id", e.org_id).single(),
      );
      if (org.settings.marketing_consent !== true) {
        await checked(
          d.from("outbox").update({ consent: false }).eq("id", e.id),
        );
        continue;
      }
    }
    await d
      .from("outbox")
      .update({ attempts: e.attempts + 1 })
      .eq("id", e.id);
    const r = await fetch(
      `https://graph.facebook.com/${env("META_GRAPH_VERSION")}/${env("META_PIXEL_ID")}/events`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: env("META_ACCESS_TOKEN"),
          ...(process.env.META_TEST_EVENT_CODE
            ? { test_event_code: process.env.META_TEST_EVENT_CODE }
            : {}),
          data: [
            {
              event_name: e.event,
              event_id: e.id,
              event_time: Math.floor(Date.parse(e.created_at) / 1000),
              action_source: "website",
              event_source_url: env("APP_URL"),
              user_data: { external_id: [hash(e.org_id || e.id)] },
              custom_data: e.payload,
            },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (r.ok)
      await checked(
        d
          .from("outbox")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", e.id),
      );
  }
  return new Response("ok");
};
export const config = { schedule: "*/10 * * * *" };
