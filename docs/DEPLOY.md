# Publicação em ambiente novo

## 1. Banco independente

Crie um projeto Supabase para homologação. **Não use o projeto Mendes ou um projeto de produção com dados existentes.** Execute os arquivos SQL de `supabase/migrations` em ordem numérica, de 001 a 006. As migrações pressupõem os schemas padrão `auth` e `storage` do Supabase. Faça backup antes de qualquer migração em ambiente existente; esta entrega não inclui migração automática dos dados antigos.

O bucket `tenant-files` é privado, com limite de 5 MB por arquivo e MIME PNG/JPEG/WebP/PDF. Caminhos começam com o UUID da organização; RLS isola listagem e leitura. Revise limite total do bucket e quotas antes da abertura pública.

Em Auth, configure Site URL e URLs permitidas de redirecionamento: domínio de homologação, produção, `/auth` e `/auth?reset=1`. Ative confirmação de e-mail, senha de pelo menos 10 caracteres, proteção contra senhas comprometidas quando disponível e SMTP de produção. Limites de tentativas e e-mails são configurados no Supabase, não somente no frontend.

Configure Cloudflare Turnstile no Supabase Auth, informe a chave secreta no painel do Supabase e `VITE_TURNSTILE_SITE_KEY` no frontend. O formulário envia o token para cadastro, login e recuperação. Não habilite CAPTCHA no Supabase sem configurar a chave pública correspondente no aplicativo. Restrinja os domínios permitidos do widget. Homologue os três fluxos, inclusive recusa e token expirado.

## 2. Configuração local

Copie `.env.example` para `.env`; não versione `.env`. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A chave anon é pública; a proteção está nas políticas RLS. Configure as variáveis do servidor separadamente para testar as funções.

```bash
npm ci
npm test
npm run test:db
npm run build
npx netlify-cli dev
```

Sem credenciais, `/demo` é a experiência funcional disponível. Para testar contas reais é necessário aplicar as migrações e usar o Auth remoto.

## 3. GitHub e Netlify

Crie um repositório com o conteúdo desta pasta, mantendo `package.json` na raiz. Suba o código e o lockfile; não suba `node_modules`. Importe esse repositório no Netlify. O `netlify.toml` define build, pasta `dist`, funções, SPA fallback e cabeçalhos de segurança.

Cadastre no Netlify as variáveis de `.env.example`. As `VITE_*` são públicas e precisam estar disponíveis durante o build. `SUPABASE_SERVICE_ROLE_KEY`, token Mercado Pago e Meta devem existir somente nas Functions; nunca prefixe segredos com `VITE_`. Use valores diferentes em previews/homologação e produção. Mudanças em `VITE_*` exigem novo build.

Defina `APP_URL` para o domínio HTTPS real, sem barra final. Confira o número de WhatsApp comercial em `VITE_WHATSAPP`; o exemplo usa o número encontrado no MDFlux original. Revise sitemap, robots, metadados e o nome do controlador nas páginas legais. Trocar domínio também exige revisar CSP se o seu Supabase usar um domínio personalizado.

As funções agendadas `lifecycle` (a cada hora) e `conversions` (a cada 10 minutos) dependem da ativação no Netlify e da disponibilidade do plano contratado. Confirme as execuções e logs no painel. Não conte com a hora do celular para aplicar expiração: as políticas usam `now()` do PostgreSQL mesmo que a rotina agendada atrase.

## 4. Primeiro administrador

Crie uma conta normal, confirme o e-mail e copie seu UUID do Auth. No SQL Editor, com acesso administrativo, execute substituindo pelo UUID real:

```sql
insert into public.global_admins(user_id)
values ('00000000-0000-0000-0000-000000000000');
```

Na conta, abra Configurações, cadastre o autenticador e confirme o código. Acesse `/admin`; se necessário, confirme o segundo fator nessa tela. A API exige simultaneamente sessão válida, allowlist e JWT com AAL2. Nenhum usuário se promove a administrador pelo navegador.

## 5. Antes de produção

Homologue com duas contas/empresas, recuperação de senha, convites, MFA, Storage, pagamentos de teste, reenvio de webhook, retorno sem pagamento, cancelamento e expiração. Execute o cenário de retenção em projeto descartável e confira arquivos retidos. Documente os prazos legais, contratos de operadores, política de backup e plano de restauração. Complete as pendências de `ESCOPO-E-LIMITACOES.md` relevantes à sua operação.
