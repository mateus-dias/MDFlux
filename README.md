# MD Flux

Plataforma SaaS multiempresa para gestão centralizada de financeiro, clientes, agenda, produtos, vendas, estoque, relatórios e equipe.

## Visualização local

Sirva a pasta `dist` com qualquer servidor HTTP estático. Exemplo:

```bash
npx serve dist
```

O site comercial e o ambiente demonstrativo estão prontos para navegação. A demonstração não persiste alterações e permite testar módulos, filtros, formulários e exportação CSV.

## Credenciais da demonstração

- Usuário: `demo@mdflux.com.br` ou `demo`
- Senha: `MDFlux@2026`

Os botões “Testar grátis”, “Testar demonstração” e “Entrar” sempre abrem a tela de login. O ambiente demonstrativo só é liberado após a validação dessas credenciais. Como se trata de uma demonstração estática, elas protegem apenas o acesso ao protótipo; na produção, substitua essa validação pelo Supabase Auth.

Todos os CTAs comerciais usam a configuração centralizada do WhatsApp `+55 16 99775-4245`.

## Domínio do painel

O projeto reconhece automaticamente o hostname `app.mdflux.com.br`. Quando carregado nesse subdomínio, ele oculta o site comercial e apresenta diretamente o login em tela dedicada. O login não pode ser fechado nesse domínio e, ao sair do painel, o usuário retorna à tela de acesso.

Na Netlify, adicione `app.mdflux.com.br` como alias do mesmo projeto. No DNS do domínio, crie um registro `CNAME` com nome `app` apontando para o endereço `.netlify.app` da aplicação.

## Supabase

1. Crie ou selecione o projeto Supabase.
2. Execute `supabase/migrations/001_initial_schema.sql` no SQL Editor.
3. Execute `supabase/seed.sql` para cadastrar planos e módulos.
4. Configure as variáveis usando `.env.example` como referência.
5. Em Authentication, crie o primeiro usuário.
6. Copie o UUID do usuário e execute:

```sql
update public.profiles set is_global_admin = true where id = 'UUID_DO_USUARIO';
```

Nenhuma chave privilegiada deve ser colocada no frontend. Use `SUPABASE_SERVICE_ROLE_KEY` apenas em Edge Functions.

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
