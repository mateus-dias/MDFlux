# Auditoria dos anexos e decisões

## MD Flux original

O ZIP externo contém 36 entradas, site e build estáticos, `package.json` com apenas script de cópia/build Node, três migrações e três ZIPs internos. Foram inventariados também os ZIPs `MDFlux-codigo-completo-documentos-premium.zip` (31 entradas), `MDFlux-codigo-completo-netlify-corrigido.zip` (31) e `md-flux.zip` (18). Eles mantêm a mesma família de aplicação estática, não uma base React/TypeScript oculta.

O material original tem versões duplicadas de site/dist e migrações referentes ao modelo anterior. Republicar um ZIP interno poderia reintroduzir divergências. A estratégia escolhida foi uma nova base independente, com migrações próprias e configuração explícita. Preservados o logotipo original, identidade azul, marca, proposta comercial e contato encontrado no site. A lógica estática antiga não foi tratada como backend seguro.

## Mendes

O arquivo contém 164 entradas: código React 19/TypeScript/Vite, componentes de formulários/documentos/totais, módulos parametrizados, dashboard, filtros, permissões, Supabase e assets da marca do cliente. As dependências de referência incluíam Supabase, React, lucide, IndexedDB, exportação de documentos e testes.

A referência usada foi a organização por módulos, menu lateral, visão geral, ações rápidas, cadastros reaproveitáveis, totais da seleção e distinção entre valor previsto e caixa realizado. Foram inspecionados a estrutura, configuração de módulos, dashboard, navegação de registros, serviços, SQL e dependências para orientar a adaptação.

Os componentes entregues no novo projeto são implementação independente. Não foram copiados os assets do cliente, dados, documentos, credenciais, banco, configurações de produção ou distribuições compiladas do Mendes.

## Decisões

- React/TypeScript/Vite como base preferida; CSS próprio consistente em vez de introduzir framework adicional.
- Um único PostgreSQL multiempresa com `org_id`, RLS e RPCs, em projeto novo.
- Papéis fixos e planos centralizados; datas de trial e entitlement no servidor.
- Demonstração em memória da aba/sessionStorage, sem banco compartilhado entre leads.
- JSONB para payload comercial com campos relacionais/financeiros tipados; validação SQL de vínculos e cálculos.
- Funções de pagamento, links, administração e marketing no servidor, sem segredo VITE.
- Biblioteca de XLSX substituída por ExcelJS e PDF atualizado após revisão de vulnerabilidades; lockfile reproduzível.

O arquivo `INVENTARIO-ANEXOS.json` registra somente estrutura/contagem/hash dos pacotes analisados, sem exportar conteúdo confidencial do cliente.
