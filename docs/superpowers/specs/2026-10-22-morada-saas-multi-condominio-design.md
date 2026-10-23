# Morada como SaaS multi-condomínio

> Design de 2026-10-22, saído de um brainstorm com o Lucas. É o documento-mãe de
> cinco sub-projetos (seção 11). Cada sub-projeto ganha o próprio plano em
> `docs/superpowers/plans/`. Mockups de referência (descartáveis) estão em
> `.superpowers/brainstorm/` (`onboarding-flow-v1.html`,
> `portfolio-mobile-v2.html`). O visual final vai ser refinado pelo Lucas no
> Claude Design. Este documento fixa o comportamento, não o pixel.

## 1. Intenção

Hoje o Morada é um software de um condomínio só (o "Condomínio Morada · Bloco 2"),
com o nome do prédio escrito no código, um admin semeado e um único registro de
configuração. O objetivo é que **qualquer pessoa** abra o link, monte o próprio
condomínio e passe a administrá-lo, no espírito de um SaaS de verdade.

Além disso, o Morada deve servir quem administra **vários condomínios
independentes**, como uma contabilidade com equipe. Exemplo-guia:

- A **Roberta** é dona da contabilidade e precisa ver todos os condomínios.
- A **Fernanda** cuida de 3 condomínios e o **Júlio** de outros 3.
- Em cada prédio, o **síndico** (que mora lá) também administra, com menos poder.
- Os **moradores** só veem a própria casa.

O que importa para o Lucas: entrar no Morada não pode parecer preencher formulário.
O primeiro contato é uma **conversa**, e o condomínio "ganha forma" como um
**prédio que acende**. Esse mesmo desenho de prédio é a linguagem visual de todo o
produto (o prédio do condomínio, a rua de condomínios).

## 2. Objetivos

1. Cadastro aberto: qualquer pessoa cria uma conta com e-mail e senha e monta o
   próprio condomínio por um onboarding em conversa.
2. Vários condomínios por organização, com isolamento total de dados entre eles.
3. Equipe na organização: dono que vê tudo e membros atribuídos a condomínios.
4. Três níveis dentro do condomínio: **morador**, **síndico** e **administrador**.
5. Convites por link (WhatsApp ou e-mail). O convidado cria a própria senha.
6. Configuração por condomínio: nome, estrutura (blocos, andares, apartamentos),
   valor da taxa, dia de vencimento e **chave Pix real**.
7. Tela inicial do administrador com vários condomínios: a "rua de condomínios",
   com bandeiras de pendência.
8. O condomínio atual do Lucas, com os dados reais, continua funcionando como o
   primeiro condomínio de uma organização dele, sem perder nada.

## 3. Não-objetivos (agora)

- **Cobrança / assinatura do Morada.** É grátis por enquanto. O modelo só precisa
  não impedir uma assinatura por organização no futuro.
- App nativo. Continua web responsiva.
- Integração paga de WhatsApp (API oficial). O "enviar pelo WhatsApp" é um link
  `wa.me` com a mensagem pronta.
- Login social (Google etc.).
- Conciliação bancária ou Pix dinâmico via PSP. A chave Pix gera um BR Code
  estático (seção 8.4).
- Portal público, marketing ou landing elaborada. O link leva direto ao cadastro
  ou login.

## 4. Anti-objetivos (seria falha mesmo funcionando)

- **Vazamento entre condomínios.** Qualquer dado de um condomínio visível, ou
  alterável, por quem não tem vínculo com ele. Isso é o pior defeito possível do
  projeto. Ver seção 6.
- **Onboarding com cara de formulário** (uma tela cheia de campos).
- **Layout pensado para desktop.** Tudo nasce na largura do celular. O desktop é
  extensão (regra do Lucas: "foca sempre em layouts mobile, o desktop é uma
  extensão"). Nunca reproduzir moldura de celular.
- **Apagar de verdade.** Nada é excluído fisicamente: condomínio, vínculo,
  convite, morador. Tudo é desativado por flag (regra do projeto).
- **Perder ou corromper os dados reais** do condomínio atual na migração.

## 5. Conceitos novos (vocabulário de domínio)

Os nomes abaixo entram no vocabulário do `CLAUDE.md` junto com os existentes
(`Apartment`, `Resident`, `Occupancy`, `Receipt`…).

| Nome           | O que é                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Organization` | Quem administra um ou mais condomínios: a contabilidade, ou o síndico solo. Todo condomínio pertence a exatamente uma organização. Futura unidade de cobrança.                                                                                     |
| `Condominium`  | Um condomínio independente: nome, estrutura (blocos/andares/apartamentos), configurações (taxa, vencimento, Pix). Todo dado operacional de hoje (apartamentos, moradores, recibos, contas, receitas, avisos, mensagens, categorias) pertence a um. |
| `Account`      | **Conflito de nome:** `Account` já é "conta/lançamento". A conta de login se chama **`UserAccount`** (ou continua `User`, escolha do construtor), nunca `Account`.                                                                                 |
| `OrgMember`    | Vínculo pessoa ↔ organização, com papel `owner` ou `member` e flag `active`.                                                                                                                                                                       |
| `CondoRole`    | Vínculo pessoa ↔ condomínio, com papel `administrador`, `sindico` ou `morador` e flag `active`. Uma pessoa pode ter vínculos em vários condomínios.                                                                                                |
| `Invitation`   | Convite com token, e-mail opcional, papel pretendido, condomínio (e organização, se for convite de equipe), validade e status (`pendente` · `aceito` · `expirado` · `revogado`).                                                                   |

**A pessoa é uma só.** Um `UserAccount` (e-mail + senha) pode ser morador no
Ipê, síndico do Ipê e não ter nada no Aurora. O papel é resolvido **por
condomínio**, nunca globalmente. O `Resident` (cadastro do morador ligado ao
apartamento) continua existindo e é ligado ao `UserAccount` quando o morador
aceita o convite.

## 6. Isolamento de dados (o requisito mais importante)

- Toda tabela operacional ganha `condominium_id NOT NULL`, com FK e índice.
- Unicidades que hoje são globais passam a valer **por condomínio**: rótulo de
  apartamento, categorias, configurações, recibo mensal único etc.
  (`idx_receipts_condo_fee_month` e afins).
- A sessão diz **quem é a pessoa**. O condomínio "atual" vem de cada requisição
  (rota ou cabeçalho, escolha do construtor). A cada requisição, o servidor
  verifica que a pessoa tem um `CondoRole` ativo (ou é admin da organização dona,
  ver seção 7) naquele condomínio, e então injeta o `condominiumId` nos casos de uso.
- **Repositórios nunca consultam sem `condominiumId`.** A assinatura dos métodos
  torna o escopo obrigatório: não existe `list()` sem condomínio.
- Recurso de outro condomínio responde **404**, não 403. Não revela que o recurso
  existe.
- Chaves de arquivo no R2 (comprovantes) ganham prefixo por condomínio, e o
  download confere o vínculo.
- **Testes de isolamento obrigatórios.** Cada contrato de repositório e cada
  grupo de rotas tem um teste "dois condomínios, A não vê nem altera nada de B".
  Isso é critério de pronto do sub-projeto 1.

## 7. Papéis e permissões

### 7.1 No condomínio (decidido com o Lucas)

| Ação                                                                         | Morador | Síndico | Administrador |
| ---------------------------------------------------------------------------- | :-----: | :-----: | :-----------: |
| Ver os próprios recibos, pagar, mandar comprovante e mensagem                |   ✅    |   ✅    |       —       |
| Ler avisos                                                                   |   ✅    |   ✅    |      ✅       |
| Ver o prédio inteiro: moradores, atrasos, contas, caixa                      |    —    |   ✅    |      ✅       |
| Publicar aviso, responder mensagens                                          |    —    |   ✅    |      ✅       |
| Cadastrar, convidar e desativar moradores                                    |    —    |   ✅    |      ✅       |
| **Mexer no dinheiro**: lançar conta/receita, dar baixa, conferir comprovante |    —    |   ✅    |      ✅       |
| **Mudar taxa, vencimento e chave Pix**                                       |    —    |   ❌    |      ✅       |
| Mudar nome e estrutura do condomínio, nomear ou trocar o síndico             |    —    |   ❌    |      ✅       |

- O síndico quase sempre também mora no prédio, então tem os dois vínculos
  (`sindico` + `morador`). Ele entra uma vez e alterna entre **"minha casa"** (a
  visão de morador, com os recibos dele) e **"o prédio"** (a visão de síndico).
- O síndico só vê o condomínio dele, nunca a rua da organização.
- Quem cria o condomínio pelo link vira **administrador**, não síndico. O papel
  síndico existe para quando outra pessoa (ex.: a contabilidade) administra junto.
- Ações de dinheiro registram **quem fez e quando** (no mínimo, autor e data em
  baixas, lançamentos e conferências), para o administrador ver o que o síndico fez.

### 7.2 Na organização

| Papel          | Pode                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner` (dono) | Tudo de administrador em **todos** os condomínios da organização. Criar condomínio, convidar e desativar membros da equipe, atribuir quem administra qual condomínio. |
| `member`       | Administrador **somente** dos condomínios atribuídos a ele. Cria condomínio novo (que fica atribuído a ele). Não mexe na equipe.                                      |

- Uma organização pode ter mais de um dono.
- Quem se cadastra sozinho ganha uma organização com ele como dono. Para o síndico
  solo, a organização é **invisível**: não aparece nome de empresa nem tela de
  equipe até ele convidar alguém. Isso permite crescer de "um prédio" para
  "contabilidade" sem migração.
- Desativar um membro corta o acesso na hora. Nada é apagado.

## 8. Contas, convites e acesso

### 8.1 Cadastro e login

- Todo mundo entra com **e-mail + senha**: morador, síndico, equipe, dono.
- Cadastro aberto (`/` → "Criar conta"). Depois do cadastro, a pessoa cai no
  onboarding (seção 9).
- "Esqueci a senha" por e-mail, com link de redefinição que expira.
- Ao entrar:
  - quem tem **um** vínculo cai direto no condomínio;
  - quem tem vários vê a **rua** (seção 10). Se a pessoa é só moradora em mais
    de um condomínio, aparece uma escolha simples de qual casa abrir.
- O **login derivado** (`lucia303`) e a senha temporária gerada pelo admin
  **deixam de existir** depois da migração (seção 12).
- A sessão segue o transporte que já existe (cookie httpOnly + CSRF). A JWT passa
  a carregar a identidade da pessoa, não um papel global.

### 8.2 Convites

- Quem convida: administrador ou síndico (moradores do condomínio dele); dono
  (equipe da organização); administrador (síndico do condomínio).
- O convite gera um **link único** com três ações na tela:
  - **Enviar pelo WhatsApp**: abre `wa.me` com mensagem pronta (nome do
    condomínio + link). Pode ter o telefone do morador preenchido;
  - **Enviar por e-mail**: o Morada envia;
  - **Copiar link**.
- Validade de 7 dias (minha decisão). Pode ser reenviado (gera um novo token e
  revoga o anterior) e revogado.
- Ao abrir o link, o convidado vê o nome do condomínio, cria a senha (ou entra,
  se já tem conta com aquele e-mail) e cai direto no condomínio no papel
  convidado. O convite de morador já vem ligado ao `Resident`/apartamento que o
  administrador cadastrou.
- O token é de uso único, aleatório e guardado como hash.

### 8.2.1 Verificação de e-mail (segurança)

- **Cadastro aberto exige confirmar o e-mail** (link enviado) antes de criar
  condomínio. Sem confirmação, a conta existe mas não opera.
- Convite **com e-mail**: a conta que aceita precisa ter **aquele** e-mail. Se já
  existe conta com ele, a pessoa entra com a senha. Se não existe, a conta é
  criada ali, já verificada, porque abrir o link enviado para aquele e-mail prova
  a posse.
- Convite **sem e-mail** (só WhatsApp): quem abre informa um e-mail e cria a
  senha. O vínculo só ativa depois de confirmar esse e-mail. O convite é de uso
  único, então um link repassado depois de aceito não serve para mais nada.
- Cadastrar uma conta com o e-mail de outra pessoa não dá acesso a nada: sem
  confirmação, não há vínculo.

### 8.3 E-mail

- Um port de envio de e-mail na `platform`, com adapter de provedor transacional
  (escolha do construtor; o deploy já usa Cloudflare, então Cloudflare Email
  Service ou similar é natural). Em dev e teste, um adapter em memória que
  guarda as mensagens para inspeção (sem `console.*`).
- E-mails: convite, confirmação de e-mail, redefinição de senha. Remetente e
  textos em PT-BR.

### 8.4 Pix

- A chave Pix fica nas configurações do condomínio, editável só pelo
  administrador. Tipos: CPF, CNPJ, e-mail, telefone, aleatória, validados com Zod.
- Na tela de pagar, o "copia e cola" e o QR deixam de ser o payload de
  demonstração (`receipts/domain/pix-code.ts`) e viram um **BR Code estático
  real** (padrão EMV do Bacen, com CRC16), com chave, nome do recebedor, cidade e
  valor do recibo.
- **Nome do recebedor** e **cidade** são campos das configurações, ao lado da
  chave. No onboarding, a etapa do Pix pergunta "Em nome de quem está essa
  chave?" e "Em qual cidade fica o condomínio?" logo depois da chave (pulam
  junto com ela).
- Sem chave cadastrada, a tela de pagar mostra que o Pix ainda não foi
  configurado, e o morador não vê código falso.

## 9. Onboarding: conversa, depois o prédio acende

Mobile-first, visual de referência em `onboarding-flow-v1.html`.

**Etapa 1 · Conversa.** O Morada pergunta como num chat, uma coisa por vez. Cada
resposta vira um balão. As perguntas não aparecem como campos de formulário:

1. "Que condomínio vamos gerenciar hoje?" → nome.
2. Tem blocos ou é um prédio só? → se tiver blocos: quantos e o nome de cada um.
3. Quantos andares e quantos apartamentos por andar (por bloco)? → gera os
   apartamentos (`101…404`). A numeração pode ser ajustada depois.
4. Quanto cada apartamento paga por mês e até que dia? → taxa + vencimento.
5. Para onde vai o Pix? → chave (pode pular: "Depois eu vejo").

Respostas pulam com chips ("Depois eu vejo", "Está vazio"). A conversa é
retomável: sair no meio e voltar continua de onde parou.

**Etapa 2 · O prédio aparece.** O condomínio é desenhado com os andares e
apartamentos informados (um prédio por bloco, lado a lado). Cada janela é um
apartamento. Tocar numa janela cadastra o morador (nome, telefone/e-mail) e
oferece o convite. Janela com morador **acende**.

**Etapa 3 · O térreo ganha vida.** Embaixo do prédio: **quais são as contas**
(categorias, já sugeridas: água, energia, serviços, manutenção), **quanto foi
gasto** no mês e **quanto tem em caixa** hoje (saldo inicial). Tudo pode ser
pulado.

Como isso é guardado:

- **Caixa hoje** vira um **saldo inicial** nas configurações do condomínio (valor
  - data). Não é uma receita falsa. O `CondoBalance` passa a ser saldo inicial
  - receitas − contas pagas a partir dessa data.
- **Gasto do mês** vira um lançamento `Account` **por categoria** informada, com
  status `pago` e data de hoje. Assim entra nos relatórios e no resumo do mês
  como qualquer conta. Se a pessoa disser só um total, vira uma conta única
  "Gastos de <mês>" na categoria Serviços.

Ao final: "Abrir o <nome>". O onboarding de um **segundo** condomínio ("+ Novo
condomínio" na rua) é a mesma conversa.

**O prédio continua sendo a tela inicial** do administrador/síndico dentro do
condomínio: a mesma ilustração, com as janelas mostrando o estado de cada
apartamento (vazio, ocupado, pendente, atrasado, nas cores de status já
existentes) e o térreo com contas, gasto do mês e caixa. Tocar numa janela abre o
apartamento (a tela "Apartamentos" de hoje).

**Construção irregular** (cobertura, térreo comercial, numeração fora do padrão):
a estrutura gerada é só o ponto de partida. O administrador pode adicionar,
renomear ou desativar apartamentos depois, e o desenho reflete o que existe.

## 10. A rua de condomínios

Para quem administra mais de um condomínio. Visual de referência em
`portfolio-mobile-v2.html`.

- Saudação ("Bom dia, Roberta") + resumo ("9 condomínios · 3 pedem atenção hoje").
- **Rua**: um prédio em miniatura por condomínio, do tamanho real (andares ×
  apartamentos), rolando para o lado no celular. Urgentes primeiro. No fim, o
  lote **"+ Novo condomínio"**. No desktop, a rua mostra todos sem rolar.
- **Bandeira** no prédio com pendência. Dois níveis:
  - **Urgente**: morador com taxa vencida sem pagamento; conta vencida sem baixa.
  - **Atenção**: conta que vence nos próximos 3 dias; comprovante de Pix
    esperando conferência; mensagem de morador não lida.
- Pré-requisito: `accounts` ganha **`due_date` opcional** (vencimento), editável
  no editor de contas. "Conta vencida" = não paga com `due_date` no passado, ou
  status `atrasado`. "Vence em breve" = não paga com `due_date` nos próximos 3
  dias. Contas sem vencimento nunca geram bandeira por prazo.
- **Mensagem não lida é por pessoa.** Cada administrador ou síndico tem o próprio
  "lido" (tabela de leitura por pessoa, como `notice_dismissals`). A bandeira da
  rua conta as não lidas **por quem está olhando**. Na migração do sub-projeto 1,
  `threads` ganha ligação real com `Resident`/`Apartment` (hoje são textos
  `resident_name`/`apt`), preenchida a partir dos dados existentes.
- **Select simples** "Ir para um condomínio…" logo abaixo, ordenado por urgência,
  com o motivo no texto.
- **"Pede atenção hoje"**: lista com o motivo de cada bandeira. Tocar leva direto
  ao condomínio (idealmente à tela do problema).
- A Fernanda vê só os condomínios atribuídos a ela. A Roberta vê todos.
- Dentro de um condomínio há sempre um atalho para voltar à rua ou trocar de
  condomínio.
- O cálculo das pendências é uma consulta agregada por condomínio, feita no
  servidor. Não abrir N telas no cliente.

## 11. Sub-projetos e ordem

Cada um entrega algo funcionando e passa pelas gates. Um plano por sub-projeto,
nesta ordem, porque cada um depende do anterior:

1. **Base multi-condomínio.** `Organization`, `Condominium`, `condominium_id` em
   tudo, escopo obrigatório nos repositórios, resolução do condomínio por
   requisição, testes de isolamento, configuração por condomínio (inclusive o
   nome, que sai do código: chega de "Bloco 2" fixo), migração dos dados atuais
   (seção 12). Ao fim: o app funciona como hoje, só que de dentro de um
   condomínio, e um segundo condomínio criado à mão fica invisível ao primeiro.
   **Já cria as tabelas de vínculo** (`organization_members`, `condo_roles`) na
   forma mínima: o admin legado vira `owner` + `administrador` do condomínio
   migrado, e cada morador vira `morador`. A checagem de acesso por requisição
   já usa esses vínculos desde o início, para os testes "admin de A não vê B"
   valerem de verdade. O sub-projeto 3 acrescenta a matriz de permissões e o
   papel síndico por cima, sem reescrever o middleware. Também inclui a ligação
   de `threads` com morador/apartamento e o `due_date` de contas (seção 10).
2. **Contas e convites.** `UserAccount` por e-mail, cadastro aberto, convites
   (WhatsApp/e-mail/copiar), redefinição de senha, port de e-mail, migração dos
   moradores atuais para convite, fim do login derivado.
3. **Papéis.** `CondoRole` (morador/síndico/administrador) com a matriz da seção
   7.1, `OrgMember` (dono/membro) com a matriz da seção 7.2, atribuição de
   condomínios a membros, troca "minha casa ↔ o prédio", registro de autor nas
   ações de dinheiro. Chave Pix real (8.4) entra aqui ou no 1, a critério do plano.
4. **Onboarding.** Conversa + prédio que acende + térreo. O prédio vira a home do
   condomínio.
5. **A rua de condomínios.** Rua, bandeiras, select, "pede atenção hoje".

Telas dos sub-projetos 4 e 5 são implementadas a partir dos mockups e
refinadas depois pelo Lucas no Claude Design. Não esperar o design final para
construir o comportamento.

## 12. Migração do condomínio atual

- **Backup antes** (`pg_dump` do Neon de produção e do `morada` local), seguindo
  `docs/DEPLOY.md`.
- Migração SQL append-only que cria a organização do Lucas e o condomínio
  "Condomínio Morada · Bloco 2" (nome real) com id fixo, e preenche
  `condominium_id` de todas as linhas existentes com ele antes de tornar a
  coluna `NOT NULL`. O `condo_settings` `default` vira a configuração desse
  condomínio.
- O admin atual vira dono da organização e administrador do condomínio. Ele
  precisa de um e-mail: a migração não inventa um. Fica um passo de
  provisionamento documentado (comando ou script) para definir o e-mail do
  dono em produção.
- Moradores com login derivado: o administrador recebe, na tela de cada
  apartamento, o botão de convite para migrarem para e-mail + senha. Até
  aceitarem, o login antigo continua funcionando, **preso a esse condomínio**.
  Ele é aposentado só depois que todos migrarem ou por decisão explícita do
  admin. (Minha decisão: evita trancar moradores reais do lado de fora.)
- Verificar contagens de linha antes e depois em todas as tabelas.

## 13. Restrições

- Stack e arquitetura do `CLAUDE.md` e `docs/LAYERING.md`: não trocar
  bibliotecas, `residents` é a referência, boundaries por lint, `compose.ts` sem
  rotas, Zod nas bordas, sem `any`/`!`/`console.*`.
- TDD, cobertura ≥ 80% (domínio perto de 100%), commits convencionais com o
  trailer `Spec:` apontando para este documento.
- Postgres é o único banco. Migrações são append-only em
  `platform/postgres/migrations.ts`.
- Nunca apagar de verdade (flags `active`/`visible`/status).
- Mobile-first em tudo. O desktop é extensão, sem moldura de celular.
- Testes nunca tocam o banco `morada` real (já isolado em `morada_test`).
- Rodar `make e2e` antes de push em mudanças de login/convite/UI de apartamentos
  (o pre-push não roda e2e).
- Atualizar `CLAUDE.md` (vocabulário, "dois papéis" → três papéis + organização)
  e `docs/DATA-MODEL.md` no sub-projeto 1.

## 14. Deixado para o construtor

- Como o condomínio atual viaja na requisição (prefixo de rota
  `/api/condos/:id/...` vs cabeçalho), desde que a checagem de vínculo seja
  central e impossível de esquecer numa rota nova.
- Nome final da entidade de login (`User` vs `UserAccount`), desde que nunca
  `Account`.
- Provedor de e-mail transacional.
- Como a web passa a ter URLs (o link de convite e o de redefinição precisam
  abrir a tela certa: hoje a navegação é uma máquina de estados Zustand sem URL).
- Modelagem exata de blocos (tabela própria vs atributo do apartamento).
- Rate limit para cadastro, convite e "esqueci a senha", no padrão do
  `platform/rate-limit.ts`.
- Animações do prédio acendendo (respeitando `prefers-reduced-motion`).

## 15. Decisões que tomei sem o Lucas dizer explicitamente

Para ele conferir:

- Organização sempre existe, invisível para o síndico solo.
- Mais de um dono por organização é permitido; membro pode criar condomínio.
- Quem cria pelo link é administrador, não síndico.
- Síndico tem dois vínculos (síndico + morador) e alterna entre "minha casa" e
  "o prédio".
- Convite vale 7 dias, é reenviável e revogável; WhatsApp via `wa.me`, sem API paga.
- O login antigo dos moradores atuais continua valendo até migrarem para convite.
- Recurso de outro condomínio responde 404.
- Os níveis de pendência (urgente/atenção) e a janela de 3 dias para conta vencendo.
- A chave Pix gera BR Code estático real; sem chave, não há código falso.
- Categorias padrão sugeridas no onboarding (água, energia, serviços, manutenção).
- Confirmação de e-mail obrigatória. O convite com e-mail exige a conta daquele
  e-mail; o convite só por WhatsApp exige confirmar o e-mail informado.
- Contas ganham vencimento opcional (`due_date`) para as bandeiras de prazo.
- "Não lida" é por pessoa, não por condomínio.
- Caixa do onboarding = saldo inicial nas configurações; gasto do mês = contas
  pagas por categoria.
- Nome do recebedor e cidade do Pix perguntados na etapa do Pix.
- Os vínculos (`organization_members`, `condo_roles`) nascem já no sub-projeto 1.
