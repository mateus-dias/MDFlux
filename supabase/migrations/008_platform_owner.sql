-- Pin the existing, verified platform owner to an immutable Auth UUID.
-- Email changes and editable user_metadata never grant this privilege.
begin;
create table public.platform_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict
);
alter table public.platform_owner enable row level security;
revoke all on public.platform_owner from public, anon, authenticated;
grant select on public.platform_owner to service_role;
insert into public.platform_owner(user_id)
select id from auth.users where lower(email)='admin@mdflux.com.br' and email_confirmed_at is not null;
do $$ begin
  if not exists(select 1 from public.platform_owner) then
    raise exception 'A conta admin@mdflux.com.br deve existir e ter e-mail confirmado antes desta migração';
  end if;
end $$;
insert into public.global_admins(user_id) select user_id from public.platform_owner on conflict do nothing;

create function public.is_platform_owner() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from platform_owner where user_id=auth.uid())
$$;
create function public.platform_organization(o uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from memberships m join platform_owner p on p.user_id=m.user_id
    where m.org_id=o and m.role='owner' and m.active)
$$;
revoke all on function public.is_platform_owner(), public.platform_organization(uuid) from public,anon,authenticated;
grant execute on function public.is_platform_owner() to authenticated,service_role;
grant execute on function public.platform_organization(uuid) to service_role;

create or replace function public.entitled(o uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select (is_platform_owner() and is_member(o)) or
    (auth.role()='service_role' and platform_organization(o)) or
    exists(select 1 from subscriptions where org_id=o and not suspended and
      ((status='trialing' and trial_end>now()) or (status in ('active','canceled') and paid_until>now())))
$$;
create or replace function public.allowed(o uuid,k text,write_access boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from memberships m join subscriptions s on s.org_id=m.org_id
 where m.org_id=o and m.user_id=auth.uid() and m.active
 and (is_platform_owner() or (
   (k='ticket' or entitled(o))
   and (k<>'order' or s.plan<>'essencial' or s.status='trialing')
   and (k<>'ticket' or s.status in ('active','canceled'))))
 and (not write_access or m.role<>'viewer')
 and (m.role in ('owner','manager','viewer') or
   (m.role='finance' and k in ('client','supplier','income','expense','ticket')) or
   (m.role='operator' and k in ('client','quote','proposal','order','product','ticket'))))
$$;
create or replace function public.account_context() returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('server_now',now(),'organizations',(
   select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'settings',o.settings,'role',m.role,
     'subscription',to_jsonb(s) || case when is_platform_owner() then
       jsonb_build_object('exempt',true,'status','exempt','plan','empresarial','suspended',false)
       else '{}'::jsonb end)), '[]')
   from memberships m join organizations o on o.id=m.org_id join subscriptions s on s.org_id=o.id
   where m.user_id=auth.uid() and m.active),
   'admin',is_global_admin(),'platform_owner',is_platform_owner())
$$;

-- Keep the scheduled retention job from expiring or purging the owner's company.
create or replace function public.lifecycle() returns jsonb
language plpgsql security definer set search_path=public as $$
declare s subscriptions; n integer:=0; begin
 update subscriptions set status='trial_expired',updated_at=now()
 where status='trialing' and trial_end<=now() and not platform_organization(org_id);
 update subscriptions set status='past_due',updated_at=now()
 where status='active' and paid_until<=now() and not platform_organization(org_id);
 for s in select * from subscriptions where status='trial_expired' and purge_after<now()
   and not suspended and not platform_organization(org_id) for update skip locked loop
  if exists(select 1 from payments where org_id=s.org_id) or exists(select 1 from checkout_attempts where org_id=s.org_id and status in ('pending','creating')) then continue;end if;
  update document_links set revoked=true where org_id=s.org_id;
  delete from records where org_id=s.org_id and kind not in ('income','expense','contract') and not exists(select 1 from document_links where record_id=records.id);
  update subscriptions set status='expired',suspended=true where org_id=s.org_id;
  update memberships set active=false where org_id=s.org_id and role<>'owner';
  insert into audit(org_id,action) values(s.org_id,'retention.trial_purged');n:=n+1;
 end loop;
 delete from api_limits where window_start<now()-interval '2 days';
 return jsonb_build_object('purged',n);
end $$;
create or replace function public.save_record(p_org uuid,p_kind text,p_name text,p_status text,p_amount numeric,p_paid numeric,p_due date,p_data jsonb,p_id uuid default null,p_version integer default null) returns public.records language plpgsql security definer set search_path=public as $$
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
  if n>=50000 or (n>=300 and not is_platform_owner() and exists(select 1 from subscriptions where org_id=p_org and status='trialing')) then raise exception 'Limite de registros atingido'; end if;
  insert into records(org_id,kind,name,status,amount,paid,due_date,data) values(p_org,p_kind,trim(p_name),p_status,v_amount,p_paid,p_due,p_data) returning * into r;
 else
  select * into v_old from records where id=p_id and org_id=p_org and kind=p_kind for update;
  if v_old.id is null or v_old.version is distinct from p_version then raise exception 'Registro alterado. Atualize a tela'; end if;
  if exists(select 1 from document_links where record_id=p_id and not revoked and expires_at>now()) then raise exception 'Revogue o link publicado antes de editar'; end if;
  update records set name=trim(p_name),status=p_status,amount=v_amount,paid=p_paid,due_date=p_due,data=p_data,version=version+1,updated_at=now() where id=p_id returning * into r;
 end if;
 insert into audit(org_id,actor,action,entity_id,details) values(p_org,auth.uid(),case when p_id is null then 'record.created' else 'record.updated' end,r.id,jsonb_build_object('kind',r.kind,'version',r.version,'previous',to_jsonb(v_old)));
 return r; end $$;


-- Existing subscription rows are unchanged: no fabricated payment or paid-through date.
alter policy audit_read on public.audit using (
  is_member(org_id) and (is_platform_owner() or
    (exists(select 1 from subscriptions where org_id=audit.org_id and plan='empresarial')
     and exists(select 1 from memberships where org_id=audit.org_id and user_id=auth.uid() and role in ('owner','manager'))))
);
-- Enforce payment arithmetic and inventory movement at the database boundary.
create or replace function public.validate_record() returns trigger language plpgsql set search_path=public as $$ declare paid_sum numeric; delta numeric; s subscriptions; begin
 if new.kind in ('income','expense') then
  if jsonb_typeof(coalesce(new.data->'settlements','[]'))<>'array' then raise exception 'Baixas inválidas';end if;
  if exists(select 1 from jsonb_array_elements(coalesce(new.data->'settlements','[]')) x where (x->>'amount')::numeric<=0 or nullif(x->>'date','')::date is null) then raise exception 'Baixa inválida';end if;
  select coalesce(sum((x->>'amount')::numeric),0) into paid_sum from jsonb_array_elements(coalesce(new.data->'settlements','[]')) x;
  if round(paid_sum,2)<>new.paid then raise exception 'Total das baixas não corresponde ao valor recebido/pago';end if;
  new.status:=case when new.paid>=new.amount then 'paid' when new.paid>0 then 'partial' else 'pending' end;
 end if;
 if new.kind='product' then
  select * into s from subscriptions where org_id=new.org_id;
  delta:=coalesce((new.data->>'stock_delta')::numeric,0);
  if s.plan='essencial' and not public.is_platform_owner() and (delta<>0 or coalesce(new.data->>'type','service')='material') then raise exception 'Estoque e materiais exigem Profissional ou Empresarial';end if;
  new.data:=new.data||jsonb_build_object('stock',case when tg_op='INSERT' then 0 else coalesce((old.data->>'stock')::numeric,0) end+delta,'stock_delta',0,'movements',(case when tg_op='INSERT' then '[]'::jsonb else coalesce(old.data->'movements','[]') end)||case when delta<>0 then jsonb_build_array(jsonb_build_object('delta',delta,'at',now(),'actor',auth.uid())) else '[]'::jsonb end);
  if (new.data->>'stock')::numeric<0 then raise exception 'Estoque insuficiente';end if;
 end if;
 return new;end $$;
create or replace function public.manage_member(p_org uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=public as $$ declare lim integer; begin
 if not is_owner(p_org) or not entitled(p_org) or p_role='owner' or p_user=auth.uid() then raise exception 'Operação não autorizada'; end if;
 select case when is_platform_owner() then 10 else case plan when 'essencial' then 1 when 'profissional' then 3 else 10 end end into lim from subscriptions where org_id=p_org;
 perform 1 from organizations where id=p_org for update;
 if p_active and (select count(*) from memberships where org_id=p_org and active and user_id<>p_user)>=lim then raise exception 'Limite de usuários do plano'; end if;
 update memberships set role=p_role,active=p_active where org_id=p_org and user_id=p_user and role<>'owner';
 insert into audit(org_id,actor,action,details) values(p_org,auth.uid(),'member.updated',jsonb_build_object('user',p_user,'role',p_role,'active',p_active)); end $$;

create or replace function public.attach_invited_user(p_org uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$ declare lim integer;begin
 perform 1 from organizations where id=p_org for update;
 if p_role not in ('manager','finance','operator','viewer') or not entitled(p_org) then raise exception 'Convite não autorizado';end if;
 select case when platform_organization(p_org) then 10 else case plan when 'essencial' then 1 when 'profissional' then 3 else 10 end end into lim from subscriptions where org_id=p_org;
 if (select count(*) from memberships where org_id=p_org and active)>=lim then raise exception 'Limite de usuários';end if;
 insert into memberships(org_id,user_id,role) values(p_org,p_user,p_role);
end $$;

commit;
