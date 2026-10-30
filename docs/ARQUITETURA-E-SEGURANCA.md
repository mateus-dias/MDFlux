# Arquitetura e segurança

## Fronteiras

Frontend React/TypeScript consulta Supabase com anon key e JWT do usuário. Escrita operacional usa RPCs explícitas. RLS em todas as tabelas públicas nega acesso por padrão. Credenciais service-role existem apenas nas Netlify Functions; endpoints privilegiados revalidam sessão e associação/papel. Admin exige allowlist + MFA AAL2 por RPC com JWT verificado.

`organizations` é o tenant; `memberships` associa usuários e papéis; `subscriptions` controla tempo e plano. `records` armazena envelopes validados por tipo com campos comerciais JSONB, valor/baixas tipados, versão e vínculo à organização. Índices por tenant/tipo/data e vencimento atendem a primeira escala. O limite inicial de consulta do frontend é 50 mil registros; o banco também limita criação acima desse teto. Para escala maior, adotar busca/paginação/agregação no servidor antes de elevar limites.

`audit` preserva alterações e versões anteriores; `document_links` contém snapshots e hash do token; `document_acceptances` registra o aceite com digest. `payments`, `checkout_attempts` e `outbox` são privados ao servidor, exceto pagamentos próprios visíveis ao titular. `user_activity` recebe heartbeat autenticado sem leitura de outros usuários pelo navegador.

## Controles

- Não há concatenação de SQL a partir do navegador: RPCs parametrizadas e validação de quantidade, preço, desconto, baixas e vínculos de tenant.
- Autorização independe de menus ocultos. Trial e acesso pago usam timestamps do banco. O relógio local só afeta o texto da contagem.
- Papéis de consulta não escrevem; desativação remove acesso imediatamente no banco.
- Valores são numeric no banco; cálculos de itens e estoque são conferidos no servidor. Versão evita sobrescrita silenciosa entre edições.
- React escapa texto e nenhum HTML de documento do cliente é injetado. CSV neutraliza fórmulas de planilha; exportação XLSX escreve campos como texto, não como fórmulas fornecidas pelo usuário.
- Headers CSP, HSTS, frame denial, nosniff, permissões e referrer estão em `netlify.toml`. Functions respondem `no-store` e validam métodos.
- Sessões usam Bearer, não autenticação por cookie implícito nos endpoints mutáveis. O servidor ignora org/plano arbitrários sem verificar vínculo.
- Links públicos usam 256 bits de aleatoriedade, guardam somente SHA-256 do token e expiram em 7 dias. Aceite é único por snapshot; alterar documento publicado exige revogar link.
- Storage privado, MIME permitido e tamanho máximo por objeto; signed URL dura 60 segundos na consulta de anexo. Nenhum dado privado entra no cache do service worker.
- Rate limit compartilhado por banco nos endpoints de checkout, convites, aceites e eventos. Auth possui controles próprios a configurar no Supabase.
- Webhook usa HMAC e confirmação via API; confirmação de acesso e outbox são transacionais/idempotentes por ID de pagamento.

## Limites e riscos residuais

Não é certificação OWASP, teste de invasão profissional nem garantia de invulnerabilidade. Não há antivírus de uploads, quota de Storage por organização, rotação automática de segredos, recuperação automática de checkout ambíguo, observabilidade externa ou central de alertas. Não foram implementadas permissões personalizadas por operação além dos papéis fixos.

Os logs guardam versões anteriores de registros; retenção de auditoria e minimização precisam ser formalizadas. As políticas de suporte não permitem que administrador global navegue indiscriminadamente em registros comerciais; futuro acesso assistido precisa de autorização e auditoria específicas. Presença usa aba visível e não mede produtividade. Logs de tentativas de Auth malsucedidas são do Supabase; a aplicação não coleta senha nem expõe esses eventos no painel global.

A geração de parcelas no cliente é sequencial e pode ficar parcial em erro de rede. Relatórios carregam o conjunto autorizado; cálculos gerenciais não são contabilidade fiscal. Datas sem hora usam ISO para vencimentos; ajuste o fuso de operação e valide cenários de virada do dia em produção.

## Backup e recuperação

Backups dependem da configuração/plano do Supabase. Esta entrega não contrata nem ativa backup remoto. Defina RPO/RTO, periodicidade, responsáveis e retenção. Faça cópia criptografada do PostgreSQL e do Storage em destino separado, controle acesso e teste restauração em projeto de homologação. Registre o último restore bem-sucedido e valide autenticação, associações e Storage após restaurar. Não prometa eliminação imediata de backups; eliminação deve seguir o prazo formalmente definido.

## Monitoramento

Acompanhe falhas das Functions, outbox com 8 tentativas, reservas `creating`, pagamentos não vinculados, crescimento do Storage, limites Auth e execuções do cron. Não imprima tokens, corpos completos de pagamentos ou assinaturas HMAC nos logs. Integre um serviço de monitoramento e alertas antes de escalar.

## Referências

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/guides/auth/auth-captcha
