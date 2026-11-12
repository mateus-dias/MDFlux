# MD Flux Intelligence

Esta entrega evolui o projeto existente. O assistente usa o Supabase Auth e as regras de acesso dos registros. Essencial pode consultar saldos e vencimentos, conforme o papel da empresa. Profissional e Empresarial também podem analisar caixa, gravar cadastros e lançamentos, parcelar despesas, importar planilhas e configurar lembretes internos.

## Homologação

1. Confirme que a base do projeto corresponde ao commit publicado na Netlify e que as migrações atuais já foram aplicadas. Os arquivos legados com prefixos 001, 002 e 003 não devem ser executados em lote com o esquema SaaS.
2. Em um Supabase de homologação com a estrutura atual, aplique apenas a nova migração 009. Ela cria tabelas isoladas e RPCs e não atualiza tabelas de preços, clientes, registros financeiros, assinaturas ou pagamentos.
3. Configure a prévia com as variáveis públicas e de servidor do ambiente de homologação. Mantenha as credenciais de produção no contexto de produção. Nenhuma nova chave de API é necessária para o assistente.
4. Teste duas empresas e os três planos. Inclua usuário de consulta, conta suspensa, expiração, lote inválido, repetição da confirmação, contas vencidas e o primeiro acesso de uma sessão nova.
5. Confirme o catálogo e os preços publicados. O código compartilha os preços existentes de R$ 69,90, R$ 99,90 e R$ 129,90. Nenhum preço ou vínculo de assinatura foi migrado.
6. Antes de publicar, obtenha um backup recuperável e verifique a migração no esquema de produção. Aplique a migração antes de promover o deploy. Se o deploy falhar, a versão anterior continua operando com as tabelas adicionais. Evite apagar as novas tabelas se já houver operações e notificações gravadas.
7. Confira os logs da função intelligence-reminders no agendamento diário às 09h de Brasília. Ela só processa regras confirmadas, respeita o plano e ignora notificações já geradas para o mesmo vencimento. Monitorar uso de funções e banco dentro das cotas gratuitas.

## Operações no assistente

- Consulte valores a receber, a pagar e vencimentos. A análise de caixa usa as datas das baixas e diferencia o caixa registrado de lucro contábil.
- Cadastre cliente, fornecedor, serviço, receita ou despesa. Confira a prévia e confirme a gravação. Para datas, use DD/MM/AAAA, hoje ou amanhã.
- Exemplo de parcelamento: Cadastre uma compra de R$ 45.000 em 90 parcelas mensais, começando em 10/12/2026.
- Importe até 300 linhas por arquivo XLSX ou CSV com os cabeçalhos tipo, descrição, valor e vencimento. Tipos aceitos: receita e despesa. Corrija as linhas recusadas no arquivo original e importe novamente. A confirmação grava o lote em uma única transação.
- Prepare cobranças vencidas, revise o texto e abra a conversa oficial do WhatsApp. O envio depende de ação manual.
- Exemplo de regra: Me lembre das contas 2 dias antes de vencer. A caixa de notificações permite marcar avisos como lidos.
- A IA local é opcional e só interpreta consultas. O navegador pode baixar o modelo localmente. Os comandos determinísticos continuam disponíveis sem o modelo. O chat guarda a conversa em memória e limpa o estado na troca de empresa ou ao recarregar.
- O PWA mantém cache de imagens de marca. Dados de empresa, anexos e sessões exigem conexão.

## Limites desta versão

A interpretação local depende da Prompt API e do suporte a português. A biblioteca de comandos ainda não cobre todos os exemplos do Prompt Mestre. Cadastros contextuais se limitam a clientes e fornecedores. A importação usa cabeçalhos definidos e não tem editor de mapeamento. As notificações são internas e os lembretes têm uma regra de vencimento por usuário e empresa. E-mail e push, baixa de pagamentos pelo chat, documentos operacionais pelo chat e relatórios inteligentes exportáveis continuam pendentes.

## IA em nuvem opcional

Use uma conta Cloudflare Workers Free. Na Netlify, configure o ID da conta em MDFLUX_CLOUDFLARE_ACCOUNT_ID e o token com permissão de inferência Workers AI em MDFLUX_CLOUDFLARE_AI_TOKEN, no contexto e escopo de Functions. Configure MDFLUX_CLOUD_AI=true nas Functions e VITE_MDFLUX_CLOUD_AI=true no build. Mantenha o token fora de variáveis VITE e do repositório.

A integração se limita a mensagens de conversa que o fluxo do sistema não resolveu e requer consentimento na interface. Envia o texto digitado e instruções fixas sobre o produto. O histórico, anexos e registros consultados no banco não são enviados. A função valida sessão e empresa, limita chamadas e retorna ao fluxo local em caso de indisponibilidade. O modelo não tem ferramentas de escrita. As instruções são atualizadas junto com o produto e não são treinamento automático com conversas de clientes.
