# Relatório de validação — 30/10/2026

## Resultado local

| Verificação | Resultado |
|---|---|
| `npm run build` | Aprovado: TypeScript estrito e Vite 7.3.7 |
| `npm test` | 6 testes aprovados |
| `npm run test:db` | 17 verificações aprovadas em PostgreSQL/PGlite |
| `npm run test:e2e` | 4 cenários de viewport aprovados em Chromium |
| `node --check` em todos os módulos Netlify | Aprovado |
| `npm audit --json` | 0 vulnerabilidades reportadas na consulta realizada (produção e desenvolvimento) |

A auditoria de dependências é uma consulta ao banco de avisos do npm, não comprovação de ausência de vulnerabilidades. O lockfile fixa a resolução avaliada.

## Testes de domínio

Cálculo de itens/descontos, arredondamento, fronteira exata do trial em 72h, suspensão, conta pendente, acesso pago cancelado até o fim do período, distinção entre caixa e previsto, neutralização de fórmulas CSV, valores/limites dos três planos e HMAC válido/inválido/ID alterado/segredo incorreto/timestamp vencido.

## Testes de banco

As seis migrações foram aplicadas no motor PostgreSQL PGlite. O teste cria adaptadores mínimos dos schemas gerenciados Auth/Storage; executa as funções e políticas RLS da entrega.

1. Migrações compilam.
2. Cadastro cria organizações distintas e exatamente 259.200 segundos de trial.
3. Empresa A não cria registros nem lê organização B.
4. Storage recusa upload em outro tenant.
5. Storage oculta arquivos de A para B.
6. B não lê, arquiva nem referencia um registro de A.
7. Browser não altera plano, não se promove a admin e não chama rotina privilegiada.
8. Totais de documento são recalculados; itens negativos e baixas inconsistentes são recusados.
9. Trial vencido bloqueia leituras/escritas operacionais e preserva contexto da conta.
10. Plano Essencial não cria OS nem material/estoque.
11. Administração global exige allowlist e MFA AAL2.
12. Pagamento aprovado repetido não prolonga novamente o acesso; preço divergente é recusado.
13. Retenção preserva conta com checkout pendente.
14. Consulta não escreve via RPC direta.
15. Associação desativada perde acesso imediatamente.
16. Estoque negativo é recusado e heartbeat não aponta para tenant alheio.
17. Aceite vincula snapshot e recusa segunda resposta para o mesmo link.

Não houve conexão com um Supabase remoto. Isso não valida SMTP, configuração hospedada, atualização do Auth ou o serviço real de Storage; esses cenários precisam ser homologados.

## Testes de interface

Larguras: 1440×1000, 768×1024, 390×844 e 360×800. Chromium headless, sem simular um dispositivo físico iOS/Android.

Em cada largura: abertura do site, ausência de overflow horizontal no site e dashboard, entrada na demonstração, cadastro e edição de cliente, pesquisa, navegação no menu móvel, downloads CSV/PDF/XLSX, ausência de erros JavaScript e isolamento entre dois contextos de navegação. Revisão visual de capturas internas foi realizada. Uma rolagem horizontal em cards financeiros móveis foi identificada e corrigida antes do resultado final.

Os testes não cobrem todas as combinações de formulários, cada módulo ou acessibilidade completa. Há labels, foco visível, semântica de dialog e ajustes de movimento reduzido, mas não foi feita auditoria WCAG formal.

## Avisos e itens não testados

O build informa um chunk ExcelJS maior que 500 kB; ele é carregado por importação dinâmica somente ao exportar XLSX. O aplicativo principal não espera essa biblioteca no primeiro carregamento.

Não testados com serviços reais: cadastro/login/recuperação/convite por e-mail; CAPTCHA; MFA hospedado; upload/signed URL; publicação Netlify; execuções cron; checkout real/sandbox Mercado Pago; renovação/estorno via provedor; Meta Pixel/CAPI em conta do titular; backup/restore e exclusão de arquivos remotos.

Não houve publicação, compra, cobrança, migração remota nem envio de mensagem a terceiros durante o desenvolvimento. Não há declaração de homologação de produção.
