import { db, checked } from "../lib/core.mjs";
export default async () => {
  const d = db();
  await checked(d.rpc("lifecycle"));
  return new Response("ok");
};
export const config = { schedule: "17 * * * *" };
