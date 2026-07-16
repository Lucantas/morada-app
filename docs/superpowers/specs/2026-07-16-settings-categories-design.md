# Sub-projeto 3 — Ajustes via ⚙️ + Categorias de contas

> Fase de UI derivada do Claude Design `Morada.dc.html` (projeto `ea2ea282`),
> terceiro de quatro sub-projetos. Full-stack (API + web). TDD; boundaries
> `ui → domain ← data` (web) e `domain / app / adapters / platform` (api);
> gates `make check` e `make api-check` ≥ 80%.

## Contexto

Hoje a tela de Ajustes (`settings-screen`, view `a-settings`) só tem a taxa
(`condo_settings`: monthlyFeeCents + dueDay) e é acessada por uma aba no
bottom-nav do admin. O design (Morada.dc.html 706-753 + gear na linha 66) muda:

1. **Categorias de contas** — uma lista gerenciável (nome + palavras-chave) que
   **reclassifica automaticamente** as contas já registradas ao salvar.
2. **Acesso pelo ⚙️** no header do admin (não mais aba no bottom-nav).

A lógica de reclassificação está **totalmente especificada no design**
(`remapAccounts`, linha 960) e é seguida à risca (ver abaixo).

Contas têm `category: string` (texto livre, `min(1).max(60)`) + `description`.
Próxima migração: `007`. `settings` é a feature-template canônica (mesma
estrutura domain/app/adapters/postgres/contract).

## Regra de reclassificação (verbatim do design)

`reclassifyAccounts(categories, accounts)` — função **pura**:

- Normaliza com `norm(s) = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')`
  (minúsculas + remove acentos).
- Para cada conta: `hay = norm(description + ' ' + category)`.
- Acha a **primeira** categoria (ordem da lista) cuja **alguma** palavra-chave
  (split por vírgula, trim, não-vazia) satisfaz `hay.includes(norm(keyword))`.
- Se achou e `categoria.name !== account.category` → nova conta com
  `category = categoria.name` (conta como reclassificada). Senão, inalterada.
- Retorna `{ accounts: Account[], reclassified: number }`. Imutável.

Categorias-semente do design: Água (`água, agua, saneamento, esgoto`),
Energia (`energia, luz, elétr, eletr`), Serviços
(`limpeza, internet, portaria, serviço, servico, segurança`), Manutenção
(`manutenção, manutencao, reparo, elevador, conserto, bomba`).

## API

**Migração `007_categories`** (append-only): tabela `categories`
(`id TEXT PRIMARY KEY, name TEXT NOT NULL, keywords TEXT NOT NULL, position INTEGER NOT NULL`),
mais os 4 seeds do design (position 0..3, keywords como string separada por vírgula).

**Feature `categories`** (espelha a estrutura de `settings`):

- `domain/category.ts`: `categorySchema` (`id`, `name` min1 max60, `keywords`
  string, `position` int) + `Category` + `categoryDraftSchema` (id opcional).
- `domain/reclassify.ts`: `reclassifyAccounts(categories, accounts)` puro (regra
  acima). Usa um tipo mínimo local `type ReclassifiableAccount = { category: string; description: string }` genérico via generics para preservar o tipo de conta.
- `domain/category-repository.ts`: `CategoryRepository { list(): Promise<Category[]>; replaceAll(categories: Category[]): Promise<Category[]> }`.
- `app/get-categories.ts`: `getCategories(repo)`.
- `app/save-categories.ts`: `saveCategories(catRepo, accountsPort, input)` —
  valida a lista (draftSchema, atribui ids/positions), `replaceAll`, depois lê
  as contas via `accountsPort.list()`, roda `reclassifyAccounts`, salva as
  contas alteradas via `accountsPort.save()`, retorna `{ categories, reclassified }`.
  `accountsPort` é uma **porta local** `{ list(): Promise<AccountLike[]>; save(a: AccountLike): Promise<AccountLike> }` (padrão `ResidentApartmentLookup` do `createReceipt`), fiada na composição a partir do `AccountRepository` real — **sem import cross-feature**.
- `adapters/postgres/category-repository.ts`: `replaceAll` = transação
  (DELETE all + INSERT com position). `adapters/settings-repository.contract.ts`
  equivalente para categorias (`category-repository.contract.ts`, roda vs pg).
- `adapters/http/routes.ts`: `GET /` → `getCategories`; `PUT /` → `saveCategories`
  (body = lista de categorias), retorna `{ categories, reclassified }`.
- `platform/repositories.ts`: adiciona `categories: new PostgresCategoryRepository(pool)`.
- `compose.ts`: monta `api.route('/categories', guarded('admin', categoryRoutes(categories, accountsPortFrom(accounts))))` — a porta adapta o `AccountRepository`.

`condo_settings` / `settingsRoutes` permanecem inalterados (taxa é salva à parte).

## Web

- **Feature `categories`** (`domain` + `data`): `Category` type/schema espelhando
  a API; `CategoryRepository` (list, save→retorna `{categories, reclassified}`);
  `HttpCategoryRepository` (`GET/PUT /api/categories`); hook `useCategories` +
  `useSaveCategories`.
- **Tela Ajustes** (`settings-screen`): renomeia o título "Configurações"→"Ajustes";
  mantém a Taxa; **adiciona** a seção "Categorias de contas" — lista editável
  (nome + palavras-chave por categoria, remover), bloco "Nova categoria"
  (nome + palavras-chave + "Adicionar categoria"), e o botão principal passa a
  **"Salvar e reclassificar contas"** que: salva a taxa (`PUT /settings`) e as
  categorias (`PUT /categories`), e mostra a mensagem do design
  ("Pronto — N conta(s) foi/foram reclassificada(s)." / "Configurações salvas.
  Nenhuma conta precisou ser reclassificada.").
- **Acesso pelo ⚙️**: adiciona um botão de engrenagem (ícone `wrench` existente)
  no header do admin home (`dashboard-screen`), ao lado dos ícones de aviso/mensagens,
  navegando para `a-settings`; **remove** o item `settings` do `adminNav`
  (bottom-nav fica: Início, Apartamentos, Contas, Sair).
- Categoria da conta permanece **texto livre** (editor de contas inalterado).

## Testes (TDD)

**API:** `reclassify.test.ts` (match acento-insensível; primeira categoria vence;
não-match inalterado; contagem correta; imutabilidade). `save-categories.test.ts`
(replaceAll + reclassifica via porta fake + retorna count). `category-repository`
contrato pg (list/replaceAll round-trip, ordena por position). rota
`PUT /categories` (admin, retorna `{categories, reclassified}`; resident→403 via mount).

**Web:** seção de categorias (adicionar/editar/remover); "Salvar e reclassificar"
chama save e mostra a mensagem com a contagem; gear no header do admin abre
`a-settings`; `adminNav` não tem mais o item settings.

Gates verdes (≥ 80%). Domínio perto de 100%.

## Fora de escopo

- Editor de contas virar picker de categorias (fica texto livre).
- Excluir conta/recibo (deferido). Entradas/income = SP4.

## Entrega

Branch `feat/settings-categories` off `main`; commits atômicos convencionais;
ff-merge para `main` antes do SP4.
