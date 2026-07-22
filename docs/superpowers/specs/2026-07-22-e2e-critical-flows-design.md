# E2E críticos com Playwright — design

Suíte e2e cobrindo os fluxos críticos do Morada, rodando local e no CI, escolhida pelo
usuário em 2026-07-22 ("fluxos críticos + CI").

## Topologia

- **Playwright** (`@playwright/test`, Chromium apenas) em `apps/web/e2e/`.
- O navegador acessa SÓ o vite dev server (`:5173`) com `VITE_API_URL=''` — as chamadas
  `/api`/`/auth` passam pelo proxy do vite (`vite.config.ts` já o define) para a API
  (`:8787`). Same-origin de verdade: cookies `SameSite=Strict` + leitura do cookie
  `csrf` funcionam exatamente como em produção (que usa o proxy `_worker.js`).
- `playwright.config.ts` usa `webServer` (array) para subir API e web; localmente
  `reuseExistingServer` acelera iteração.

## Isolamento de dados (regra do projeto: NUNCA tocar o DB `morada` real)

- Local: a API do e2e sobe com `DATABASE_URL` apontando para **`morada_e2e`**
  (auto-criado na primeira execução, mesmo padrão do `morada_test`), resetado no início
  da run. `make e2e` encapsula isso.
- CI: job novo com service Postgres dedicado (mesmo padrão do job `api`), DB descartável.
- Login seed: `admin` / `morada-admin` (seed de dev já existente). Todo o resto é criado
  pelos próprios testes via UI.

## Fluxos cobertos (jornada serial — `test.describe.serial`, 1 worker)

1. Admin faz login → dashboard aparece (saldo/cards).
2. Admin cria morador (apto novo) → aparece na lista de apartamentos.
3. Admin provisiona o login do morador → captura a senha temporária da tela.
4. Admin emite cobrança para o morador (recibo pendente no ledger).
5. Morador (novo contexto de browser) faz login com a senha temporária → vê o recibo
   pendente → submete pagamento (pix, com comprovante mínimo via upload de fixture) →
   estado "aguardando confirmação".
6. Admin confirma o pagamento → recibo `pago` no ledger do apartamento.
7. Logout (ambos) → voltar à tela de login; rota autenticada volta 401.

Asserções por papel e por estado visível na UI (Testing-Library-style locators por
role/label/texto), sem sleeps fixos — esperas por estado.

## CI

- Job `e2e` em `ci.yml`: service Postgres, `pnpm install`, `playwright install
--with-deps chromium`, roda a suíte (o `webServer` do config sobe API+web), artefatos
  (trace/screenshot) em caso de falha via `actions/upload-artifact`.
- O job NÃO bloqueia menos que os outros: falhou, CI vermelho.

## Fora de escopo

- Safari/Firefox, mobile viewports, visual regression, notices/mensagens/categorias
  (cobertos por testes de unidade/integração; expandir depois se valer).
- Rodar e2e no pre-push local (CI-only + `make e2e` manual).
