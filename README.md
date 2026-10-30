# MD Flux 2.0

Gestão para prestadores de serviços e pequenos negócios. React 19 + TypeScript + Vite, Supabase Auth/PostgreSQL/Storage e Netlify Functions.

**Entrega de desenvolvimento, com testes locais. Não está publicado nem homologado para cobranças reais.** A demonstração funciona sem chaves. As contas reais exigem um projeto Supabase novo e as integrações configuradas. Consulte `docs/ESCOPO-E-LIMITACOES.md`: este arquivo distingue recursos disponíveis, integração preparada e requisitos ainda parciais do prompt.

## Comece aqui

Requer Node 22 ou superior e npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

Abra a URL do Vite. Use `/demo` para explorar sem credenciais. Os dados são fictícios, salvos somente no `sessionStorage` da aba e reiniciáveis. Não insira dados pessoais na demonstração. Use `http://localhost`, não abra `index.html` diretamente com `file://`.

Para testar o produto conectado, configure as variáveis públicas do `.env`, aplique as migrações **em um Supabase independente** e rode as funções com Netlify Dev. O Vite sozinho não executa endpoints de pagamento, documentos públicos ou administração global.

```bash
npx netlify-cli dev
```

Acesse o endereço do Netlify Dev. Em produção as funções são instaladas junto com o site. O `dist/` incluído é uma compilação sem credenciais; refaça o build depois de configurar o Supabase.

## O que foi desenvolvido

- Site comercial com três planos: Essencial R$ 69,90 (1 usuário), Profissional R$ 99,90 (3), Empresarial R$ 129,90 (10). Destaque factual “Recomendado”. Seção separada de sistemas personalizados.
- Autenticação Supabase: cadastro curto, confirmação por e-mail, login, recuperação de senha e integração opcional Turnstile. Criação automática de empresa com teste de 72h por trigger SQL.
- Dashboard com recebido, pago, caixa, previsto, valores em aberto, clientes e operações. Caixa é separado de previsão e não é denominado lucro.
- Clientes, fornecedores, produtos/serviços, materiais, orçamento, proposta, contrato, OS, entradas/saídas e suporte. Busca, filtros por status/data, ordenação, paginação, seleção e totais.
- Itens e descontos, catálogo nos documentos, modelos de condições comerciais, PDF A4, CSV, XLSX e vínculo de cliente/OS. Orçamento pode gerar proposta; orçamento aprovado pode gerar OS; proposta aprovada pode gerar contrato.
- OS com responsável, prioridade, agendamento, datas, checklist, registro de confirmação e anexos privados.
- Baixas parciais com datas, parcelas futuras mensais e estoque com movimentos validados pelo banco.
- Multiempresa com RLS real, papéis no banco, limites de equipe, autorização por plano e controle otimista de versão.
- Links públicos com token aleatório, snapshot imutável, digest SHA-256 e resposta de aprovação/recusa com evidências mínimas.
- Checkout recorrente Mercado Pago e webhook com HMAC, consulta à API oficial, conferência de valor/moeda/vínculo e confirmação idempotente. Retorno do checkout nunca libera acesso.
- Pixel e outbox Conversions API com consentimento, IDs de evento e Purchase originado exclusivamente de pagamento confirmado.
- Painel global com allowlist e MFA AAL2: empresas, assinaturas, receita, usuários, atividade aproximada, suspensão, extensão de teste, alteração de plano, redefinição de senha e respostas de suporte.
- Rotinas de expiração, retenção conservadora, auditoria e PWA sem cache de dados privados.

## Testes

```bash
npm test
npm run test:db
npm run build
npx playwright install chromium
npm run test:e2e
```

O teste de banco usa **PGlite (PostgreSQL em WASM)** e adapta somente as interfaces do Supabase Auth/Storage. Executa migrações e políticas RLS reais; não substitui homologação em Supabase hospedado. O navegador usa a aplicação compilada e um servidor HTTP de teste na porta 4173. Não deixe outro processo ocupando essa porta.

`docs/TESTES.md` descreve evidências e limites. Os arquivos de teste foram incluídos; `node_modules`, caches, dados dos projetos originais e segredos não foram incluídos.

## Documentação

- `docs/DEPLOY.md`: Supabase, GitHub e Netlify, incluindo variáveis e provisionamento do administrador.
- `docs/PAGAMENTOS.md`: Mercado Pago, webhooks, testes, cancelamento e troca de plano.
- `docs/META.md`: consentimento, Pixel, CAPI e limitações de correspondência.
- `docs/ADMINISTRACAO.md`: operação, equipe, MFA, auditoria e suporte.
- `docs/COMERCIAL-E-RETENCAO.md`: teste, planos, assinaturas e retenção.
- `docs/ARQUITETURA-E-SEGURANCA.md`: modelo, ameaças, backups e riscos residuais.
- `docs/AUDITORIA-ORIGINAIS.md`: análise dos arquivos fornecidos e decisões de reaproveitamento.
- `docs/ESCOPO-E-LIMITACOES.md`: matriz honesta do escopo e pendências.

## Origem e identidade

O logotipo original do MD Flux foi preservado. Os fluxos, menus e totais do Mendes foram usados como referência de experiência; os componentes deste projeto foram escritos de forma independente. Não há marca, dados, banco nem credenciais do cliente Mendes nesta entrega. As migrações antigas do MD Flux não são aplicadas: usam outro modelo e não são uma atualização compatível.
