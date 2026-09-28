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
