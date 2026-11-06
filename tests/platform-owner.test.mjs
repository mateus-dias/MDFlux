import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { customerStatus, contactNumber } from "../src/commercial.mjs";

test("commercial status follows dates, suspension and confirmed access", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(
    customerStatus(
      { status: "trialing", trial_end: new Date(now).toISOString() },
      now,
    ),
    "trial_ended",
  );
  assert.equal(
    customerStatus({ status: "active", paid_until: "2026-11-10" }, now),
    "due_soon",
  );
  assert.equal(
    customerStatus({ status: "active", paid_until: "2026-11-05" }, now),
    "overdue",
  );
  assert.equal(
    customerStatus({ status: "active", paid_until: "2026-12-10" }, now),
    "active",
  );
  assert.equal(
    customerStatus({ status: "trial_expired" }, now, true),
    "exempt",
  );
  assert.equal(customerStatus({ suspended: true }, now), "suspended");
  assert.equal(contactNumber("(11) 99999-9999"), "5511999999999");
  assert.equal(contactNumber(""), null);
});

test("pinned owner bypasses expiration, retains data and cannot grant other users a bypass", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select current_user::text$$;
      create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))$$;
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant execute on all functions in schema auth to anon,authenticated,service_role;`);
    await db.exec(
      `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;grant execute on function storage.foldername(text) to authenticated;`,
    );
    for (const name of [
      "001_saas.sql",
      "002_storage.sql",
      "003_service.sql",
      "004_validation.sql",
      "005_member_storage.sql",
      "006_activity.sql",
      "007_payment_ordering.sql",
    ]) {
      const sql = await fs.readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      );
      await db.exec(
        sql.replace("create extension if not exists pgcrypto;", ""),
      );
    }
    const root = "11111111-1111-4111-8111-111111111111",
      client = "22222222-2222-4222-8222-222222222222";
    await db.exec(`insert into auth.users(id,email,email_confirmed_at) values
      ('${root}','admin@mdflux.com.br',now()), ('${client}','cliente@example.com',now());
      update subscriptions set plan='essencial',trial_end=now()-interval '20 days',purge_after=now()-interval '10 days';`);
    await db.exec(
      await fs.readFile(
        new URL(
          "../supabase/migrations/008_platform_owner.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const { rows: memberships } = await db.query("select * from memberships");
    const rootOrg = memberships.find((m) => m.user_id === root).org_id;
    const clientOrg = memberships.find((m) => m.user_id === client).org_id;
    async function asUser(id, aal = "aal1") {
      await db.exec("reset role");
      await db.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",
        [id, aal],
      );
      await db.exec("set role authenticated");
    }
    await asUser(root);
    const context = (await db.query("select account_context() c")).rows[0].c;
    assert.equal(context.platform_owner, true);
    assert.equal(context.admin, false, "global dashboard still requires MFA");
    assert.equal(context.organizations[0].subscription.exempt, true);
    assert.equal(
      (await db.query("select entitled($1) ok", [rootOrg])).rows[0].ok,
      true,
    );
    assert.equal(
      (await db.query("select allowed($1,'order',true) ok", [rootOrg])).rows[0]
        .ok,
      true,
    );
    assert.equal(
      (await db.query("select allowed($1,'quote',true) ok", [clientOrg]))
        .rows[0].ok,
      false,
    );
    await db.query(
      "select save_record($1,'quote','Orçamento preservado','draft',0,0,null,'{}')",
      [rootOrg],
    );
    await db.query(
      "select save_record($1,'product','Material','active',0,0,null,'{\"type\":\"material\",\"stock_delta\":2}')",
      [rootOrg],
    );
    assert.equal(
      (
        await db.query("select count(*) n from audit where org_id=$1", [
          rootOrg,
        ])
      ).rows[0].n > 0,
      true,
    );
    await asUser(root, "aal2");
    assert.equal(
      (await db.query("select is_global_admin() ok")).rows[0].ok,
      true,
    );
    await db.exec("reset role");
    await db.query("insert into memberships values($1,$2,'viewer',true)", [
      rootOrg,
      client,
    ]);
    await db.query("insert into global_admins values($1)", [client]);
    await db.exec("set role service_role; select lifecycle(); reset role");
    assert.equal(
      (
        await db.query("select count(*) n from records where org_id=$1", [
          rootOrg,
        ])
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query("select status from subscriptions where org_id=$1", [
          clientOrg,
        ])
      ).rows[0].status,
      "expired",
    );
    await asUser(client, "aal2");
    assert.equal(
      (await db.query("select is_platform_owner() ok")).rows[0].ok,
      false,
    );
    assert.equal(
      (await db.query("select entitled($1) ok", [rootOrg])).rows[0].ok,
      false,
      "a colleague does not inherit the exemption",
    );
    await assert.rejects(db.query("select * from platform_owner"));
    await db.exec("reset role");
    await db.query(
      "update auth.users set email='novo@example.com' where id=$1",
      [root],
    );
    await db.query(
      "update auth.users set email='admin@mdflux.com.br',raw_user_meta_data='{\"is_admin\":true}' where id=$1",
      [client],
    );
    await asUser(client);
    assert.equal(
      (await db.query("select is_platform_owner() ok")).rows[0].ok,
      false,
      "reusing the email or metadata never grants privilege",
    );
  } finally {
    await db.close();
  }
});
