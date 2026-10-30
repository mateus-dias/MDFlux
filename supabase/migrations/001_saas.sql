-- Fresh, independent Supabase project. Never apply on the Mendes database.
create extension if not exists pgcrypto;
create table public.organizations(id uuid primary key default gen_random_uuid(), name text not null default 'Minha empresa', settings jsonb not null default '{}', created_at timestamptz not null default now());
create table public.memberships(org_id uuid references public.organizations on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner','manager','finance','operator','viewer')), active boolean not null default true, primary key(org_id,user_id));
create table public.subscriptions(org_id uuid primary key references public.organizations on delete cascade, plan text not null default 'profissional' check(plan in ('essencial','profissional','empresarial')), status text not null default 'trialing', trial_start timestamptz not null default now(), trial_end timestamptz not null default now()+interval '72 hours', paid_until timestamptz, provider_id text unique, suspended boolean not null default false, purge_after timestamptz not null default now()+interval '10 days', updated_at timestamptz not null default now());
create table public.records(id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations on delete cascade, kind text not null check(kind in ('client','supplier','quote','proposal','contract','order','income','expense','product','ticket')), name text not null check(length(name) between 1 and 200), status text not null default 'draft', amount numeric(14,2) not null default 0 check(amount>=0), paid numeric(14,2) not null default 0 check(paid>=0 and paid<=amount), due_date date, data jsonb not null default '{}', version integer not null default 1, archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index records_tenant_kind on public.records(org_id,kind,created_at desc);
create index records_due on public.records(org_id,due_date) where not archived;
create table public.audit(id bigint generated always as identity primary key, org_id uuid references public.organizations on delete set null, actor uuid, action text not null, entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now());
create table public.global_admins(user_id uuid primary key references auth.users on delete cascade);
create table public.checkout_attempts(id uuid primary key default gen_random_uuid(),org_id uuid references public.organizations,plan text not null,provider_id text unique,url text,status text not null default 'creating',created_at timestamptz default now());
create unique index one_pending_checkout on public.checkout_attempts(org_id) where status in ('creating','pending');
create table public.payments(id text primary key,org_id uuid references public.organizations,provider_id text not null,status text not null,amount numeric(14,2) not null,currency text not null,paid_at timestamptz,created_at timestamptz default now());
create table public.outbox(id text primary key,event text not null,org_id uuid references public.organizations,consent boolean not null default false,payload jsonb not null default '{}',sent_at timestamptz,attempts integer not null default 0,created_at timestamptz default now());
create table public.document_links(id uuid primary key default gen_random_uuid(),org_id uuid references public.organizations on delete cascade,record_id uuid references public.records on delete cascade,token_hash text unique not null,snapshot jsonb not null,digest text not null,expires_at timestamptz not null,revoked boolean not null default false,created_at timestamptz default now());
create table public.document_acceptances(link_id uuid primary key references public.document_links,decision text not null check(decision in ('approved','declined')),signer text not null,digest text not null,evidence jsonb not null,created_at timestamptz not null default now());
create table public.deletion_requests(org_id uuid primary key references public.organizations,requested_by uuid not null,created_at timestamptz default now(),status text default 'requested');
create table public.api_limits(key text primary key,hits integer not null default 0,window_start timestamptz not null default now());

create function public.is_member(o uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from memberships where org_id=o and user_id=auth.uid() and active) $$;
create function public.is_owner(o uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from memberships where org_id=o and user_id=auth.uid() and active and role='owner') $$;
create function public.is_global_admin() returns boolean language sql stable security definer set search_path=public as $$ select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from global_admins where user_id=auth.uid()) $$;
create function public.entitled(o uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from subscriptions where org_id=o and not suspended and ((status='trialing' and trial_end>now()) or (status in ('active','canceled') and paid_until>now()))) $$;
create function public.allowed(o uuid,k text,write_access boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from memberships m join subscriptions s on s.org_id=m.org_id where m.org_id=o and m.user_id=auth.uid() and m.active
 and (k='ticket' or entitled(o))
 and (k<>'order' or s.plan<>'essencial' or s.status='trialing')
 and (k<>'ticket' or s.status in ('active','canceled'))
 and (not write_access or m.role<>'viewer')
 and (m.role in ('owner','manager','viewer') or (m.role='finance' and k in ('client','supplier','income','expense','ticket')) or (m.role='operator' and k in ('client','quote','proposal','order','product','ticket')))) $$;

-- All public tables default deny. Only the policies below authorize browser reads.
do $$ declare t text; begin foreach t in array array['organizations','memberships','subscriptions','records','audit','global_admins','checkout_attempts','payments','outbox','document_links','document_acceptances','deletion_requests','api_limits'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy org_read on public.organizations for select to authenticated using(is_member(id));
create policy member_read on public.memberships for select to authenticated using(is_member(org_id));
create policy subscription_read on public.subscriptions for select to authenticated using(is_member(org_id));
create policy record_read on public.records for select to authenticated using(allowed(org_id,kind));
create policy audit_read on public.audit for select to authenticated using(is_member(org_id) and exists(select 1 from subscriptions where org_id=audit.org_id and plan='empresarial') and exists(select 1 from memberships where org_id=audit.org_id and user_id=auth.uid() and role in ('owner','manager')));
create policy payment_read on public.payments for select to authenticated using(is_owner(org_id));
create policy deletion_read on public.deletion_requests for select to authenticated using(is_owner(org_id));

create function public.bootstrap_user() returns trigger language plpgsql security definer set search_path=public as $$ declare o uuid; begin
 insert into organizations(name) values(coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'),''),'Minha') || ' · Empresa') returning id into o;
 insert into memberships values(o,new.id,'owner',true); insert into subscriptions(org_id) values(o);
 insert into audit(org_id,actor,action) values(o,new.id,'registration'); return new; end $$;
create trigger new_auth_user after insert on auth.users for each row execute function public.bootstrap_user();

create function public.save_record(p_org uuid,p_kind text,p_name text,p_status text,p_amount numeric,p_paid numeric,p_due date,p_data jsonb,p_id uuid default null,p_version integer default null) returns public.records language plpgsql security definer set search_path=public as $$
declare r records; v_amount numeric:=round(p_amount,2); v_old records; n integer; begin
 if not allowed(p_org,p_kind,true) then raise exception 'Sem permissão ou assinatura expirada'; end if;
 if length(trim(p_name)) not between 1 and 200 or length(p_data::text)>100000 or jsonb_typeof(p_data)<>'object' or p_amount<0 or p_paid<0 or p_paid>p_amount then raise exception 'Dados inválidos'; end if;
 if p_data ? 'items' then
  if jsonb_typeof(p_data->'items')<>'array' or jsonb_array_length(p_data->'items')>100 then raise exception 'Itens inválidos'; end if;
  if exists(select 1 from jsonb_array_elements(p_data->'items') x where (x->>'qty')::numeric<=0 or (x->>'price')::numeric<0) then raise exception 'Quantidade ou preço inválido'; end if;
  select round(coalesce(sum((x->>'qty')::numeric*(x->>'price')::numeric),0)-coalesce((p_data->>'discount')::numeric,0),2) into v_amount from jsonb_array_elements(p_data->'items') x;
  if v_amount<0 or coalesce((p_data->>'discount')::numeric,0)<0 then raise exception 'Desconto inválido'; end if;
 end if;
 if nullif(p_data->>'client_id','') is not null and not exists(select 1 from records where id=(p_data->>'client_id')::uuid and org_id=p_org and kind='client' and not archived) then raise exception 'Cliente inválido'; end if;
 if nullif(p_data->>'order_id','') is not null and not exists(select 1 from records where id=(p_data->>'order_id')::uuid and org_id=p_org and kind='order' and not archived) then raise exception 'OS inválida'; end if;
 if p_id is null then
  perform 1 from organizations where id=p_org for update;
  select count(*) into n from records where org_id=p_org and not archived;
  if n>=50000 or (n>=300 and exists(select 1 from subscriptions where org_id=p_org and status='trialing')) then raise exception 'Limite de registros atingido'; end if;
  insert into records(org_id,kind,name,status,amount,paid,due_date,data) values(p_org,p_kind,trim(p_name),p_status,v_amount,p_paid,p_due,p_data) returning * into r;
 else
  select * into v_old from records where id=p_id and org_id=p_org and kind=p_kind for update;
  if v_old.id is null or v_old.version is distinct from p_version then raise exception 'Registro alterado. Atualize a tela'; end if;
  if exists(select 1 from document_links where record_id=p_id and not revoked and expires_at>now()) then raise exception 'Revogue o link publicado antes de editar'; end if;
  update records set name=trim(p_name),status=p_status,amount=v_amount,paid=p_paid,due_date=p_due,data=p_data,version=version+1,updated_at=now() where id=p_id returning * into r;
 end if;
 insert into audit(org_id,actor,action,entity_id,details) values(p_org,auth.uid(),case when p_id is null then 'record.created' else 'record.updated' end,r.id,jsonb_build_object('kind',r.kind,'version',r.version,'previous',to_jsonb(v_old)));
 return r; end $$;
create function public.archive_record(p_id uuid,p_version integer) returns void language plpgsql security definer set search_path=public as $$ declare r records; begin
 select * into r from records where id=p_id for update;
 if not allowed(r.org_id,r.kind,true) or not exists(select 1 from memberships where org_id=r.org_id and user_id=auth.uid() and role in ('owner','manager')) then raise exception 'Sem permissão'; end if;
 if r.version<>p_version then raise exception 'Registro alterado'; end if;
 update records set archived=true,version=version+1 where id=p_id;
 update document_links set revoked=true where record_id=p_id;
 insert into audit(org_id,actor,action,entity_id) values(r.org_id,auth.uid(),'record.archived',r.id); end $$;
create function public.update_settings(p_org uuid,p_name text,p_settings jsonb) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_owner(p_org) then raise exception 'Somente o titular'; end if;
 if length(p_name)>200 or length(p_settings::text)>20000 then raise exception 'Dados inválidos'; end if;
 update organizations set name=p_name,settings=p_settings where id=p_org;
 insert into audit(org_id,actor,action) values(p_org,auth.uid(),'settings.updated'); end $$;
create function public.manage_member(p_org uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$ declare lim integer; begin
 if not is_owner(p_org) or not entitled(p_org) or p_role='owner' or p_user=auth.uid() then raise exception 'Operação não autorizada'; end if;
 select case plan when 'essencial' then 1 when 'profissional' then 3 else 10 end into lim from subscriptions where org_id=p_org;
 perform 1 from organizations where id=p_org for update;
 if p_active and (select count(*) from memberships where org_id=p_org and active and user_id<>p_user)>=lim then raise exception 'Limite de usuários do plano'; end if;
 update memberships set role=p_role,active=p_active where org_id=p_org and user_id=p_user and role<>'owner';
 insert into audit(org_id,actor,action,details) values(p_org,auth.uid(),'member.updated',jsonb_build_object('user',p_user,'role',p_role,'active',p_active)); end $$;
create function public.request_deletion(p_org uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if not is_owner(p_org) then raise exception 'Somente o titular'; end if;
 insert into deletion_requests(org_id,requested_by) values(p_org,auth.uid()) on conflict do nothing;
 insert into audit(org_id,actor,action) values(p_org,auth.uid(),'deletion.requested'); end $$;
create function public.account_context() returns jsonb language sql stable security definer set search_path=public as $$ select jsonb_build_object('server_now',now(),'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'settings',o.settings,'role',m.role,'subscription',to_jsonb(s))), '[]') from memberships m join organizations o on o.id=m.org_id join subscriptions s on s.org_id=o.id where m.user_id=auth.uid() and m.active),'admin',is_global_admin()) $$;

-- Only service-role APIs may mutate billing, links and retention. Function execution is explicit.
revoke all on all tables in schema public from anon,authenticated;
grant select on organizations,memberships,subscriptions,records,audit,payments,deletion_requests to authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_member(uuid),public.is_owner(uuid),public.is_global_admin(),public.entitled(uuid),public.allowed(uuid,text,boolean),public.account_context(),public.save_record(uuid,text,text,text,numeric,numeric,date,jsonb,uuid,integer),public.archive_record(uuid,integer),public.update_settings(uuid,text,jsonb),public.manage_member(uuid,uuid,text,boolean),public.request_deletion(uuid) to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
