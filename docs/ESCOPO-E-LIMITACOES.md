# Escopo entregue e limitações

Este projeto inclui aplicação utilizável e backend escrito; não é uma declaração de que todos os detalhes do extenso prompt estão prontos para operação comercial. Use esta matriz antes de lançar. “Preparado” significa código e configuração, **não integração real comprovada**.

| Área | Disponível nesta entrega | Dependência ou limite |
|---|---|---|
| Identidade/site | Logo original, azul, site responsivo, planos, demo, WhatsApp, FAQ, SEO básico | Domínio, WhatsApp e textos legais devem ser revisados |
| Dashboard | Recebido, pago, caixa, previsto, pendências, gráficos por baixa, clientes/OS/documentos | Não há comparação percentual mensal nem DRE contábil |
| Clientes/fornecedores | CRUD, contatos, documento opcional, histórico vinculado, busca/filtro/ordem/exportação | Sem validação externa CPF/CNPJ/CEP |
| Orçamentos/propostas | Itens, catálogo, quantidade, desconto, total no banco, condições, PDF, link e resposta | Links públicos exigem Functions/Supabase; PDFs usam marca textual MD Flux e dados básicos da empresa |
| Contratos | Conteúdo editável, condições modelo da empresa, origem de proposta, PDF e aceite com digest | Sem biblioteca de modelos setoriais, assinatura desenhada, verificação avançada de identidade ou provedor certificado |
| OS | Status, cliente, responsável em texto, local, agenda, datas, prioridade, itens, estimativa, checklist em texto, confirmação manual e anexos | Sem agenda visual/calendário, checklist com execução por etapa nem consumo automático de estoque |
| Financeiro | Previsto/realizado, baixas parciais com datas, vínculo cliente/OS, categorias e parcelas futuras | Parcelas sequenciais não são lote transacional; sem geração mensal contínua/alteração em série |
| Produtos/materiais | Catálogo, custo, preço, unidade, categoria e estoque com histórico no banco | Movimento manual; sem inventário por depósito ou baixa automática da OS |
| Equipe | Convite por e-mail, papéis fixos, ativação/desativação e limites 1/3/10 | Convites somente a e-mails novos; sem permissões por operação editáveis ou transferência de titularidade |
| Relatórios | Listagem autorizada com filtro por data, CSV, XLSX e PDF A4 | Relatórios gerenciais específicos/custos por OS não têm telas dedicadas; limite 50 mil registros carregados |
| Configurações | Dados, contato, endereço, condições de documento, módulo OS visível, consentimento e MFA | Sem upload de logo próprio, gerenciador de categorias/numeração/modelos completo |
| Auth/trial | Supabase, e-mail, recuperação, empresa automática, 72h de servidor, expiração no RLS | SMTP, CAPTCHA e limites dependem do painel Supabase; início ocorre no cadastro |
| Multiempresa | RLS, roles, RPCs, Storage privado e testes de isolamento | Homologação em Supabase real ainda necessária |
| Mercado Pago | Checkout recorrente, HMAC, consulta oficial, conferência, idempotência, cancelamento e bloqueio | Sem credenciais/testes reais; troca sem pró-rata; reconciliação de checkout ambíguo é manual |
| Meta | Pixel consentido, eventos de funil, CAPI via outbox, deduplicação e Purchase confirmado | Sem credenciais/teste real; sem fbc/fbp/UTM/e-mail hash, Subscribe ou relatório de atribuição |
| Suporte | Chamados, categoria, prioridade, histórico de mensagens e respostas do admin | Anexos específicos de chamado e notificações e-mail/push não foram finalizados; acesso crítico usa WhatsApp |
| Global admin | Allowlist/MFA, empresas, usuários/pesquisa, assinaturas, receitas, suspensão, extensão, plano, senha por link e auditoria | Sem paginação além dos 1.000 usuários iniciais, revogação global de sessões, edição completa de cadastro ou dashboards avançados de conversão |
| Presença | Última atividade e tempo aproximado por heartbeat visível | Não comprova logout nem duração exata de sessão |
| Retenção | Expiração automática, carência 7 dias, bloqueio de limpeza com pagamentos/checkout, limpeza conservadora e pedido de exclusão | Arquivos Storage, usuários Auth, retenção legal e backups exigem procedimento complementar; não é eliminação completa automática |
| Segurança | Validação, RLS, roles, headers, token seguro, HMAC, rate limit e auditoria | Sem pentest, antivírus/quotas de upload, monitoramento/alertas integrados e política legal formalizada |
| PWA | Manifest, ícones, instalação, cache exclusivo de marca | Sem operações offline de negócio, sincronização ou aviso visual de conectividade/atualização |
| Demonstração | Dados fictícios por aba, reinício, sem pagamentos nem admin | Não usar dados pessoais; não é conta demo compartilhada em banco |
| Publicação | Fonte, lockfile, build, SQL, Functions e Netlify config | Não houve deploy, criação de contas externas, aplicação de SQL remoto ou cobrança real |

## O que impede ativar produção imediatamente

1. Criar e configurar Supabase independente, SMTP, CAPTCHA e limites; aplicar as seis migrações.
2. Configurar Netlify Functions/variáveis/cron e domínio HTTPS.
3. Conectar Mercado Pago e Meta com dados próprios e homologar o ciclo completo com contas de teste.
4. Revisar controlador, bases legais, prazos, contratos, backup e procedimento de exclusão/Storage.
5. Decidir quais limitações funcionais da matriz precisam ser concluídas antes da sua oferta pública e ajustar comunicação do produto.

Nenhum dado, conta, credencial ou banco do cliente Mendes foi transportado. Não há migração automática do banco antigo do MD Flux.
