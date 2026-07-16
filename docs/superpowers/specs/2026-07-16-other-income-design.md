# Sub-projeto 4 — Outras entradas (income)

> Fase de UI derivada do Claude Design `Morada.dc.html` (projeto `ea2ea282`),
> quarto e último sub-projeto. Full-stack (API + web). TDD; boundaries
> `ui → domain ← data` (web) e `domain / app / adapters / platform` (api);
> gates `make check` e `make api-check` ≥ 80%.

## Contexto

O design tem um ledger de **"Outras entradas"** (receitas não-taxa: acordo
judicial, reembolso, etc.) na tela de Contas do admin ("Contas · Outras
entradas", Morada.dc.html 171-191), com CRUD completo via um editor
(`a-income-edit`, linhas 680-703): **descrição · origem · valor · data ·
comprovante**, com salvar e **excluir**.

Hoje o resumo do dashboard (`buildDashboardSummary`) computa `incomeCents` = soma
dos recibos pagos do mês e `balanceCents` = (recibos pagos − contas pagas)
all-time. **Decisão travada:** as outras entradas **somam** a esse resumo.

## Modelo financeiro (decisão travada)

Uma "entrada" é dinheiro recebido (tem data; sem status — toda entrada conta).

- `incomeCents` ("Entradas do mês") = recibos pagos do mês + entradas do mês (por `date`).
- `balanceCents` (saldo) = (recibos pagos all-time + entradas all-time) − contas pagas all-time.
- `paidCents`, `recentPaid`, `maintenances` inalterados.

## API

**Migração `008_incomes`** (append-only): tabela `incomes`
(`id TEXT PRIMARY KEY, description TEXT NOT NULL, source TEXT NOT NULL,
value_cents INTEGER NOT NULL, date DATE, proof_data_url TEXT`). Sem seeds
(regra "nada de dados de mentira").

**Feature `income`** (espelha `accounts`):

- `domain/income.ts`: `incomeSchema` (`id`, `description` min1 max200,
  `source` min1 max120, `valueCents` int nonneg, `date` ISO nullable,
  `proofDataUrl` opcional via o `proofSchema` compartilhado de
  `receipts/domain/proof.ts`) + `incomeDraftSchema` (id opcional).
- `domain/income-repository.ts`: `IncomeRepository { list(); getById(id); save(income); delete(id) }`.
- `domain/errors.ts`: `IncomeValidationError` (+ `readonly status = 400`), `IncomeNotFoundError` (404).
- `app/{list-incomes,get-income,save-income,delete-income}.ts` (+ testes).
- `adapters/postgres/income-repository.ts` + `adapters/income-repository.contract.ts` + pg test.
- `adapters/http/routes.ts`: `GET /` (list), `POST /` (create), `PUT /:id` (update),
  `DELETE /:id` (delete) — todas admin. `IncomeValidationError`→400, `IncomeNotFoundError`→404
  (via o `onError` name/status-based existente).
- `platform/repositories.ts`: `incomes: new PostgresIncomeRepository(pool)`.
- `compose.ts`: `api.route('/incomes', guarded('admin', incomeRoutes(incomes)))`.

**Dashboard estendido:**

- `build-dashboard-summary.ts`: novo tipo `LedgerIncome { valueCents: number; date: string | null }`;
  a assinatura passa a `buildDashboardSummary(accounts, receipts, incomes, today)`:
  `allTimeIncome = sum(paidReceipts) + sum(incomes)`;
  `monthIncome = sum(mês paidReceipts) + sum(mês incomes por date)`.
- `PostgresDashboardRepository.getSummary()` também carrega
  `SELECT value_cents, date::text FROM incomes` e passa ao summary. O
  `dashboard-repository.contract` ganha o income repo na fábrica; adicionar `incomes`
  ao `DATA_TABLES` do `resetPg`.
- O schema `dashboardSummarySchema` **não muda** (os campos já existem; os valores
  agora incluem entradas).

## Web

- **Feature `income`** (`domain` + `data`): `Income` type/schema (id, description,
  source, valueCents, date, proofDataUrl?); `IncomeRepository` (list, save, delete);
  `HttpIncomeRepository` (constructor-injected `ApiClient`; `GET/POST/PUT/DELETE
/api/incomes`); `InMemoryIncomeRepository`; hooks `useIncomes`/`useSaveIncome`/`useDeleteIncome`.
- **Tela de Contas** (`accounts-screen`): abaixo da lista de contas, seção
  **"Outras entradas"** — lista as entradas (descrição + origem + valor) com um
  botão "Adicionar", cada linha abre o editor. Empty state quando vazio.
- **Editor de entrada** (nova view `a-income-edit` + `income-edit-screen`):
  campos Descrição, Origem, Valor (`MoneyInput`), Data (input date), **Anexar
  comprovante** (reusa `receipts/domain/proof`); "Salvar entrada"; se editando,
  "Excluir entrada" (com `ConfirmDialog` de confirmação — reusa o do SP1).
- **Dashboard**: nenhuma mudança de UI necessária (lê o resumo já estendido); o
  hero "Entradas do mês" já usa `incomeCents`.
- Wiring: `nav-store` ganha `a-income-edit`; `app.tsx` roteia o editor e passa o
  income repo à tela de Contas; `container.ts` exporta `incomeRepository` +
  `createIncome`/`updateIncome`/`deleteIncome` (ou via repo direto nos hooks).

## Testes (TDD)

**API:** `build-dashboard-summary` (income soma ao mês + all-time; entrada sem
data não entra no mês mas entra no all-time); `save-income`/`delete-income`
(validação, 404); contrato pg do `IncomeRepository` (CRUD round-trip, proof);
rotas admin (`POST/PUT/DELETE /incomes` admin; resident 403 via mount);
dashboard contract reflete entradas no summary.

**Web:** editor de entrada (salvar chama create/update; excluir confirma e chama
delete); seção "Outras entradas" na tela de Contas (lista + abrir + empty state);
comprovante anexado vira dataURL.

Gates verdes (≥ 80%). Domínio perto de 100%.

## Fora de escopo

- Excluir recibo/lançamento de conta (segue deferido — só a **entrada** tem excluir).
- Income com "status"/pago (entrada é sempre dinheiro recebido).

## Entrega

Branch `feat/other-income` off `main`; commits atômicos convencionais; ff-merge
para `main` — encerra a fase de 4 sub-projetos do design.
