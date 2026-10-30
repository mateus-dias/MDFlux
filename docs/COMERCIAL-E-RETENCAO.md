# Regras comerciais e retenção

O cadastro cria empresa e assinatura `trialing` com 72 horas calculadas por PostgreSQL. Confirmação de e-mail é necessária para a utilização real. Como o teste começa no cadastro, demora em confirmar o e-mail consome parte dele; esse comportamento é informado na tela de cadastro.

Trial usa recursos do Profissional e limite total de 300 registros ativos, com teto operacional de 50.000 por empresa na implementação atual. Não há cartão obrigatório. Há limite por arquivo, mas ainda não quota total por tenant: configure e monitore armazenamento. CAPTCHA, limites de Auth e confirmação reduzem abuso; não garantem impedir uma pessoa de recriar testes com identidades diferentes.

Ao expirar, o SQL bloqueia leitura/escrita operacional pela data do servidor mesmo antes da execução do cron. Conta, planos, contratação, preferências e solicitação de exclusão continuam disponíveis. `lifecycle` atualiza `trial_expired`, depois `expired` quando elegível. Estados usados incluem trialing, trial_expired, active, past_due, canceled e expired; pagamentos pendentes ficam registrados em checkout/payments, sem promover acesso.

Os dados de teste elegíveis têm carência de 7 dias após o fim do trial (10 dias desde cadastro). A rotina bloqueia a limpeza se houver qualquer pagamento registrado ou checkout pendente/em criação. Trata o cenário de forma conservadora: não apaga cegamente registros financeiros, contratos, auditoria ou snapshots de documentos. Relações com snapshots também preservam os registros de origem. Não há eliminação indiscriminada de auth.users, logs ou backups.

Solicitações de exclusão são registradas para análise do responsável. A rotina inicial limpa somente registros operacionais elegíveis e revoga links/acessos secundários; arquivos Storage, documentos retidos, usuários Auth e backups exigem revisão de retenção e um procedimento operacional complementar. Não anuncie exclusão completa automática antes de concluir essa etapa e formalizar prazos legais. O painel informa que dados são elegíveis conforme política, sem prometer eliminação instantânea de backups.

Assinatura paga continua até `paid_until`, inclusive após cancelamento da renovação. Inadimplência efetiva bloqueia uso ao fim do período confirmado. O administrador pode suspender sem alterar registros. Redução de plano não remove dados; recursos fora do plano ficam indisponíveis e o número de membros ativos precisa caber no novo limite.

Não há promessa de faturamento, lucro, leads diários, número fictício de usuários ou depoimentos inventados no site. O título “Recomendado” do plano Profissional é recomendação comercial, não estatística de vendas.
