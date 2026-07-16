# Sub-projeto 2 — Card "Novo recibo" inline

> Fase de UI derivada do Claude Design `Morada.dc.html` (projeto `ea2ea282`),
> segundo de quatro sub-projetos. Substitui a tela separada de adicionar recibo
> por um card inline na tela do apartamento. TDD; boundaries `ui → domain ← data`;
> gates web (`make check`) e api (`make api-check`) ≥ 80%.

## Contexto

Hoje "Adicionar" na seção de recibos do apartamento navega para uma tela separada
(`issue-charge-screen.tsx`, view `a-resident-charge`) via `onIssueCharge`. O design
(Morada.dc.html linhas 288-320) troca isso por um **card tracejado inline "Novo
recibo"** que permite lançar vários recibos em sequência sem sair da tela.

Criação hoje: `POST /api/receipts` → `createReceipt` aceita
`{residentId, ref, title, valueCents, dueDate, paidAt?, method?}`. Duas divergências
com o design, já decididas:

- O card **não tem campo de vencimento** → **derivar** o vencimento do mês da
  Competência (MM/AAAA) + `dueDay` de `condo_settings` (Ajustes).
- O card tem **"Anexar comprovante"** ao criar um recibo já pago → **estender a API**
  `createReceipt` com `proofDataUrl?` (a coluna `proof_data_url` já existe, migração
  005; o adapter já a persiste).

## Fora de escopo

- Edição de recibo permanece **inline como hoje** na `ReceiptsSection` (o design tem
  tela dedicada `a-rec-edit`, mas o pedido é só transformar o _adicionar_ em card).
- Excluir recibo (deferido pelo usuário). Ajustes/Categorias e Entradas são SP3/SP4.

## API — `createReceipt` aceita comprovante

`apps/api/src/receipts/app/create-receipt.ts`:

- `inputSchema` ganha `proofDataUrl: z.string().optional()`.
- Quando o recibo é criado **pago** (`paidAt` + `method` presentes), inclui
  `proofDataUrl` no objeto salvo (junto com `paidAt`/`method`). Quando **pendente**,
  ignora `proofDataUrl` (não faz sentido comprovante sem pagamento).
- A rota `POST /api/receipts` já repassa o body inteiro — sem mudança de rota.
- `receiptSchema` (domínio) já tem `proofDataUrl` opcional; o adapter Postgres já
  grava `proof_data_url` — confirmar via contrato/teste.

## Web — helper de vencimento

Novo `apps/web/src/features/receipts/domain/due-date.ts`:

```ts
export function dueDateFromRef(ref: string, dueDay: number): string | null;
```

- `ref` no formato `MM/AAAA` (ex.: "04/2026"); `dueDay` 1..28.
- Retorna ISO `AAAA-MM-DD` (ex.: "2026-04-15") ou `null` se `ref` não casar `MM/AAAA`
  ou mês inválido. Pura, sem `Date.now()`.

## Web — card "Novo recibo" inline

Novo componente `apps/web/src/features/residents/ui/new-receipt-card.tsx`
(presentacional + lógica local), usado dentro da `ReceiptsSection`:

```ts
type NewReceiptCardProps = {
  dueDay: number; // de condo_settings, para derivar o vencimento
  issue: (input: {
    ref: string;
    valueCents: number;
    dueDate: string;
    paidAt?: string;
    method?: 'dinheiro' | 'pix';
    proofDataUrl?: string;
  }) => Promise<void>;
  onClose: () => void;
};
```

- Campos: **Competência** (MM/AAAA) · **Valor** (`MoneyInput`) · chips **status**
  `pendente`/`pago`.
- Se `pago`: chips **método** (`dinheiro`/`pix`) + **"Anexar comprovante"**
  (`<input type=file>` → `fileToDataUrl` de `receipts/domain/proof`; valida com
  `isAllowedProof`) + chip do arquivo anexado (com remover).
- **Vencimento derivado** de `dueDateFromRef(competência, dueDay)`. Se `null`
  (competência inválida), bloqueia o salvar com hint "Use MM/AAAA".
- Validação de salvar: competência válida, `valueCents > 0`; se pago, `method`
  definido (comprovante opcional).
- **"Adicionar e continuar"**: chama `issue({ ref, valueCents, dueDate, ...(pago ?
{ paidAt: hoje, method, proofDataUrl? } : {}) })`; ao resolver, **limpa os campos e
  mantém o card aberto**; erro vira mensagem inline. **"Concluir"** chama `onClose`.
- Hint fixo: "O card permanece aberto para você lançar vários recibos em sequência."
- `title` do recibo é fixo "Taxa condominial" (definido no `issue` do container, não
  no card).

Observação: o `paidAt` "hoje" é obtido no card via `new Date().toISOString().slice(0,10)`
(o app já faz isso em `resident-edit-screen`/`pay-screen`).

## Web — fiação e remoção da tela

- `ReceiptsSection` (em `resident-edit-screen.tsx`): o botão **"Adicionar"** passa a
  alternar um estado local `showNewReceipt` e renderizar `<NewReceiptCard/>` acima da
  lista, em vez de chamar `onIssueCharge`. A prop de navegação `onIssueCharge` é
  removida da cadeia (screen → section).
- `resident-edit-screen` recebe `dueDay` para passar ao card. Fonte: nova prop
  `settingsRepository` em `ResidentEditScreen`; a tela lê `useSettings(settingsRepository)`
  e passa `settings.data?.dueDay ?? 15`. (`residents/ui` pode importar `settings/domain`
  — boundary permitido.)
- `container.issueCharge` (input) ganha `proofDataUrl?`; repassa no `POST /api/receipts`.
  O `title` "Taxa condominial" continua sendo enviado pelo container (como hoje).
- **Remoção**: apaga `issue-charge-screen.tsx` + seu teste; remove a view
  `a-resident-charge` de `nav-store.ts`; remove o `case 'a-resident-charge'` + o import
  `IssueChargeScreen` de `app.tsx`; remove `onIssueCharge`/`go('a-resident-charge')`.
  `app.tsx` passa `settingsRepository` para `ResidentEditScreen`.

## Plano de testes (TDD)

**API** (`create-receipt.test.ts`): criar pago com `proofDataUrl` persiste o
comprovante; criar pendente com `proofDataUrl` **ignora** (não grava); pago sem
`proofDataUrl` continua válido.

**Web:**

- `due-date.test.ts`: "04/2026" + 15 → "2026-04-15"; formatos inválidos → null;
  mês fora de 1..12 → null.
- `new-receipt-card.test.tsx`: renderiza campos; competência inválida bloqueia salvar
  com hint; "Adicionar e continuar" chama `issue` com o vencimento derivado e mantém o
  card aberto (campos limpos); status pago revela método + anexar comprovante e envia
  `paidAt`/`method`/`proofDataUrl`.
- `resident-edit-screen.test.tsx`: "Adicionar" abre o card inline (não navega); criar
  pelo card invalida a lista de recibos (novo recibo aparece).
- `app`/`nav` regression: a view `a-resident-charge` não existe mais; nenhum import de
  `IssueChargeScreen`.

Gates: `make api-check` e `make check` verdes (≥ 80%).

## Entrega

Branch `feat/inline-receipt-card` off `main`; commits atômicos convencionais; PR
próprio; ff-merge para `main` antes do SP3.
