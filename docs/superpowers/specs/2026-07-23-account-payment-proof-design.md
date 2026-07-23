# Comprovante de pagamento nas contas (accounts)

**Data:** 2026-07-23
**Status:** aprovado, pronto para plano de implementação

## Objetivo

Permitir que o **admin** anexe um arquivo (PDF ou imagem) representando um boleto
pago ou comprovante PIX a uma **conta / lançamento** (`Account`), e revisite esse
comprovante depois. O anexo fica sempre disponível na edição da conta e **não altera
o status** da conta.

## Decisões travadas (do usuário)

- **Quando anexar:** sempre disponível na edição da conta, independente do status
  (paridade total com `income` / "Outras entradas"). Sem gate por status.
- **Efeito no status:** nenhum. O comprovante é apenas um anexo; o admin controla o
  status separadamente.
- **Escopo negativo (YAGNI):** não mexer no dashboard/summary; não adicionar
  indicador de comprovante na lista de contas (a lista de income também não tem).
  Fica como follow-up separado se desejado.

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
   correto; 404 se a conta ou o comprovante não existir.

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
5. **`accounts/adapters/http/routes.ts`** — nova rota `GET /:id/proof` (mesma forma da
   rota `GET /:id/proof` de income, com `toArrayBufferView`).
6. **`accounts/adapters/account-repository.contract.ts`** — casos de contrato para
   proof: `getProof` devolve bytes após save com `proofDataUrl`; `getProof` null quando
   não há comprovante; `hasProof` refletido em `getById`/`list`; re-save sem
   `proofDataUrl` preserva o comprovante. Roda em Postgres **e** in-memory.
7. **`repositories.ts`** — `new PostgresAccountRepository(pool, proofStorage)`.
8. **In-memory account repo de teste da API** (se existir no contrato) — implementar
   `getProof` + preservar proof, para o contrato passar nos dois adapters.

### Web (`apps/web`)

9. **`features/accounts/domain/account.ts`** — `accountSchema` espelha
   `proofDataUrl?` (string opcional/nullable) e `hasProof?: boolean`.
10. **`features/accounts/data/in-memory-account-repository.ts`** — no `save`, derivar
    `hasProof` quando `proofDataUrl` for enviado (espelhando a API) para os testes de
    componente da tela de edição funcionarem.
11. **`features/accounts/data/http-account-repository.ts`** — sem método novo; o
    `PUT` já envia o account com `proofDataUrl`. (O link "Ver comprovante" aponta
    direto para `/api/accounts/:id/proof`.)
12. **`features/accounts/ui/account-edit-screen.tsx`** — bloco "Anexar comprovante"
    (input file `accept="image/*,application/pdf"`, `fileToDataUrl` + `isAllowedProof`,
    nome do arquivo, erro de tipo) + link "Ver comprovante" quando `existing.data.hasProof`,
    apontando para `/api/accounts/:id/proof`. Copiado de `income-edit-screen`. O
    `proofDataUrl` entra no payload de `save.mutate`.

## Interface web `AccountRepository`

**Não** ganha `getProof` — o comprovante web é servido via URL direta
`/api/accounts/:id/proof` (idêntico ao income, cujo `IncomeRepository` web também não
tem `getProof`).

## Testes (TDD)

- **API domain/adapters:** casos de contrato de proof (item 6) rodando em pg +
  in-memory; teste de rota `GET /:id/proof` (bytes + `Content-Type`; 404 conta
  inexistente; 404 sem comprovante) no `compose.test`.
- **Web:** teste de componente da `account-edit-screen` — anexar comprovante inclui
  `proofDataUrl` no save; "Ver comprovante" aparece quando `hasProof`; tipo inválido
  mostra erro. Round-trip via in-memory repo.
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
