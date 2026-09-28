# MD Flux

Plataforma SaaS multiempresa para gestão centralizada de dashboard, financeiro, contas a pagar e receber, clientes, agenda, produtos e serviços, vendas, relatórios e exportações.

## Visualização local

Sirva a pasta `dist` com qualquer servidor HTTP estático. Exemplo:

```bash
npx serve dist
```

O site comercial, o ambiente demonstrativo e o login real com Supabase Auth estão prontos para navegação. A demonstração não persiste alterações e permite testar módulos, filtros, formulários, busca e exportações CSV, XLSX, PDF e DOCX.

## Credenciais da demonstração

- Usuário: `demo@mdflux.com.br` ou `demo`
- Senha: `MDFlux@2026`

Os botões “Testar grátis”, “Testar demonstração” e “Entrar” sempre abrem a tela de login. As credenciais acima liberam somente a demonstração local, em modo de leitura. Contas reais são autenticadas diretamente pelo Supabase Auth e têm o acesso aos dados limitado pelas políticas RLS.

Todos os CTAs comerciais usam a configuração centralizada do WhatsApp `+55 16 99775-4245`.

## Domínio do painel

O projeto reconhece automaticamente o hostname `app.mdflux.com.br`. Quando carregado nesse subdomínio, ele oculta o site comercial e apresenta diretamente o login em tela dedicada. O login não pode ser fechado nesse domínio e, ao sair do painel, o usuário retorna à tela de acesso.

Na Netlify, adicione `app.mdflux.com.br` como alias do mesmo projeto. No DNS do domínio, crie um registro `CNAME` com nome `app` apontando para o endereço `.netlify.app` da aplicação.

## Supabase

1. Crie ou selecione o projeto Supabase.
2. Execute `supabase/migrations/001_initial_schema.sql` no SQL Editor.
3. Execute `supabase/seed.sql` para cadastrar o plano único MD Flux (R$ 69,90/mês, até 3 usuários) e seus módulos.
4. Execute `supabase/migrations/002_auth_permissions_security.sql` para ativar criação automática de perfil e autorização granular.
5. Em bancos já existentes, execute também `supabase/migrations/003_single_plan_mdflux.sql`.
5. Configure as variáveis usando `.env.example` como referência.
6. Em Authentication, crie o primeiro usuário.
7. Promova o e-mail administrativo:

```sql
update public.profiles p
set is_global_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('admin@mdflux.com.br');
```

O login real usa diretamente o Supabase Auth com a Publishable Key. Nenhuma chave privilegiada deve ser colocada no frontend. Use `SUPABASE_SERVICE_ROLE_KEY` apenas em Edge Functions.

Se o administrador não entrar, confirme que o e-mail está confirmado em **Authentication → Users**, execute a migration `002` e depois execute o comando de promoção acima.

## Estrutura de segurança

- Todas as tabelas de negócio possuem `company_id`.
- RLS está habilitado e usa `current_company_ids()` para isolamento entre empresas.
- Operações administrativas devem validar JWT e `is_global_admin` antes de usar service role.
- O perfil demo é somente leitura no backend.
- Arquivos devem usar os caminhos `companies/{company_id}/logos/` e `companies/{company_id}/attachments/`.

## Publicação na Netlify

Conecte o repositório e use `dist` como diretório de publicação. O `netlify.toml` já contém fallback de SPA e headers básicos de segurança.

## Próximas integrações

A base prevê checkout futuro com Mercado Pago, e-mail transacional, convites e rotinas administrativas por Supabase Edge Functions.
