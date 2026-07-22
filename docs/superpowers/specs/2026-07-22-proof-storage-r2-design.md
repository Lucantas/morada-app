# Comprovantes em R2 (ProofStorage) — design

Move os comprovantes de pagamento de base64-no-Postgres para o Cloudflare R2, atrás de um
port `ProofStorage`, e corrige um problema latente: hoje o `SELECT` de recibos inclui
`proof_data_url`, então TODO load de lista (ledger do apartamento, recibos do morador)
baixa todos os comprovantes em base64 inline. Escolha do usuário 2026-07-22: R2.

## Decisões

- **Escrita mantém base64.** O web continua lendo o arquivo via `FileReader` → data URL →
  POST (sem mudança de UX). A API decodifica no adapter.
- **Leitura vira endpoint.** O comprovante deixa de viajar inline no JSON do recibo. As
  respostas de recibo/entrada passam a expor `hasProof: boolean` (derivado); um endpoint
  autenticado serve os bytes: `GET /api/receipts/:id/proof` e `GET /api/incomes/:id/proof`.
  GET é método seguro (sem CSRF), same-origin via proxy do Pages → cookie de sessão vai
  junto. O browser abre/baixa pelo `Content-Type` real (imagem/pdf).
- **Port + dois modos.** `ProofStorage` (`put`/`get`). Adapter **R2** (via
  `@aws-sdk/client-s3`, S3-compatível) quando as 4 envs de R2 estão setadas; **fallback
  DB** (base64 na coluna, comportamento atual) quando não — cobre dev/test/CI sem
  credencial. O offload/serve vive no adapter Postgres de receipts/income (app layer
  intocado).
- **Legado sem backfill.** Linhas antigas com `proof_data_url` continuam servidas pelo
  fallback do próprio endpoint (lê a coluna quando não há `proof_key`). Backfill é
  opcional e fica para depois.
- **Chave R2:** `receipts/<receiptId>` e `incomes/<incomeId>` (um comprovante por
  registro; re-submissão sobrescreve). `Content-Type` derivado do prefixo do data URL.

## Camadas

1. **Config** (`platform/config.ts`): bloco `r2 = { endpoint, accessKeyId,
secretAccessKey, bucket }` quando as 4 envs existem, senão `null`. Sem env em dev →
   `null` → fallback DB. (Prod exige as 4; não falha o boot se faltar — só usa fallback,
   para não travar o app se o R2 cair.)
2. **Port** `ProofStorage` (domain de receipts, infra-agnóstico):
   `put(key, dataUrl): Promise<void>` (decodifica base64+content-type, grava bytes),
   `get(key): Promise<{ contentType: string; body: Uint8Array } | null>`.
   Adapters: `R2ProofStorage` (S3 client → R2), e nenhum adapter no modo fallback (o
   próprio pg adapter grava base64 quando `storage === null`).
3. **Migração `013_proof_key`** (append-only): `ADD COLUMN proof_key TEXT` em `receipts`
   e `incomes` (nullable). Mantém `proof_data_url` (legado/fallback).
4. **Adapters Postgres (receipts + income):**
   - `save`: se `storage` e o registro traz um data URL base64 novo → `storage.put(key)`,
     grava `proof_key = key`, `proof_data_url = NULL`; senão grava base64 (atual).
   - Leituras (`list`/`listBy*`): NÃO trazem base64; trazem `has_proof` =
     `proof_key IS NOT NULL OR proof_data_url IS NOT NULL`.
   - `getProof(id): Promise<{contentType, body} | null>`: `proof_key` → `storage.get`;
     senão `proof_data_url` → decodifica; senão `null`.
5. **Domínio:** Receipt/Income ganham `hasProof?: boolean` (read-only, derivado);
   `proofDataUrl` permanece como CANAL DE ESCRITA (input opcional), nunca mais populado na
   leitura. `proof_key`/`has_proof` são persistence-only (fora do Zod de domínio, como
   `visible`).
6. **Rotas:** `GET /api/receipts/:id/proof` (morador dono ou admin — reusa o guard
   `denyForeignReceipt`); `GET /api/incomes/:id/proof` (admin). 404 se sem comprovante;
   responde com `Content-Type` e o corpo binário.
7. **Web:** o botão "Ver comprovante" (admin no ledger + income screen) passa a depender
   de `hasProof` e aponta `href` para o endpoint (`/api/receipts/:id/proof`), em vez do
   data URL inline. Upload no pay-screen/new-receipt-card/income segue base64. Schemas web
   ganham `hasProof` e param de ler `proofDataUrl` na resposta.

## Composição

`repositories.ts`/`compose.ts` constroem `ProofStorage` a partir de `config.r2` (ou
`null`) e injetam nos pg repos de receipts e income.

## Deploy (com as credenciais do usuário — passo gated)

`flyctl secrets set -a morada-api R2_ENDPOINT=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=…
R2_BUCKET=morada-proofs`. Documentar em `docs/DEPLOY.md`. Migração 013 roda no
release_command. Smoke: submeter um pagamento com comprovante em prod → objeto aparece no
bucket; "Ver comprovante" abre.

## Testes (TDD)

- Config: 4 envs → objeto; faltando qualquer uma → `null`.
- Port contract com fake in-memory (put→get round-trip; content-type preservado; get de
  chave ausente → null).
- pg receipts/income: com `storage` fake injetado, `save` de base64 chama `put`, grava
  `proof_key`, zera coluna; `getProof` lê do storage; linha legado (só `proof_data_url`)
  servida pelo fallback; listas trazem `has_proof` e NÃO o base64.
- Rotas: 200 + content-type no dono/admin; 403 morador em recibo alheio; 404 sem
  comprovante; income admin-only.
- Web: botão gated em `hasProof`, href para o endpoint; upload segue base64.
- `make api-check` + `make check` + `make e2e` verdes.

## Fora de escopo

- Backfill dos base64 legados para o R2 (servidos pelo fallback).
- URLs pré-assinadas (stream-through pelo endpoint é suficiente e funciona pelo proxy).
- Multipart no upload (base64 mantém o contrato do cliente).
