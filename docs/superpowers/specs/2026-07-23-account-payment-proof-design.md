# Comprovante de pagamento nas contas (accounts)

**Data:** 2026-07-23
**Status:** aprovado, pronto para plano de implementação

## Objetivo

Permitir que o **admin** anexe um arquivo (PDF ou imagem) representando um boleto
pago ou comprovante PIX a uma **conta / lançamento** (`Account`), e revisite esse
comprovante depois. O anexo fica sempre disponível na edição da conta e **não altera
o status** da conta. Além disso, o **morador** pode **baixar** o comprovante de uma
conta paga (quando ele existir) pela tela Condomínio.

## Decisões travadas (do usuário)

- **Quando anexar:** sempre disponível na edição da conta, independente do status
  (paridade total com `income` / "Outras entradas"). Sem gate por status.
- **Efeito no status:** nenhum. O comprovante é apenas um anexo; o admin controla o
  status separadamente.
- **Download pelo morador:** o morador pode baixar o comprovante de uma conta paga
  quando ele existir. Ponto de acesso: a lista "Últimas contas pagas" da tela
  Condomínio (único lugar onde o morador vê contas hoje). A rota de proof passa a ser
  acessível a qualquer usuário autenticado (admin **ou** morador) — despacho de
  gastos do condomínio é informação compartilhada do prédio, sem dono por morador
  (mesma postura da rota de proof de receipts, que já é servida a não-admins).
- **Escopo negativo (YAGNI):** não adicionar indicador de comprovante na lista
  admin de contas (a lista de income também não tem); não criar uma tela nova de
  contas para o morador — reusar o `recentPaid` já existente. Balanço/somatórios do
  dashboard permanecem inalterados (só o `PaidItem` ganha a flag `hasProof`).

## Reúso — nada de infra nova

O padrão de comprovante já existe e é reaproveitado integralmente (espelhando
`income`, o análogo admin-only mais próximo):

- `receipts/domain/proof.ts` — `proofSchema` (aceita `image/*` e `application/pdf`,
  data URL base64, máx. ~7 MB).
- `receipts/domain/proof-storage.ts` — porta `ProofStorage` + `decodeDataUrl` +
  tipo `ProofBytes`.
- `receipts/adapters/r2/r2-proof-storage.ts` — adaptador R2 (S3-like), já wired em
  `repositories.ts` via `config.r2`.
- Web: `fileToDataUrl` / `isAllowedProof` de `features/receipts/domain/proof`
  (a UI de `accounts` pode importar `receipts/domain` — permitido por boundary).

## Modelo de dados

Migração append-only **`014_account_proof`**:

```sql
ALTER TABLE accounts ADD COLUMN proof_data_url TEXT;
ALTER TABLE accounts ADD COLUMN proof_key TEXT;
```

- `proof_key` → objeto no R2 (upload novo é offloaded para lá: `accounts/<id>`).
- `proof_data_url` → fallback base64 legado / quando não há storage configurado.
- Leituras derivam `has_proof = (proof_key IS NOT NULL OR proof_data_url IS NOT NULL)`.

Isto espelha exatamente `incomes` (migração `008_incomes` + `013_proof_key`).

## Fluxo

1. **Write** — o admin edita a conta e anexa um arquivo. O front converte o arquivo
   em data URL (`fileToDataUrl`), valida (`isAllowedProof`) e envia como
   `proofDataUrl` junto do `PUT /api/accounts/:id` (o payload já carrega o account
   inteiro). Semântica de `proofDataUrl` idêntica ao income:
   - `string` = novo upload;
   - `null` = limpar explicitamente;
   - `undefined` = manter o comprovante existente (re-save sem novo anexo).
2. **Persist** — o adapter Postgres: se for upload novo, `storage.put('accounts/<id>')`
   e grava `proof_key`; senão grava `proof_data_url`. A cláusula `SET` de proof no
   upsert só é emitida quando `proofDataUrl !== undefined`, para um re-save preservar
   o comprovante existente.
3. **Read** — listagens/`getById` trazem `hasProof` (nunca os bytes).
4. **Serve** — `GET /api/accounts/:id/proof` devolve os bytes via `repo.getProof(id)`
   (R2 se `proof_key`, senão `decodeDataUrl(proof_data_url)`), com o `Content-Type`
   correto; 404 se a conta ou o comprovante não existir. Acessível a **qualquer
   usuário autenticado** (admin ou morador), fora do guard admin do CRUD.
5. **Morador baixa** — na tela Condomínio, cada item de "Últimas contas pagas"
   (`PaidItem`) com `hasProof` mostra um link "Baixar comprovante" apontando para
   `/api/accounts/:id/proof`. O `PaidItem` ganha `hasProof`, derivado no dashboard a
   partir das colunas de proof da conta.

## Mapa de arquivos

### API (`apps/api`)

1. **`platform/postgres/migrations.ts`** — nova migração `014_account_proof`.
2. **`accounts/domain/account.ts`** — `accountSchema` ganha:
   - `proofDataUrl: proofSchema.nullable().optional()` (importa `receipts/domain/proof`);
   - `hasProof: z.boolean().optional()` (derivado na leitura, nunca input de escrita).
     `accountDraftSchema` permanece inalterado.
3. **`accounts/domain/account-repository.ts`** — interface ganha
   `getProof(id): Promise<ProofBytes | null>`.
4. **`accounts/adapters/postgres/account-repository.ts`** — construtor passa a receber
   `ProofStorage | null`; `save` trata proof como o `PostgresIncomeRepository`
   (upload/data_url + `SET` condicional); `SELECT_COLUMNS` deriva `has_proof`; novo
   método `getProof`.
5. **`accounts/adapters/http/routes.ts`** — nova função `accountProofRoutes(repo)`
   com **apenas** `GET /:id/proof` (bytes via `toArrayBufferView`, 404 conta/proof
   ausente). O CRUD (`accountRoutes`) **não** ganha a rota de proof — ela é montada
   fora do guard admin para o morador alcançá-la.
6. **`compose.ts`** — montar a rota de proof (auth-any) **antes** do CRUD admin no
   mesmo path, para o `GET /:id/proof` cair na rota sem guard e os demais paths
   caírem no CRUD guardado:
   `api.route('/accounts', accountProofRoutes(accounts));`
   `api.route('/accounts', guarded('admin', accountRoutes(accounts)));`
   (Hono resolve routers na ordem de registro; a rota de proof só define `GET
/:id/proof`, então list/getById/POST/PUT/DELETE caem no CRUD admin.)
7. **`accounts/adapters/postgres/account-repository.test.ts`** — casos de proof
   espelhando `income-repository.test.ts` (offload para storage; fallback base64
   quando storage null; `getProof` de storage e de base64 legado; `getProof` null
   sem proof / id inexistente; `list`/`getById` trazem `hasProof`, nunca
   `proofDataUrl`; re-save `undefined` preserva; `null` limpa). Construtor do contrato
   compartilhado passa `null` como storage: `new PostgresAccountRepository(pool, null)`.
8. **`repositories.ts`** — `new PostgresAccountRepository(pool, proofStorage)`.

**API — dashboard (para o morador baixar)**

9. **`dashboard/domain/dashboard.ts`** — `paidItemSchema` ganha
   `hasProof: z.boolean().optional()`.
10. **`dashboard/domain/build-dashboard-summary.ts`** — `LedgerAccount` ganha
    `hasProof?: boolean`; o `.map` de `recentPaid` inclui `hasProof: a.hasProof ?? false`.
11. **`dashboard/adapters/postgres/dashboard-repository.ts`** — o SELECT de accounts
    adiciona `(proof_key IS NOT NULL OR proof_data_url IS NOT NULL) AS has_proof` e o
    map de `LedgerAccount` passa `hasProof: row.has_proof`.

### Web (`apps/web`)

12. **`features/accounts/domain/account.ts`** — `accountSchema` espelha
    `proofDataUrl?` (string opcional/nullable) e `hasProof?: boolean`.
13. **`features/accounts/data/in-memory-account-repository.ts`** — no `save`, derivar
    `hasProof` quando `proofDataUrl` for enviado (espelhando a API) para os testes de
    componente da tela de edição funcionarem.
14. **`features/accounts/data/http-account-repository.ts`** — sem método novo; o
    `PUT` já envia o account com `proofDataUrl`. (O link "Ver comprovante" aponta
    direto para `/api/accounts/:id/proof`.)
15. **`features/accounts/ui/account-edit-screen.tsx`** — bloco "Anexar comprovante"
    (input file `accept="image/*,application/pdf"`, `fileToDataUrl` + `isAllowedProof`,
    nome do arquivo, erro de tipo) + link "Ver comprovante" quando `existing.data.hasProof`,
    apontando para `/api/accounts/:id/proof`. Copiado de `income-edit-screen`. O
    `proofDataUrl` entra no payload de `save.mutate`.

**Web — dashboard/morador (download)**

16. **`features/dashboard/domain/dashboard.ts`** — `paidItemSchema` (web) espelha
    `hasProof: z.boolean().optional()`.
17. **`features/resident-home/ui/resident-finance-screen.tsx`** — o `PaidRow` mostra
    um link "Baixar comprovante" (`<a target="_blank" rel="noreferrer">`) apontando
    para `/api/accounts/${item.id}/proof` **somente quando** `item.hasProof`.
    `resident-home` pode importar `dashboard/domain` (já importa hoje). Nenhum outro
    consumidor do dashboard muda; a lista admin (`dashboard-screen.tsx`) fica intacta.

## Interface web `AccountRepository`

**Não** ganha `getProof` — o comprovante web é servido via URL direta
`/api/accounts/:id/proof` (idêntico ao income, cujo `IncomeRepository` web também não
tem `getProof`).

## Testes (TDD)

- **API adapters:** casos de proof no `account-repository.test.ts` (pg), espelhando
  income (item 7).
- **API rotas (`compose.test`):** admin baixa o proof (200 + `Content-Type`);
  **morador autenticado também baixa** (200, não 403); 404 conta inexistente; 404
  conta sem comprovante.
- **API dashboard:** teste de `buildDashboardSummary` — `recentPaid` carrega
  `hasProof` a partir do `LedgerAccount`.
- **Web:** componente `account-edit-screen` — anexar comprovante inclui `proofDataUrl`
  no save; "Ver comprovante" aparece quando `hasProof`; tipo inválido mostra erro.
- **Web:** componente `resident-finance-screen` — "Baixar comprovante" aparece com
  `href` correto quando `PaidItem.hasProof`; ausente quando não há proof.
- Gates verdes: `make api-check` e `make check` (cobertura ≥ 80%, domínio ~100%).

## Execução

TDD, subagent-driven (CLAUDE.md não-negociável #9): um subagent por task, review entre
tasks, review final da branch inteira. Commits atômicos, conventional commits. Branch
própria off `main`.

## Riscos / notas

- `PostgresAccountRepository` hoje é construído sem storage em `repositories.ts` —
  adicionar o parâmetro é a única mudança de wiring; demais features já passam
  `proofStorage`.
- Contas legadas ficam com `proof_data_url`/`proof_key` NULL → `hasProof = false`,
  comportamento correto (sem comprovante).
- **Exposição do proof a moradores:** a rota serve o comprovante de qualquer conta por
  id a qualquer usuário autenticado (sem checagem de dono nem de status). É decisão
  aceita — gastos do condomínio são transparência financeira do prédio; a UI só
  oferece o download nas contas pagas recentes (`recentPaid`). Sem vazamento de dados
  pessoais (comprovante de despesa do condomínio, não de morador).
