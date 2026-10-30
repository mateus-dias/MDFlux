# Operação e administração

## Empresa

A conta tem uma ou mais associações a empresas. O seletor do cabeçalho aparece quando há mais de uma. A organização ativa nunca é uma fonte de autorização: o servidor valida usuário, associação, perfil, assinatura e plano em cada operação.

Titular administra dados e equipe. Gestor opera os módulos e arquiva registros. Financeiro opera clientes, fornecedores, entradas, saídas e suporte. Operacional opera clientes, documentos comerciais, OS, catálogo e suporte. Consulta lê os módulos elegíveis e não salva. Permissões são aplicadas no SQL; o menu apenas melhora a experiência.

Convites são limitados ao plano. Nesta versão, use um endereço ainda não cadastrado; convite a conta já existente exige fluxo de aceitação a implementar. Um convidado pode receber uma organização própria pelo provisionamento padrão do Auth; escolha a empresa correta no seletor. SMTP precisa estar configurado. Limites são reconferidos na transação de anexar o usuário, inclusive com convites simultâneos.

O titular não pode ser desativado por `manage_member`. Transferência de titularidade e permissões personalizadas por operação não estão disponíveis. A desativação de um membro revoga o acesso à organização no banco mesmo se ele ainda tiver uma sessão Auth válida.

## Documentos

Cadastre o cliente, crie itens ou adicione-os do catálogo e salve. PDF A4 usa o conteúdo do registro. Compartilhar gera link com token aleatório, copia o endereço e abre WhatsApp. Links expiram em 7 dias e podem ser revogados. Para editar documento com link ativo, revogue o link antes; snapshots anteriores e aceites não são sobrescritos.

O destinatário visualiza o snapshot e responde com nome e concordância explícita. A data é do banco. A evidência inclui digest, decisão, nome e origem técnica minimizada. É aceite simples, não assinatura avançada ou qualificada. Caso precise de identidade verificada/certificado, integre um provedor especializado.

## Financeiro e estoque

Valor previsto e baixas são distintos. Cada baixa possui data e valor; o banco valida a soma. Para repetir, escolha a quantidade de parcelas em um novo lançamento. A geração das parcelas ocorre sequencialmente; se houver falha de rede parcial, confira os registros antes de repetir, pois o lote não é transacional/idempotente nesta versão. Editar recorrência existente não recria parcelas já geradas.

Movimentar estoque usa delta positivo para entrada e negativo para saída; o banco recalcula a partir do saldo anterior e registra data/ator. Saída abaixo de zero é recusada. Não há baixa automática ao concluir OS; registre o consumo manualmente. Despesas vinculadas à OS entram no caixa conforme suas baixas; custo estimado da OS não cria automaticamente uma despesa.

## Suporte

Assinantes criam chamados e acrescentam mensagens. O histórico fica no registro; o administrador responde no painel global. Durante teste ou expiração, problemas críticos de acesso, pagamentos e privacidade usam o canal essencial. Atualize a tela para consultar respostas; notificações push/e-mail não foram implantadas.

## Global

Cadastre o UUID em `global_admins` por SQL administrativo e configure MFA. A rota `/admin` consulta apenas informações administrativas necessárias; não disponibiliza livre navegação em dados operacionais das empresas. Use suspensão/reativação para bloqueio de assinatura e extensão para conceder mais 72h a testes elegíveis. Toda ação é auditada. Alteração administrativa de plano não altera a cobrança externa.

Usuários são consultáveis por nome/e-mail (primeiros 1.000 por consulta); nunca são retornadas senhas. Redefinição envia link ao titular e depende de SMTP. A atividade é observada a cada minuto enquanto a aba está visível. Tempo e presença são aproximados, não jornada de trabalho nem prova de logout. Nenhuma tela é gravada.
