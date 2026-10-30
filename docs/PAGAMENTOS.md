# Mercado Pago

## Implementação

A implementação usa as APIs oficiais de assinaturas `/preapproval`, `/preapproval/{id}`, `/authorized_payments/{id}` e `/v1/payments/{id}`. A recorrência é mensal, em BRL, sem dados de cartão no MD Flux. O checkout é hospedado pelo Mercado Pago (`init_point`). Não exige IDs de plano externos: preços são definidos no servidor e no banco; a assinatura é criada sem plano associado.

Configure `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` nas Functions. Não cole valores no código. Crie primeiro uma aplicação/contas de teste seguindo o procedimento disponível na sua conta Mercado Pago. Não use compradores e vendedores da mesma conta.

Configure notificações HTTPS em `https://SEU-DOMINIO/.netlify/functions/webhook` para `subscription_preapproval`, `subscription_authorized_payment` e `payment`, conforme as opções de assinaturas habilitadas na sua aplicação. Há diferenças entre produtos e versões do painel; confirme o suporte à assinatura secreta para essa integração. O endpoint recusa notificações sem HMAC; não desative a validação para contornar configuração incorreta.

## Garantias implementadas

- Apenas o titular da empresa inicia ou cancela assinaturas.
- Valor/plano são definidos no servidor; campo alterado no navegador não muda o preço.
- Reserva única de checkout pendente por empresa, limite de requisições e chave de idempotência por tentativa.
- `x-signature`, `x-request-id`, ID do recurso e timestamp são conferidos; tolerância de relógio de 5 minutos.
- Dados completos são consultados na API oficial. O tópico de fatura fornece o vínculo confiável entre cobrança e `preapproval_id`.
- Pagamento é conferido com checkout da empresa, plano, preço, BRL e ID de assinatura.
- Atualização de acesso e registro de Purchase ocorrem na mesma transação SQL. Pagamento aprovado repetido não acrescenta outro mês.
- Pagamento pendente não libera plano e retorno a `/app/plans` não confirma pagamento.
- Reembolso/chargeback vinculados revogam o acesso; rejeição afeta assinatura vencida; cancelamento preserva o período já pago.

## Troca de plano

Na primeira versão, cancele a renovação vigente e escolha o novo plano. O período pago permanece registrado; não há cálculo proporcional, crédito ou reembolso automático. Antes de reduzir usuários, desative os que excedem o limite. Os registros não são apagados na redução. A ação administrativa de alterar plano modifica permissões, não modifica o contrato ou valor de cobrança do Mercado Pago: faça a conciliação comercial antes de usá-la.

## Retentativas e pendências

Erro HTTP 4xx definitivo permite outra tentativa. Em timeout/erro ambíguo, a reserva continua `creating`: o provedor pode já ter criado a assinatura. Isso evita segunda cobrança recorrente. O suporte deve consultar `/preapproval/search` pelo `external_reference` (UUID da tentativa), reconciliar `provider_id`/`url` ou marcar falha somente após confirmar que não houve criação. A reconciliação automática dessa exceção ainda não está implementada.

Eventos `payment` sem vínculo de assinatura são ignorados. O evento `subscription_authorized_payment` é a via principal para confirmar recorrência; homologue os payloads reais antes de cobrar. Os formatos não foram validados com credenciais do titular nesta entrega.

## Homologação obrigatória

Verifique contratação, primeira cobrança, renovação, pendente, rejeitado, cancelamento, estorno, atraso, assinatura inválida e entrega duplicada. Teste consulta à API com erro temporário e a retentativa do webhook. Em produção monitore reservas presas e pagamentos sem correspondência. O código preparado não equivale a integração já conectada.

## Referências oficiais consultadas

- https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post
- https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/get-authorized-payment/get
- https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
