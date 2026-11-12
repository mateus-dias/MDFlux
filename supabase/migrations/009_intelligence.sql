begin;

create table public.intelligence_operations (
  org_id uuid not null references public.organizations on delete cascade,
  actor uuid not null,
  id uuid not null,
  request jsonb not null,
  record_ids uuid[] not null default '{}',
  primary key (org_id, actor, id)
);
alter table public.intelligence_operations enable row level security;
revoke all on public.intelligence_operations from public, anon, authenticated;

create function public.intelligence_access(p_org uuid, p_advanced boolean)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select public.is_member(p_org) and public.entitled(p_org) and
    (not p_advanced or exists (
      select 1 from public.subscriptions
      where org_id = p_org and plan in ('profissional', 'empresarial')
    ))
$$;

create function public.intelligence_finance(p_org uuid, p_advanced boolean default false)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare
  local_day date := (now() at time zone 'America/Sao_Paulo')::date;
  month_start date := date_trunc('month', local_day)::date;
  previous_start date := (month_start - interval '1 month')::date;
  next_start date := (month_start + interval '1 month')::date;
  report jsonb;
begin
  if not public.intelligence_access(p_org, p_advanced)
     or not public.allowed(p_org, 'income') or not public.allowed(p_org, 'expense')
  then raise exception 'Sem permissão para esta consulta'; end if;
  with financial as (
    select * from public.records
    where org_id = p_org and not archived and kind in ('income', 'expense')
  ), balances as (
    select
      coalesce(sum(amount-paid) filter(where kind='income' and due_date >= month_start and due_date < next_start),0) as receivable_month,
      coalesce(sum(amount-paid) filter(where kind='income'),0) as receivable,
      coalesce(sum(amount-paid) filter(where kind='expense'),0) as payable,
      coalesce(sum(amount-paid) filter(where kind='income' and due_date < local_day),0) as overdue_income,
      coalesce(sum(amount-paid) filter(where kind='expense' and due_date < local_day),0) as overdue_expense,
      count(*) filter(where amount>paid and due_date between local_day and local_day+7) as due_soon
    from financial
  ), cash as (
    select kind, (s->>'date')::date as day, (s->>'amount')::numeric as amount,
      coalesce(nullif(data->>'category',''),'Sem categoria') as category
    from financial cross join lateral jsonb_array_elements(coalesce(data->'settlements','[]')) s
    where p_advanced
  ), totals as (
    select
      coalesce(sum(amount) filter(where kind='income' and day >= month_start and day <= local_day),0) as received,
      coalesce(sum(amount) filter(where kind='expense' and day >= month_start and day <= local_day),0) as paid,
      coalesce(sum(amount) filter(where kind='income' and day >= previous_start and day < month_start),0) as previous_received,
      coalesce(sum(amount) filter(where kind='expense' and day >= previous_start and day < month_start),0) as previous_paid,
      coalesce(sum(case when kind='income' then amount else -amount end) filter(where day <= local_day),0) as recorded_cash
    from cash
  ), categories as (
    select category, sum(amount) as paid from cash
    where kind='expense' and day between month_start and local_day
    group by category order by paid desc, category limit 5
  )
  select to_jsonb(balances) || jsonb_build_object('as_of', local_day, 'month_start', month_start) ||
    case when p_advanced then to_jsonb(totals) || jsonb_build_object('categories',
      coalesce((select jsonb_agg(to_jsonb(categories) order by paid desc, category) from categories),'[]'))
    else '{}'::jsonb end
  into report from balances cross join totals;
  return report;
end
$$;

create function public.intelligence_create(p_org uuid, p_operation uuid, p_rows jsonb)
returns uuid[] language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  entry jsonb;
  saved public.records;
  prior public.intelligence_operations;
  ids uuid[] := '{}';
  record_kind text;
  record_amount numeric;
  record_due date;
  relation_id uuid;
  metadata jsonb;
begin
  if not public.intelligence_access(p_org, true) then raise exception 'Assistente operacional indisponível para este plano'; end if;
  if p_operation is null or p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Operação inválida'; end if;
  if jsonb_array_length(p_rows) not between 1 and 300 or octet_length(p_rows::text)>200000 then raise exception 'Limite de registros por operação excedido'; end if;

  insert into public.intelligence_operations(org_id,actor,id,request)
    values(p_org,auth.uid(),p_operation,p_rows) on conflict do nothing;
  select * into prior from public.intelligence_operations
    where org_id=p_org and actor=auth.uid() and id=p_operation for update;
  if prior.request is distinct from p_rows then raise exception 'Identificador já utilizado'; end if;
  if cardinality(prior.record_ids)>0 then return prior.record_ids; end if;

  perform 1 from public.organizations where id=p_org for update;
  for entry in select value from jsonb_array_elements(p_rows) loop
    record_kind := entry->>'kind';
    if record_kind is null or record_kind not in ('client','supplier','product','income','expense') then raise exception 'Tipo não permitido'; end if;
    if not public.allowed(p_org,record_kind,true) then raise exception 'Sem permissão para gravar este registro'; end if;
    record_amount := coalesce((entry->>'amount')::numeric,0);
    record_due := (entry->>'due_date')::date;
    if record_amount < 0 or record_amount > 999999999999.99
       or record_amount <> round(record_amount,2)
       or (record_kind in ('income','expense') and (record_amount <= 0 or record_due is null))
    then raise exception 'Valor ou vencimento inválido'; end if;
    if coalesce((entry->>'import_row')::boolean,false) and exists (
      select 1 from public.records where org_id=p_org and not archived and kind=record_kind
        and lower(trim(name))=lower(trim(entry->>'name'))
        and amount=record_amount and due_date=record_due
    ) then raise exception 'Possível duplicidade no financeiro. Revise a planilha e importe novamente.'; end if;
    metadata := jsonb_strip_nulls(jsonb_build_object('category',left(entry->>'category',100),
      'installment_group',case when (entry->>'installment')::int is not null then p_operation end,
      'installment',(entry->>'installment')::int,'type',case when record_kind='product' then 'service' end));
    relation_id := (entry->>'contact_id')::uuid;
    if relation_id is not null then
      if record_kind not in ('income','expense') or not exists (
        select 1 from public.records where id=relation_id and org_id=p_org and not archived
          and kind=case record_kind when 'income' then 'client' else 'supplier' end
      ) then raise exception 'Cliente ou fornecedor inválido'; end if;
      metadata := metadata || jsonb_build_object(case record_kind when 'income' then 'client_id' else 'supplier_id' end, relation_id);
    end if;
    saved := public.save_record(p_org,record_kind,entry->>'name',
      case when record_kind in ('income','expense') then 'pending' else 'active' end,
      record_amount,0,record_due,metadata);
    ids := array_append(ids,saved.id);
  end loop;
  update public.intelligence_operations set record_ids=ids
    where org_id=p_org and actor=auth.uid() and id=p_operation;
  return ids;
end
$$;

revoke execute on function public.intelligence_access(uuid,boolean),
  public.intelligence_finance(uuid,boolean), public.intelligence_create(uuid,uuid,jsonb)
  from public, anon;
grant execute on function public.intelligence_access(uuid,boolean),
  public.intelligence_finance(uuid,boolean), public.intelligence_create(uuid,uuid,jsonb)
  to authenticated;
create function public.intelligence_collections(p_org uuid)
returns table(id uuid, name text, due_date date, balance numeric, client text, phone text)
language plpgsql stable security invoker set search_path = public, pg_temp
as $$
begin
  if not public.intelligence_access(p_org,true) or not public.allowed(p_org,'income')
     or not public.allowed(p_org,'client') then raise exception 'Sem permissão para consultar cobranças'; end if;
  return query select r.id, r.name, r.due_date, r.amount-r.paid, c.name,
    coalesce(c.data->>'phone',c.data->>'whatsapp')
  from public.records r left join public.records c
    on c.id::text=r.data->>'client_id' and c.org_id=p_org and c.kind='client' and not c.archived
  where r.org_id=p_org and r.kind='income' and not r.archived and r.amount>r.paid
    and r.due_date < (now() at time zone 'America/Sao_Paulo')::date
  order by r.due_date,r.id limit 50;
end
$$;

create table public.intelligence_reminders (
  org_id uuid not null references public.organizations on delete cascade,
  actor uuid not null references auth.users on delete cascade,
  days_before integer not null check(days_before between 0 and 30),
  enabled boolean not null default true,
  primary key(org_id,actor)
);
create table public.intelligence_notifications (
  org_id uuid not null,
  actor uuid not null,
  record_id uuid not null references public.records on delete cascade,
  due_date date not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key(org_id,actor,record_id,due_date),
  foreign key(org_id,actor) references public.intelligence_reminders on delete cascade
);
alter table public.intelligence_reminders enable row level security;
alter table public.intelligence_notifications enable row level security;
revoke all on public.intelligence_reminders,public.intelligence_notifications from public,anon,authenticated;

create function public.intelligence_reminder(p_org uuid,p_days integer,p_enabled boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.intelligence_access(p_org,true) or not public.allowed(p_org,'income')
     or not public.allowed(p_org,'expense') then raise exception 'Sem permissão para configurar lembretes'; end if;
  insert into public.intelligence_reminders(org_id,actor,days_before,enabled)
  values(p_org,auth.uid(),p_days,p_enabled) on conflict(org_id,actor)
  do update set days_before=excluded.days_before,enabled=excluded.enabled;
  insert into public.audit(org_id,actor,action,details) values(p_org,auth.uid(),'intelligence.reminder',
    jsonb_build_object('days_before',p_days,'enabled',p_enabled));
end
$$;

create function public.intelligence_run_reminders()
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.intelligence_notifications(org_id,actor,record_id,due_date)
  select p.org_id,p.actor,r.id,r.due_date
  from public.intelligence_reminders p
  join public.memberships m on m.org_id=p.org_id and m.user_id=p.actor and m.active
  join public.subscriptions s on s.org_id=p.org_id and s.plan in ('profissional','empresarial')
  join public.records r on r.org_id=p.org_id
  where p.enabled and public.entitled(p.org_id)
    and m.role in ('owner','manager','finance','viewer')
    and r.kind in ('income','expense') and not r.archived and r.amount>r.paid
    and r.due_date between (now() at time zone 'America/Sao_Paulo')::date
      and (now() at time zone 'America/Sao_Paulo')::date+p.days_before
  on conflict do nothing
$$;

create function public.intelligence_inbox(p_org uuid, p_mark_read boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare response jsonb;
begin
  if not public.intelligence_access(p_org,true) or not public.allowed(p_org,'income')
     or not public.allowed(p_org,'expense') then raise exception 'Sem permissão para consultar notificações'; end if;
  if p_mark_read then
    update public.intelligence_notifications set read_at=now()
    where org_id=p_org and actor=auth.uid() and read_at is null;
  end if;
  select jsonb_build_object('enabled',coalesce(p.enabled,false),'days_before',coalesce(p.days_before,2),'items',
    coalesce((select jsonb_agg(to_jsonb(q)) from (
      select r.name,r.kind,n.due_date,n.created_at,n.read_at from public.intelligence_notifications n
      join public.records r on r.id=n.record_id and r.org_id=n.org_id
      where n.org_id=p_org and n.actor=auth.uid() and not r.archived
      order by n.created_at desc,n.record_id limit 50
    ) q),'[]')) into response
  from (select 1) base left join public.intelligence_reminders p on p.org_id=p_org and p.actor=auth.uid();
  return response;
end
$$;

revoke execute on function public.intelligence_collections(uuid),
  public.intelligence_reminder(uuid,integer,boolean),public.intelligence_inbox(uuid,boolean)
  from public,anon;
grant execute on function public.intelligence_collections(uuid),
  public.intelligence_reminder(uuid,integer,boolean),public.intelligence_inbox(uuid,boolean) to authenticated;
revoke execute on function public.intelligence_run_reminders() from public,anon,authenticated;
grant execute on function public.intelligence_run_reminders() to service_role;
commit;
