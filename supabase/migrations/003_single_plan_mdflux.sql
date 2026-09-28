insert into public.plans(name,price,user_limit,description,active) values
('MD Flux',69.90,3,'Gestão empresarial integrada para até 3 usuários',true)
on conflict(name) do update set price=excluded.price,user_limit=excluded.user_limit,description=excluded.description,active=true;

update public.plans set active=false where name <> 'MD Flux';

insert into public.modules(code,name,description) values
('dashboard','Dashboard','Indicadores e visão geral'),('finance','Financeiro','Gestão financeira e contas a pagar/receber'),('customers','Clientes','Cadastro e histórico'),('calendar','Agenda','Compromissos e serviços'),('catalog','Produtos e Serviços','Catálogo central'),('sales','Vendas','Vendas e movimentações'),('reports','Relatórios','Análises e exportações'),('settings','Configurações','Empresa e preferências') on conflict(code) do update set name=excluded.name,description=excluded.description;

insert into public.plan_modules(plan_id,module_id)
select p.id,m.id from public.plans p cross join public.modules m
where p.name='MD Flux' and m.code in ('dashboard','finance','customers','calendar','catalog','sales','reports','settings')
on conflict do nothing;

-- Mantém o limite comercial de 3 usuários por empresa no plano MD Flux.


-- Integração rastreável entre vendas e financeiro.
alter table public.financial_transactions add column if not exists sale_id uuid references public.sales(id) on delete cascade;
create index if not exists financial_transactions_sale_id_idx on public.financial_transactions(sale_id);

-- Limite do plano: no máximo 3 usuários ativos por empresa.
create or replace function public.enforce_mdflux_user_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare active_count integer; max_users integer;
begin
  if new.status <> 'active' then return new; end if;
  select coalesce(p.user_limit,3) into max_users
  from public.subscriptions s join public.plans p on p.id=s.plan_id
  where s.company_id=new.company_id and s.status in ('paid','pending','exempt')
  order by s.created_at desc limit 1;
  max_users := coalesce(max_users,3);
  select count(*) into active_count from public.company_users cu
  where cu.company_id=new.company_id and cu.status='active' and (tg_op='INSERT' or cu.id<>new.id);
  if active_count >= max_users then raise exception 'Limite de % usuários ativos atingido para esta empresa.', max_users; end if;
  return new;
end $$;
drop trigger if exists trg_enforce_mdflux_user_limit on public.company_users;
create trigger trg_enforce_mdflux_user_limit before insert or update of status,company_id on public.company_users
for each row execute function public.enforce_mdflux_user_limit();
