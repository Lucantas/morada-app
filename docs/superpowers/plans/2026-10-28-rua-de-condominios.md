# Rua de condomínios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem administra mais de um condomínio entra numa "rua": um prédio em miniatura por condomínio, com bandeiras de pendência, um select "Ir para um condomínio…" e a lista "Pede atenção hoje". De dentro de qualquer condomínio dá para voltar à rua e trocar de condomínio.

**Architecture:**

- **API:** uma consulta agregada (`StreetQuery`) calcula, no servidor e em poucas queries `= ANY($ids)`, as pendências e as janelas de todos os condomínios de staff da pessoa. Ela é exposta em `GET /me/street`.
- **Mensagens:** o "não lida" das conversas passa a ser por pessoa (`thread_reads`), pré-requisito da bandeira de mensagens.
- **Web:**
  - Uma feature `street` (domain/data/ui) contém nível, motivos, texto e ordenação, além da tela.
  - A troca de condomínio limpa o cache do TanStack Query, como a troca "Minha casa ↔ O prédio" já faz.
  - Ela usa o `CondoSummary` fresco vindo da rua, e não o congelado no login.

**Tech Stack:** Hono + node-pg + Zod + Jest (API); Vite + React 19 + Zustand + TanStack Query v5 (web); Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md` §10 (e §6 isolamento, §11 item 5)

## Global Constraints

- **Isolamento:** a rua só agrega condomínios em que a pessoa é `administrador` ou `sindico` (o mesmo `listForUser` que já resolve o acesso). Condomínio em que ela é só `morador` nunca mostra pendências, e condomínio sem vínculo nunca aparece.
- **Níveis exatos da spec:**
  - **Urgente:** morador com taxa vencida sem pagamento, ou conta vencida sem baixa.
  - **Atenção:** conta que vence nos próximos 3 dias, comprovante de Pix esperando conferência, ou mensagem de morador não lida.
- **Prazos das contas:**
  - "Conta vencida" = não paga e com `due_date < hoje`, **ou** status `atrasado`.
  - "Vence em breve" = não paga, não vencida e com `hoje ≤ due_date ≤ hoje+3`.
  - Contas sem vencimento nunca geram bandeira por prazo. Só contam contas com `visible = true`.
- **"Morador com taxa vencida":** é o mesmo status que a lista de moradores mostra, `statusOverride ?? deriveResidentStatus(...)` (`apps/api/src/residents/app/list-residents.ts`), restrito a moradores com ocupação ativa. A rua e a lista nunca podem divergir.
- **"Comprovante pra conferir":** recibo com status `em_analise`.
- **"Não lida" é por pessoa:** a bandeira conta as conversas não lidas por quem está olhando.
- **"Hoje":** mesma fonte que `listResidents`, `new Date().toISOString().slice(0, 10)`, injetada como parâmetro `today` nos casos de uso (testável).
- **Cálculo agregado no servidor.** O cliente faz uma única chamada (`GET /me/street`) e nunca abre N telas.
- **Mobile-first:**
  - No celular, a rua rola para o lado, urgentes primeiro, e o lote **"+ Novo condomínio"** fica no fim.
  - A partir de `min-width: 768px`, a rua quebra linha e mostra todos sem rolar.
  - Nunca moldura de celular.
- **Animações** respeitam `prefers-reduced-motion`. As classes novas ficam em `shared/ui/tokens.css`, como no SP4.
- **Nada é apagado de verdade.** Migrações são append-only em `apps/api/src/platform/postgres/migrations.ts`.
- **Boundaries da web:** ui de uma feature não importa ui de outra, e ui não importa data. A UI de outra feature entra por slot ou render-prop montado em `app/` (padrão do SP4).
- **Commits:** convencionais, com o trailer `Spec: docs/superpowers/specs/2026-10-22-morada-saas-multi-condominio-design.md`. Nunca `--no-verify`. Nunca trailer `Claude-Session:`.
- **Textos (exatos, PT-BR):** estão nos passos das Tasks 4 e 6.

## Review Focus

1. **Uma sobrescrita de status manual:**
   - Um morador marcado `em_dia` mas com recibo pendente vencido não conta como atrasado.
   - Um marcado `atrasado` sem recibo vencido conta.

   A rua bate com a lista de moradores. Teste na Task 2.

2. **Conta que vence hoje** é "vence em breve", não "vencida". `hoje+3` ainda é "em breve" e `hoje+4` não é. Uma conta `atrasado` sem vencimento é vencida e não entra em "em breve". Teste na Task 2.
3. **Trocar de condomínio não mostra dados do anterior.** O cache das queries tem chaves sem condomínio, então a troca limpa o cache. Teste na Task 7.
4. **O morador abrir a própria conversa não marca como lida para o staff.** Isso é um bug atual, porque `/read` do morador zera o `unread` global. Dois administradores leem de forma independente. Teste na Task 1.
5. **Condomínio onde a pessoa é só morador** não aparece na rua com pendências: vai para "Onde você mora", sem contagens. Teste na Task 3.

---

### Task 1: "Não lida" por pessoa nas conversas

**Files:**

- Modify: `apps/api/src/platform/postgres/migrations.ts` (append `028_thread_reads`)
- Modify: `apps/api/src/messages/domain/thread-repository.ts`
- Modify: `apps/api/src/messages/adapters/postgres/thread-repository.ts`
- Modify: `apps/api/src/messages/adapters/thread-repository.contract.ts`, ou o arquivo de contrato existente das threads
- Modify: `apps/api/src/messages/app/{list-threads,mark-read,post-message}.ts` + testes
- Modify: `apps/api/src/messages/adapters/http/routes.ts` + teste de rotas
- Modify: in-memory/fake thread repo usado nos testes, se existir

**Interfaces:**

- Produces:

  ```ts
  interface ThreadRepository {
    list(viewerUserId: string): Promise<Thread[]>;            // unread = não lida PARA o viewer
    getById(id: string, viewerUserId: string): Promise<Thread | null>;
    save(thread: Thread): Promise<Thread>;                    // persiste mensagens/nomes; ignora `unread`
    recordResidentMessage(id: string): Promise<void>;         // resident_message_at = now()
    markRead(id: string, userId: string): Promise<void>;      // upsert thread_reads.read_at = now()
  }
  listThreads(repo, viewerUserId): Promise<Thread[]>
  markRead(repo, id, viewerUserId): Promise<Thread>
  postMessage(repo, id, author, text, viewerUserId): Promise<Thread>
  ```

  O `Thread.unread` continua no schema, com o novo significado "não lida para quem pediu".

- [ ] **Step 1: Migração 028.** Append:
  ```sql
  ALTER TABLE threads ADD COLUMN resident_message_at TIMESTAMPTZ;
  UPDATE threads SET resident_message_at = now() WHERE unread;
  CREATE TABLE thread_reads (
    thread_id TEXT NOT NULL REFERENCES threads(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    condominium_id TEXT NOT NULL REFERENCES condominiums(id),
    read_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (thread_id, user_id)
  );
  ```
  A coluna `threads.unread` fica, sem uso (append-only). Conversa legada não lida continua não lida para todo o staff; conversa lida fica lida para todos.
- [ ] **Step 2: Testes de contrato que falham.**
  - `unread is per viewer: staff A reading does not clear it for staff B`
  - `a resident message after a read makes the thread unread again for that reader`
  - `markRead in condo A never touches a thread of condo B`: isolamento, com o repo escopado em B e `markRead` de um id de A sem efeito
  - `a thread with no resident message is read for everyone`

  Unread em SQL: `t.resident_message_at IS NOT NULL AND (tr.read_at IS NULL OR tr.read_at < t.resident_message_at)`, com `LEFT JOIN thread_reads tr ON tr.thread_id = t.id AND tr.user_id = $viewer`.

- [ ] **Step 3: Testes de caso de uso e rotas que falham.**
  - `postMessage by a resident records the resident message`
  - `postMessage by staff marks the thread read for that staff member`
  - `POST /:id/read by the resident does not make the thread read for the admin`: Review Focus 4

  Nas rotas, o viewer é `c.get('uid')`.

- [ ] **Step 4: Implementar até ficar verde** (`make api-test`).
- [ ] **Step 5: Atualizar `docs/DATA-MODEL.md` e commitar.** Seção de mensagens: `thread_reads`, `resident_message_at`. Commit: `feat(api): unread conversations are tracked per person`.

### Task 2: StreetQuery (pendências + janelas, agregado no servidor)

**Files:**

- Create: `apps/api/src/street/domain/street.ts` (schemas Zod + tipos)
- Create: `apps/api/src/street/domain/street-query.ts` (porta)
- Create: `apps/api/src/street/adapters/postgres/street-query.ts`
- Create: `apps/api/src/street/adapters/street-query.contract.ts` + `postgres/street-query.test.ts` (padrão dos contratos existentes, `morada_test`)
- Modify: `apps/api/src/repositories.ts` (expor a query não-escopada; ela recebe os ids já autorizados)

**Interfaces:**

- Produces:

  ```ts
  type Pendencies = {
    overdueResidents: number;
    overdueAccounts: number;
    accountsDueSoon: number;
    proofsToReview: number;
    unreadThreads: number;
  };
  type StreetWindow = { block: string | null; floor: number; position: number; lit: boolean };
  type StreetFacts = { pendencies: Pendencies; windows: StreetWindow[] };
  interface StreetQuery {
    factsFor(
      condoIds: readonly string[],
      viewerUserId: string,
      today: string,
    ): Promise<Map<string, StreetFacts>>;
  }
  ```
  - Todo id pedido volta no Map, com zeros e `windows: []` quando não há nada.
  - `windows`: só apartamentos `active` com `floor` e `position` não nulos. `lit` = tem ocupação ativa.
  - Ordem: `block NULLS FIRST, floor, position`.

- [ ] **Step 1: Testes de contrato que falham** (dois condomínios A e B em todos):
  - `counts only the requested condos and never mixes A into B`
  - `overdue residents follow the resident list: override wins over derived status`: Review Focus 1
    - `em_dia` com recibo vencido = 0.
    - `atrasado` sem recibo vencido = 1.
    - Pendente vencido sem override = 1.
    - Morador com ocupação inativa = 0.
  - `account due dates: due today and today+3 are due soon, today+4 is not, yesterday is overdue`: Review Focus 2
  - `an atrasado account with no due date is overdue and never due soon`
  - `paid and hidden accounts never count`
  - `proofs to review count em_analise receipts`
  - `unread threads are counted for the viewer only` (usa a Task 1)
  - `windows list placed active apartments lit by active occupancy`: unplaced e `active = false` ficam fora
  - `ids without data come back with zero pendencies and no windows`
- [ ] **Step 2: Implementar o adapter Postgres.**
  - Uma query por métrica (ou CTEs numa query), sempre com `WHERE condominium_id = ANY($1)` e `GROUP BY condominium_id`. Nunca uma query por condomínio.
  - Morador atrasado, a mesma regra de `deriveResidentStatus` em SQL:
    ```
    status_override = 'atrasado'
    OR (status_override IS NULL
        AND EXISTS (SELECT 1 FROM receipts
                    WHERE resident_id = r.id AND status = 'pendente'
                      AND due_date < $today AND condominium_id = r.condominium_id))
    ```
    Só vale para quem tem ocupação ativa num apartamento do mesmo condomínio.
- [ ] **Step 3: Verde** (`make api-test`). **Commit:** `feat(api): street query aggregates pendencies and windows per condominium`.

### Task 3: `GET /me/street`

**Files:**

- Create: `apps/api/src/street/app/get-street.ts` + teste
- Modify: `apps/api/src/condos/adapters/http/routes.ts` (`meRoutes` ganha dep `street: StreetQuery` e `GET /street`) + teste de rotas
- Modify: `apps/api/src/compose.ts` (injeção)
- Modify: `apps/api/README.md` (endpoint)

**Interfaces:**

- Consumes: `listMyCondos` (`condos/app/condo-access-views.ts`), `StreetQuery` (Task 2).
- Produces:

  ```ts
  type StreetCondo = CondoSummary & StreetFacts;   // summary fresco + pendências + janelas
  type Street = { name: string | null; condos: StreetCondo[]; homes: CondoSummary[] };
  getStreet(deps: { condos; users; street }, userId: string, today: string): Promise<Street>
  ```
  - `condos`: entradas com `condoRole` `administrador` ou `sindico`, em ordem alfabética, como `listMyCondos` já devolve.
  - `homes`: entradas só `morador`, sem fatos.
  - `name`: `users.name` da pessoa.
  - `StreetQuery.factsFor` é chamado **só** com os ids de `condos`.

- [ ] **Step 1: Testes que falham.**
  - `street lists staff condos with facts and moradia condos as homes only`: Review Focus 5. Uma pessoa é admin em A, síndica em B, moradora em C e sem vínculo com D. Esperado: `condos` = [A, B] com pendências, `homes` = [C] sem campo `pendencies`, e D ausente.
  - `factsFor is called only with staff condo ids`
  - Na rota:
    - `GET /me/street` sem sessão dá 401.
    - Com sessão, dá 200 com o formato acima.
    - Um owner da organização vê todos os condomínios da org.
    - Um member vê só os atribuídos.
- [ ] **Step 2: Implementar, verde, commitar.** Commit: `feat(api): GET /me/street for the condominium street`.

### Task 4: Web — domínio e dados da rua

**Files:**

- Create: `apps/web/src/features/street/domain/street.ts` (schemas + funções puras) + teste
- Create: `apps/web/src/features/street/domain/street-repository.ts`
- Create: `apps/web/src/features/street/data/http-street-repository.ts` + teste (`GET /me/street`, mesmo cliente que `http-onboarding-repository` usa para `/me/condos`)

**Interfaces:**

- Consumes: `loginCondoSchema` (`features/session/domain/login-response.ts`) para o summary.
- Produces:
  ```ts
  type FlagLevel = 'urgente' | 'atencao';
  type ReasonKind = 'overdue_residents' | 'overdue_accounts' | 'accounts_due_soon' | 'proofs_to_review' | 'unread_threads';
  type Reason = { kind: ReasonKind; level: FlagLevel; count: number; text: string; flag: string };
  reasonsOf(p: Pendencies): Reason[]           // só count > 0, na ordem de ReasonKind acima
  levelOf(p: Pendencies): FlagLevel | null     // nível do primeiro motivo
  sortByUrgency(condos: StreetCondo[]): StreetCondo[]  // urgente → atenção → nenhum; empate: soma dos counts desc, depois nome pt-BR
  greeting(hour: number, name: string | null): string
  summaryLine(total: number, needingAttention: number): string
  miniBuilding(windows: StreetWindow[]): { block: string | null; floors: boolean[][] }[]  // floors de cima para baixo; índice = position-1; posição sem apartamento = false
  interface StreetRepository { get(): Promise<Street> }
  ```
- Textos exatos (singular quando `count === 1`):

  | kind                        | `text`                                                                     | `flag`                       |
  | --------------------------- | -------------------------------------------------------------------------- | ---------------------------- |
  | overdue_residents (urgente) | `1 morador com taxa vencida` / `N moradores com taxa vencida`              | `1 atrasado` / `N atrasados` |
  | overdue_accounts (urgente)  | `1 conta vencida` / `N contas vencidas`                                    | `1 vencida` / `N vencidas`   |
  | accounts_due_soon (atenção) | `1 conta vence em até 3 dias` / `N contas vencem em até 3 dias`            | `vence em breve`             |
  | proofs_to_review (atenção)  | `1 comprovante de Pix pra conferir` / `N comprovantes de Pix pra conferir` | `N comprov.`                 |
  | unread_threads (atenção)    | `1 mensagem não lida` / `N mensagens não lidas`                            | `N msg`                      |
  - `greeting`: `Bom dia` para 5–11h, `Boa tarde` para 12–17h e `Boa noite` no resto. O texto fica `${saudação}, ${primeiro nome}`, ou só `${saudação}` sem nome.
  - `summaryLine`:
    - `1 condomínio` / `N condomínios`
    - mais ` · 1 pede atenção hoje` / ` · N pedem atenção hoje`
    - ou ` · nada pede atenção hoje`

- [ ] **Step 1: Testes que falham.** Cobrir:
  - cada linha da tabela, nos dois números;
  - a ordem de `reasonsOf`;
  - `levelOf` nulo sem pendência;
  - os desempates de `sortByUrgency`;
  - as bordas de hora 4/5/11/12/17/18;
  - `miniBuilding` com blocos e com buraco de posição;
  - o repositório http rejeitando payload inválido (Zod).
- [ ] **Step 2: Implementar, verde (`make test`), commitar.** Commit: `feat(web): street domain and data`.

### Task 5: Web — troca de condomínio no estado da sessão

**Files:**

- Modify: `apps/web/src/shared/lib/condo-scope.ts` + teste
- Modify: `apps/web/src/features/session/ui/session-store.ts` + teste

**Interfaces:**

- Produces:
  - `useCondoScope`:
    - ganha `atStreet: boolean` (default `false`) e `condoCount: number` (default `1`), os dois persistidos;
    - ganha `setAtStreet(v: boolean)` e `setCondoCount(n: number)`;
    - o `migrate`/`merge` tolera estado antigo sem esses campos.
  - `applyLogin(response)`: além do que já faz, `condoCount = condos.length`, e `atStreet = condos.length > 1 && !invitedCondoId`.
  - `enterCondo(condo: LoginCondo): Role`: aplica o mesmo `setCondo` de `applyLogin` com esse condo, `authenticate(condo.role, null)`, `atStreet = false` e devolve o role.
  - `goToStreet(): void`: `atStreet = true`, e mantém a sessão.
  - `useCanSeeStreet(): boolean`: `condoCount > 1 || condo.condoRole !== 'morador'`. O staff sempre alcança a rua, até para criar outro condomínio. O morador de um condomínio só não vê.

- [ ] **Step 1: Testes que falham.**
  - `login with two condos lands at the street`
  - `login from an invitation lands in the invited condo even with many condos`
  - `enterCondo replaces the current condo with fresh permissions and leaves the street`
  - `persisted state from before the street restores with atStreet false and condoCount 1`
- [ ] **Step 2: Implementar, verde, commitar.** Commit: `feat(web): condo switching state for the street`.

### Task 6: Web — tela da rua

**Files:**

- Create: `apps/web/src/features/street/ui/street-screen.tsx` + teste
- Create: `apps/web/src/features/street/ui/mini-building.tsx` + teste
- Create: `apps/web/src/features/street/ui/use-street.ts` (query key `['street']`)
- Modify: `apps/web/src/shared/ui/tokens.css` (classes `street-*`, com reduced-motion)

**Interfaces:**

- Consumes: Task 4.
- Produces:

  ```tsx
  type StreetTarget = 'a-home' | 'a-residents' | 'a-accounts' | 'a-messages' | 'r-home';
  <StreetScreen repository={StreetRepository}
    onOpen={(condo: LoginCondo, target: StreetTarget) => void}
    onNewCondo={() => void} onSignOut={() => void} />
  ```

  Mapa motivo → alvo:

  | Motivo                              | Alvo          |
  | ----------------------------------- | ------------- |
  | overdue_residents, proofs_to_review | `a-residents` |
  | overdue_accounts, accounts_due_soon | `a-accounts`  |
  | unread_threads                      | `a-messages`  |

  Tocar no prédio ou escolher no select abre `a-home`. Tocar em "Onde você mora" abre `r-home`.

- Layout, de cima para baixo:
  1. **Saudação** (`greeting`), em Fraunces, e a `summaryLine`.
  2. **Rua:**
     - uma lista horizontal rolável (`overflow-x: auto`), com um botão por prédio na ordem de `sortByUrgency`;
     - cada prédio é um `MiniBuilding`, a bandeira `flag` do primeiro motivo (vermelha para urgente, âmbar para atenção) e o nome embaixo;
     - no fim, o lote tracejado `+ Novo condomínio`, um botão que chama `onNewCondo`;
     - a dica `arraste para ver mais →` só abaixo de 768px;
     - a partir de 768px, `flex-wrap` e sem rolagem.
  3. **Select** `Ir para um condomínio…`: placeholder com esse texto, opções na ordem de `sortByUrgency`, rótulo `${nome} — ${text do 1º motivo}` ou só `${nome}`.
  4. **`Pede atenção hoje`:** um item por motivo (não por condomínio), urgentes primeiro, com nome, `text` e a tag `urgente` ou `atenção`. Tocar chama `onOpen` com o alvo do mapa. Vazio mostra `Nada pede atenção hoje.`
  5. **`Onde você mora`:** só se `homes` não estiver vazio. É uma linha por casa com o nome do condomínio.
  6. **Link `Sair`.**
- Detalhes:
  - Prédio sem janelas desenha um bloco genérico 2×3 apagado.
  - `aria-label` do botão do prédio: `${nome}, ${N} apartamentos${, motivos}`.
  - Carregando mostra skeleton. Erro mostra estado de erro com `Tentar de novo` (padrão `status-view`).

- [ ] **Step 1: Testes que falham** (Testing Library):
  - `orders buildings urgent first and puts + Novo condomínio last`
  - `tapping an attention item opens that condo at the problem screen`
  - `the select lists condos by urgency with the reason`
  - `homes are listed without pendencies`
  - `empty attention list says Nada pede atenção hoje.`
  - `error state retries`
  - `mini building draws floors top-down with lit windows`
- [ ] **Step 2: Implementar, verde, commitar.** Commit: `feat(web): the condominium street screen`.

### Task 7: Web — ligar a rua ao app

**Files:**

- Modify: `apps/web/src/app/app.tsx`, `apps/web/src/app/container.ts`
- Modify: `apps/web/src/features/onboarding/ui/conversation-screen.tsx`
- Create: `apps/web/src/features/street/ui/street-shortcut.tsx` + teste
- Modify: testes de app/roteamento existentes
- Modify: `CLAUDE.md`
- Modify: `docs/DATA-MODEL.md`, se a Task 1 não cobrir

**Interfaces:**

- Consumes: Tasks 5 e 6, `ConversationScreen`, `localDraftStore`.
- Comportamento:
  - **Rua:** `SessionRouter`, com `atStreet`, renderiza a rua, ou a conversa de novo condomínio quando a pessoa tocou `+ Novo condomínio`. O estado local `creating` fica em app.
  - **`onOpen(condo, target)`:** `queryClient.clear()`, depois `enterCondo(condo)`, depois `go(target)`. Se o condo tem `onboardingPending`, o `SessionRouter` existente já leva ao onboarding.
  - **Nova conversa:**
    - `ConversationScreen` ganha a prop opcional `leaveLabel?: string`, default `Sair`. Na rua ela é chamada com `leaveLabel="Voltar"` e `onSignOut` volta para a rua.
    - `onCreated(condo)`: `setCondoCount(condoCount + 1)`, `queryClient.clear()`, `enterCondo(condo)`, `go('a-home')`.
  - **Atalho `StreetShortcut`:**
    - É um botão de texto `Seus condomínios` no topo, renderizado junto do `ViewSwitch` no `headerAction`, e só quando `useCanSeeStreet()`.
    - Clicar faz `queryClient.clear()` + `goToStreet()`.
    - Aparece nas visões admin e resident.
  - **Pagamento de recibo:** `pay-screen` usa `pixQueryKey` sem condomínio. Com o `clear()` na troca, não precisa reescrever chaves. Registrar isso como ruling no ledger.
- [ ] **Step 1: Testes que falham.**
  - `switching from the street to condo B never shows condo A residents`: Review Focus 3. O repositório fake responde por condomínio. Abrir A, voltar à rua, abrir B: a lista mostra só os de B.
  - `the shortcut is hidden for a resident with a single condo`
  - `creating a condo from the street enters its onboarding`
- [ ] **Step 2: Implementar, verde (`make check`).**
- [ ] **Step 3: Atualizar o vocabulário no `CLAUDE.md`:**
  - `Street`: a tela inicial de quem administra mais de um condomínio, ou seja, prédios em miniatura, bandeiras `urgente` / `atenção` e "Pede atenção hoje", projeção calculada no servidor;
  - `ThreadRead`: o "lido" de uma conversa por pessoa.
- [ ] **Step 4: Commitar.** Commit: `feat(web): land on the street and switch condominiums`.

### Task 8: E2E da rua

**Files:**

- Create: `apps/web/e2e/street.spec.ts` (reusa `confirmed-user.ts` e os passos do `onboarding.spec.ts`)

- [ ] **Step 1: Escrever a jornada.**
  1. Usuário confirmado cria o condomínio "Residencial Ipê" pela conversa e conclui o onboarding sem preencher o térreo.
  2. Toca `Seus condomínios`: a rua mostra Ipê e `+ Novo condomínio`.
  3. Cria "Edifício Aurora" pela conversa, que entra no onboarding do Aurora; conclui.
  4. Em Contas do Aurora, cria uma conta com vencimento ontem, não paga.
  5. Volta à rua: a bandeira `1 vencida` aparece no Aurora, o Aurora vem antes do Ipê, e "Pede atenção hoje" mostra `1 conta vencida` com `urgente`.
  6. Tocar no item abre as Contas do Aurora.
  7. Voltar à rua e abrir o Ipê: as Contas do Ipê não mostram a conta do Aurora.
- [ ] **Step 2: Rodar.** `make e2e`: tudo verde, incluindo as specs antigas.
- [ ] **Step 3: Commitar.** Commit: `test(e2e): the condominium street journey`.
