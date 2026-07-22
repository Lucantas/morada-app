# Skeletons de carregamento em todas as telas logadas

> Melhoria de usabilidade: substituir os estados de "Carregando…" (texto plano
> e spinner) por skeletons fiéis ao layout, em todas as telas de admin e morador.
> Web-only, sem tocar API/domínio/data. Boundaries `ui → domain ← data`; TDD;
> gate web ≥ 80%.

## Contexto

Hoje o carregamento aparece de três formas espalhadas pelas telas:

- **texto plano** `Carregando…` (`dashboard`, `accounts`, `settings`, `pay`,
  `resident-finance`, `thread`, `support`, `create-login`);
- **`StatusView variant="loading"`** com spinner CSS (`residents`, `receipts`,
  `resident-home`, `admin-messages`, `notices`, `income-section`);
- formulários de edição que carregam dados existentes e não mostram nada
  específico enquanto buscam (`account-edit`, `resident-edit`, `income-edit`).

Nenhum comunica a **forma** do conteúdo que está por vir. Este projeto entrega
skeletons shimmer fiéis ao layout em todas as telas que hoje sinalizam
carregamento, melhorando a percepção de velocidade.

## Decisões (alinhadas com o usuário)

1. **Animação:** shimmer (brilho deslizante). Cai para estático em
   `@media (prefers-reduced-motion: reduce)`.
2. **Fidelidade:** cada tela ganha um skeleton com a forma do seu conteúdo real.
3. **Escopo:** todas as telas que hoje mostram carregamento (lista abaixo),
   incluindo os formulários de edição — nestes, o skeleton reproduz os campos.

## Fora de escopo (explícito)

- Estados de **erro** (`StatusView variant="error"`) permanecem intactos —
  skeleton é exclusivo do estado de loading.
- Estados **vazios** (`EmptyState`) permanecem intactos.
- A tela de login (fora do app logado) e telas sem carregamento de dados.
- API, domínio e data — nada muda fora de `apps/web/src/**/ui` e `shared/ui`.

---

## Primitivo base — `shared/ui/skeleton.tsx`

Componente reutilizável que renderiza um bloco shimmer.

```ts
type SkeletonProps = {
  width?: number | string; // default '100%'
  height?: number | string; // default 14
  radius?: number | string; // default var(--r-sm)
  circle?: boolean; // atalho: radius 50% + width=height
  style?: CSSProperties; // ajustes pontuais (margin, flex)
};
```

- Renderiza um `<span>` (inline-block) com classe `.skeleton`, `aria-hidden="true"`
  (o anúncio de carregamento vem do wrapper de tela, não de cada bloco).
- `circle` força `borderRadius: '50%'` e usa `width` para os dois eixos.
- Sem texto, sem children.

### CSS em `tokens.css`

```css
.skeleton {
  display: inline-block;
  background: var(--line-soft);
  border-radius: var(--r-sm);
  position: relative;
  overflow: hidden;
}
.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none;
  }
}
```

Anima apenas `transform` (compositor-friendly). O gradiente branco translúcido
lê bem sobre `--surface` e `--surface-2`.

### Wrapper de acessibilidade — `SkeletonScreen`

Como o texto visível "Carregando…" some, o leitor de tela precisa continuar
sabendo. Cada skeleton de tela envolve seu conteúdo num container padrão:

```tsx
// dentro de skeleton.tsx
export function SkeletonScreen({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="visually-hidden">Carregando…</span>
      {children}
    </div>
  );
}
```

- `.visually-hidden` é uma classe utilitária nova em `tokens.css` (padrão
  clip-rect) — texto fora da tela mas lido por AT.
- Os skeletons de tela usam `SkeletonScreen` como raiz do bloco de loading.

---

## Skeletons por tela (co-localizados)

Cada tela ganha um `*-skeleton.tsx` ao lado do screen, montando a forma do
conteúdo com o primitivo + o shell existente (`Screen`/`ScreenBody`/`TopBar`/
`SurfaceCard`). O `TopBar` e o `bottomNav` reais continuam visíveis; o skeleton
substitui **apenas** o corpo que hoje mostra `isLoading`.

Um helper reutilizável de lista evita repetição:

```tsx
// skeleton.tsx
export function SkeletonRows({ count, height }: { count: number; height?: number });
```

Renderiza `count` `SurfaceCard`s-fantasma (ícone circular + duas linhas de
texto de larguras variadas), o padrão comum a quase todas as listas.

### Admin

| Tela                    | Forma do skeleton                                                                |
| ----------------------- | -------------------------------------------------------------------------------- |
| `dashboard-screen`      | card de saldo (bloco alto) + 1 quick-action + 3 linhas de conta + 2 manutenções  |
| `residents-screen`      | campo de busca-fantasma + `SkeletonRows count={5}` (apto em negrito + nome)      |
| `resident-edit-screen`  | cabeçalho (apto + status pill) + campos do form + `SkeletonRows` do ledger       |
| `accounts-screen`       | linha de resumo/stat + `SkeletonRows count={6}`                                  |
| `account-edit-screen`   | campos do formulário (valor, data, categoria, status)                            |
| `income-section`        | `SkeletonRows count={4}`                                                         |
| `income-edit-screen`    | campos do formulário (valor, data, descrição)                                    |
| `notices-screen`        | `SkeletonRows count={4}` (título + corpo)                                        |
| `admin-messages-screen` | `SkeletonRows count={5}` (avatar + nome + prévia)                                |
| `thread-screen`         | bolhas de chat alternadas (esq/dir, larguras variadas) + barra de input-fantasma |
| `settings-screen`       | seções de ajustes: blocos de label + linhas de categoria                         |
| `create-login-screen`   | campos do formulário (usuário) + botão-fantasma                                  |

### Morador

| Tela                      | Forma do skeleton                                                     |
| ------------------------- | --------------------------------------------------------------------- |
| `resident-home-screen`    | card de saudação/saldo + linha de próximos vencimentos + atalhos      |
| `receipts-screen`         | `SkeletonRows count={5}` (mês + valor + status pill)                  |
| `pay-screen`              | card do recibo (valor grande) + bloco do QR/Pix + botão-fantasma      |
| `resident-finance-screen` | stat cards + `SkeletonRows`                                           |
| `notices-screen`          | (compartilhada — mesmo skeleton do admin)                             |
| `support-screen`          | bolhas de chat alternadas + input-fantasma (mesmo do `thread-screen`) |

Onde `thread-screen` e `support-screen` compartilham a forma (chat), extrair um
`chat-skeleton` reutilizável em `features/messages/ui` e ambos consomem.

---

## Integração

Em cada tela, o branch atual:

```tsx
{
  query.isLoading && <StatusView variant="loading" message="…" />;
}
// ou
{
  query.isLoading && <p>Carregando…</p>;
}
```

passa a:

```tsx
{
  query.isLoading && <XxxSkeleton />;
}
```

- A variante `error` do `StatusView` e os `EmptyState` continuam idênticos.
- `StatusView` mantém a prop `variant='loading'` no tipo (não removemos a API),
  mas ela deixa de ser usada nas telas. O `StatusScreen` de `app.tsx` (loading
  de sessão inicial, fora das telas de dados) fica como está.

## Arquitetura / boundaries

- Primitivo + helpers de skeleton: `shared/ui/skeleton.tsx` + CSS em
  `tokens.css`.
- Skeletons de tela: co-localizados em `features/<f>/ui/*-skeleton.tsx`.
- `chat-skeleton` em `features/messages/ui` (consumido por thread e support,
  ambos da mesma feature — sem import cruzado).
- Sem imports de `domain`/`data`; imutabilidade; sem `any`; sem `console.*`;
  comentários só se essenciais.

## Plano de testes (TDD, Testing Library + jsdom)

1. `skeleton.test.tsx` — `Skeleton` aplica classe `.skeleton`,
   width/height/radius e `circle`; `SkeletonScreen` tem `role="status"`,
   `aria-busy` e o texto oculto "Carregando…"; `SkeletonRows` renderiza `count`
   linhas.
2. Por tela: enquanto a query está em `isLoading`, o screen renderiza o
   skeleton (query por `role="status"`/`aria-busy` e/ou presença de blocos
   `.skeleton`) e **não** o texto "Carregando…" antigo; quando `isSuccess`, o
   conteúdo real aparece e o skeleton some. Os testes de erro/empty existentes
   permanecem verdes.
3. `chat-skeleton` coberto via thread/support.

Gate: `make check` verde (web ≥ 80% cobertura). Domínio inalterado.

## Entrega

Branch `feat/loading-skeletons` off `main`; commits atômicos convencionais com
trailer `Spec: docs/superpowers/specs/2026-07-22-loading-skeletons-design.md`;
execução subagent-driven, uma tela por vez, revisando entre tarefas.
