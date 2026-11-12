import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let passed = 0;
const check = (name) => {
  passed++;
  console.log("PASS", name);
};
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;grant usage on schema public,auth to authenticated,anon,service_role;grant execute on all functions in schema auth to authenticated,anon,service_role;`,
);
await db.exec(
  `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;grant execute on function storage.foldername(text) to authenticated;`,
);
for (const f of [
  "001_saas.sql",
  "002_storage.sql",
  "003_service.sql",
  "004_validation.sql",
  "005_member_storage.sql",
  "006_activity.sql",
  "007_payment_ordering.sql",
  "009_intelligence.sql",
]) {
  let sql = await fs.readFile(
    new URL("../supabase/migrations/" + f, import.meta.url),
    "utf8",
  );
  sql = sql.replace("create extension if not exists pgcrypto;", "");
  await db.exec(sql);
}
check("migrations compile on PostgreSQL engine (Auth and Storage shims)");
const u1 = "11111111-1111-4111-8111-111111111111",
  u2 = "22222222-2222-4222-8222-222222222222";
await db.exec(`insert into auth.users(id) values('${u1}'),('${u2}')`);
const orgs = (await db.query("select org_id,user_id from memberships")).rows;
const a = orgs.find((m) => m.user_id === u1).org_id,
  b = orgs.find((m) => m.user_id === u2).org_id;
assert.notEqual(a, b);
const trial = (
  await db.query(
    "select extract(epoch from (trial_end-trial_start)) seconds from subscriptions limit 1",
  )
).rows[0];
assert.equal(Number(trial.seconds), 259200);
check("signup provisions isolated organizations and exact 72h server trial");
async function asUser(id, aal = "aal1") {
  await db.exec("reset role");
  await db.query(
    `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)`,
    [id, aal],
  );
  await db.exec("set role authenticated");
}
async function insert(org, kind, name, amount = 0, paid = 0, data = {}) {
  return (
    await db.query(
      `select * from public.save_record($1,$2,$3,'draft',$4,$5,null,$6)`,
      [org, kind, name, amount, paid, JSON.stringify(data)],
    )
  ).rows[0];
}
async function rejects(fn) {
  let failed = false;
  try {
    await fn();
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
}
await asUser(u1);
const r = await insert(a, "client", "Tenant A");
assert.ok(r.id);
await rejects(() => insert(b, "client", "Attack"));
assert.equal((await db.query("select * from organizations")).rows.length, 1);
check("tenant A cannot create records in tenant B or read organization B");
await db.query(
  "insert into storage.objects(bucket_id,name) values('tenant-files',$1)",
  [a + "/example/photo.png"],
);
await rejects(() =>
  db.query(
    "insert into storage.objects(bucket_id,name) values('tenant-files',$1)",
    [b + "/example/photo.png"],
  ),
);
check("storage rejects cross-tenant uploads");

await asUser(u2);
assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
check("storage hides tenant A files from tenant B");
assert.equal(
  (await db.query("select * from records where id=$1", [r.id])).rows.length,
  0,
);
await rejects(() => db.query(`select archive_record($1,1)`, [r.id]));
await rejects(() =>
  insert(b, "quote", "Cross link", 1, 0, { client_id: r.id }),
);
check("tenant B cannot read, archive or reference tenant A records");
await rejects(() => db.exec(`update subscriptions set plan='empresarial'`));
await rejects(() => db.exec(`insert into global_admins values('${u2}')`));
await rejects(() => db.exec(`select lifecycle()`));
check(
  "browser cannot forge plans, grant global admin or invoke service lifecycle",
);
await asUser(u1);
await rejects(() => insert(a, "income", "Forged payment", 100, 100, {}));
const fin = await insert(a, "income", "Partial", 100, 25, {
  settlements: [{ date: "2026-10-30", amount: 25 }],
});
assert.equal(fin.status, "partial");
await rejects(() =>
  insert(a, "quote", "Negative line", 0, 0, {
    items: [{ name: "x", qty: -1, price: 10 }],
  }),
);
const quote = await insert(a, "quote", "Server total", 1, 0, {
  items: [{ name: "x", qty: 2, price: 100 }],
  discount: 10,
});
assert.equal(Number(quote.amount), 190);
check("server recalculates totals, validates line items and payment evidence");
await db.exec("reset role");
await db.query(
  `update subscriptions set trial_end=now()-interval '1 second' where org_id=$1`,
  [a],
);
await asUser(u1);
await rejects(() => insert(a, "client", "Expired"));
assert.equal((await db.query("select * from records")).rows.length, 0);
assert.equal((await db.query("select account_context()")).rows.length, 1);
check("expired trial blocks reads and writes while preserving account context");
await db.exec("reset role");
await db.query(
  `update subscriptions set status='active',paid_until=now()+interval '1 month',plan='essencial' where org_id=$1`,
  [a],
);
await asUser(u1);
await rejects(() => insert(a, "order", "Plan bypass"));
await rejects(() =>
  insert(a, "product", "Material bypass", 1, 0, { type: "material" }),
);
check("Essencial cannot bypass OS or material/stock entitlements");
await db.exec("reset role");
await db.query("insert into global_admins values($1)", [u1]);
await asUser(u1);
assert.equal((await db.query("select is_global_admin() ok")).rows[0].ok, false);
await asUser(u1, "aal2");
assert.equal((await db.query("select is_global_admin() ok")).rows[0].ok, true);
check("global administration requires allowlist and MFA AAL2");
await db.exec("reset role");
const provider = "test-preapproval",
  payment = "test-payment";
await db.query(
  `insert into checkout_attempts(org_id,plan,provider_id,status) values($1,'profissional',$2,'pending')`,
  [a, provider],
);
const params = [
  payment,
  provider,
  a,
  "profissional",
  "approved",
  99.9,
  "BRL",
  "2026-10-30T13:00:00Z",
];
await db.query("select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)", params);
const before = (
  await db.query("select paid_until from subscriptions where org_id=$1", [a])
).rows[0].paid_until;
await db.query("select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)", params);
assert.equal(
  String(
    (
      await db.query("select paid_until from subscriptions where org_id=$1", [
        a,
      ])
    ).rows[0].paid_until,
  ),
  String(before),
);
assert.equal((await db.query("select * from outbox")).rows.length, 1);
await rejects(() =>
  db.query("select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)", [
    "bad",
    provider,
    a,
    "profissional",
    "approved",
    1,
    "BRL",
    "2026-10-30T13:00:00Z",
  ]),
);
check("confirmed payment is idempotent and rejects mismatched amounts");
for (const delayed of ['pending','in_process','rejected','approved']) {
 await db.query('select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)',params.map((v,i)=>i===4?delayed:v));
}
assert.equal(String((await db.query('select paid_until from subscriptions where org_id=$1',[a])).rows[0].paid_until),String(before));
assert.equal((await db.query('select status from payments where id=$1',[payment])).rows[0].status,'approved');
await rejects(()=>db.query('select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)',params.map((v,i)=>i===7?null:v)));
check('out-of-order payment notifications cannot regress approval or grant access twice');

await db.query(
  `update subscriptions set status='trial_expired',purge_after=now()-interval '1 day' where org_id=$1`,
  [b],
);
await db.query(
  `insert into checkout_attempts(org_id,plan,status) values($1,'essencial','pending')`,
  [b],
);
await db.exec("select lifecycle()");
assert.equal(
  (await db.query("select suspended from subscriptions where org_id=$1", [b]))
    .rows[0].suspended,
  false,
);
check("retention job preserves accounts with pending checkouts");

await db.exec("reset role");
const u3 = "33333333-3333-4333-8333-333333333333";
await db.query("insert into auth.users(id) values($1)", [u3]);
await db.query("insert into memberships values($1,$2,'viewer',true)", [a, u3]);
await asUser(u3);
await rejects(() => insert(a, "client", "Viewer write"));
check("viewer cannot write even by calling the RPC directly");
await db.exec("reset role");
await db.query(
  "update memberships set active=false where org_id=$1 and user_id=$2",
  [a, u3],
);
await asUser(u3);
assert.equal(
  (await db.query("select * from records where org_id=$1", [a])).rows.length,
  0,
);
check("deactivating membership revokes data access immediately");
await asUser(u1);
await rejects(() =>
  insert(a, "product", "Negative stock", 10, 0, { stock_delta: -1 }),
);
await rpcHeartbeat();
async function rpcHeartbeat() {
  await db.query("select heartbeat($1)", [a]);
  await rejects(() => db.query("select heartbeat($1)", [b]));
}
check("stock cannot become negative and activity cannot spoof another tenant");
await db.exec("reset role");
await db.query(
  "insert into document_links(org_id,record_id,token_hash,snapshot,digest,expires_at) values($1,$2,'test-hash','{}','test-digest',now()+interval '1 day')",
  [a, quote.id],
);
await db.query(
  "select accept_document('test-hash','approved','Pessoa Exemplo',$1)",
  [JSON.stringify({ consent: true })],
);
await rejects(() =>
  db.query(
    "select accept_document('test-hash','declined','Pessoa Exemplo','{}')",
  ),
);
assert.equal(
  (await db.query("select status from records where id=$1", [quote.id])).rows[0]
    .status,
  "approved",
);
check(
  "document response binds snapshot digest and rejects duplicate acceptance",
);

for (const finalStatus of ['refunded','charged_back']) {
 const id='terminal-'+finalStatus;
 const args=params.map((v,i)=>i===0?id:v);
 await db.query('select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)',args);
 await db.query('select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)',args.map((v,i)=>i===4?finalStatus:v));
 await db.query('select confirm_payment($1,$2,$3,$4,$5,$6,$7,$8)',args);
 assert.equal((await db.query('select status from payments where id=$1',[id])).rows[0].status,finalStatus);
}
check('refunds and chargebacks cannot be resurrected by delayed approval');
await db.exec(await fs.readFile(new URL('../supabase/migrations/007_payment_ordering.sql',import.meta.url),'utf8'));
check('additive payment migration can be reapplied without losing data');
await db.exec("reset role");
await db.query("update subscriptions set plan='essencial', status='active', paid_until=now()+interval '1 day', suspended=false where org_id=$1", [a]);
await asUser(u1);
assert.equal(typeof (await db.query("select intelligence_finance($1) as report",[a])).rows[0].report.receivable, "number");
await rejects(() => db.query("select intelligence_finance($1,true)",[a]));
await rejects(() => db.query("select intelligence_finance($1)",[b]));
const operation = "33333333-3333-4333-8333-333333333333";
const batch = JSON.stringify([
  {kind:"expense",name:"Parcela 1/2",amount:25.01,due_date:"2026-12-31",installment:1},
  {kind:"expense",name:"Parcela 2/2",amount:25,due_date:"2027-01-31",installment:2},
]);
const batchCall = (id, rows) => db.query("select intelligence_create($1,$2,$3) as ids",[a,id,rows]);
await rejects(() => batchCall(operation,batch));
await db.exec("reset role");
await db.query("update subscriptions set plan='profissional' where org_id=$1",[a]);
await asUser(u1);
const first = (await batchCall(operation,batch)).rows[0].ids;
assert.equal(first.length,2);
assert.deepEqual((await batchCall(operation,batch)).rows[0].ids,first);
await rejects(() => batchCall(operation,JSON.stringify([{kind:"client",name:"Reuso incorreto"}])));
await rejects(() => batchCall("44444444-4444-4444-8444-444444444444", JSON.stringify([
  {kind:"client",name:"Não deve sobreviver"},{kind:"expense",name:"Inválido",amount:-1},
])));
assert.equal((await db.query("select count(*)::int as n from records where name='Não deve sobreviver'")).rows[0].n,0);
assert.equal((await db.query("select count(*)::int as n from records where data->>'installment_group'=$1",[operation])).rows[0].n,2);
check("Intelligence enforces plan and organization, saves batches atomically and deduplicates retries");
await db.query("select intelligence_reminder($1,2,true)",[a]);
assert.equal((await db.query("select intelligence_inbox($1) as inbox",[a])).rows[0].inbox.enabled,true);
await rejects(() => db.query("select intelligence_run_reminders()"));
await db.exec("reset role");
check("Intelligence reminders can be configured only by entitled members and the job is service-only");
console.log(`\n${passed} database checks passed.`);
await db.close();
