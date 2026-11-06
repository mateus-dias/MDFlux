# Superadmin e acompanhamento de clientes

## Aplicação

Aplicar `supabase/migrations/008_platform_owner.sql` no SQL Editor do projeto Supabase de produção, após backup e conferência do projeto. Esta é uma migração aditiva para o schema SaaS (`organizations`, `memberships`, `subscriptions`), já usado pelo aplicativo React. Não reaplicar as migrações antigas nem os arquivos do schema legado (`companies`, `profiles`).

A conta `admin@mdflux.com.br` precisa existir e ter e-mail confirmado. A migração fixa o UUID dessa conta na tabela protegida `platform_owner`; se a conta não existir ou não estiver confirmada, a transação falha sem aplicar alterações. A exceção não é concedida por metadados editáveis, por reutilização do e-mail ou a outros administradores.

Depois da migração, publicar o código e atualizar a sessão do administrador. O contexto da conta mostra acesso administrativo sem teste ou data de pagamento fictícia. As assinaturas e pagamentos existentes permanecem preservados. A rotina de retenção deixa de expirar ou excluir dados das empresas em que a conta fixa é titular ativo. Ela não recupera registros eventualmente já excluídos antes da migração.

## Uso

Em Configurações, configurar MFA e confirmar o autenticador. Abrir **Administração global** (`/admin`). O painel comercial exige a sessão com segundo fator, além da lista administrativa existente no banco. O acesso aos próprios módulos continua disponível sem depender do teste. A exceção não concede acesso operacional às empresas de outros clientes.

O painel reúne empresas, titulares, e-mails, telefone opcional, último login, término do teste, acesso pago até, pagamentos e situação calculada pela data do servidor. Os filtros distinguem teste vigente, teste encerrado, acesso vigente, vencimento em até sete dias, cancelamento e vencimento. A conta administrativa não entra nas mensalidades dos clientes.

O telefone é opcional no cadastro, com aviso de finalidade, e fica nos metadados do usuário. Cadastros anteriores aparecem com telefone não informado. O link de WhatsApp apenas abre a conversa para contato manual; nenhuma mensagem é enviada automaticamente.

O histórico mostra registros e estados confirmados pelo backend de pagamentos existente. Vencimento não comprova renovação futura. A confirmação de cada pagamento ainda depende do webhook Mercado Pago configurado. Não foram criadas cobranças nem alterados valores ou periodicidade do provedor.

## Verificações

Executar `npm test`, `npm run test:db`, `npm run build` e `node tests/admin.browser.mjs` (Chromium em `/usr/bin/chromium`, ou definir `CHROMIUM_PATH`). O teste de painel usa dados fictícios e não envia mensagens.

Homologar em produção: entrar com o superadmin, abrir orçamento e salvar, abrir `/admin` com MFA, conferir cliente real com teste encerrado e conferir vencimento/pagamento confirmado no Mercado Pago. Não declarar o problema resolvido em produção antes de aplicar a migração e validar o acesso real.
