# Fix do race no ensure-month (recibos mensais duplicados) — design

Bug encontrado pela suíte e2e em 2026-07-22: `POST /api/receipts/ensure-month` é
check-then-insert sem guarda de unicidade no banco. Montagens repetidas/concorrentes do
dashboard admin num mês novo podem criar recibos "Taxa condominial" duplicados para o
mesmo morador e competência. Afeta produção (cobranças reais).

## Correção em três camadas

1. **Dedupe dos dados existentes (migração `012_receipt_monthly_unique`, passo 1):**
   arquivar (`visible = false` — nada é deletado, regra do projeto) as duplicatas
   visíveis de `(resident_id, ref)` com `title = 'Taxa condominial'`, mantendo por grupo
   o recibo de maior valor probatório: `pago` > `em_analise` > demais status; empate
   decidido pelo menor `id` (estável). Janela de duplicatas em produção é tratada pela
   própria migração no deploy.
2. **Guarda no banco (migração, passo 2):** índice único parcial
   `idx_receipts_condo_fee_month ON receipts (resident_id, ref) WHERE visible AND
title = 'Taxa condominial'`. O passo 1 garante que a criação do índice não falha.
3. **Comportamento explícito na aplicação:** o adapter Postgres de receipts converte a
   violação `23505` desse índice (SQLSTATE + constraint estruturais, padrão já usado no
   dismiss de notices) no novo erro de domínio `MonthlyReceiptExistsError` (`status =
409`). O use case do ensure-month captura esse erro por recibo e SEGUE (idempotência
   sob race = sucesso); a criação manual (`POST /api/receipts`) que colida devolve 409
   com mensagem clara em PT-BR em vez de 500.

## O que não muda

- O fluxo lazy (disparo no load do dashboard admin) — decisão do usuário de 2026-07-22.
- O shape das respostas do ensure-month e da criação manual em casos de sucesso.
- Recibos que não são a taxa condominial (título diferente) — sem restrição nova.

## Testes (TDD)

- Migração/adapter (pg): duplicatas seedadas são arquivadas preservando a de maior
  valor probatório; o índice bloqueia um segundo insert visível da mesma competência;
  `save` colidindo lança `MonthlyReceiptExistsError`.
- Use case: dois `ensure-month` consecutivos geram exatamente 1 recibo por morador;
  colisão simulada no meio (repo fake lança o erro de domínio) não aborta os demais.
- Rota: criação manual duplicada → 409 com mensagem; compose.test cobre o caminho.
- Gates `make api-check` (+ `make check` intocado) verdes; e2e continua verde.
