# Meta Pixel e Conversions API

Configure `VITE_META_PIXEL_ID` no build e, nas Functions, `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_GRAPH_VERSION` e opcionalmente `META_TEST_EVENT_CODE`. Selecione uma versão Graph vigente e permitida na sua conta. Não exponha o token Meta no navegador.

O script Pixel só é carregado na página comercial depois do consentimento no banner. A navegação para login, documentos e espaço de trabalho carrega um novo documento sem o script. O rodapé permite recusar/reabrir preferências. As configurações da empresa incluem consentimento separado para medir compras confirmadas. Não são enviados senha, cartão, dados completos de clientes ou conteúdo de documentos.

No Pixel são enviados PageView e Lead consentidos da página comercial. CompleteRegistration, StartTrial e InitiateCheckout são enfileirados apenas para a CAPI, sem carregar o Pixel nessas telas. A função `track` também aceita ViewContent, para instrumentação futura. Cada chamada usa UUID como `eventID`; quando houver eventos nas duas integrações, o mesmo UUID permite deduplicação. PageView representa o carregamento inicial consentido da página comercial.

Purchase é criado somente pelo banco quando um pagamento aprovado e conferido ativa/renova a assinatura. Valor, BRL e plano são definidos pelo servidor. O ID estável `purchase:ID_PAGAMENTO` evita duplicação. Não há Purchase no retorno do checkout nem em pagamento pendente. Compra é enviada somente por CAPI; não há duplicata de Pixel dessa compra. Subscribe não é enviado nesta versão.

A rotina `conversions` consome a outbox a cada 10 minutos, limita o lote a 50, usa até 8 tentativas e só marca envio após HTTP de sucesso. Antes de enviar compra vinculada a uma empresa, confere novamente o consentimento atual. Não há backoff exponencial nem alerta automático para falhas definitivas: monitore as tentativas no banco e os logs das Functions.

Limitação: a correspondência usa identificador pseudonimizado. A versão atual não captura `_fbc`, `_fbp`, UTM ou e-mail hash para atribuição avançada. Isso limita a qualidade de correspondência e a análise de campanhas; não há promessa de atribuição completa ou de vendas. Cadastros por frontend são sinais de funil e não evidência contábil. A fonte de receita é a tabela de pagamentos confirmados.

Homologue no Gerenciador de Eventos, com código de teste: consentimento negado/permitido/revogado; mesmo ID no Pixel e CAPI; pagamento pendente sem Purchase; pagamento aprovado com um Purchase; webhook duplicado sem duplicar a compra. Nenhum evento foi enviado para uma conta real durante o desenvolvimento.
