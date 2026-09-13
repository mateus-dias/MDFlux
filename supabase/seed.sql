insert into public.plans(name,price,user_limit,description) values
('Básico',49.90,1,'Essencial para organizar a gestão'),('Profissional',79.90,3,'Automação e visão completa'),('Completo',124.90,10,'Operação integrada com equipe e estoque') on conflict(name) do update set price=excluded.price,user_limit=excluded.user_limit;
insert into public.modules(code,name,description) values
('dashboard','Dashboard','Indicadores e visão geral'),('finance','Financeiro','Fluxo de caixa e contas'),('customers','Clientes','Cadastro e histórico'),('calendar','Agenda','Compromissos e serviços'),('catalog','Produtos e Serviços','Catálogo central'),('sales','Vendas','Vendas e movimentações'),('inventory','Estoque','Saldos, inventário e alertas'),('reports','Relatórios','Análises e exportações'),('team','Equipe','Usuários e permissões'),('settings','Configurações','Empresa e preferências') on conflict(code) do nothing;

