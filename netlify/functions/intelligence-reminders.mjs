import { db, checked } from "../lib/core.mjs";

export default async () => {
  await checked(db().rpc("intelligence_run_reminders"));
  return new Response("ok");
};

export const config = { schedule: "0 12 * * *" };
