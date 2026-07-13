# Backlog de UI — questões em aberto

> Registro do que ainda falta / está em aberto na interface, para decidir e
> executar no design. O **backend já suporta** os itens da seção 1 (só falta a
> tela). Atualizado em 2026-07-13.

## 1. Telas que faltam (backend pronto, só a UI)

- **Visão geral do apartamento (admin).** Ver o histórico completo de um
  apartamento: todos os moradores que passaram + todos os recibos, independente
  de quem estava. Endpoint pronto: `GET /api/apartments/:id/receipts`. Falta:
  uma tela de apartamento (abrir um apto → ocupante atual + histórico de
  moradores + ledger de recibos). Hoje a lista de moradores só mostra os
  **ativos**; não há como navegar apartamentos como entidade nem ver quem já
  saiu. (O repositório já tem `listByApartment` de moradores; falta expor a rota
  e a tela.)

## 2. Ajustes/lacunas nas telas que já existem

- **"Morador saiu" sem confirmação.** O botão desativa na hora. Falta um
  diálogo de confirmação ("Registrar saída de Fulana do Apto 302?").
- **Senha temporária sem "copiar".** Na tela de criar acesso, a senha aparece
  uma vez mas não tem botão de copiar (o Pix tem). Adicionar copiar + aviso
  claro de que não será mostrada de novo.
- **Emitir cobrança com campos crus.** Referência, valor e vencimento são texto
  livre. Faltam: máscara de moeda no valor, seletor de mês para a referência,
  data para o vencimento; o título é fixo em "Taxa condominial".
- **Estados vazios.** Morador sem recibos / sem avisos, conversa de suporte
  vazia, sistema recém-criado sem moradores — hoje mostram texto simples.
  Desenhar empty states de verdade ("Nenhum recibo ainda", ilustração/CTA).
- **Loading/erro genéricos.** O `StatusScreen` do morador (carregando/erro) é
  mínimo; padronizar loading/erro/skeleton nas telas.

## 3. Decisões de produto/design em aberto

- **Layout desktop.** Hoje é full-bleed (ocupa a tela toda). Definir se o
  desktop ganha um layout próprio (nav lateral, conteúdo em múltiplas colunas /
  bento) ou continua full-bleed. Mobile-first está ok.
- **Campo de apartamento no cadastro.** Hoje é texto livre ("Apto 302"). Como o
  apartamento agora é entidade estável, um **seletor/autocomplete de apartamentos
  existentes** evita duplicar apto por erro de digitação (ex.: "Apto 302" vs
  "302"). Decidir: texto livre com normalização, ou picker.
- **Acesso do morador que saiu.** Ao dar "morador saiu", o login dele **continua
  funcionando** (o usuário não é desativado). Decidir se a saída também
  desativa/expira o login.
- **Provisionamento de login.** Hoje o admin escolhe o `username` e a senha é
  auto-gerada e mostrada na tela. Confirmar: username manual vs. sugerido; e como
  entregar a senha (tela, e nada de e-mail/SMS por enquanto).
- **Aviso "dispensado".** Hoje é uma flag global no aviso (dispensar some para
  todos). Decidir se precisa ser por-morador.
- **Geração de recibos.** Só existe emitir cobrança **1 a 1** por morador.
  Decidir se precisa "emitir para todos" (mês corrente) e/ou recorrência mensal.
- **Pagamento Pix.** É demo (QR/código são payload de demonstração, sem PSP
  real). Definir se/quando integra pagamento de verdade.
- **Visão "Condomínio" do morador.** A tela de finanças do morador mostra o
  resumo do condomínio (saldo/entradas/contas pagas), igual ao painel do admin.
  Confirmar se é isso mesmo que o morador deve ver.

## 4. Itens menores / polish

- Busca/filtro nas listas de recibos, contas e avisos (moradores já tem busca).
- Contas (lançamentos): não há excluir; categoria é texto livre (poderia ser
  seletor).
- Perfil do morador: os toggles falsos foram removidos; hoje é só contato +
  sair. Definir se há alguma preferência real a expor.
