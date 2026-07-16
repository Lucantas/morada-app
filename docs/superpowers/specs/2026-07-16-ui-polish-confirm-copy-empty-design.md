# Sub-projeto 1 — Polish web: confirmação, copiar senha, empty/loading/erro

> Fase de UI derivada do Claude Design `Morada.dc.html` (projeto `ea2ea282`).
> Primeiro de quatro sub-projetos. Web-only, sem tocar API/domínio/data.
> Segue os boundaries `ui → domain ← data`; TDD; gate web ≥ 80%.

## Contexto

O change set de pagamentos (14–15/07) já cobriu a maior parte do design. Restam
três lacunas de UI confirmadas no código:

- **B** — "Arquivar morador" dispara `deactivate` na hora, sem confirmação
  (`resident-edit-screen.tsx:150`). Ação destrutiva.
- **C** — a senha temporária aparece uma vez mas não tem botão de copiar
  (`create-login-screen.tsx`), enquanto o Pix tem (`pay-screen.tsx:46`).
- **D** — estados vazios e loading/erro são texto plano espalhado por várias
  telas; não há primitivo padronizado.

Este sub-projeto entrega os três com dois primitivos novos reutilizáveis.

## Fora de escopo (explícito)

- Card de recibo inline, Ajustes/⚙️/Categorias, Entradas — são os sub-projetos
  2, 3 e 4.
- O empty state da seção de recibos em `resident-edit-screen` fica para o
  **sub-projeto 2**, que reconstrói toda essa área. Aqui só tocamos o empty de
  "moradores antigos".
- Telas fora do conjunto D fechado abaixo (contas, settings, thread de suporte)
  mantêm o texto plano atual.

---

## C — Copiar senha temporária

**Onde:** `create-login-screen.tsx`, no card `created` (usuário + senha temporária).

- Novo helper `shared/lib/clipboard.ts` → `copyText(text: string): Promise<void>`
  (encapsula `navigator.clipboard.writeText`), testável e reutilizável (o Pix
  passa a poder usá-lo depois; não refatorar o Pix agora).
- `CredentialRow` ganha um botão **Copiar** por linha (usuário e senha).
  Ao clicar: chama `copyText(value)` e troca o rótulo para **"Copiado!"** por
  ~2s (estado local por linha). `aria-label="Copiar {label}"`.
- Glifo de cópia inline como SVG (o design faz assim, linha 556: `rect`+`path`);
  não estender o `Icon` para multi-elemento nesta fase.
- O aviso "a senha não será mostrada novamente" (já existe) permanece.

**Comportamento:** copiar não altera o fluxo; puramente conveniência. Sem
persistência.

---

## B — Confirmação ao arquivar morador (ConfirmDialog reutilizável)

### Novo primitivo `shared/ui/confirm-dialog.tsx`

Overlay modal renderizado sobre a viewport (a web é mobile-first full-bleed; a
moldura de telefone **é** a viewport). Backdrop escurecido + card centralizado.

```ts
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string; // ex.: "Confirmar saída"
  cancelLabel?: string; // default "Cancelar"
  tone?: 'default' | 'danger'; // danger = botão de confirmação vermelho
  isPending?: boolean; // desabilita botões + rótulo "…"
  onConfirm: () => void;
  onCancel: () => void;
};
```

Requisitos de acessibilidade/UX:

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no título.
- Foco move para o botão de confirmação ao abrir.
- **Esc** cancela; clique no backdrop cancela; clique no card não propaga.
- Quando `open` é falso, não renderiza nada (retorna `null`).
- `tone='danger'` usa `--atraso-700`/`--atraso-line` no botão de confirmação.
- Botão fechar (X) no canto — glifo `x` adicionado ao `Icon` (path único
  `M18 6L6 18M6 6l12 12`, reutilizável).

### Fiação no `resident-edit-screen.tsx`

- Estado local `confirmingMoveOut: boolean`.
- "Arquivar morador" passa a abrir o dialog (`setConfirmingMoveOut(true)`) em vez
  de chamar `moveOut` direto.
- ConfirmDialog:
  - `title`: `Registrar saída de {nome}?` (usa o nome atual; se vazio, "deste
    morador").
  - `message`: `{nome} deixa de ser o morador ativo do {apto}. O histórico do
apartamento é preservado.`
  - `confirmLabel`: "Confirmar saída", `tone='danger'`,
    `isPending={deactivate.isPending}`.
  - `onConfirm`: chama o `moveOut` atual (`deactivate.mutate(residentId, { onSuccess: onBack })`) e fecha.
  - `onCancel`: fecha sem efeito.

---

## D — Empty states + loading/erro padronizados

### Novo primitivo `shared/ui/empty-state.tsx`

Baseado no padrão do design (dashed border, `surface-2`, centralizado) com
suporte a ícone + título + descrição + CTA opcionais.

```ts
type EmptyStateProps = {
  icon?: IconName; // opcional; badge circular acima do título
  title: string;
  description?: string;
  action?: ReactNode; // ex.: um PrimaryButton
};
```

Visual: card `border: 1px dashed var(--line)`, `background: var(--surface-2)`,
`border-radius: var(--r-md)`, padding ~20px, texto centralizado. Título
`.95rem/600 ink-900`; descrição `.86rem ink-500`. Variante mínima (só título)
cai no mesmo padrão do design (`Nenhum … registrado`).

### Novo primitivo `shared/ui/status-view.tsx`

Promove o `StatusScreen` privado de `app.tsx` para `shared/ui`, com variantes.

```ts
type StatusViewProps = {
  variant: 'loading' | 'error';
  message: string;
  onRetry?: () => void; // só em 'error'; renderiza botão "Tentar de novo"
};
```

- `loading`: spinner CSS (compositor-friendly, `transform` rotate) + mensagem.
- `error`: mensagem em `--atraso-700` + botão de retry opcional.
- `StatusScreen` em `app.tsx` passa a delegar para `StatusView`
  (mantém a assinatura atual `{ message, bottomNav }`, renderizando
  `variant='loading'`/`'error'` conforme o caso já existente).

### Conjunto fechado de aplicação (D)

| Tela                                                       | loading/erro | empty                                                                                                                   |
| ---------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `residents-screen` (lista de apartamentos)                 | `StatusView` | `EmptyState` "Nenhum apartamento encontrado." (com CTA cadastrar quando a lista é totalmente vazia vs filtro sem match) |
| `receipts-screen` (recibos do morador)                     | `StatusView` | `EmptyState` "Nenhum recibo ainda"                                                                                      |
| `notices-screen` (avisos do morador)                       | `StatusView` | `EmptyState` "Nenhum aviso no momento"                                                                                  |
| `resident-home-screen`                                     | `StatusView` | conforme conteúdo vazio existente                                                                                       |
| `admin-messages-screen` (inbox)                            | `StatusView` | `EmptyState` "Nenhuma mensagem ainda"                                                                                   |
| `resident-edit-screen` (só o empty de "moradores antigos") | —            | `EmptyState` "Nenhum morador antigo registrado."                                                                        |

Distinção na lista de apartamentos: **sem nenhum apartamento** → empty com CTA
"Cadastrar apartamento"; **filtro sem resultado** → empty simples sem CTA.

Contas/settings/thread ficam fora (texto plano aceitável nesta fase).

---

## Ícones

- Adicionar `x` ao `Icon` PATHS (`M18 6L6 18M6 6l12 12`).
- Glifo de cópia: inline no `create-login-screen` (multi-elemento, não vai pro
  `Icon`).
- EmptyState reutiliza ícones existentes contextualmente (`receipt`, `bell`,
  `message`, `residents`) — sem novos ícones multi-path.

## Arquitetura

- Tudo novo em `shared/ui` + `shared/lib`; edições nas telas listadas.
- Sem imports cruzados de feature; sem tocar `domain`/`data`/API.
- Imutabilidade, sem `any`, sem `console.*`, comentários só se essenciais.

## Plano de testes (TDD, Testing Library + jsdom)

1. `clipboard.test.ts` — `copyText` chama `navigator.clipboard.writeText`.
2. `create-login-screen.test` — após provisionar, clicar em "Copiar" da senha
   chama o clipboard com o valor e mostra "Copiado!".
3. `confirm-dialog.test` — renderiza quando `open`; `onConfirm`/`onCancel`
   disparam; Esc e backdrop cancelam; não renderiza quando `open=false`;
   `tone='danger'` aplica cor; foco no confirmar.
4. `resident-edit-screen.test` — "Arquivar morador" abre o dialog; confirmar
   chama `deactivate`; cancelar não chama.
5. `empty-state.test` — renderiza título/descrição/ícone/action.
6. `status-view.test` — variantes loading/error; retry chama `onRetry`.
7. Testes de tela por site de aplicação de D asseverando o componente correto
   em cada estado (loading/error/empty).

Gate: `make check` verde (web ≥ 80% cobertura).

## Entrega

Branch `feat/ui-polish-confirm-copy-empty` off `main`; commits atômicos
convencionais; PR próprio; mergeado antes do sub-projeto 2.
