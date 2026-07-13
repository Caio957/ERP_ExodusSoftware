# CLAUDE.md — Painel de Progresso do Projeto Exodus Software

> **Para a IA (Claude):** este é o documento-fonte do estado do projeto. **Leia-o
> integralmente antes de qualquer implementação** e **atualize-o ao final de cada
> entrega** (seções "Estado atual", "Validações" e "Pendências"). Arquivos
> `CLAUDE.md` são carregados automaticamente como contexto pelo Claude Code.
>
> **Para o avaliador externo (Gemini):** este documento descreve o que já foi
> construído, as decisões tomadas e os pontos onde queremos sua análise. As
> perguntas direcionadas estão na seção **§13 — Pedidos de avaliação**.

- **Última atualização:** 2026-07-13
- **Idioma do projeto:** Português (pt-BR) em toda comunicação e documentação.
- **Equipe:** Caio e Helom (sócios). O repositório é a fonte única; ambos importam
  o código em suas máquinas, então **este CLAUDE.md é o registro de onde paramos** —
  mantê-lo fiel a cada entrega é essencial.
- **Repositório:** https://github.com/Caio957/ERP_ExodusSoftware (branch `main`).
- **URL de produção:** https://exodus-web-production.up.railway.app
- **Deploy:** **automático a cada `git push` na `main`** (GitHub → Railway). Migrações
  aplicadas no deploy. ⚠️ Só pushar código validado (typecheck + build).
- **Fluxo de branches:** desenvolvimento acontece em **branches de feature** (`feature/*`);
  commits são empurrados para o GitHub nessas branches; o **merge para `main` é feito
  manualmente via PR no GitHub** (o merge dispara o auto-deploy no Railway). A IA
  trabalha sempre na branch ativa indicada — nunca commita direto na `main` sem
  instrução explícita. ✅ **`refinamento-vendas` mesclada via PR #10** (`8458271`),
  ✅ **`refinamento-compras` mesclada via PR #11** (`4049233`, 2026-07-09) e
  ✅ **`feature/bloqueio-edicao-compras` + `feature/refinamento-financeiro` mescladas
  via PR #13** (`3a38eea`, 2026-07-10 — a segunda continuou a partir da primeira, então
  o PR trouxe as duas levas de uma vez: fechamento tático de Compras + a onda completa
  de Financeiro/Caixa/Vendas/PDV/Produtos/Estoque/recibos), ✅ **`feature/melhoria-impressao`
  mesclada via PR #14** (`35e5026`, 2026-07-10 — implementação, iteração e reversão total
  do compartilhamento de PDF via `html2canvas`/Web Share API; ver Onda 2026-07-10b em §11),
  ✅ **`fix/android-print-blank-page` mesclada via PR #15** (`6c39ec6`, 2026-07-10 —
  blindagem CSS estática do motor de impressão nativo para o spooler do Android) e
  ✅ **`fix/android-print-iframe-engine` mesclada via PR #16** (`76b38c9`, 2026-07-11 —
  motor de impressão migrado para iframe isolado, ver Onda 2026-07-11 em §11),
  ✅ **`fix/email-client-validation-gap` mesclada via PR #17** (`1eb5f05`, 2026-07-12),
  ✅ **`fix/remove-demo-login-button` mesclada via PR #18** (`445a4a6`, 2026-07-12),
  ✅ **`refactor/settings-user-modal-gold-standard` mesclada via PR #19** (`092e528`,
  2026-07-12) e ✅ **`feature/refinamento-sistema` mesclada via PR #20** (`f18a5fe`,
  2026-07-13 — isolamento RBAC de Vendas, rastreabilidade de origem no Caixa, e toda a
  onda de Custo de Aquisição Real/Landed Cost em Compras: frete/outras despesas
  rateados, wizard de 2 etapas na Compra Manual, cadastro in-line de produto na
  importação de XML, e frete/despesas editáveis também no fluxo de XML — ver Onda
  2026-07-12/13 em §11) — ver §11 para o histórico completo de commits de todas.
  **`main` e `origin/main` estão em sincronia em `f18a5fe`.** Nenhuma branch de feature
  ativa no momento — a próxima onda de trabalho deve criar uma nova
  `feature/*`/`fix/*`/`refinamento-*` a partir daqui.
  ⚠️ **Padrão observado na rodada de correções de impressão (PRs #14→#16)**: cada uma das 3 PRs
  seguidas (#14→#16) tentou resolver o mesmo sintoma relatado pelo Comandante (página em
  branco/layout quebrado ao imprimir no Android) com uma causa raiz diferente — cada
  merge foi feito **antes** de confirmação de teste real no tablet, então a próxima
  correção só chegava depois que a anterior já estava em produção e ainda falhando.
  **Recomendação para a próxima vez**: validar no dispositivo real antes do merge, não
  depois — evita essa cadeia de tentativas sequenciais no ar.
  ✅ **Divergência anterior resolvida (2026-07-03)**: as três branches em
  paralelo (`feature/tela-produtos-caio`, `feature/estoque-tipo-movimentacao`
  e `feature/refinamento-cadastros`), incluindo os marcadores de conflito
  Git não resolvidos que haviam ficado no `CLAUDE.md` da `main`, foram todas
  reconciliadas e mescladas via PR #5.
- **Fase atual:** Sistema em **produção no Railway** (projeto `exodus-software`,
  conta helomramos40@gmail.com). Banco PostgreSQL gerenciado, seed do ADMIN executado,
  interface redesenhada (design system "beauty"). **Todo o backlog de funcionalidades
  pedido pelos sócios foi concluído** em 2026-06-04 (módulos Produtos, PDV/Vendas,
  Caixa, Compras, Financeiro, Cadastros e Dashboard — histórico completo em §11).
  Estado: pronto para uso; próximos passos são de maturidade (testes, segurança — §14).

---

## 1. Visão geral do produto

**Exodus Software** é um ERP **gerencial** para lojas de maquiagem e cosméticos.
**Não há emissão fiscal** (sem NFC-e/NF-e). O foco é controle rigoroso de
**estoque, compras, financeiro e fluxo de caixa**, com um **PDV de balcão**.

- **Interface primária:** tablet Android no balcão → **Touch UI** (botões grandes),
  suporte a **leitor de código de barras** Bluetooth e operação **offline-first**.
- **Perfis (RBAC):** `ADMIN` (acesso total, vê financeiro) e `CASHIER` (opera vendas).

---

## 2. Stack tecnológica

| Camada   | Tecnologias |
|----------|-------------|
| Frontend | PWA · React 18 + Vite 6 + TypeScript · Tailwind CSS · Dexie.js (IndexedDB) · React Query · Zustand · React Router · vite-plugin-pwa (Workbox) |
| Backend  | Node.js · Fastify 5 · TypeScript · Zod · Prisma ORM 5 · fast-xml-parser |
| Banco    | PostgreSQL 16 (Docker local; troca para Supabase preparada) |
| Auth     | JWT (`@fastify/jwt`) + bcrypt (`bcryptjs`), RBAC por papel |
| Build    | tsup (api) · tsc + vite (web) · tsx (dev/seed) |

---

## 3. Estrutura do monorepo (npm workspaces)

```
ERP_ExodusSoftware/
├── package.json                # workspaces + scripts orquestradores
├── docker-compose.yml          # Postgres 16 (volume persistente)
├── Dockerfile                  # imagem monolito para Railway
├── railway.json                # config Railway (builder Dockerfile, healthcheck)
├── .dockerignore
├── tsconfig.base.json          # config TS estrita compartilhada
├── CLAUDE.md                   # ESTE documento
├── packages/
│   └── shared/                 # contratos compartilhados back ↔ front
│       └── src/
│           ├── enums.ts        # enums de domínio (z.enum)
│           ├── pricing.ts      # margem/markup bidirecional (puro)
│           └── schemas/        # auth, person, product, invoice, sale, cash, financial, settings, common
├── apps/
│   ├── api/                    # Backend Fastify
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # modelo de dados (ver §9)
│   │   │   ├── seed.ts         # usuários de exemplo
│   │   │   └── migrations/     # 8 migrações aditivas (lista completa em §9)
│   │   └── src/
│   │       ├── server.ts       # bootstrap + shutdown gracioso
│   │       ├── app.ts          # buildApp(): plugins, rotas, @fastify/static (monolito)
│   │       ├── env.ts          # validação de env com Zod (fail-fast)
│   │       ├── lib/            # prisma, errors, password, serialize
│   │       ├── plugins/        # auth (JWT+RBAC), error-handler + SPA fallback
│   │       ├── services/       # nfe-parser, sales (create/update/delete + idempotência)
│   │       └── routes/         # auth, products, persons, invoices, sales, cash,
│   │                           # financial, purchase-suggestions, settings, dashboard
│   └── web/                    # PWA React
│       └── src/
│           ├── main.tsx        # QueryClient + ErrorBoundary + startSyncEngine
│           ├── App.tsx         # rotas + ProtectedRoute (RBAC)
│           ├── lib/            # api (fetch+JWT+DELETE), token, db (Dexie), sync, products
│           ├── hooks/          # useOnline, useBarcodeScanner
│           ├── store/          # auth (Zustand persist)
│           ├── components/     # Layout, ProtectedRoute, ErrorBoundary, StatusBadge,
│           │                   # ThermalReceipt, SaleReceipt (térmico+A4 unificado),
│           │                   # XmlImport (upload de arquivo)
│           └── pages/          # Login, Pdv, Products, StockAdjust, Cash, Registrations,
│                               # Sales, Purchases, Financial, Dashboard, Settings
```

---

## 4. Como rodar (resumo)

```bash
npm install
npm run db:up          # Postgres via Docker  (requer Docker Desktop — ver §12)
npm run db:migrate     # aplica migração + gera client
npm run db:seed        # admin@exodus.local/admin12345 ; caixa@exodus.local/caixa12345
npm run dev:api        # http://localhost:3333
npm run dev:web        # http://localhost:5173  (proxy /api → 3333)
```

Scripts na raiz: `db:up`, `db:down`, `db:migrate`, `db:generate`, `db:seed`,
`dev:api`, `dev:web`, `build`, `typecheck`.

---

## 5. Estado atual por módulo

Legenda: ✅ implementado e validado · 🟡 implementado parcial · ⬜ não iniciado

### Backend
- ✅ **Infra**: env tipado, Prisma singleton, CORS, Helmet, logger (pino-pretty em dev).
  `@fastify/static` serve o PWA em produção (monolito Railway).
- ✅ **Auth/RBAC**: `/auth/login`, `/auth/register` (ADMIN), `/auth/me`; guards
  `authenticate` e `authorize(roles)`.
- ✅ **Error handler global** (§Req 4.8): trata Zod, AppError, Prisma (P2002/P2025)
  e erros inesperados; 404 padronizado; SPA fallback para rotas do front.
- ✅ **Produtos**: CRUD completo; filtros por `search`, `brand`, `group`, `subgroup`;
  busca vazia retorna todos; variantes com lote/validade **opcionais** (controlado
  por `Product.tracksLotValidity`); `DELETE` protegido (bloqueia se houver vendas/notas);
  **`POST /products/adjust-stock`** (acerto de estoque → `StockMovement ADJUST`).
- ✅ **Pessoas**: CRUD cliente/fornecedor (document opcional); **`DELETE`** com proteção
  (bloqueia se houver vendas/notas/títulos vinculados).
- ✅ **Entrada de XML/NFe** (§4.3): `/invoices/parse` (resolve o De/Para e já retorna
  `matchedVariant` com os dados reais do catálogo — nome do produto, SKU, preços —
  para o item auto-mapeado nunca exibir o `xProd` da nota como se fosse o nome
  cadastrado), `/invoices/confirm`, `/invoices/mappings`; **`/invoices/manual`** (compra
  multi-produto: **nº de documento sequencial** — agora gerado também no `/confirm`,
  que antes deixava `documentNumber` nulo nas notas de XML —, novo preço de venda por
  item, lote por item, contas a pagar parceladas). **Custo Médio Ponderado (CMP)**
  centralizado em `lib/inventory.ts` (`calcWeightedAverageCost`), única fonte de
  verdade usada por `/confirm`, `/manual` e pela edição completa (evita as duas rotas
  divergirem e reintroduzirem o bug de sobrescrever o custo médio com o custo da
  entrada). `Invoice.nfeNumber` (nº da NF, `ide.nNF` do XML — nulo em compra manual)
  salvo em `/confirm`, junto com `entryDate` (data de entrada, distinta da emissão),
  ambos expostos na listagem para a grade de Compras Lançadas. **`GET/PUT/DELETE
  /invoices/:id`**: `PUT` sem `items` só edita metadados (observação/data/nº doc/
  fornecedor); `PUT` **com `items`** dispara **edição completa** (Mini-PDV de
  Compras) — estorna o estoque físico da nota antiga, remove itens/financeiro
  antigos, recalcula o CMP dos novos itens e recria as contas a pagar em uma única
  transação (espelha `updateSale`); bloqueada com erro de negócio se alguma parcela
  já tiver sido baixada. `DELETE` estorna estoque + remove contas a pagar pendentes
  (bloqueado se houver título já baixado).
- ✅ **Vendas**: `/sales` e `/sales/sync` (lote offline) com **idempotência por
  `clientRef`**; **split de pagamento** (tabela `SalePayment`) e **"A prazo"** (gera
  contas a receber); **`PUT/DELETE /sales/:id`** (editar/excluir com estorno de estoque
  + remoção do financeiro vinculado); desconto/acréscimo/observação por venda;
  **`Sale.code` sequencial (NºDOC)**; **`Sale.financialGenerated`** (excluir/gerar
  financeiro: `DELETE/POST /sales/:id/financial`); edição agora suporta split/"a
  prazo" (parcelas → contas a receber); `GET /sales/:id` inclui `payments` e
  `financialAccounts`. **Isolamento RBAC (2026-07-12)**: `GET /sales` e
  `GET /sales/:id` não tinham NENHUM filtro por papel/dono — qualquer CASHIER
  chamando a API diretamente enxergava todas as vendas da loja (a tela `/vendas`
  já era ADMIN-only só no frontend). Corrigido: `userFilter` condicional
  (`ADMIN` vê tudo; `CASHIER` só `Sale.userId === req.user.sub`) na listagem;
  `GET /:id` retorna 403 se o dono não bater (checado após o fetch, já que
  `findUnique` só aceita campo com constraint única no `where`).
- ✅ **Caixa**: abrir, sangria/suprimento, fechar; `/current` com `expectedCash`
  (somado por `SalePayment` em dinheiro); **`/cash/registers`** (histórico),
  **`/cash/:id/movements`** (timeline vendas+manuais), **`PUT/DELETE /cash/transactions/:id`**
  (só com caixa aberto **e bloqueado se a movimentação tiver origem sistêmica** —
  descrição iniciada em `"Baixa:"`/`"Estorno"`, geradas pelo Financeiro; excluir
  essas pelo Caixa quebraria a conciliação sem reabrir o título — estorne pela
  tela de origem); **`/summary`** por forma — **só ADMIN**.
  **`GET /cash/report`** (Relatório Periódico/Extrato Consolidado): recebe
  `startDate`/`endDate`, RBAC igual ao `/registers` (ADMIN vê a loja toda,
  operador só os próprios caixas); fronteiras de data ancoradas em **UTC-3
  explícito** (`T00:00:00.000-03:00` / `T23:59:59.999-03:00` — servidor roda em
  UTC, então `setUTCHours`/`setHours` puros cortavam movimentos noturnos locais);
  inclui caixas `OPEN` e `CLOSED` (sem filtro de status); `summary.cashInDrawer`
  = `totalInitialCash + vendas em dinheiro + totalSupply - totalBleed -
  totalCollected` (`totalCollected` = soma do `finalCash` dos caixas já
  fechados — dinheiro recolhido sai da gaveta).
- ✅ **Financeiro**: listar com **filtros avançados** — `orderBy`
  (`code`/`description`/`dueDate`/`amount`) + `orderDir`, e `statusFilter` semântico
  (`ALL`/`OPEN`/`OVERDUE`/`NOT_OVERDUE`/`PARTIAL`/`PAID`, este último com
  precedência sobre o `status`/`dueFrom`/`dueTo` simples quando presente — "hoje"
  calculado com o mesmo offset `-03:00` explícito do `/cash/report`, evitando o
  mesmo bug de fuso já documentado); `/installments` (N parcelas, fornecedor/
  cliente obrigatório); **`/:id/settle`** (baixa parcial/total, grava em
  `AccountSettlement`) e **`/:id/reverse`** (estorno da última baixa) — **ambas
  agora integradas ao Caixa**: exigem um `CashRegister` `OPEN` do operador
  (`req.user.sub`) e criam uma `CashTransaction` de compensação na mesma
  transação (`settle` de RECEIVABLE → `SUPPLY`; de PAYABLE → `BLEED`; `reverse`
  faz o inverso), com descrição `"Baixa: {desc}"`/`"Estorno de Baixa: {desc}"` —
  essas descrições são o que o Caixa usa para bloquear edição/exclusão indevida
  (acima). `PUT/DELETE` bloqueados por origem (nota/venda) **e por baixa
  existente**. Cada título tem **`code` sequencial**; status
  `PENDING|PARTIAL|PAID`.
- ✅ **Configurações** (tabela `Setting`, JSON): `/settings/product-form` (campos
  obrigatórios), **`/settings/company`** (dados da empresa), **`/settings/payment-types`**
  (tipos de recebimento). GET autenticado, PUT ADMIN.
- ✅ **Dashboard** (§novo, ADMIN): `GET /dashboard?from&to` — agrega vendas, recebimentos
  por forma, série diária e situação de contas a pagar/receber.
- ✅ **Sugestão de compra** (§4.6): média de vendas na janela × lead time.

### Frontend
- ✅ **Shell**: ErrorBoundary, Layout touch, ProtectedRoute (RBAC), StatusBadge
  (online/fila com ícones lucide-react).
- ✅ **Login**: layout split (painel de marca + formulário), `autoCapitalize=none`,
  trim na validação, `type="email"`. Botão "preencher acesso demo" **removido
  (2026-07-12)** — sistema em produção com cliente real, virou risco de segurança
  ter credenciais expostas na tela de login.
- ✅ **PDV** (§4.4): scanner de teclado, **busca vazia lista todos os produtos**,
  carrinho com **valor unitário editável por item**, **desconto e acréscimo** sobre o
  subtotal (entrada em R$ e em %), **observação** livre da venda, **seletor de cliente**
  (busca ou cadastro rápido), **fila offline (Dexie)** com sucesso imediato, modal de
  recibo. Caixa fechado mostra tela de bloqueio.
  **Pagamento:** 4 formas à vista (atalho) + modal com **split (múltiplas formas)** e
  **"A prazo"** (nº de parcelas, 1º vencimento, intervalo → gera contas a receber).
  **Motor de impressão dual** (`printMode` state): botões "🖨️ Bobina (80mm)" e "📄 Imprimir
  / Salvar PDF (A4)" no modal pós-venda; `handlePrint` mede a altura do recibo fora da tela
  (`receiptRef.scrollHeight`) e imprime via **iframe isolado** (`lib/iframePrint.ts`,
  onda 2026-07-11 — ver §11): clona o HTML/CSS medido para um iframe invisível e chama
  `print()` no `contentWindow` dele, não mais em `window.print()` do documento principal.
  Substituiu o "Dynamic Measurement Engine" original (que imprimia o documento principal
  filtrado por CSS `@media print`), descontinuado por gerar página em branco no spooler
  de impressão do WebView do Android mesmo após a blindagem CSS estática. O texto do
  botão A4 deixa explícito que o próprio spooler do SO já oferece "Salvar como PDF"/
  "Compartilhar" — não há geração de PDF client-side (`html2canvas`/`jsPDF` foram
  avaliados, implementados e **revertidos**, ver Onda 2026-07-10b em §11).
  **Bobina e A4 reutilizam exclusivamente `<SaleReceipt>`** (`format="thermal"`/`"a4"`) —
  o antigo `components/ThermalReceipt.tsx` (endereço/telefone **hardcoded**, ignorava os
  dados reais de `/api/settings/company`) foi removido; a bobina do PDV agora mostra os
  dados configurados da empresa (nome, CNPJ/CPF, endereço, telefone **e e-mail**) e a
  observação da venda, igual ao A4 (onda 2026-07-07, ver §11). Code real obtido via
  `POST /api/sales` com `clientRef` idempotente ao finalizar online.
  **Trava de navegação** (carrinho com item pendente): `beforeunload` nativo
  (refresh/fechar aba) + interceptação de clique em `<a href>` (menu lateral/bottom
  nav/drawer) em fase de captura no `document` — o projeto usa `<BrowserRouter>`
  "clássico" (não `createBrowserRouter`/`RouterProvider`), então `useBlocker` do
  react-router-dom não está disponível (exige "data router"); a interceptação de
  clique é o equivalente funcional sem migrar o roteamento do app inteiro.
  **Blindagem de impressão mobile A4**: o container off-screen de medição
  (`#a4-print-root`) virou `w-[210mm]` fixo (era `w-full` = largura do viewport no
  celular, que esmagava a folha A4 via `maxWidth:100%` do template antes do
  `@page` escalar); botões "Bobina"/"Papel A4" ficam `disabled` durante a janela
  assíncrona de medição + clonagem para o iframe de impressão, evitando cliques repetidos.
- 🟡 **Cadastros** (`/cadastros`, autenticado): CRUD de **clientes e fornecedores**
  (nome, CPF/CNPJ, telefone, e-mail, endereço) com exclusão protegida por origem.
  **Modal via React Portal** no mesmo padrão ouro de Produtos/Caixa (header com
  ícone+título+subtítulo, corpo com scroll interno, rodapé fixo com `btn-ghost`/
  `btn-primary`); grid responsivo `grid-cols-1 sm:grid-cols-2` (antes fixo em
  2 colunas, sem colapsar no mobile). **Campos dinâmicos PF/PJ**: `isPJ =
  document.replace(/\D/g,'').length > 11` alterna o label do nome
  ("Razão Social"/"Nome Completo") e exibe um segundo campo — `tradeName`
  ("Nome Fantasia"/"Apelido", novo campo `Person.tradeName` no schema).
  **Máscaras em tempo real** (`lib/masks.ts`, sem dependências): `maskCpfCnpj`,
  `maskPhone`, `maskCep` aplicadas no `onChange` e também no preenchimento
  programático (lookup de CNPJ/CEP, que não dispara `onChange`). **Busca de
  CNPJ**: motor trocado de BrasilAPI (bloqueia o campo `email` por proteção
  anti-spam, sempre retorna `null`) para **ReceitaWS**, que retorna o payload
  completo; a chamada é **proxeada pelo backend** (`GET /api/persons/cnpj/:cnpj`)
  porque a ReceitaWS bloqueia CORS para chamadas diretas do browser — o proxy
  também trata o caso da ReceitaWS responder HTTP 200 mesmo em erro
  (`status: 'ERROR'` no corpo). **Listagem**: ordenação client-side (nome/código/
  cidade, crescente/decrescente) via `<select>`; botão flutuante "voltar ao
  topo" com design **Dark Glassmorphism** (fundo `rgba` escuro + `backdrop-blur`)
  e **animação drop-down** de entrada (gatilho em `scrollY > 50`, opacidade +
  translate-Y via classes dinâmicas); **ejetado via `createPortal(...,
  document.body)`** para evitar Containing Block Hijacking (o `animate-fade-in`
  do `Layout.tsx` deixa um `transform` persistente em elementos ancestrais,
  quebrando o `position: fixed` e fazendo o botão se comportar como `absolute`);
  documento/telefone exibidos com máscara nos cards. **Busca "onisciente"**:
  filtro 100% client-side (nome, nome
  fantasia/apelido, documento com/sem máscara, cidade, telefone) — a lista
  completa é buscada uma vez por tipo e refinada localmente a cada tecla, sem
  round-trip de rede. **Comandante sinalizou pendências adicionais na tela**
  ainda não detalhadas/implementadas — ver §12.12.
- ✅ **Vendas** (ADMIN, `/vendas`): **NºDOC sequencial** em todas as vendas; consulta
  com coluna de status do financeiro; **botão Visualizar** (ver itens, pagamentos,
  contas a receber) antes de decidir; **excluir** (estorna estoque + remove
  financeiro); **excluir/gerar financeiro** (reversível — venda sai/entra no caixa
  e recebimentos); **imprimir** — cupom térmico aprimorado ou folha A4 estilizada
  com dados da empresa (escolha na hora). Todos os modais (Visualizar/Imprimir/
  Editar) via **React Portal** — mesmo padrão ouro de Produtos/Caixa/Cadastros
  (header com ícone/título+código/subtítulo, corpo com scroll interno, rodapé
  fixo); os três precisaram ser ejetados individualmente para não haver
  sobreposição de stacking context entre eles.
  **Editar venda = Mini-PDV**: modal alargado (`sm:max-w-5xl h-[90dvh]`) em duas
  colunas — carrinho (cliente + busca de produto + itens com +/−, preço editável,
  remover) à esquerda, "Resumo da venda" (`sticky`) à direita (desconto,
  acréscimo, forma de pagamento, parcelas "a prazo", observação, total).
  **Bloqueada se a venda já tiver financeiro gerado** (`sale.financialGenerated`):
  botão Editar desabilitado no Visualizar + guarda de segurança dentro do próprio
  modal de edição — o operador precisa excluir o financeiro manualmente primeiro
  para ter consciência do impacto no caixa. **Fluxo de finalização maduro**: ao
  salvar, se a forma de pagamento for Dinheiro, abre a calculadora de troco
  (`ChangeCalculatorModal`, extraído para `components/` e reaproveitado do PDV);
  senão, pede confirmação simples antes de disparar a API.
  **Cliente padrão configurável** (Configurações → Vendas, `GET/PUT
  /api/settings/sales`): substitui o fallback hardcoded "Balcão" por um
  `Person` real escolhido pelo ADMIN — pré-selecionado automaticamente no PDV
  (removível pelo operador) e usado como fallback do `clientId` ao salvar uma
  edição sem cliente selecionado. **Filtros avançados** (busca por NºDOC/cliente,
  forma de pagamento, faixa de valor, financeiro, desconto, acréscimo — 100%
  client-side, `useMemo`) + **paginação** (10/25/50/100 por página, padrão Tray)
  + **botão flutuante "Voltar ao topo"** (mesmo padrão de Cadastros, `bottom-24
  md:bottom-8` para não cobrir a bottom nav no mobile). **Impressão unificada com
  o PDV**: `PrintReceiptModal.tsx` (novo, `components/`) reaproveita o mesmo motor
  de impressão dual (medição off-screen + `@page` dinâmico + remoção física dos
  irmãos do `body`) e o mesmo `<SaleReceipt>` usado no PDV — a bobina e o A4
  impressos a partir de `/vendas` agora têm exatamente o mesmo texto/layout do
  PDV, incluindo dados completos da empresa e a observação da venda (`sale.notes`,
  novo campo em `SaleReceiptData`); cliente sem nome exibe "Consumidor Final" no
  comprovante impresso (mantém "Balcão" nas telas do app). `PrintSaleModal` virou
  só a ponte de dados (busca `sale`+`company`, mapeia para `SaleReceiptData`).
  **Filtro de período + ordenação**: `startDate`/`endDate` (cobrindo o dia inteiro
  da data final via `T23:59:59`) e `sortField` (`code`/`date`/`items`) +
  `sortDir`, incorporados ao mesmo objeto `SalesFilterValues`/`updateFilter` já
  existente — "Limpar filtros" já reseta tudo de graça.
- ✅ **Produtos**: filtros (marca/grupo/subgrupo) + busca + **ordenação** (Descrição,
  Código, SKU, Preço de venda — crescente/decrescente via selects no painel de filtros);
  editar produto e variantes (asteriscos `*` também no modal Editar); excluir (com
  confirmação + bloqueio por origem); toggle **"controlar lote e validade"** (lote/validade
  só obrigatórios quando marcado); **descrição da variante opcional** (fallback = nome do
  produto); **marca/grupo/subgrupo obrigatórios conforme a config da loja**.
  **Precificação com modo global** (`pricingMode`): ADMIN escolhe em Configurações
  se o campo de percentual exibe Margem ou Markup; formulário exibe exatamente
  4 campos [Último custo | Custo médio | Margem OU Markup | Venda]. Alterar o custo
  preserva o percentual e recalcula o preço; alterar o preço recalcula o percentual.
  **Trava de margem 100%**: `NumField` recebeu prop `max?: number`; quando
  `pricingMode === 'margin'` é injetado `max={99.99}`, impedindo fisicamente que o
  usuário ultrapasse 99,99% (divisão por zero no cálculo do preço de venda).
  **Custo Médio Ponderado (CMP)**: campo `averageCost` na variante (DB e UI); calculado
  automaticamente a cada entrada de nota (XML ou manual) pela fórmula
  `(stockAtual × avgAtual + qtdEntrada × custoUnitário) / (stockAtual + qtdEntrada)`;
  pode ser corrigido manualmente na edição da variante. Obrigatoriedade configurável
  via flag `requireAverageCost` nas Configurações de Produto.
  **Modal de cadastro/edição via React Portal**: `createPortal(..., document.body)` em
  ambos os modais — imune ao containing block gerado pelo `animate-fade-in` do `<main>`.
  Usa `.modal-overlay` + `.modal-sheet` do design system (bottom-sheet no mobile, card
  centralizado no desktop); scroll interno (`flex-1 min-h-0 overflow-y-auto`) com
  cabeçalho e rodapé `shrink-0` fixos. **Cabeçalho do modal Editar** exibe `#N`.
  **Campo SKU** restaurado no card de variante (obrigatório, validado por
  `buildVariantSchema`, enviado ao `PUT /api/products/variants/:id`).
  **Validação Zod dinâmica**: `buildProductFormSchema(brandReq, groupReq, subgroupReq,
  barcodeReq, tracksLotValidity, requireAverageCost)` e `buildVariantSchema(barcodeReq,
  tracksLotValidity, requireAverageCost)` geram schemas em runtime. `submit()` /
  `handleSave()` usam `safeParse` — erros por campo exibidos inline. Campos numéricos
  usam `z.coerce.number().min(0).catch(0)` para evitar "Dados inválidos" com campo vazio.
  **Sanitização de payload**: `brand || undefined`, `group || undefined` ao salvar (strings
  vazias seriam rejeitadas pelo Zod `.min(1)` do backend; `undefined` é descartado pelo
  JSON.stringify e o Prisma ignora o campo).
  **Paginação real** (`currentPage`/`itemsPerPage`, padrão 1/50): o backend já
  paginava de verdade (`skip`/`take` + `total`) mas o front nunca pedia — ficava
  fixo em `pageSize=100`; agora envia `page`/`pageSize` de verdade e reseta a
  página ao mudar filtro/ordenação/tamanho. Rodapé Padrão Ouro + botão flutuante
  "Voltar ao topo" (Dark Glassmorphism, `scrollY > 300`).
- ✅ **Caixa**: card gradiente com **saldo atual** (`expectedCash`); suprimento/sangria
  via **modal próprio com observação** (sem `window.prompt`); **timeline de
  movimentações** unindo vendas (leitura) + sangrias/suprimentos (editáveis/excluíveis
  só com o caixa aberto); **resumo de recebimentos por forma** (ADMIN); **histórico de
  caixas de outros dias** com detalhe e resumo; fechamento por modal.
  **Rastreabilidade de origem** (`RegisterMovements`, 2026-07-12): vendas na
  timeline mostram `Venda #{code}` (NºDOC), não mais um genérico "Venda ·
  Dinheiro" — o backend (`/:id/movements`) já enviava o `code` desde a onda de
  Relatório Periódico, mas esse componente específico (usado tanto na aba "Caixa
  Atual" quanto no detalhe do "Histórico") nunca usava o campo; a aba "Relatório
  Periódico" (`PeriodicReport`, componente separado) já fazia certo. Todos os
  modais (Sangria/Suprimento/Fechamento) via **React Portal**
  (`createPortal(..., document.body)`) — mesmo padrão da tela de Produtos, imune
  ao containing block do `animate-fade-in`. **Impressão de resumo/fechamento**
  (`CashPrintButton` + `CashReceipt.tsx`): mede a altura real do recibo
  (`scrollHeight + 15px` de sobra para a guilhotina) e imprime via **iframe
  isolado** (`lib/iframePrint.ts`, mesmo motor do PDV/Vendas, onda 2026-07-11
  — ver §11), que clona o HTML/CSS medido para um documento à parte e chama
  `print()` nele em vez de `window.print()` no documento principal.
  **Terceira aba "Relatório"** (`PeriodicReport`): seletor de período (padrão =
  mês corrente), cards de resumo (Total de vendas, Dinheiro em gaveta,
  Suprimentos, Sangrias, Fechamentos/Recolhido) e timeline consolidada de
  todos os caixas do período (ícone + operador + valor com sinal).
- ✅ **Compras**: **aba "Sugestão de compra"** (`PurchaseSuggestion`, componente
  próprio) com filtros (marca/grupo/subgrupo/janela/reposição), **paginação
  client-side** + **scroll-to-top**, produto exibido como `#código - nome` com a
  marca em `badge-brand`, e "Média/dia" formatada em vírgula BR + sufixo (`0,37
  un/dia`, com `title` explicativo); importação de XML por **upload de arquivo .xml**
  (item auto-mapeado exibe o **nome real do catálogo**, não o `xProd` da nota);
  **compra manual multi-produto** (vários itens, observação, **nº de documento
  sequencial**, **novo preço de venda por item** mostrando o atual, **lote/validade por
  item**, precificação bidirecional margem/markup, e **contas a pagar parceladas**
  opcionais do total via `<PurchaseFinancialEngine>` — motor compartilhado com a
  Etapa 3 do XML). **Aba "Compras lançadas"**: **filtros avançados** (nº de documento,
  fornecedor, data, faixa de valor, status do financeiro — 100% client-side, mesmo
  padrão de Vendas) + **paginação client-side** + **scroll-to-top**; grade com colunas
  **"Nº NF"** (nulo em compra manual) e **"Entrada"** (além da renomeada "Emissão") +
  **modal de visualização em Padrão Ouro** (`ViewPurchaseModal`, `createPortal`,
  header com fornecedor/emissão/entrada/nº doc, contas a pagar com datas corrigidas —
  fim do bug "Invalid Date" nas parcelas) + **`EditPurchaseModal`** (Mini-PDV de
  Compras: troca fornecedor, data, itens e contas a pagar; bloqueado com tela de
  acesso negado se a compra tiver **qualquer financeiro vinculado** — simetria com
  `Sale.financialGenerated`, não só parcela já baixada) + **excluir** (estorna
  estoque + remove contas a pagar pendentes; bloqueado se houver título já baixado).
  **Ordenação** (`sortField`: doc/NF/emissão/entrada/valor/itens + `sortDir`)
  incorporada ao mesmo `PurchaseFilterValues`; label do filtro de data corrigido
  de "Data da compra" para "Data de emissão" (batendo com a coluna da grade).
  **Custo de Aquisição Real / Landed Cost** (4.9, onda 2026-07-13 — ver §11):
  `Invoice.freight`/`Invoice.otherExpenses` — frete e outras despesas rateados
  proporcionalmente ao valor de cada item (`apportionLandedCost`,
  `packages/shared/src/pricing.ts` — fonte única backend+frontend) para compor o
  custo real (`costPrice`/`averageCost`) do produto; `InvoiceItem.unitCost`
  continua guardando o valor original do documento (auditoria). `totalAmount`
  passou a ser recalculado de forma uniforme como `produtos + frete + despesas`
  em `/confirm`, `/manual` e na edição (decisão deliberada: sobrescreve o `vNF`
  bruto do XML por uma fórmula única e auditável — sistema é gerencial, não
  fiscal). **Compra Manual virou um wizard de 2 etapas** (`ManualPurchase`):
  Etapa 1 (dados da nota — fornecedor/data/produtos com só Qtd/Custo Base/Lote-
  Validade/Frete/Outras Despesas, sem precificação) → Etapa 2 (`RepricingRow`,
  grid Custo Antigo/Custo Novo Rateado/Preço Venda Antigo/Novo/Margem-Markup,
  calculado sobre o custo já rateado, não o bruto da Etapa 1). **Cadastro
  In-Line de Produto na Etapa 1 do XML** (`NewProductInlineForm`): item do XML
  sem De/Para pode ser cadastrado na hora (Nome/SKU/Código de barras
  pré-preenchidos do XML, Marca/Grupo/Subgrupo com sugestão via
  `SmartFilterInput`, obrigatoriedade dinâmica das Configurações) em vez de
  abandonar a importação — o backend cria Produto+Variante **dentro da mesma
  transação** do `/confirm`, usando o custo rateado como custo inicial, antes de
  vincular o `InvoiceItem`; `SupplierProductMapping` também aponta pro produto
  novo (próxima nota do fornecedor já vem auto-mapeada). **Frete/Outras
  Despesas editáveis também na Etapa 1 do XML** (não só na Compra Manual): a
  Etapa 2 do XML recalcula o rateio no cliente (`landedCosts`, `useMemo`) a
  partir do estado editado, não de um valor congelado do `/parse` — permite
  ajustar pra refletir frete "por fora" (FOB) não descrito no XML.
- ✅ **Financeiro**: lançamento manual a pagar/receber com **N parcelas** e
  **fornecedor/cliente obrigatório**; cada título tem **código sequencial** (`code`);
  **baixa parcial** (registra liquidações em `AccountSettlement`, mostra saldo restante)
  e **quitação integral com desconto**; **estorno da última baixa**; **filtros
  avançados** (busca, período de vencimento, `statusFilter` semântico — Todos/
  Abertos/Vencidos/A Vencer/Parcial/Quitado — e ordenação por código/descrição/
  vencimento/valor, ambos crescente/decrescente) + **paginação** (10/25/50/100,
  padrão Tray) + **botão flutuante "Voltar ao topo"** (Dark Glassmorphism);
  **títulos vencidos destacados**; edição/exclusão **bloqueadas** para origem
  nota/venda e para títulos já baixados. **Modais "Novo lançamento" e "Baixar
  título" em Padrão Ouro** (`createPortal`, header/body/footer estritos,
  bottom-sheet no mobile) — antes usavam o wrapper `<Modal>` sem portal, sofrendo
  o bug de containing block do `animate-fade-in`; o input "Valor a baixar" do
  modal de baixa migrou de `type="number"` (steppers nativos) para o padrão
  blindado do projeto (`type="text"` + `inputMode="decimal"` + `sanitizeBr` +
  bloqueio de `-`/`+`/`e`/`E` + seleção total no foco). **Descrições
  rastreáveis**: parcelas geradas por Vendas/Compras agora incluem o código de
  origem — `"Venda #{code} - Parcela X/Y"` e `"Compra #{documentNumber} -
  Parcela X/Y"` (antes só "Venda a prazo X/Y" / "NF ... - parcela X/Y", sem
  indicar qual venda/compra originou o título). **Integração com o Caixa**:
  `/settle` e `/reverse` agora exigem um caixa aberto do operador e criam uma
  `CashTransaction` de compensação automaticamente (ver bullet do Caixa acima).
- ✅ **Dashboard** (ADMIN, `/dashboard`): visão financeira por **período** — vendas
  (total/qtd/ticket), recebimentos por forma, série diária (gráfico corrigido) e
  situação de contas a pagar/receber (aberto e vencido); **card Receitas − Despesas**
  (saldo +/− do período).
- ✅ **Acerto de estoque** (ADMIN, `/estoque`): inventário — informa a quantidade
  contada e o motivo; registra a diferença como `StockMovement` tipo `ADJUST`;
  **histórico de acertos** com editar (recalcula estoque) e apagar (reverte diff),
  agora com **paginação client-side** (10/25/50/100) e coluna **"Cód."** sequencial
  (`StockMovement.code`, nulo nos demais tipos de movimento — calculado
  manualmente via `aggregate max+1` escopado a `type='ADJUST'` na criação, mesmo
  padrão de `Invoice.documentNumber`, já que a tabela é um razão compartilhado
  com vendas/notas e um autoincrement de banco misturaria a numeração).
  **Busca de produto blindada para teclado virtual mobile**: input envolvido em
  `<form onSubmit>` (`type="search"` + `enterKeyHint="search"`) — o `onKeyDown`
  isolado não é confiável em teclados virtuais que disparam a submissão nativa
  do formulário sem um evento de tecla JS correspondente.
  Endpoints: `GET/PUT/DELETE /products/stock-adjustments(/:id)`.
- ✅ **Configurações** (ADMIN) em abas: **Produto** (campos obrigatórios + lote/validade
  padrão + **modelo de precificação** `pricingMode`: Margem ou Markup — radio group;
  + **`requireAverageCost`**: torna o custo médio obrigatório no cadastro/edição;
  todos persistidos em `Setting`, consumidos dinamicamente pelo formulário de produto),
  **Recebimentos** (tipos de pagamento configuráveis: renomear/ativar/adicionar,
  consumidos dinamicamente pelo PDV), **Empresa** (dados cadastrais do contratante) e
  **Usuários** (CRUD completo: criar/editar/excluir; definir quais telas cada operador
  pode acessar via checkboxes — `allowedPages` granular por usuário; modal
  `UserFormModal` padronizado pro Padrão Ouro — `createPortal` + header/body/footer
  rígidos, 2026-07-12 — mesma causa raiz do `animate-fade-in` já documentada
  alhures). Validação de e-mail (login e criação de usuário) já usava
  `z.string().trim().toLowerCase().email(...)` no schema compartilhado e
  `type="email"` no frontend desde antes; único gap real encontrado (2026-07-12)
  era uma pré-checagem fraca (`email.includes('@')`) no `submit()` do
  `UserFormModal`, substituída por `createUserSchema.shape.email.safeParse(...)`.
- ✅ **Recibo térmico** 58/80mm e **comprovante A4** (§4.7): `ThermalReceipt` renderiza
  cabeçalho completo (nome, endereço, cidade, tel) + itens + totais + pagamento.
  `SaleReceipt` (componente unificado) entrega cupom térmico ou folha A4 estilizada com
  logo, tabela de itens e dados da empresa. Impressão via `window.print()` com
  `@page` e `print-color-adjust: exact` injetados dinamicamente.
- ✅ **PWA**: manifest + Service Worker (Workbox) com cache de app shell e API.

---

## 6. Sincronização offline-first (detalhe — §4.4)

Decisão: **fila própria no IndexedDB (Dexie)** em vez de Background Sync nativo
(suporte irregular entre navegadores). Fluxo:

1. Venda no PDV → `enqueueSale()` gera `clientRef` (uuid) e grava em `saleQueue`
   com status `PENDING`. O caixa recebe **sucesso imediato**.
2. Se **online**, `doSale` chama imediatamente `POST /api/sales` com o **mesmo
   `clientRef`** para obter o `code` sequencial (usado no comprovante A4). O sync
   posterior detecta `DUPLICATE` via `clientRef` — **sem duplicata**.
3. `startSyncEngine()` (em `main.tsx`) dispara `flushQueue()` ao **evento `online`**,
   ao iniciar e a cada 30s.
4. `flushQueue()` envia o lote para `POST /api/sales/sync`. O backend é
   **idempotente**: `clientRef` já gravado retorna `DUPLICATE` (não duplica venda).
5. Sucesso (`CREATED`/`DUPLICATE`) → remove da fila; `ERROR` → marca para retry.

Busca de produto por código de barras também tem fallback offline (cache
`variants` no Dexie) — ver `apps/web/src/lib/products.ts`.

---

## 7. Decisões de arquitetura e **divergências do schema base**

O schema Prisma do briefing foi **mantido como base, porém corrigido e estendido**
(aprovado pelo usuário). Cada mudança está comentada no cabeçalho de
`apps/api/prisma/schema.prisma`:

| Mudança | Motivo |
|--------|--------|
| `User.passwordHash` | O model original não tinha campo de senha; necessário para JWT/bcrypt. |
| `User.allowedPages Json?` | Controle granular de acesso por página para CASHIER (null = padrão do papel). |
| `ProductVariant.batch` (nullable) | Lote agora **opcional** — obrigatório só quando `Product.tracksLotValidity = true` (configurável por produto). |
| `ProductVariant.averageCost Decimal @default(0)` | Custo Médio Ponderado (CMP) — calculado automaticamente a cada entrada de nota; pode ser corrigido manualmente. |
| `Product.tracksLotValidity` (booleano) | Liga/desliga exigência de lote/validade por produto (migração `add_lot_validity_control`). |
| `Person.document` opcional (mantém `@unique`) | Clientes de balcão sem CPF; no Postgres, múltiplos `NULL` não colidem. |
| `Person.tradeName String?` | Nome fantasia (PJ) ou apelido (PF) — campo dinâmico conforme `isPJ` no formulário (migração `20260702000000_add_person_trade_name`). |
| Campos de endereço em `Person` | Autocompletar via BrasilAPI (CEP) e ReceitaWS (CNPJ) — §4.2. |
| `SupplierProductMapping` (nova) | Persistir o **De/Para** fornecedor↔variante (§4.3). |
| Relações faltantes | `Invoice→supplier`, `CashRegister→user`, `Sale→user/client`, `FinancialAccount→invoice/person`. |
| `StockMovement` (nova) | Razão (ledger) de estoque para auditoria e base da sugestão de compra. |
| `Sale.clientRef @unique` + `soldAt` | Idempotência da fila offline e data real da venda. |
| `Setting` (nova) | Configurações da loja em chave/valor JSON (migração `add_settings`). |
| `Sale` + `subtotal`/`discount`/`surcharge`/`notes` | Desconto, acréscimo e observação por venda (mig. `sale_discount_surcharge_notes`). |
| `SalePayment` (nova) | Split de pagamento — várias formas por venda (mig. `sale_payments`). |
| `FinancialAccount.saleId` | Vínculo venda→contas a receber (a prazo); removido ao editar/excluir a venda (mig. `financial_account_sale_link`). |
| `Invoice` + `documentNumber`/`notes` | Nº de documento sequencial e observação da compra manual (mig. `invoice_document_notes`). |
| `FinancialAccount.code` (SERIAL `@unique`) + status `PARTIAL` | Código sequencial do título e baixa parcial (mig. `financial_settlements_code`). |
| `AccountSettlement` (nova) | Liquidações (baixas) de um título — baixa parcial + estorno (mesma migração). |
| `PaymentMethod` enum `+A_PRAZO`; método **relaxado para string** na venda | Permite tipos de recebimento configuráveis além dos base. |

Outras decisões:
- **CFOP flexível** (§4.3): registrado exatamente como vem no XML, sem bloquear a
  operação — uso apenas gerencial.
- **Monetário**: `Decimal(10,2)` no banco; números convertidos na borda da API
  (`lib/serialize.ts`) para JSON; cálculos com `Prisma.Decimal` no total da venda.
- **Validação**: Zod único em `packages/shared`, reutilizado no Fastify (entrada)
  e no front (formulários), via `fastify-type-provider-zod`.

---

## 8. Mapa de requisitos → implementação

| Req | Descrição | Implementação | Status |
|-----|-----------|---------------|--------|
| 4.1 | Margem/Markup bidirecional | `packages/shared/src/pricing.ts`, `pages/ProductsPage.tsx` | ✅ |
| 4.1 | Lote/validade configurável | `Product.tracksLotValidity`, `schemas/product.ts`, toggle no formulário | ✅ |
| 4.2 | BrasilAPI/ReceitaWS (CNPJ/CEP) | Autocomplete no `RegistrationsPage.tsx`; CNPJ via ReceitaWS proxeada em `GET /api/persons/cnpj/:cnpj` (CORS) | ✅ |
| 4.3 | Entrada de XML + De/Para | `services/nfe-parser.ts`, `routes/invoices.ts`, `components/XmlImport.tsx` (upload) | ✅ |
| 4.3 | Compra manual (sem XML) | `routes/invoices.ts` (`/manual`), `pages/PurchasesPage.tsx` | ✅ |
| 4.3 | CFOP flexível | `InvoiceItem.cfop` | ✅ |
| 4.3 | Contas a Pagar das duplicatas | `routes/invoices.ts` (confirm) | ✅ |
| 4.4 | PDV offline-first | `lib/db.ts`, `lib/sync.ts`, `hooks/useBarcodeScanner.ts`, `PdvPage.tsx` | ✅ |
| 4.5 | Caixa (abrir/fechar/sangria/suprimento) | `routes/cash.ts`, `CashPage.tsx` (saldo em tempo real) | ✅ |
| 4.5 | Resumo financeiro só ADMIN | `routes/cash.ts` (`/summary`), `routes/financial.ts` | ✅ |
| 4.6 | Sugestão de compra | `routes/purchase-suggestions.ts`, `PurchasesPage.tsx` | ✅ |
| 4.7 | Recibo 58/80mm + print | `components/SaleReceipt.tsx`, motor de impressão via iframe em `lib/iframePrint.ts` | ✅ |
| 4.8 | Resiliência/Logs | `plugins/error-handler.ts`, `components/ErrorBoundary.tsx` | ✅ |
| — | Produtos: filtros + editar + excluir | `routes/products.ts` (GET filtros, DELETE protegido), `ProductsPage.tsx` | ✅ |
| — | PDV: desconto/acréscimo/observação + valor unitário editável | `PdvPage.tsx`, `services/sales.ts` | ✅ |
| — | Vendas: split de pagamento + "A prazo" (parcelas) | `SalePayment`, `services/sales.ts`, `PdvPage.tsx` (modal) | ✅ |
| — | Vendas: consulta + editar/excluir | `routes/sales.ts` (PUT/DELETE), `SalesPage.tsx` | ✅ |
| — | Cadastros de clientes/fornecedores | `routes/persons.ts`, `RegistrationsPage.tsx` | 🟡 |
| — | Caixa: timeline + editar/excluir + histórico + resumo | `routes/cash.ts`, `CashPage.tsx` | ✅ |
| — | Compra manual multi-produto + nº doc + contas a pagar | `routes/invoices.ts` (`/manual`), `PurchasesPage.tsx` | ✅ |
| — | Financeiro: baixa parcial + estorno + filtros + código | `AccountSettlement`, `routes/financial.ts`, `FinancialPage.tsx` | ✅ |
| — | Acerto de estoque (inventário) | `routes/products.ts` (`/adjust-stock`), `StockAdjustPage.tsx` | ✅ |
| — | Dashboard financeiro por período | `routes/dashboard.ts`, `DashboardPage.tsx` | ✅ |
| — | Configurações (ADMIN): produto, recebimentos, empresa | `routes/settings.ts`, `pages/SettingsPage.tsx`, `Setting` model | ✅ |

---

## 9. Modelo de dados (entidades)

`User`, `Product` 1—N `ProductVariant`, `Person` (CLIENT|SUPPLIER),
`Invoice` 1—N `InvoiceItem`, `SupplierProductMapping`, `CashRegister` 1—N
`CashTransaction`/`Sale`, `Sale` 1—N `SaleItem`/`SalePayment`, `StockMovement`,
`FinancialAccount` 1—N `AccountSettlement`, `Setting` (chave/valor). Campos `role`,
`type`, `status` etc. são `String` no Prisma (flexibilidade) mas **validados por
`z.enum`** na borda (`packages/shared/src/enums.ts`) — exceto o método de pagamento
da venda, **relaxado para string** (tipos de recebimento configuráveis). Detalhe
completo: `apps/api/prisma/schema.prisma`.

**Migrações (todas aditivas/seguras, lista não exaustiva — ver
`apps/api/prisma/migrations/`):** `0_init`, `add_lot_validity_control`,
`add_settings`, `sale_discount_surcharge_notes`, `financial_account_sale_link`,
`sale_payments`, `invoice_document_notes`, `financial_settlements_code`,
`sale_code_financial_flag`, `product_person_code`,
`20260626000000_add_average_cost_to_variants`, `20260702000000_add_person_trade_name`,
`20260710011551_add_invoice_nfe_number`, `20260710041311_add_code_to_stock_adjustments`,
`20260713021023_add_invoice_expenses` (`Invoice.freight`/`Invoice.otherExpenses` —
landed cost, ver §5 Compras e Onda 2026-07-13 em §11). Aplicadas automaticamente
no Railway a cada deploy (`prisma migrate deploy`).

---

## 10. Convenções de código

- **TypeScript estrito** (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- Contratos e tipos **derivados de Zod** (`z.infer`) — sem duplicar tipos.
- Erros de domínio via classes `AppError` (`lib/errors.ts`); o handler global
  converte em resposta `{ statusCode, code, message }`.
- Comentários de domínio em **português**; identificadores em inglês.
- Componentes React touch-first (classes utilitárias `.btn`, `.input`, `.card`,
  alvos `min-h-touch`).
- ⚠️ **Workspaces copiados (Windows):** neste ambiente o npm **copia** `@exodus/shared`
  para `node_modules` em vez de symlinkar. Após editar `packages/shared/src`, rode
  `npm install` para o tsc/build enxergarem as mudanças.

---

## 11. Validações já executadas

- ✅ `npm run typecheck` (shared + api + web) → **0 erros** (validado em todas as ondas).
- ✅ Backend `tsup` build OK + smoke test: `/health` 200 · login inválido 400 · 401/404 padronizados.
- ✅ Frontend `vite build` OK + PWA (`sw.js`, `manifest.webmanifest`).
- ✅ **Versionamento**: repositório publicado no GitHub (branch `main`); segredos fora do versionamento.
- ✅ **Execução contra banco real** (2026-06-02): Docker Desktop instalado; `db:up` → `db:migrate` (Prisma Client v5.22.0) → `db:seed`. Login real do ADMIN retorna JWT; `/auth/me` responde 200.
- ✅ **Fluxo end-to-end real** (2026-06-02): login → abrir caixa → criar produto → registrar venda (2×R$29,90 = R$59,80) → **baixa de estoque 10→8** + `StockMovement`.
- ✅ **Interface redesenhada** (2026-06-02): design system "beauty" (paleta brand/accent, Inter + Plus Jakarta Sans, gradientes, lucide-react). Todas as páginas redesenhadas. `vite build` OK.
- ✅ **Deploy Railway** (2026-06-03): projeto `exodus-software` criado (conta helomramos40@gmail.com), Postgres gerenciado provisionado, serviço `exodus-web` com `JWT_SECRET` e `DATABASE_URL`. Build via Dockerfile: `prisma migrate deploy` + `node dist/server.js`. URL: https://exodus-web-production.up.railway.app.
- ✅ **Onda 1 — Produtos & Caixa** (2026-06-04): filtros (marca/grupo/subgrupo), busca vazia lista todos, editar/excluir produto com proteção de origem, asteriscos em campos obrigatórios, toggle controle lote/validade, `Product.tracksLotValidity` (migração aplicada no Railway). Caixa mostra saldo atual (`expectedCash`). Validado em produção.
- ✅ **Onda 2 — Configurações** (2026-06-04): tela `/configuracoes` (ADMIN), model `Setting`, rota `/api/settings/product-form`. Toggles: subgrupo obrigatório, código de barras obrigatório, lote/validade por padrão. Formulário de produto lê a config. Validado em produção.
- ✅ **Onda 3 — Compras** (2026-06-04): importação de XML por **upload de arquivo** (não cola texto); compra manual (fornecedor, data, produto, qtd, preço, lote/validade → dá entrada de estoque via `/api/invoices/manual`). Validado em produção.
- ✅ **Onda 4 — Financeiro** (2026-06-04): lançamento manual com **parcelas** (N parcelas × intervalo, última absorve arredondamento); editar/excluir títulos; proteção de origem (bloqueia títulos com `invoiceId`). Validado em produção (3 parcelas de 33,33/33,33/33,34).
- ✅ **Onda 5 — Produtos (refinamentos)** (2026-06-04): correção da precificação
  (último percentual margem/markup editado recalcula a venda; alterar custo mantém
  o percentual); descrição da variante opcional (fallback = nome); marca/grupo
  obrigatórios conforme Configurações (`brandRequired`/`groupRequired`); asteriscos
  no modal Editar produto. `npm run build` (shared+api+web) OK. Commit `ec3e134`.
- ✅ **Onda PDV-A — Vendas (parte 1)** (2026-06-04): busca vazia lista todos; valor
  unitário editável por item; desconto e acréscimo (R$ e %); observação da venda.
  Migração aditiva `sale_discount_surcharge_notes` (Sale: subtotal/discount/surcharge/
  notes). `npm run build` OK. Commit `9344d19`. (Migração aplicada no auto-deploy.)
- ✅ **Onda PDV-C — Consulta/edição de vendas** (2026-06-04): tela `/vendas` (ADMIN)
  com excluir (estorna estoque + remove financeiro) e editar por completo (itens,
  desconto, acréscimo, observação, pagamento). Migração aditiva
  `financial_account_sale_link` (FinancialAccount.saleId). `npm run build` OK.
  Commit `7e6b652`. (Migração aplicada no auto-deploy.)
- ✅ **Onda Cadastros** (2026-06-04): tela `/cadastros` (clientes/fornecedores, CRUD +
  exclusão protegida); `DELETE /api/persons/:id`; **seletor de cliente no PDV** (busca
  ou cadastro rápido). Sem migração (model `Person` já existia). Build OK. Commit `02c2aa7`.
- ✅ **Onda PDV-B — Pagamentos** (2026-06-04): split de pagamento (múltiplas formas) +
  venda **"A prazo"** com parcelas (gera contas a receber). Nova tabela `SalePayment`
  (migração `sale_payments`), enum `+A_PRAZO`, `Sale.paymentMethod` legado vira `SPLIT`.
  **Caixa corrigido**: saldo e resumo somam por `SalePayment` (antes contavam o total
  inteiro da venda como CASH). `npm run build` OK. Commit `848089a`.
- ✅ **Onda Caixa** (2026-06-04): timeline de movimentações (vendas + manuais), editar/
  excluir sangria/suprimento (bloqueado se caixa fechado), modal com observação,
  resumo por forma de pagamento (ADMIN) e histórico de outros dias. Endpoints
  `/cash/registers`, `/cash/:id/movements`, `PUT|DELETE /cash/transactions/:id`. Sem
  migração. Build OK. Commit `b1903ca`.
- ✅ **Auto-deploy Railway** (2026-06-04): serviço `exodus-web` vinculado ao GitHub
  (branch `main`) com **deploy automático a cada push**; migrações aplicadas no deploy.
- ✅ **Onda Compra manual** (2026-06-04): multi-produto, observação, nº de documento
  sequencial, novo preço de venda por item, lote/validade por item, contas a pagar
  parceladas; aba de compras lançadas (detalhe/editar/excluir com estorno). Migração
  aditiva `invoice_document_notes` (Invoice: documentNumber, notes). Endpoints
  `GET/PUT/DELETE /invoices/:id`. `npm run build` OK. Commit `419b232`.
- ✅ **Onda Financeiro** (2026-06-04): baixa parcial + estorno (tabela
  `AccountSettlement`), código sequencial (`FinancialAccount.code` SERIAL — preenche
  os existentes), fornecedor/cliente obrigatório, filtros (período + busca), vencidos
  destacados, bloqueio de edição de baixados. Migração `financial_settlements_code`.
  Endpoints `/financial/:id/settle` e `/:id/reverse` (substituem `/pay`). Build OK.
  Commit `ceaf504`.
- ✅ **Onda Cadastros & Dashboard** (2026-06-04): **dados da empresa** (Setting), **tipos
  de recebimento** configuráveis (Setting + PDV dinâmico; método de pagamento relaxado
  para string), **acerto de estoque** (`/products/adjust-stock` → `StockMovement ADJUST`)
  e **dashboard financeiro** por período (`/dashboard`). Sem migração (Setting/JSON +
  tabelas existentes). `npm run build` OK. Commit `ba5dc18`. **Backlog de melhorias
  100% concluído.**
- ✅ **Onda 2026-06-05 — múltiplas melhorias** (2026-06-05):
  - **Compra manual**: checkbox lote/validade pré-marcado conforme o produto já controla.
  - **Cadastro produto**: lote/validade sempre desmarcado por padrão (opt-in); remove
    bloqueio indevido ao cadastrar produto sem lote.
  - **Financeiro**: paginação 50/50 — **corrige bug que deixava a tela vazia** (front
    pedia `pageSize=200` mas schema limitava a 100).
  - **Dashboard**: gráfico "Vendas por dia" corrigido (barras colapsavam); novo card
    **Receitas − Despesas** (saldo +/− do período). Backend também ignora vendas com
    `financialGenerated=false`.
  - **Vendas**: NºDOC sequencial (`Sale.code`); status "com/sem financeiro gerado"
    (`Sale.financialGenerated`); botão Visualizar antes de editar; editar cliente e
    editar pagamento **a prazo** (split + parcelas → contas a receber); excluir/gerar
    financeiro (reversível, bloqueia se houver baixa registrada); imprimir em cupom
    térmico aprimorado ou folha A4 com dados da empresa (escolha na hora).
  - **Acerto de estoque**: histórico completo com editar (recalcula diff no estoque) e
    apagar (reverte o ajuste). Endpoints `GET/PUT/DELETE /products/stock-adjustments`.
  - **Migração aditiva** `sale_code_financial_flag` (`Sale.code SERIAL @unique`,
    `Sale.financialGenerated BOOLEAN DEFAULT true`).
  - `npm run typecheck` + `npm run build` → **0 erros**.
- ✅ **Onda 2026-06-07a — Múltiplas melhorias** (2026-06-07):
  - **PDV**: fix timezone parcelas (data 1 dia a menos corrigida, +T00:00:00); aviso de
    parcela em fim de semana; alerta de caixa do dia anterior com botão "Ir ao Caixa";
    modal de confirmação antes de finalizar venda à vista.
  - **Compras**: novo modal picker de produto (grid com filtros marca/grupo, carrega
    todos desde o início); botão "Visualizar" na lista de compras lançadas; coluna de
    status financeiro; excluir/gerar/refazer contas a pagar da compra.
  - **Dashboard**: fix divergência "Recebimentos por forma" (fallback para vendas
    legadas sem SalePayment); labels de data (DD/MM) abaixo das barras do gráfico.
  - **Caixa**: label "Resumo do **último** fechamento" com nota explicativa.
  - **Produto**: fix "Dados inválidos" (brand/group vazio enviado como `""` em vez de
    `undefined`); exibir código `#N` no card de produto.
  - **Cadastros (Pessoas)**: exibir código `#N` em cada cliente/fornecedor.
  - **Financeiro**: card adicional de Total Vencido ao lado do Saldo em Aberto.
  - **SalesPage**: fix timezone no `genInstallments` da edição de venda.
  - **Schema + migração** `20260607000000`: `Product.code SERIAL @unique` e
    `Person.code SERIAL @unique` — ambos read-only, gerados automaticamente.
  - Backend Invoice: `DELETE /api/invoices/:id/financial` e
    `POST /api/invoices/:id/financial` (excluir/refazer contas a pagar da compra);
    listagem inclui `hasFinancial` e `totalFinancial`.
  - `npm run typecheck` + `npm run build` → **0 erros**. Commit `6619330`.
- ✅ **Onda 2026-06-07b — Responsividade mobile** (2026-06-07):
  - **Causa raiz corrigida**: Layout usava `overflow-hidden/auto` aninhados com altura
    fixa — falha no iOS. Trocado para **scroll natural do documento** (padrão robusto).
  - **PDV mobile**: carrinho flui abaixo dos produtos (mostrava em branco antes);
    quantidade, preço, desconto, acréscimo e botões de pagamento agora visíveis;
    toast de confirmação acima do bottom nav.
  - **Bottom nav**: `pb-28` garante que nenhuma tela seja coberta pela barra inferior.
  - **Modais bottom-sheet**: todos os modais (Produto, Pessoa, Vendas, Financeiro,
    Compras, Caixa, Estoque) viram **bottom-sheet no celular** (sobem de baixo, largura
    total, `max-h: 92dvh`) e card centralizado no desktop — via utilitários
    `.modal-overlay` / `.modal-sheet` no `index.css`.
  - Sidebar do desktop agora é `sticky` (rola com a página ao lado do conteúdo).
  - `npm run typecheck` + `npm run build` → **0 erros**. Commit `a57d952`.
- ✅ **Onda 2026-06-06 — Redesign visual premium (AZUL + DOURADO)** (2026-06-06):
  reformulação visual completa do PWA, sem novas dependências (CSS/Tailwind avançado).
  **Identidade Exodus corrigida: paleta AZUL (brand) + DOURADO (accent/gold)** — substitui
  o roxo/rosé anterior em todo o app.
  - **Paleta** (`tailwind.config.js`): `brand` = azul royal (50→950), `accent`/`gold` =
    dourado, `ink` = azul-noite. Gradientes `brand-gradient` (azul), `gold-gradient`,
    `brand-gold` (azul→dourado, assinatura), `royal-gradient` (azul-noite hero). Sombras
    `glow-brand`/`glow-gold`/`brand-lg`/`gold-lg`. Aurora azul+dourado, `dots`, `shine`.
  - **Design system** (`index.css`): fundo com **aurora animada azul/dourado** + textura
    de **pontos**; botões azuis com **brilho dourado deslizante (sheen)**; `.btn-gold`;
    inputs com borda azul e **glow** no foco; `.card`/`.card-hover`/`.card-feature` (faixa
    dourada no topo); `.page-title` com **barra dourada**; utilitários `gradient-text`
    (azul→dourado), `gradient-text-gold`, `icon-tile`/`icon-tile-gold`, `gradient-border`,
    `badge-gold`; `prefers-reduced-motion`.
  - **Layout** (`Layout.tsx`): header glass, logo azul com **anel dourado** e nome em
    gradiente; sidebar com **indicador ativo animado**; **bottom navigation** no celular +
    **drawer "Menu"** → responsividade real (celular/tablet/desktop).
  - **Login**: painel **azul-noite dramático** com **brilho cônico girando**, orbes
    azul/dourado flutuantes, título com palavra em dourado e **cartão glass** com borda
    em gradiente.
  - **Dashboard**: KPIs em cores variadas (azul/dourado/verde), barras do gráfico em
    degradê azul→dourado. **PDV**: botões de pagamento harmonizados (a prazo dourado).
  - Favicon e `theme_color` atualizados para azul/dourado.
  - `npm run typecheck` + `npm run build` → **0 erros**.
- ✅ **Onda 2026-06-08 — Usuários, XML multi-etapas, Sugestão de compras** (2026-06-08):
  - **Gerenciamento de usuários** (Configurações > Usuários): CRUD completo de usuários
    (criar/editar/excluir); para cada operador define-se quais telas pode acessar via
    checkboxes (`allowedPages`); ADMIN sempre tem acesso total independente de `allowedPages`.
  - **Schema + migração** `20260608000000_user_allowed_pages`: `User.allowedPages JSONB`
    (null = usa padrão do papel; array = restrição personalizada para CASHIER).
  - **Backend auth**: `GET /api/auth/users`, `PUT /api/auth/users/:id`,
    `DELETE /api/auth/users/:id` (não pode excluir a si mesmo); `GET /api/auth/me`
    inclui `allowedPages`.
  - **Store auth**: `canAccess(pageKey)` substitui `adminOnly`; CASHIER padrão =
    `['pdv', 'products', 'cash', 'registrations']`; Layout filtra nav por `canAccess`.
  - **Sugestão de compras**: retorna TODOS os produtos/variantes (não só os com vendas
    na janela); filtros `brand`/`group`/`subgroup`; ordena por sugestão desc + nome.
  - **Importação XML — fluxo 3 etapas**:
    1. De/Para: modal catálogo completo (busca + filtros marca/grupo + grid de produtos)
    2. Revisão de preços: custo anterior, custo XML, preço de venda atual e campo para
       novo preço de venda por item (deixar vazio = manter).
    3. Contas a pagar: opções — duplicatas do XML, parcelamento personalizado ou sem
       financeiro.
  - **Backend invoice confirm**: aplica `newSalePrice` por item; `customInstallments`
    sobrepõe `duplicates` na geração de contas a pagar.
  - **Fix mobile**: PrintSaleModal header em 2 linhas; FinancialPage `flex-wrap`;
    PurchaseDetail modal hoistado ao nível do `PurchasesPage` (fora de `.card`).
  - `npm run typecheck` + `npm run build` → **0 erros**. Commit `86766ce`.
- ✅ **Onda 2026-06-08b — Fixes PDV mobile** (2026-06-08):
  - **Fix layout A prazo** (campo data): `grid-cols-2 sm:grid-cols-3` com campo "1º
    vencimento" ocupando `col-span-2` no mobile (linha inteira, sem sobreposição).
    Commit `b57009c`.
  - **Fix lógica: botão "Confirmar venda" bloqueado corretamente**: condição trocada de
    `aPrazoTotal <= 0` para `!lines.some(l.method === 'A_PRAZO')` — basta existir
    qualquer linha com método A_PRAZO (mesmo com valor 0) para exigir cliente cadastrado;
    `min-w-0 w-full` no input de data + `overflow-hidden` no grid impedem o campo de
    vazar fora do card no iOS/Safari. Commit `5e9b7c7`.
- ✅ **Onda 2026-06-09 — Fixes UX inputs numéricos + layout carrinho PDV** (2026-06-09):
  - **Fix inputs numéricos** (`PdvPage`, `SalesPage`, `ProductsPage`): `onFocus={(e) => e.target.select()}`
    em todos os inputs de valor unitário, custo e preço de venda — ao tocar no campo o valor é
    selecionado inteiro, evitando o bug onde digitar "30" sobre "0" resultava em "030".
    `parseFloat` substitui `Number()` no `onChange` para consistência no parser.
    Arquivos: `PdvPage.tsx` (valor unitário do carrinho), `SalesPage.tsx` (valor unitário na
    edição de venda), `ProductsPage.tsx` (custo/venda das variantes + componente `PriceField`).
  - **Fix layout carrinho PDV mobile**: valores de total grandes (ex: R$ 3.000,00) estouravam
    a div pai no mobile. Container flex recebeu `min-w-0`; grupo de controles (−/qtd/+) e
    grupo do input receberam `shrink-0`; span do total trocou `w-20` fixo por
    `min-w-0 flex-1 truncate` — absorve o espaço restante sem vazar a tela.
  - `npm run typecheck` → **0 erros**. Commit `0d1283d`.
- ✅ **Onda 2026-06-10 — Ciclo de qualidade QA: inputs numéricos BR** (2026-06-10):
  - **Fix "zero fantasma" (causa raiz)** (`PdvPage`, `SalesPage`, `ProductsPage`): migração de
    `type="number"` para `type="text"` + estado local de string (`raw`) com ref `skipSync` em
    todos os inputs de valor unitário, custo e preço. O campo pode ficar vazio ao apagar;
    o pai recebe `parseFloat || 0` a cada tecla sem round-trip que recria o "0". Novos
    componentes: `UnitPriceInput` (`PdvPage`), `EditItemPriceInput` (`SalesPage`); `NumField`
    refatorado (`ProductsPage`); inputs inline de variante substituídos por `NumField`.
    Commit `eb47ad1`.
  - **Padrão BR de vírgula decimal** (`PdvPage`, `SalesPage`, `ProductsPage`): função
    `sanitizeBr()` adicionada nos três arquivos — converte ponto em vírgula, remove caracteres
    inválidos, garante uma única vírgula, elimina zeros à esquerda. `onChange` chama
    `parseFloat(cleaned.replace(',', '.'))` para repasse ao estado numérico do pai. Inicialização
    e `useEffect` de sync usam `String(value).replace('.', ',')`. Commit `295d7c8`.
  - **Bloqueio de negativos em desconto/acréscimo** (`PdvPage` — `AdjustRow`, `SalesPage`):
    `onKeyDown` bloqueia `-` + `Math.max(0, ...)` no `onChange` como rede de segurança.
    `min="0"` já existia para as setas nativas. Commit `550eb9d`.
  - **Bloqueio de `+`, `e`, `E`** nos mesmos 4 inputs: `onKeyDown` expandido para
    `['-', '+', 'e', 'E']` — impede notação científica (`10e2`) e sinal positivo explícito.
    Commit `f802d84`.
  - **`sanitizeBr` nos campos de desconto/acréscimo** (`PdvPage` — `AdjustRow`, `SalesPage`):
    `AdjustRow` ganhou estados locais `rawAmount`/`rawPct` com `skipSync` independentes;
    ambos os inputs migrados para `type="text"`. Na `SalesPage`, os dois inputs inline
    foram substituídos pelo novo componente `FinancialAdjustInput` (mesmo padrão do
    `EditItemPriceInput`). Commit `73f2439`.
  - `npm run typecheck` → **0 erros** em todos os commits.
- ✅ **Onda 2026-06-15 — Ciclo QA: PaymentModal e ChangeCalculatorModal** (2026-06-15):
  - **Parser de condições de parcelamento** (`PaymentModal` — `PdvPage`): campo "Intervalo
    (dias)" substituído por "Condição (dias)" (`type="text"`). Aceita intervalo único (`30`)
    ou múltiplos separados por `/`, `-`, `,` ou `.` (`30/60/90`). Estado `conditionStr`
    (string) substitui `intervalDays` (number). Commit `48174e8`.
  - **Override manual de data por parcela**: estado `customDates: Record<number, string>`;
    cada parcela da lista ganha `<input type="date">` editável. `resolvedInstallments`
    aplica os overrides antes de enviar ao backend. `customDates` limpo ao alterar
    `parcels`, `conditionStr` ou `firstDue`. Commit `48174e8`.
  - **Interlock bidirecional parcelas ↔ condição**: ao digitar `30/60/90` o campo
    "Parcelas" é setado para `3` automaticamente. Ao alterar "Parcelas" manualmente
    quando `conditionStr` tem múltiplos intervalos, a string é resetada para o primeiro
    intervalo (`"30"`). Commits `dc16fd5` e `2820ce8`.
  - **Fallback matemático correto**: parcelas além dos intervalos declarados usam
    `data_anterior + último_intervalo` (e não "hoje + último intervalo"). Commit `dc16fd5`.
  - **ChangeCalculatorModal** (pagamento rápido em Dinheiro): modal de cálculo de troco
    com input blindado (`sanitizeBr` + `raw` state + `inputMode="decimal"`); campo
    "Valor recebido"; cálculo de troco em tempo real (verde se positivo); alerta
    vermelho "Valor insuficiente"; botão "Valor exato (Pular)" (bypass direto);
    botão "Confirmar venda" desabilitado com `disabled={received < total}` +
    `disabled:opacity-50 disabled:cursor-not-allowed`. Commits `84d6446` e `b234ff9`.
  - **Estado `changeConfig`** substitui `showChangeModal: boolean` — carrega
    `{ amount, onConfirm }`, desacoplando valor e callback do fluxo que os origina
    (pagamento rápido ou split). Commit `c8c4b7e`.
  - **Interceptação de Dinheiro no split pay**: quando `PaymentModal` é confirmado com
    linha `CASH`, fecha o modal de split e abre `ChangeCalculatorModal` com o valor
    exato da parcela em dinheiro; `doSale` só é chamado após confirmação do troco.
    Commit `c8c4b7e`.
  - **Trava de duplicidade no split**: `<option disabled>` quando o código já está
    selecionado em outra linha — impede duas linhas com o mesmo método. Commit `c8c4b7e`.
  - `npm run typecheck` → **0 erros** em todos os commits.
- ✅ **Onda 2026-06-17 — Motor de Impressão Dual (QA cycle)** (2026-06-17):
  - **Motor dual no PDV** (`PdvPage.tsx`): estado `printMode ('thermal'|'a4'|null)`;
    botões "🖨️ Bobina (80mm)" e "📄 Papel A4" no modal pós-venda substituem o único
    "Imprimir"; `handlePrint` usa dois timeouts aninhados (50+50ms) para medir
    `receiptRef.offsetHeight + 30px` antes de chamar `window.print()` (Dynamic
    Measurement Engine). Commits `3179ef0`→`a28dcfb`.
  - **`@page` dinâmico**: térmico → `size: 80mm <Npx medido>; margin:0`; A4 →
    `size: A4 portrait; margin:10mm`. Ambos incluem
    `* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important }`
    para preservar backgrounds (logo gradiente). Regra `@media print { body { margin:0 } }`
    colapsa margens do browser.
  - **Container off-screen**: `fixed top-[-9999px] left-[-9999px]` + `print:static`
    permite medir altura no DOM sem exibir o elemento; `overflow-hidden` evita scroll.
  - **`ThermalReceipt.tsx`**: cabeçalho profissional (nome, endereço, cidade/UF, tel)
    adicionado; root div com `w-full text-center whitespace-pre-wrap`. Wrapper no PDV:
    `w-full max-w-[80mm] font-mono text-[11px]` (reduz clipping de 42 chars monospace).
  - **Comprovante A4 reutiliza `SaleReceipt`** (`components/SaleReceipt.tsx`): mesmo
    componente da tela Vendas — cabeçalho com logo inicial + dados da empresa, tabela
    de itens, totais, bloco de pagamento, rodapé "Documento sem valor fiscal". Query
    `/api/settings/company` adicionada ao PDV.
  - **Captura do `code` real**: `doSale` agora chama `POST /api/sales` com o `clientRef`
    gerado pelo `enqueueSale` quando online → obtém `Sale.code` sequencial para o
    comprovante A4. Sync posterior detecta `DUPLICATE` — sem duplicata.
  - **`lastSale` estendido**: campos `payments`, `subtotal`, `discount`, `surcharge`,
    `clientName`, `soldAt`, `code` capturados antes do `resetSale()`.
  - `npm run typecheck` → **0 erros** em todos os commits.
- ✅ **Onda 2026-06-22a — QA de layout: modal de Produtos** (2026-06-22):
  Branch `feature/tela-produtos-caio` — **ainda não mesclada na `main`**.
  Seis commits corretivos em `ProductsPage.tsx` após testes funcionais do Comandante:
  - **`c8ba129`**: `overflow-y-auto` no corpo do form — primeiro corte do footer cortado.
  - **`81689b9`**: hierarquia flexbox definitiva: `flex-col + shrink-0` (header/footer)
    + `flex-1 min-h-0 overflow-y-auto` (corpo). `min-h-0` é a classe crítica que impede
    o flex de ignorar `max-h`.
  - **`d4a744f`**: substituição de `modal-overlay` (com `fixed inset-0 flex items-end`)
    por `grid place-items-center` inline — elimina o clip do topo em viewports pequenos.
  - **`f95c12e`**: overlay trocado de `fixed inset-0` para `absolute inset-0` com wrapper
    da página marcado como `relative` — modal passa a respeitar o header global e a
    sidebar (não usa o viewport como referência).
  - **`dc66e61`**: `min-h-[calc(100vh-5rem)]` no wrapper força altura mínima quando a
    lista de produtos está vazia (overlay `absolute` colapsava com o conteúdo).
  - **`73fceab`**: ajuste para `min-h-[calc(100vh-9rem)]` — descontando header (4rem)
    + padding do `<main>` (`sm:p-6` = 1.5rem + `md:pb-8` = 2rem) + buffer (1.5rem) para
    eliminar scrollbar global gerada pelo overshooting da versão anterior.
  `npm run typecheck` → **0 erros** em todos os commits.
- ✅ **Onda 2026-06-22b — Validação Zod dinâmica + erros por campo (Produtos)** (2026-06-22):
  Branch `feature/tela-produtos-caio` — **ainda não mesclada na `main`**. Commit `6e94f1f`.
  - **Schema dinâmico**: funções `buildProductFormSchema(brandReq, groupReq, subgroupReq,
    barcodeReq, tracksLotValidity)` e `buildVariantSchema(barcodeReq, tracksLotValidity)`
    definidas fora dos componentes — obrigatoriedade condicionada em runtime às flags
    lidas de `/api/settings/product-form`. Campos `name`, `sku`, `cost`, `salePrice`
    sempre obrigatórios; demais campos recebem `.min(1, msg)` só quando o flag está `true`.
  - **`toFieldErrors(issues)`**: helper que extrai o primeiro erro Zod por campo para
    `Record<string, string>`.
  - **`ProductForm`**: `localError: string | null` substituído por `errors: Record<string, string>`;
    `submit()` chama `schema.safeParse(...)`, popula `errors` por campo e retorna antes
    de `create.mutate()` se houver falha. Banner genérico removido (só erro de API fica).
  - **`EditProductModal`**: estados `productErrors` + `variantErrors: Record<string, Record<string, string>>`;
    nova `handleSave()` valida produto e cada variante independentemente, acumula todos
    os erros de uma só vez; `onSubmit` chama `handleSave()` em vez de `save.mutate()`.
    Inputs inline (nome/marca/grupo/subgrupo + campos de variante) convertidos para
    componente `Field` com prop `error`.
  - **`Field` e `NumField`** (componentes): nova prop `error?: string` — aplica
    `border-rose-400` no input + renderiza `<span className="text-xs text-rose-500">`
    imediatamente abaixo do campo quando presente.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-25a — Configuração global de precificação + simplificação do formulário** (2026-06-25):
  Branch `feature/tela-produtos-caio` — **ainda não mesclada na `main`**. Commit `1b001da`.
  - **`packages/shared/src/schemas/settings.ts`**: `pricingMode: z.enum(['margin', 'markup']).default('margin')`
    adicionado ao `productFormSettingsSchema` / `ProductFormSettings`.
  - **`SettingsPage.tsx`**: radio group "Modelo de precificação" na aba Produto
    (`productDefaults` atualizado; `toggle` tipado para excluir `pricingMode`).
  - **`ProductsPage.tsx` — `ProductForm`**: estados `margin`, `markup` e `lastPricingMode`
    substituídos por um único `pct`; 3 handlers simplificados; JSX com 3 colunas e
    label condicional (Margem ou Markup conforme `pricingMode`).
  - **`ProductsPage.tsx` — `EditProductModal`**: variant state sem `margin`/`markup`/
    `lastPricingMode`; `pct` derivado no render em vez de guardado no estado;
    handlers `applyVCost`, `applyVPct`, `applyVSalePrice` simplificados; query de
    settings movida para antes dos handlers para evitar TDZ.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-25b — Campo SKU e código do produto no modal Editar** (2026-06-25):
  Branch `feature/tela-produtos-caio`. Commit `e0ac24e`.
  - **Cabeçalho** do `EditProductModal`: exibe `#{product.code}` ao lado do título.
  - **Campo SKU**: adicionado ao card da variante (`Field` com `required`, `error`,
    `onChange` via `setVariants`); estado da variante inclui `sku: v.sku`; enviado
    para `PUT /api/products/variants/:id`; `varSchema.safeParse` valida `sku`.
  - **`buildVariantSchema`**: `sku: z.string().min(1, 'SKU é obrigatório')` inserido.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-25c — Correção definitiva do posicionamento do modal de Produtos** (2026-06-25):
  Branch `feature/tela-produtos-caio`. Commits `a5f1362`→`a3e6b1c` (5 commits, iteração
  diagnóstica + solução canônica).
  - **Causa raiz confirmada**: `Layout.tsx` renderiza a rota dentro de
    `<div className="...animate-fade-in">`. O keyframe `fade-in` usa
    `transform: translateY()` com `fill-mode: both` — o transform persiste como
    `translateY(0)` e cria um **CSS containing block** que capturava qualquer
    `position: fixed` descendente, ancorando o modal ao `<div>` alto (lista longa)
    em vez do viewport.
  - **Solução**: `createPortal(<div className="modal-overlay">…</div>, document.body)`
    em **ambos** `ProductForm` e `EditProductModal` — renders fora da árvore do
    `<main>`, `fixed inset-0` ancora corretamente no viewport.
  - **Limpeza**: removidos hacks `!h-[95dvh]`, `sm:!h-auto`, `!max-h-[95dvh]`,
    `sm:!max-h-[90vh]` acumulados nas iterações anteriores. Container volta a
    `modal-sheet sm:max-w-2xl flex flex-col overflow-hidden !p-0` (o `!p-0` é
    load-bearing para o padrão header/body/footer com scroll interno).
  - **Import**: `createPortal` importado de `react-dom`.
  `npm run typecheck` + `npm run build` → **0 erros**.
- ✅ **Onda 2026-06-26a — Custo Médio Ponderado (CMP) full-stack** (2026-06-26):
  Branch `feature/tela-produtos-caio`. Commit `d5a947e`.
  - **Schema Prisma**: `ProductVariant.averageCost Decimal @default(0)`.
  - **Migração**: `20260626000000_add_average_cost_to_variants` (SQL manual; aplicada
    via `prisma db push` localmente; `prisma migrate deploy` aplicará no Railway no merge).
  - **Backend `invoices.ts`** (`/confirm` e `/manual`): antes de atualizar o estoque,
    lê `stockQty` e `averageCost` atuais; fórmula CMP:
    `stock≤0 → avg=custo; senão → (stock×avg + qtd×custo)/(stock+qtd)`; salva arredondado.
  - **Shared**: `createVariantSchema` + `updateVariantSchema` aceitam `averageCost`.
  - **Backend `products.ts`**: `POST /products` persiste `averageCost` (default = `costPrice`).
  - **Frontend `ProductsPage.tsx`**: interface `Variant`, `buildVariantSchema`,
    estado das variantes, `safeParse`, `api.put` e `NumField "Custo médio (R$)"`
    adicionados em `ProductForm` (4 colunas) e `EditProductModal`.
  `npm run typecheck` + `npm run build` → **0 erros**.
- ✅ **Onda 2026-06-26b — Trava de margem 99,99% + coerção Zod** (2026-06-26):
  Branch `feature/tela-produtos-caio`. Commit `e5d8bd2`.
  - **`NumField`**: nova prop `max?: number`; se o valor parseado exceder `max`,
    é travado em `max` (estado `raw` atualizado para string BR, `onChange(max)` chamado).
  - **`ProductForm` e `EditProductModal`**: `max={pricingMode === 'margin' ? 99.99 : undefined}`
    no campo de Margem/Markup — impede fisicamente margem ≥ 100% (divisão por zero).
  - **`buildVariantSchema`**: `costPrice`, `averageCost` e `salePrice` mudados para
    `z.coerce.number().min(0).catch(0)` — campos vazios/NaN viram 0 sem erro genérico.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-26c — Config global `requireAverageCost`** (2026-06-26):
  Branch `feature/tela-produtos-caio`. Commit `c8c3df6`.
  - **Shared `settings.ts`**: `requireAverageCost: z.boolean().default(false)` no
    `productFormSettingsSchema`.
  - **`SettingsPage.tsx`**: `ToggleRow "Exigir Custo Médio"` na aba Produto.
  - **`ProductsPage.tsx`**: `buildProductFormSchema` e `buildVariantSchema` recebem
    `requireAverageCost`; regra `z.coerce.number().refine(val => !req || val > 0)`;
    `NumField "Custo médio"` com `required={requireAverageCost}` (asterisco dinâmico)
    e `error={errors.averageCost}`.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-26d — Fix sanitização de payload (brand/group vazios)** (2026-06-26):
  Branch `feature/tela-produtos-caio`. Commit `53167fa`.
  - **`EditProductModal.save.mutate`**: `brand: brand || undefined` e
    `group: group || undefined` (era enviado como `""`, reprovado pelo Zod `.min(1)` do
    backend com 400 Bad Request). `undefined` é descartado pelo JSON.stringify; Prisma
    não toca no campo. `subgroup || null` permanece correto (schema usa `.nullish()`).
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-26e — Ordenação de produtos (full-stack)** (2026-06-26):
  Branch `feature/tela-produtos-caio`. Commit `092c60b`.
  - **Shared `product.ts`**: `listProductsQuerySchema` (estende `paginationQuery` com
    filtros + `orderBy: z.enum(['code','sku','name','price']).default('name')` e
    `orderDir: z.enum(['asc','desc']).default('asc')`).
  - **`routes/products.ts`**: substitui schema local pelo compartilhado; `name`/`code`
    → `Prisma.ProductOrderByWithRelationInput` direta; `sku`/`price` → ordenação em
    memória pós-fetch (`[...rawItems].sort()`), pois Prisma 5 não expõe `_min` no tipo
    `ProductVariantOrderByRelationAggregateInput`.
  - **`ProductsPage.tsx`**: estados `orderBy`/`orderDir` no `queryKey` e na URL;
    dois `<select className="input">` no painel de filtros (grid `lg:grid-cols-5`).
  `npm run typecheck` → **0 erros**.

- ✅ **Onda 2026-06-30a — Fix modais de Caixa (React Portal)** (2026-06-30):
  Branch `feature/tela-produtos-caio`. Commit `e05e95c`.
  - **`CashPage.tsx`**: componente `Modal` compartilhado (usado por `TransactionModal`
    e `CloseModal` — Sangria/Suprimento/Fechamento) envolvido em
    `createPortal(..., document.body)`. Mesma causa raiz da tela de Produtos: o
    `animate-fade-in` do `Layout.tsx` cria um containing block que capturava o
    `position: fixed` do backdrop, cortando-o pelo container da lista. Um único
    ponto de correção resolveu os três modais de uma vez.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-06-30b — Impressão do Relatório de Fechamento de Caixa** (2026-06-30):
  Branch `feature/tela-produtos-caio`. 4 commits (`e8cfa35`→`1c3d25a`), ciclo
  iterativo de correção guiado por testes reais de impressão do Comandante.
  - **`e8cfa35`**: componente `CashReceipt.tsx` (mesma estética do `ThermalReceipt`)
    + `CashPrintButton` em `CashPage.tsx` (reutilizado no caixa aberto e no
    histórico), reaproveitando o Dynamic Measurement Engine do PDV
    (`scrollHeight`/`offsetHeight` + `@page` dinâmico).
  - **`ca5ebde`**: refinamento de centralização/corte — `w-[80mm] max-w-[80mm]`
    fixo nos componentes de recibo, `scrollHeight + 15px` de sobra para a
    guilhotina, `#print-end-anchor`; tentativa de centralizar via
    `body { display:flex; justify-content:center }` — **quebrou** por conflitar
    com `.thermal-receipt { position:absolute }` do `index.css`.
  - **`0cb8f1b`**: **revertido** — Chrome travava (crash no print preview) ao
    combinar `overflow:hidden` forçado em `html,body` com `@page` de tamanho
    customizado; `.thermal-receipt` restaurado a `position:absolute !important`
    (papel e div têm exatamente 80mm — o absolute ancora no topo ignorando o
    "lixo" invisível de ancestrais com `visibility:hidden`, que escondem mas
    mantêm o espaço ocupado).
  - **`1c3d25a`** (**solução definitiva**): causa raiz do "3 páginas em branco"
    identificada — o app shell (`#root`) ficava com `visibility:hidden` mas
    **mantinha a altura física**, forçando o Chrome a criar folhas extras para
    cobrir essa altura fantasma. Fix: `createPortal(..., document.body)` com
    `id="thermal-print-root"`/`id="a4-print-root"` dedicados + CSS de impressão
    `body > *:not(#id) { display: none !important }` — remove fisicamente o
    resto do app do DOM impresso (não só esconde), eliminando a altura fantasma.
  `npm run typecheck` + `npm run build` → **0 erros** em todos os commits.
- ✅ **Onda 2026-06-30c/07-01 — Relatório Periódico de Caixa (Extrato Consolidado)**
  (2026-06-30 a 2026-07-01): Branch `feature/tela-produtos-caio`. 4 commits
  (`231db1d`→`052b010`), incluindo 3 correções de regra de negócio pós-validação.
  - **`231db1d`** (implementação inicial): `GET /api/cash/report` (RBAC igual ao
    `/registers`); `movements` (timeline unificada vendas+manuais de todos os
    caixas do período) e `summary` (totais por forma via `SalePayment`,
    suprimentos, sangrias, `cashInDrawer`). Frontend: terceira aba "Relatório"
    (`PeriodicReport`), seletor de período (padrão = mês corrente, datas em
    horário local via `localISODate`), cards de resumo + timeline consolidada.
  - **`2c28231`** (fix data + fundo inicial): `endDate` cortava à meia-noite
    (`setHours` em horário **local** sobre um `Date` de meia-noite **UTC**
    zerava o relatório do dia corrente e "escondia" o caixa aberto — não era
    filtro de status, a query nunca filtrou por `status`); trocado para
    `setUTCHours` (correção **incompleta**, ver próximo commit); adicionado
    `totalInitialCash` (soma do fundo inicial de todos os caixas do período) à
    equação da gaveta.
  - **`4a986f0`** (fix definitivo de timezone): `setUTCHours` ainda fechava o
    período às 23:59:59 **UTC** = 20:59:59 **local** (servidor roda em UTC,
    loja em UTC-3/Brasília) — uma venda às 23:50 local (gravada como 02:50 UTC
    do dia seguinte) sumia do relatório. Fix: fronteiras reconstruídas com
    offset **`-03:00` explícito** (`` `${dateStr}T00:00:00.000-03:00` `` /
    `` `${dateStr}T23:59:59.999-03:00` ``), imune ao timezone do processo.
  - **`052b010`** (fix contábil): `cashInDrawer` não debitava o fechamento de
    caixa — fechar significa recolher o dinheiro físico para o cofre/banco.
    Adicionado `totalCollected` (soma do `finalCash` dos caixas `CLOSED`);
    equação final: `totalInitialCash + vendas em dinheiro + totalSupply -
    totalBleed - totalCollected`. Novo card "Fechamentos (Recolhido)" no
    frontend para transparência total.
  `npm run typecheck` + `npm run build` → **0 erros** em todos os commits.
- ✅ **Onda 2026-07-02 — Acerto de estoque: busca com Enter + tipo de movimentação** (2026-07-02):
  Branch `feature/estoque-tipo-movimentacao` (Helom) — **mesclada na `main` via PR #5**
  (2026-07-03).
  - **Busca por Enter** (`StockAdjustPage.tsx` — `ProductSearch`): a busca de produto
    deixa de disparar a cada tecla; novo estado `searchTerm` só é setado no `onKeyDown`
    (Enter). Campo vazio + Enter lista todos os produtos (busca vazia já suportada
    pela API).
  - **Seletor "Tipo de movimentação"** (`Balanço/Inventário` [padrão] · `Entrada` ·
    `Saída`) adicionado antes do campo de quantidade, com visual do design system
    (azul/dourado). Label do campo de quantidade muda conforme o tipo.
  - **Regra de cálculo**: `computedNewQuantity` — Balanço usa o valor digitado como
    contagem final (comportamento antigo); Entrada soma `+quantidade` ao estoque
    atual; Saída subtrai `-quantidade`. O resultado é enviado como `newQuantity` para
    `POST /api/products/adjust-stock` (endpoint inalterado).
  - Validado na tela pelo usuário.
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-07-02 — Cadastros: modal padrão ouro, máscaras, campos PF/PJ e
  busca onisciente** (2026-07-02): Branch `feature/tela-produtos-caio`.
  8 commits (`f4bf849`→`72479ac`) — **mesclados na `main`** via PR #3/#4.
  - **`f4bf849`** (padronização visual): `PersonForm` (`RegistrationsPage.tsx`)
    refeito para reusar a casca exata do modal de Produtos/Caixa —
    `createPortal(..., document.body)`, `<form>` com `modal-sheet ... !p-0`,
    header (ícone `Users`/`Truck` + título + subtítulo + X) e rodapé fixo
    (`btn-ghost`/`btn-primary`); grid `grid-cols-1 sm:grid-cols-2` (antes
    `grid-cols-2` fixo, sem colapsar no mobile); erro de salvamento migrado de
    `window.alert` para banner inline. Preservada a busca de CNPJ/CEP existente.
  - **`0fc3a00`** (máscaras): novo `apps/web/src/lib/masks.ts` (sem
    dependências) — `maskCpfCnpj`, `maskPhone`, `maskCep`, aplicadas no
    `onChange` dos campos correspondentes.
  - **`28d2bdc`** (fix preenchimento programático): os lookups de CNPJ/CEP não
    disparam `onChange`, então telefone/CEP chegavam crus na tela após a
    busca — corrigido aplicando as mesmas funções de máscara diretamente no
    `setForm` dos handlers de lookup.
  - **`b32f4fb`** (campos dinâmicos PF/PJ): `Person.tradeName String?` (schema +
    migração `20260702000000_add_person_trade_name`); `isPJ =
    document.replace(/\D/g,'').length > 11` alterna o label do nome
    ("Razão Social"/"Nome Completo") e exibe um 2º campo ("Nome Fantasia"/
    "Apelido"); fix do bug de e-mail no lookup de CNPJ (`f.email || data.email`
    nunca reavaliava o lado direito — trocado para `data.email || f.email`).
  - **`7e8e102`** (troca de motor CNPJ): BrasilAPI bloqueia/sanitiza o campo
    `email` por proteção anti-spam (sempre `null`) — trocado para **ReceitaWS**
    (payload completo); tratamento do caso `status: 'ERROR'` (a ReceitaWS
    responde HTTP 200 mesmo em erro).
  - **`acc4d86`** (proxy CORS): ReceitaWS bloqueia fetch direto do browser
    (sem `Access-Control-Allow-Origin`) — chamada movida para
    `GET /api/persons/cnpj/:cnpj` (autenticada), que faz o proxy server-side
    (Node não sofre CORS) e já converte `status: 'ERROR'` em
    `AppError(400, ...)` no padrão `{ statusCode, code, message }` do
    error-handler global.
  - **`1618b4f`** (ordenação + UX): `<select>` de ordenação (nome/código/cidade,
    crescente/decrescente, client-side via `useMemo`); botão flutuante
    "voltar ao topo" (`fixed bottom-6 left-6`, aparece após `scrollY > 300`);
    documento/telefone exibidos com máscara nos cards da listagem.
  - **`72479ac`** (busca onisciente): a busca só filtrava `name`/`document`
    **no backend** — cidade e telefone nunca entravam nessa query. Fix: lista
    completa buscada uma vez por tipo (sem depender do termo na `queryKey`) e
    filtrada 100% no cliente (nome, nome fantasia/apelido, documento com/sem
    máscara, cidade, telefone) — digitação mais responsiva, sem round-trip por
    tecla.
  `npm run typecheck` + `npm run build` → **0 erros** em todos os commits.
  **Pendências da tela sinalizadas pelo Comandante, ainda não detalhadas** —
  ver §12.15.

- ✅ **Onda 2026-07-03 — Refinamento UI/UX Cadastros (Scroll-to-top)**: Botão
  "Voltar ao Topo" refatorado com Dark Glassmorphism e animação drop-down
  fluida (gatilho reduzido para 50px). Correção crítica de CSS Hijacking
  (ancoragem `absolute` indevida causada pelo `animate-fade-in`) resolvida
  ejetando o botão via `createPortal(..., document.body)`, garantindo
  ancoragem `fixed` perfeita ao viewport. Branch `feature/refinamento-cadastros`
  (commits `670e9a1`→`a7ac204`) — **mesclada na `main` via PR #5** (2026-07-03).
  `npm run typecheck` + `npm run build` → **0 erros**.
- ✅ **Onda 2026-07-03 — Refinamento de Vendas (Padrão Ouro + Mini-PDV + Cliente
  Padrão)** (2026-07-03): Branch `feature/refinamento-vendas` — **ainda não
  mesclada na `main`**. 7 commits (`82c98f7`→`6508dbf`).
  - **`82c98f7`** (padrão ouro): `ViewSaleModal` reestruturado com a casca
    header/body/footer (`createPortal`, `modal-sheet ... !p-0`) idêntica a
    Produtos/Caixa/Cadastros; título+data+`FinancialBadge` no header, itens/
    pagamento/contas a receber no body com scroll interno, ações no footer.
  - **`e1e7033`** (fix stacking context): `PrintSaleModal` e `EditSaleModal`
    também ejetados via `createPortal(..., document.body)` — só o
    `ViewSaleModal` tinha sido corrigido antes, então Imprimir/Editar abertos
    a partir da Visualização apareciam **atrás** dela (o portal do
    `ViewSaleModal`, ao final do DOM, sempre vencia o stacking dos modais
    ainda presos no containing block do `animate-fade-in`).
  - **`4293438`** (Cliente Padrão full-stack): `salesSettingsSchema`
    (`defaultPersonId`) no shared; `GET/PUT /api/settings/sales` (o GET já
    resolve o `Person` — `{id,name,tradeName}` — para o front não precisar
    de round-trip extra); nova aba "Vendas" em Configurações com seletor de
    cliente; PDV pré-seleciona o cliente padrão (`useEffect` + ref-guard,
    aplica uma vez) e `resetSale()` volta a ele em vez de `null`;
    `EditSaleModal` usa `salesSettings.defaultPersonId` como fallback do
    `clientId` no submit e mostra o padrão no placeholder da busca.
  - **`16378c7`** (Mini-PDV): `EditSaleModal` alargado para `sm:max-w-5xl
    h-[90dvh]`, body em grid de duas colunas (`lg:grid-cols-3`) — carrinho
    (cliente + busca de produto + itens com +/−/preço/remover) à esquerda,
    card "Resumo da venda" (`sticky`) à direita. Nenhuma lógica de itens
    mudou (já existia); só o layout. `productId` **não** é enviado no
    payload — o `saleItemSchema` do backend só aceita `{variantId, quantity,
    unitPrice}` e o `SaleDetail` não expõe id de produto; `variantId` já
    determina o produto univocamente.
  - **`7d8d6b0`** (fix sincronização): a query `['sale', saleId]` destruturava
    só `{ isLoading }`, descartando `data` — o carrinho era populado via
    efeito colateral **dentro do `queryFn`**, com uma variável `sale` local
    invisível ao resto do componente (daí o título sem código e o risco de
    o carrinho abrir vazio em cache-hit, já que essa `queryKey` é
    compartilhada com o `ViewSaleModal`, que usa um `queryFn` sem efeitos).
    Corrigido com `useEffect` reagindo a `sale` (guardado por
    `items.length === 0`, inicializa uma única vez) e queryFn puro.
  - **`68194d0`** (regra de negócio): venda com `financialGenerated: true`
    não pode mais ser editada — botão "Editar" do `ViewSaleModal` desabilitado
    (`title` explicando o motivo) e guarda de segurança dentro do
    `EditSaleModal` (`if (sale?.financialGenerated)`) que troca o corpo do
    modal por um aviso de acesso negado (`ShieldAlert`) com só um botão
    "Fechar". *Não há botão de editar na tabela principal de vendas* — só
    Visualizar/Excluir; o único ponto de entrada para editar é o footer do
    `ViewSaleModal`, já coberto.
  - **`6508dbf`** (fluxo de finalização maduro): `ChangeCalculatorModal`
    extraído de `PdvPage.tsx` para `components/ChangeCalculatorModal.tsx`
    (exportado, com `brl`/`round2`/`sanitizeBr` próprios) e reaproveitado no
    `EditSaleModal` — `handleSaveClick()` abre a calculadora de troco quando
    `paymentMethod === 'CASH'`, senão pede `window.confirm`, só então chama
    `executeSave()` (antigo `submit()`).
  `npm run typecheck` + `npm run build` → **0 erros** em todos os commits.

- ✅ **Onda 2026-07-03b — Fix "zero fantasma" no input de Compras** (2026-07-03):
  Branch `feature/refinamento-compras` — **ainda não mesclada na `main`**.
  - **`PurchasesPage.tsx`** (aba Sugestão de compra): input "Tempo de reposição
    (dias)" ganhou `onFocus={(e) => e.target.select()}` (seleciona o valor
    inteiro ao focar, mesmo padrão já aplicado em PDV/Vendas/Produtos) e
    `onChange` sanitizado com `replace(/^0+(?=\d)/, '')` — remove zeros à
    esquerda antes de converter para número, evitando o acúmulo tipo "011".
  `npm run typecheck` → **0 erros**.
- ✅ **Onda 2026-07-03c — Hook `useSearchHandler` (padronização "Enter = Buscar")**
  (2026-07-03): Branch `feature/hook-busca-enter` — **ainda não mesclada na
  `main`**.
  - **Novo hook** `apps/web/src/hooks/useSearchHandler.ts`: `useSearchHandler(onSearch:
    (term: string) => void)` retorna `{ onKeyDown }` — em qualquer Enter (com texto
    ou vazio) dispara `onSearch` com o valor atual do input (trim), lido direto de
    `e.currentTarget.value`. Segue as convenções de `useBarcodeScanner.ts` (função
    nomeada exportada, JSDoc em português).
  - **Levantamento prévio** (agente Explore) mapeou ~15 inputs de busca no app;
    quase todos já buscam corretamente com campo vazio (backend retorna tudo sem
    `search`). A única inconsistência real: dois pickers de autocomplete com gate
    de tamanho mínimo (`enabled: term.length >= 2`) — digitar, apagar tudo e dar
    Enter não fazia nada, porque a query nunca rodava abaixo de 2 caracteres.
  - **`SalesPage.tsx`** (busca de produto no `EditSaleModal`/Mini-PDV): novo estado
    `hasSearched`; gate vira `enabled: search.trim().length >= 2 || hasSearched`
    (mesma condição no dropdown); `onKeyDown` do hook seta `hasSearched(true)`;
    resetado para `false` em `addVariant` (junto com `setSearch('')` já existente).
  - **`PurchasesPage.tsx`** (busca de fornecedor no `ManualPurchase`): mesmo padrão
    — `hasSearchedSupplier`, gate `(supplierName.trim().length >= 2 ||
    hasSearchedSupplier) && !supplierId`, resetado ao selecionar um fornecedor.
  - **`StockAdjustPage.tsx`** (cleanup, zero mudança de comportamento): o
    `onKeyDown` inline da `ProductSearch` (que já implementava manualmente o
    padrão Enter-busca) foi substituído por `useSearchHandler(setSearchTerm)` —
    elimina a implementação duplicada do mesmo conceito.
  - **Fora do escopo** (decisão consciente, ver plano): `ProductsPage.tsx`,
    `PdvPage.tsx`, `FinancialPage.tsx`, `RegistrationsPage.tsx`,
    `SettingsPage.tsx`, `XmlImport.tsx` — todos já buscam certo com campo vazio,
    sem gate de tamanho mínimo bloqueando; não precisam do hook.
  `npm run typecheck` + `npm run build` → **0 erros**.

- ✅ **Onda 2026-07-03d — Drag-and-drop de XML + padronização visual de cabeçalhos**
  (2026-07-03): Branch `feature/xml-import-visual` — **ainda não mesclada na
  `main`**. 2 commits (`0999cbd`, `3e42163`).
  - **`0999cbd` (fix + upgrade do upload de XML — `XmlImport.tsx`)**: a área de
    upload só tinha um `<input type="file">` escondido — **arrastar o XML fazia o
    navegador abrir o arquivo numa aba** (comportamento padrão de drop sem
    handler), derrubando o app. Correções: (1) `handleFile` refatorado em
    `processFile(file)` compartilhado entre clique e drop; (2) `onDragOver`/
    `onDragLeave`/`onDrop` na zona de upload com estado `dragOver`; (3) **guarda
    global** `window.addEventListener('dragover'/'drop', preventDefault)` no
    mount do componente — soltar o arquivo fora da zona não navega mais para o
    XML; (4) validação de extensão/MIME `.xml` com mensagem de erro amigável;
    (5) visual premium: `card-feature`, zona com gradiente azul→branco, ao
    arrastar vira borda dourada sólida + `shadow-glow-gold` + `scale-[1.02]`,
    tile do ícone alterna azul→dourado (`icon-tile-gold` + `animate-pop`),
    spinner `Loader2` no processamento, chips `badge-brand`/`badge-gold`,
    `StepBadge` com anel dourado na etapa ativa.
  - **`3e42163` (cabeçalhos premium em todas as telas)**: Produtos (`Package`),
    Compras (`ShoppingCart`), Vendas (`Receipt`), Financeiro (`Landmark`),
    Cadastros (`Users`), Caixa (`Wallet`) e PDV (`ScanBarcode`) ganham o tile
    de ícone em gradiente azul do padrão Dashboard/Estoque/Configurações
    (`h-11 w-11 rounded-xl bg-brand-gradient shadow-brand`). **Caixa**: status
    cru `OPEN`/`CLOSED` traduzido para "Aberto"/"Fechado" (helper
    `statusLabel`) nos 3 pontos que exibiam o valor bruto; ponto verde do card
    hero agora pulsa (`animate-pulse`).
  `npm run typecheck` + `npm run build` → **0 erros** em todos os commits.

- ✅ **Onda 2026-07-07/08 — Refinamento de PDV/Vendas (Padrão Ouro, filtros,
  paginação, impressão unificada)** (2026-07-07 a 2026-07-08): Branch
  `refinamento-pdv` (mesclada em `refinamento-vendas` via PR #9, commit
  `199f3b1`) + `refinamento-vendas` — **enviada ao GitHub, pronta para PR/
  merge, ainda não mesclada na `main`**. 8 commits (`acb7f3c`→`faa3616`).
  - **`acb7f3c`** (Padrão Ouro nos overlays do PDV): `ChangeCalculatorModal`,
    `PaymentModal` (split), `ClientSearchOverlay`, o modal de confirmação rápida
    e o modal pós-venda passam todos a usar `createPortal(..., document.body)`
    + casca header/body/footer — mesma causa raiz do `animate-fade-in`
    documentada em Produtos/Caixa/Cadastros/Vendas corrigida também no PDV.
  - **`3733cc5`** (grade de produtos no mobile): `max-h-[45vh] overflow-y-auto`
    (± 3 linhas visíveis) + `lg:max-h-none lg:overflow-visible` no grid de
    produtos do PDV — antes o Carrinho ficava fora da dobra em listas longas.
  - **`2495d6b`** (código no card de produto): pílula de marca vazia (`badge-brand`
    sem `p.brand`) substituída por `#{p.code}` — sempre presente, nunca vazio.
  - **`26b56f5`** (Filtros Avançados em Vendas): painel expansível com busca
    (NºDOC/cliente, ignora `#`), forma de pagamento, faixa de valor, financeiro,
    desconto, acréscimo — combinados via `useMemo`, 100% client-side.
  - **`be5e9f6`** (Paginação em Vendas): `currentPage`/`itemsPerPage` (padrão
    Tray — 10/25/50/100), reset ao mudar filtro, rodapé com Anterior/Próximo.
  - **`9e1311a`**+**`b5453e9`** (Voltar ao topo em Vendas): mesmo padrão de
    Cadastros; posição corrigida para `right-4 bottom-24 md:bottom-8
    md:right-8` (cobria a bottom nav no mobile com `bottom-8` fixo).
  - **`902d2e9`** (extração do `PrintReceiptModal.tsx`): a impressão de Vendas
    usava `window.print()` puro (`printReceipt()`) sobre o modal on-screen —
    sem `@page` dinâmico nem remoção dos irmãos do DOM, gerava página em
    branco. Motor off-screen do PDV extraído para `components/
    PrintReceiptModal.tsx` (compartilhável); `PrintSaleModal` (`SalesPage.tsx`)
    virou só a ponte de dados.
  - **`fix(sales): align receipt printing with pdv`** (fix de paridade):
    comparação direta PDV × Vendas revelou que a bobina do PDV
    usava `components/ThermalReceipt.tsx` — componente **separado** de
    `SaleReceipt`, com endereço/telefone **hardcoded** ("Rua Principal, 123",
    "Montes Claros - MG") em vez dos dados reais de `/api/settings/company`
    (que o PDV já buscava, mas só repassava para o A4). `ThermalReceipt.tsx`
    **removido** (código morto); PDV migrado para `<SaleReceipt format="thermal">`
    — mesmo componente que o A4 e que Vendas já usavam — via um objeto
    `receiptData: SaleReceiptData` único reaproveitado no preview on-screen e
    nos dois portais off-screen. `SaleReceiptData` ganhou `notes?: string |
    null`, renderizado em `ThermalSaleReceipt` e `A4SaleReceipt`
    (`SaleReceipt.tsx`) — nem PDV nem Vendas imprimiam a observação da venda
    antes. Fallback de cliente sem nome trocado de "Balcão" para "Consumidor
    Final" **somente no comprovante impresso** (as telas do app continuam
    usando "Balcão"). Resultado: bobina e A4 agora são **byte-idênticos** entre
    PDV e Vendas — mesmo componente, mesmos dados, mesmo motor de impressão.
  - **`fix(receipts): show company contact information`** (dados da empresa
    incompletos): a unificação anterior deixou passar um gap no `CompanyInfo`
    (`SaleReceipt.tsx`) — a interface **não tinha campo `email`** e o telefone/
    endereço/documento eram renderizados por condicionais soltas e repetidas
    em cada formato. Reconhecimento confirmou no `companyProfileSchema`
    (`packages/shared/src/schemas/settings.ts`) e em `SettingsPage.tsx`
    (`CompanyCard`) que "Configurações → Empresa" só tem **5 campos**: `name`,
    `document`, `phone`, `email`, `address` (endereço é texto livre único —
    **não existe** `city`/`state`/`uf` separados). `CompanyInfo` ganhou
    `email?: string`; novo helper `companyInfoLines(company)` monta a lista
    filtrada (documento → endereço → telefone → e-mail, cada um só se
    preenchido) e é chamado **pelos dois formatos** — cupom térmico stacka
    uma linha por item, A4 usa o mesmo array com estilo próprio. Nenhuma
    mudança foi necessária em `PrintReceiptModal.tsx`/`PdvPage.tsx`/
    `SalesPage.tsx`: os três já repassavam o objeto `company` completo da
    query `/api/settings/company` — o dado sempre chegou até `SaleReceipt`,
    só não era exibido por faltar no tipo/render.
  - **`fix(receipts): load company settings in print modal`** (o preview
    continuava só com "Exodus Cosméticos" mesmo após o fix anterior):
    diagnóstico em runtime obrigatório — nada de leitura estática. Confirmado
    por consulta direta ao Postgres local (`prisma.setting.findMany()`) que a
    tabela `Setting` **não tinha nenhuma linha `company_profile`**; só
    existiam `product_form` e `sales`. `GET /api/settings/company` (curl com
    login real) confirmou o comportamento correto do backend:
    `companyProfileSchema.parse(setting?.value ?? {})` cai nos `.default('')`
    e devolve `{name:"",document:"",phone:"",email:"",address:""}` — **não
    era bug de código**, a empresa nunca tinha sido salva em Configurações →
    Empresa neste ambiente local. `companyInfoLines()` corretamente não
    renderiza nada além do nome-fallback quando todos os campos vêm vazios
    (comportamento por design, não falha). As queryKeys já eram consistentes
    em todo o app (`['settings', 'company']` em `SettingsPage.tsx`,
    `PdvPage.tsx`, `CashPage.tsx`, `SalesPage.tsx` — confirmado via grep,
    incluindo a `invalidateQueries` pós-save). Mesmo assim, endurecido por
    pedido explícito: **`PrintReceiptModal.tsx` agora busca `/api/settings/company`
    internamente** (mesma queryKey, cache compartilhado com quem já buscava —
    sem chamada duplicada) como fonte da verdade própria; a prop `company`
    recebida do chamador (`SalesPage`) vira só o fallback usado enquanto essa
    query interna ainda não resolveu (`companyFromApi ?? companyFallback`).
    Botão "Imprimir" desabilitado + rótulo "Carregando dados da empresa..."
    enquanto a query está em voo. `PdvPage.tsx` não tinha o mesmo risco (já
    busca `company` diretamente, sem um modal intermediário orientado a
    prop) — nenhuma mudança lá. **Dado de teste gravado no Postgres local**
    (`company_profile`: "Empresa Teste Runtime", CNPJ/telefone/e-mail/endereço
    fictícios claramente identificáveis) só para desbloquear a verificação
    visual do Comandante — substituir pelos dados reais em Configurações →
    Empresa.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em
  todos os commits.

- ✅ **Onda 2026-07-09 — Refinamento de Compras (QA + Padrão Ouro + Mini-PDV)**
  (2026-07-09): Branch `refinamento-compras` (criada a partir da `main` pós-merge de
  `refinamento-vendas` via PR #10, em `8458271`) — **mesclada na `main` via PR #11**
  (`4049233`). 15 commits (`4a7f8e3`→`d9394fa`), incluindo os já registrados de
  estabilização de UI/UX do XML/picker de produto e o ciclo de dívida técnica abaixo:
  - **`b4b17ab`** (blindagem do CMP): mission alegava que `/confirm`/`/manual`
    sobrescreviam o custo médio com o custo da nota — **premissa falsa**, comprovada
    via round-trip real contra o Postgres local (variante teste stock=100/avg=10 →
    `/manual` qty=50 custo=16 → avg=12 exato; `/confirm` qty=50 custo=20 → avg=14
    exato). Como não havia bug mas a fórmula estava **duplicada** entre as duas rotas
    (risco real de regressão futura), extraída para `apps/api/src/lib/inventory.ts`
    (`calcWeightedAverageCost`), única fonte de verdade agora usada por `/confirm`,
    `/manual` e pela edição completa.
  - **`8684586`** (fix nº de documento no XML): `Invoice.documentNumber` é `Int?` sem
    default no banco — `/manual` sempre calculava `aggregate max+1` antes de criar a
    nota, mas `/confirm` nunca fazia isso, deixando toda compra vinda de XML com
    `documentNumber: null` (coluna "Doc." mostrava "—"). Fix: mesma lógica de
    sequenciamento replicada dentro da transação do `/confirm`. Validado com chamada
    real ao endpoint (nota criada recebeu `documentNumber: 6`, sequenciado
    corretamente com as notas existentes).
  - **`cc91fd6`** (fix nome do produto no De/Para automático): item do XML já resolvido
    via `SupplierProductMapping` mostrava o `xProd` (nome do fornecedor) em vez do
    nome cadastrado no ERP — `/invoices/parse` só retornava o `matchedVariantId` (um
    UUID), e o frontend (`XmlImport.tsx`) forjava `productName: it.description` (o
    próprio `xProd`) para preencher a caixa verde. Fix: `/parse` agora resolve
    `ProductVariant` + `Product` para todos os IDs auto-mapeados e retorna
    `matchedVariant` completo (nome, SKU, preços); frontend consome o dado real em vez
    de inventar um. Validado com XML de teste (`xProd` ≠ nome do catálogo na resposta).
  - **`0a67a85`** (filtros avançados em "Compras lançadas"): painel expansível
    (nº de documento — ignora `#` —, fornecedor, data exata, faixa de valor, status do
    financeiro), 100% client-side via `useMemo`, espelhando exatamente o padrão já
    usado em Vendas (`SalesPage.tsx`).
  - **`d9394fa`** (Padrão Ouro + Mini-PDV de Compras): `PurchaseDetail` (modal antigo,
    fora do padrão portal) virou **`ViewPurchaseModal`** (`createPortal`, casca
    header/body/footer) — corrige também o bug **"Invalid Date"** nas parcelas
    financeiras (`new Date(a.dueDate + 'T00:00:00')` concatenava sufixo de hora num
    ISO **já completo**, gerando string inválida; novo helper `fmtDate()` detecta se a
    string já tem `'T'` antes de concatenar). Novo **`EditPurchaseModal`**
    (`sm:max-w-5xl`, mesma arquitetura de `EditSaleModal`): reaproveita
    `ManualPurchaseItemRow`/`ProductSearch`/`PurchaseFinancialEngine` já existentes;
    bloqueado com tela "Acesso Negado" se alguma parcela já tiver sido baixada.
    Backend `PUT /api/invoices/:id` upgradado: sem `items` no body, só edita metadados
    (comportamento anterior); **com `items`**, dispara edição completa numa única
    transação — estorna o estoque físico da nota antiga (`StockMovement OUT reason
    'INVOICE_EDIT'`, mesma simplificação já aceita no `DELETE`: não tenta reverter o
    CMP, só o saldo físico), remove itens/financeiro antigos, recalcula o CMP dos
    novos itens (`calcWeightedAverageCost`) e recria as contas a pagar — espelha
    `updateSale` (`services/sales.ts`). Validado com round-trip real: compra criada
    (variante A stock=50/avg=10, item qty=10 custo=12 → avg=10,33), editada trocando
    fornecedor + item para uma variante B (stock=20/avg=5, qty=5 custo=8) — variante A
    voltou a stock=50 (estorno), variante B foi a stock=25/avg=5,6 (CMP correto),
    financeiro antigo (2 parcelas) substituído por 1 nova parcela; e o guard testado
    de verdade (baixa registrada numa parcela → `PUT` com `items` retornou 422 com a
    mensagem de bloqueio).
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em todos os
  commits.

- ✅ **Onda 2026-07-10 — Fechamento tático de Compras (trava de edição, paginação,
  UX e Nº NF/Data de Entrada)** (2026-07-09 a 2026-07-10): Branch
  `feature/bloqueio-edicao-compras` (criada a partir da `main` pós-merge da
  `refinamento-compras`) — **enviada ao GitHub, pronta para PR/merge**. 6 commits
  (`33fd0c0`→`eff63de`).
  - **`33fd0c0`** (trava de edição com financeiro ativo): guard do `ViewPurchaseModal`
    (botão Editar) e do `EditPurchaseModal` trocado de `hasPaid` (só parcela já
    baixada) para `hasFinancial` (qualquer conta a pagar vinculada) — simetria exata
    com `Sale.financialGenerated`/`EditSaleModal`; força o operador a excluir o
    financeiro na visualização antes de editar a compra.
  - **`3f4233b`** (paginação + scroll-to-top em Compras Lançadas): mesmo motor de
    `SalesPage.tsx` (`currentPage`/`itemsPerPage`, rodapé Anterior/Próximo,
    `ScrollToTopButton` via `createPortal`).
  - **`92805cb`** (paginação na Sugestão de Compra): a aba (antes inline em
    `PurchasesPage()`) virou o componente próprio `PurchaseSuggestion` — mesmo
    padrão arquitetural dos irmãos `ManualPurchase`/`PurchasesList`/`XmlImport`;
    `suggestions` memoizado (`useMemo`) para o `useEffect` de reset de página não
    disparar a cada clique em "Próximo".
  - **`db396aa`** (código/marca do produto + scroll-to-top na Sugestão): backend
    (`purchase-suggestions.ts`) passou a retornar `productCode` (`variant.product.code`
    — `brand` já vinha, só não tinha essa formatação); célula da tabela exibe
    `#{productCode} - {productName}` + `badge-brand` para a marca. Reaproveitado o
    `ScrollToTopButton` já existente no arquivo (decisão de manter consistência visual
    entre as abas da mesma página, em vez do variant "Dark Glassmorphism" do
    Cadastros).
  - **`e670aba`** (UX da média diária): `0.37` cru virou `0,37 un/dia` (vírgula BR +
    sufixo, zero exato sem casas decimais) + `title` explicativo por célula.
  - **`eff63de`** (Nº NF + Data de Entrada na grade): `Invoice.nfeNumber String?`
    (schema + migração aditiva `20260710011551_add_invoice_nfe_number`); `nfe-parser.ts`
    extrai `ide.nNF`; `/invoices/parse` retorna e `/invoices/confirm` persiste
    `nfeNumber` (nulo em compra manual). Grade de Compras Lançadas ganhou colunas
    "Nº NF" e "Entrada" (`entryDate`), e "Data" foi renomeada para "Emissão"
    (`issueDate`) — `entryDate` já era salvo corretamente em ambas as rotas antes
    desta onda (só não era exibido). Validado com round-trip real (XML de teste com
    `<nNF>456</nNF>` → `/parse` → `/confirm` → `GET /invoices`, todos os campos
    conferidos). Regeneração do Prisma Client exigiu encerrar e reiniciar o
    `dev:api` local (mesmo bug de lock de DLL do Windows já documentado nesta
    doc) — confirmado com o Comandante antes de encerrar o processo.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em todos os
  commits.

- ✅ **Onda 2026-07-10 — Financeiro completo (filtros/ordenação/Padrão Ouro/
  integração com Caixa) + blindagens transversais (Vendas/Compras/PDV/Produtos/
  Estoque/recibos)** (2026-07-10): Branches `feature/bloqueio-edicao-compras`
  (continuação) e `feature/refinamento-financeiro` — **mescladas na `main` via
  PR #13** (`3a38eea`). 15 commits (`4f54d54`→`5e22f81`).
  - **`4f54d54`** (rastreabilidade financeira): descrições de parcelas geradas
    por Vendas/Compras passaram a incluir o código de origem —
    `services/sales.ts` (`createSale`/`updateSale`) e `routes/invoices.ts`
    (5 pontos de geração: `/confirm` custom/duplicatas, `/manual`, refazer
    financeiro, edição completa) — `"Venda a prazo X/Y"` virou `"Venda #{code} -
    Parcela X/Y"`, `"NF ... - parcela X/Y"` virou `"Compra #{documentNumber} -
    Parcela X/Y"`. Validado com round-trip real (venda a prazo criada e
    editada, compra manual, refazer financeiro e edição completa de compra —
    todas as 5 rotas conferidas).
  - **`9372c62`** (filtros de status + ordenação no Financeiro): novo
    `listFinancialQuerySchema` (não existia — a rota montava o querystring
    inline) com `orderBy`/`orderDir`/`statusFilter` semântico (OPEN/OVERDUE/
    NOT_OVERDUE/PARTIAL/PAID/ALL); "hoje" calculado com offset `-03:00`
    explícito (mesmo raciocínio de `cash.ts`). Validado com 4 títulos de teste
    cobrindo todos os cenários de status/vencimento.
  - **`cc500cf`** (paginação no Financeiro): seletor "Linhas por página" +
    Anterior/Próximo (`PAGE_SIZE` fixo virou estado `pageSize`).
  - **`41c0215`** / **`3e834bc`** (Padrão Ouro nos modais de lançamento):
    `NewEntryModal` e `SettleModal` migrados do wrapper `<Modal>` (sem portal)
    para `createPortal` + header/body/footer estritos; input "Valor a baixar"
    blindado (`type="text"` + `sanitizeBr`, era `type="number"` com steppers).
  - **`5ce8a24`** (integração Financeiro↔Caixa): `/financial/:id/settle` e
    `/reverse` passaram a exigir um `CashRegister` `OPEN` do operador
    (`req.user.sub`) e criar uma `CashTransaction` de compensação na mesma
    transação (RECEIVABLE→SUPPLY / PAYABLE→BLEED na baixa; inverso no
    estorno), descrição `"Baixa: {desc}"`/`"Estorno de Baixa: {desc}"`.
    Validado com round-trip real: caixa fechado bloqueia com 400, reaberto
    processa corretamente ambos os fluxos (recebível e pagável), valores e
    tipos de `CashTransaction` conferidos byte a byte no banco.
  - **`2568477`** (blindagem do Caixa contra alteração de origem sistêmica):
    `PUT/DELETE /cash/transactions/:id` bloqueiam movimentações cuja descrição
    comece com `"Baixa:"`/`"Estorno"` — excluí-las pelo Caixa deletava a
    `CashTransaction` sem reabrir o título no Financeiro, quebrando a
    conciliação. **Achado**: a missão original pedia checar `transaction.saleId`,
    mas `CashTransaction` não tem esse campo (vendas são um model `Sale`
    separado, nunca teria `id` resolvido nessa tabela) — incluir o campo
    quebraria o `typecheck`; removido da trava, mantida só a checagem por
    prefixo de descrição (a proteção real).
  - **`dfe88ee`** (filtro de período + ordenação em Vendas): `startDate`/
    `endDate` + `sortField`(code/date/items)/`sortDir`, incorporados ao mesmo
    `SalesFilterValues` já existente.
  - **`8f96425`** (ordenação em Compras Lançadas + fix de rótulo): mesmo padrão
    de Vendas (`sortField`: doc/NF/emissão/entrada/valor/itens); "Data da
    compra" renomeado para "Data de emissão" (ambiguidade com "Data de Entrada").
  - **`58b93b7`** (trava de navegação no PDV): `beforeunload` nativo +
    interceptação de clique em `<a href>` em fase de captura no `document`.
    **Achado**: `useBlocker` do react-router-dom exige um "data router"
    (`createBrowserRouter`/`RouterProvider`); o app usa `<BrowserRouter>`
    clássico — migrar o roteamento inteiro para desbloquear um hook estava fora
    do escopo, então a interceptação de clique é o equivalente funcional.
  - **`c01c959`** (paginação real em Produtos): o backend já paginava de
    verdade (`skip`/`take` + `total`) mas o front pedia sempre `pageSize=100`
    fixo; conectado a estados reais + botão "Voltar ao topo". Validado com
    chamadas reais à API (`page=1`/`page=2`, itens distintos e corretamente
    fatiados).
  - **`6a129bf`** (fix Enter mobile na busca de Estoque): input de busca
    envolvido em `<form onSubmit>` (`type="search"` + `enterKeyHint="search"`);
    correção adicional necessária: botões de resultado ganharam `type="button"`
    explícito (sem isso, clicar num resultado também re-disparava a submissão
    do formulário, já que `<button>` sem `type` é `submit` por padrão dentro
    de um `<form>`).
  - **`1157ad8`** (paginação no histórico de acertos): client-side (o backend
    retorna até 200 registros de uma vez, sem `page`/`pageSize`).
  - **`b595f50`** (código sequencial nos acertos de estoque): `StockMovement.code
    Int?` (migração aditiva `20260710041311_add_code_to_stock_adjustments`),
    calculado manualmente via `aggregate max+1` escopado a `type='ADJUST'` —
    um autoincrement de banco simples numeraria todos os tipos de movimento
    juntos (vendas, notas, acertos), não uma sequência limpa só de acertos como
    o `#1, #2` pedido. Validado com 2 acertos reais consecutivos → `code: 1` e
    `code: 2`.
  - **`5e22f81`** (blindagem de impressão mobile): **Achado crítico** — a missão
    pedia integrar Web Share API + geração de PDF via blob/`html2canvas`, mas o
    projeto **não tem nenhuma lib de PDF nem usa Blob/`navigator.share`/
    `window.open`** em lugar nenhum; o motor real é `window.print()` nativo com
    Dynamic Measurement Engine (mede altura off-screen, injeta `@page`, remove
    fisicamente o app do DOM impresso). Implementar o pedido literal exigiria um
    rewrite arquitetural (e `html2canvas` rasterizaria na largura do viewport
    mobile, *causando* o esmagamento que a missão queria corrigir) — não
    executado; fica como decisão de produto em aberto (ver §12). Em vez disso,
    corrigido o bug real: container off-screen do A4 (`PdvPage.tsx` e
    `PrintReceiptModal.tsx`) era `w-full` (largura do viewport no celular,
    esmagando a folha 210mm via `maxWidth:100%` do template antes do `@page`
    escalar) — ancorado em `w-[210mm]` fixo; térmico ganhou `minWidth:300px`
    como blindagem extra; botões de imprimir (PDV e `PrintReceiptModal`) ficam
    `disabled` durante a janela assíncrona de impressão.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em todos os
  commits.

- ⬜ **Testes automatizados (unit/integration)**: ainda não há suíte (ver §12/§13).

- ✅➜❌ **Onda 2026-07-10b — PDF via html2canvas/jsPDF + Web Share API: implementado,
  iterado e revertido** (2026-07-10): Branch `feature/melhoria-impressao`. Commits
  `a3b66b8` (implementação), `ca259b5`→`3a02074` (3 rodadas de correção
  mobile/desktop) e o commit de reversão total logo abaixo. **Decisão de produto
  revertida pelo Comandante — ver §12 item 16.**
  - **Implementação inicial**: o Comandante pediu explicitamente (mudança tática,
    não premissa falsa) um botão "Compartilhar" que gera o recibo como PDF em
    background (`jsPDF` + `html2canvas`, importados dinamicamente/code-split) e
    aciona a Web Share API nativa (`navigator.share`, fallback para download em
    desktop/sem suporte). Novo `lib/receiptPdf.ts` (host off-screen com largura
    fixa em px, captura via `html2canvas`, `jsPDF` monta o PDF final) + botões em
    `PdvPage.tsx` (modal pós-venda) e `SalesPage.tsx` (grade, `ShareSaleWorker`
    invisível reaproveitando `buildSaleReceiptData`).
  - **3 rodadas de correção mobile/desktop** (relatos sucessivos do Comandante de
    layout quebrado/espremido/colunas sumindo): (1) `position:fixed`→`absolute`
    no host + `scrollX/scrollY/x/y: 0` no `html2canvas` (quirk documentado de
    captura cortada em mobile Safari/Chrome com elementos `fixed` fora da tela);
    (2) prop `widthPx` opt-in em `SaleReceipt.tsx` (só usada pela captura,
    preservando o preview on-screen e o `window.print()` físico) trocando a
    largura do A4 de `210mm` para `800px` puro — unidades físicas (mm) são fonte
    documentada de erro no motor de layout interno do `html2canvas`, separado do
    motor nativo do browser — + `flex-nowrap` explícito em todas as linhas
    header/tabela/totais/pagamento; (3) `document.fonts.ready` + delay de 500ms
    antes da captura (hipótese de corrida de timing, já que o bug passou a ser
    relatado também no desktop, não só mobile).
  - **Reversão total** (ordem explícita do Comandante, mesmo dia): apesar das 3
    rodadas de correção com causas plausíveis e bem fundamentadas (cada uma
    endereçando um quirk real e documentado do `html2canvas`), o Comandante
    determinou que a abordagem inteira é incompatível com o Dynamic Measurement
    Engine do projeto e reverteu para o motor nativo. Removidos: `lib/receiptPdf.ts`,
    dependências `jspdf`/`html2canvas` (`npm uninstall`), botão "Compartilhar" (PDV
    e Vendas), `ShareSaleWorker`, estado `sharing`/`sharingId`. `SaleReceipt.tsx`
    restaurado ao estado fluido original (sem `widthPx`, sem `flex-nowrap`
    injetado). Bundle do PWA voltou de ~1.51MB para ~747KB de precache (chunks
    `html2canvas`/`jspdf` eliminados). Botão "Papel A4" do PDV renomeado para
    "📄 Imprimir / Salvar PDF (A4)" — o próprio spooler de impressão nativo do
    Android/iOS já oferece "Salvar como PDF"/"Compartilhar" via `window.print()`,
    sem necessidade de reimplementar isso no frontend.
  `npm run typecheck` + `npm run build` (web) → **0 erros** em todos os commits,
  incluindo o de reversão.

- ✅ **Onda 2026-07-10c — Blindagem CSS estática do motor de impressão nativo
  (Android)** (2026-07-10): Branch `fix/android-print-blank-page` (criada a partir
  da `main` pós-merge da PR #14, só com este commit) — **mesclada via PR #15**
  (`6c39ec6`). Commit `6401ea7`. Com o compartilhamento de PDF revertido, o
  Comandante reportou o sintoma original de novo: impressão em branco no Android
  (bobina e A4), funcionando normalmente em iOS/Desktop.
  - **Hipótese**: o spooler de impressão do WebView Android falha ao processar
    overrides de visibilidade/posicionamento injetados tarde no ciclo de render —
    tanto via classe Tailwind no JSX quanto via `<style>` React montado
    dinamicamente pouco antes de `window.print()`.
  - **PdvPage.tsx/CashPage.tsx**: classes `fixed top-[-9999px] left-[-9999px]`
    removidas do JSX dos roots `#thermal-print-root`/`#a4-print-root` (mantidas só
    as classes de layout interno — `w-full`/`w-[210mm]`). **PrintReceiptModal.tsx**:
    mesmo tratamento no root `#sale-receipt-print-root`.
  - **`index.css`**: bloco `@media screen { #id {...} }` estático (visibilidade na
    tela) + bloco `@media print { ... }` estático (libera altura/scroll do
    `html`/`body`/`#root`, remove fisicamente os irmãos do root ativo via
    `display:none`, força o root para o topo) — cobrindo os 3 ids reais em uso.
    `<style>` inline em cada arquivo reduzido a conter só a regra `@page`
    (dinâmica, depende da altura medida em runtime).
  - Timeout final antes de `window.print()` aumentado de 50ms para 300ms nos 3
    arquivos, para dar mais margem ao WebView processar a injeção do portal.
  - `npm run typecheck` + `npm run build` (web) → **0 erros**.
  - **Resultado**: não resolveu — ver Onda 2026-07-11 abaixo. A causa raiz não
    era CSS/timing, mas o próprio `window.print()` rodando sobre o documento
    principal de uma SPA dentro do WebView.

- ✅ **Onda 2026-07-11 — Motor de impressão migrado para iframe isolado
  (Android WebView)** (2026-07-11): Branch `fix/android-print-iframe-engine`
  (criada a partir da `main` pós-merge da PR #15) — **mesclada via PR #16**
  (`76b38c9`). Commit `d190a2c`. A blindagem CSS da onda anterior não resolveu a
  página em branco no Android — diagnóstico revisado: bug arquitetural conhecido
  do WebView do Android ao rodar `window.print()` diretamente sobre o documento
  de uma SPA complexa, independente de CSS/timing.
  - **Solução — Impressão via Iframe Isolado** (padrão consolidado da indústria
    para este cenário): novo `lib/iframePrint.ts` (`printElementViaIframe(rootId,
    pageStyle)`) — cria um `<iframe>` invisível (`position:fixed; right:0;
    bottom:0; width:0; height:0`), clona todo `<style>`/`<link rel="stylesheet">`
    do documento principal + o `innerHTML` do root medido para dentro do
    `iframeDoc` via `write()`, injeta o `pageStyle` (`@page`) recebido como
    argumento, e chama `.contentWindow.print()` **do iframe**, não mais
    `window.print()` do documento principal. Delay de 300ms após `onload` antes
    de imprimir + 500ms após imprimir antes de remover o iframe (compensa o
    WebView do Android não ser confiavelmente síncrono em `print()`).
  - Extraído como helper único (não triplicado) — `PdvPage.tsx`,
    `PrintReceiptModal.tsx` e `CashPage.tsx` (`CashPrintButton`) mantêm a etapa de
    medição da altura off-screen inalterada (ainda precisam do portal renderizado
    para ler `scrollHeight`), só a etapa final trocou.
  - **Simplificação decorrente**: como o documento principal nunca mais entra em
    modo de impressão, os listeners de `afterprint` em `window` (que nunca mais
    disparariam) e o estado `receiptHeight` (só existia para atualizar um
    `<style>` de `@page` no documento principal via re-render) foram removidos —
    `pageStyle` agora é uma string local passada direto como argumento.
  - **`index.css`**: os dois blocos `@media print` que escondiam o app principal
    — o legado por `visibility` (`.print-area`/`.thermal-receipt`) e o por `id`/
    `display:none` da onda anterior — removidos por completo (código morto: o
    documento principal nunca mais é impresso). Mantido só o `@media screen` que
    mantém os roots off-screen invisíveis na tela durante a renderização/medição.
  - `npm run typecheck` + `npm run build` (web) → **0 erros**.
  - **Pendente de validação em tablet Android real** (ver §12 item 10) — as duas
    ondas anteriores (§11 Onda 2026-07-10c e a blindagem de largura fixa do A4 em
    Onda 2026-07-10, item `5e22f81`) também pareciam corretas na análise de código
    e só falharam ao testar de fato no dispositivo; tratar esta correção como
    **não confirmada** até teste real.

- ✅ **Onda 2026-07-12 — Correções pontuais de segurança/UX** (2026-07-12): três
  branches curtas, cada uma a partir da `main` (não empilhadas), mescladas via PRs
  #17/#18/#19.
  - **`fix/email-client-validation-gap`** (PR #17, `1eb5f05`) — commit `e7a419d`.
    **Achado**: a missão pedia adicionar `z.string().trim().toLowerCase().email(...)`
    em `loginSchema`/`createUserSchema`/`updateUserSchema`, mas os três **já**
    usavam exatamente essa cadeia (confirmado com teste real: `"usuario@provedor"`
    já era rejeitado). O único gap real era client-side: `UserFormModal.submit()`
    (`SettingsPage.tsx`) fazia uma pré-checagem fraca (`!email.includes('@')`) que
    deixaria esse mesmo e-mail passar na validação local antes de ser barrado pela
    API com um erro genérico. Corrigido reaproveitando
    `createUserSchema.shape.email.safeParse(...)` em vez de duplicar a regra.
  - **`fix/remove-demo-login-button`** (PR #18, `445a4a6`) — commit `ac37484`.
    Removidos o botão "Toque para preencher o acesso demo" e a função `fillDemo`
    de `LoginPage.tsx` — sistema em produção com cliente real, credenciais
    expostas na tela de login viraram risco de segurança.
  - **`refactor/settings-user-modal-gold-standard`** (PR #19, `092e528`) — commit
    `cda3daf`. `UserFormModal` padronizado pro Padrão Ouro (`createPortal` +
    header/body/footer rígidos) — mesma causa raiz do `animate-fade-in` já
    documentada em Produtos/Vendas/Cadastros/Caixa/Financeiro. Classes `dark:`
    sugeridas pela missão **não aplicadas** — o projeto não tem nenhuma
    infraestrutura de dark mode (zero ocorrências em todo o codebase); seguido o
    padrão real já usado por `NewEntryModal` (`FinancialPage.tsx`).
  `npm run typecheck` + `npm run build` → **0 erros** em todos os commits.

- ✅ **Onda 2026-07-12/13 — RBAC de Vendas, rastreabilidade de Caixa e Custo de
  Aquisição Real (Landed Cost) em Compras** (2026-07-12 a 2026-07-13): branch
  `feature/refinamento-sistema` — **mesclada via PR #20** (`f18a5fe`). 6 commits.
  - **`2ac5b4a`** (rastreabilidade no Caixa): `RegisterMovements.tsx` mostrava
    vendas na timeline como genérico "Venda · Dinheiro". **Achado**: o backend
    (`/cash/:id/movements`) já enviava `code` (NºDOC) desde a onda de Relatório
    Periódico — o gap era só esse componente específico nunca usar o campo
    (a aba "Relatório Periódico", componente separado, já fazia certo). Corrigido
    para `Venda #{code} · {forma}`, sem nenhuma mudança de backend.
  - **`98cf8fc`** (IDOR real em Vendas): `GET /api/sales` e `GET /api/sales/:id`
    não tinham filtro algum por papel/dono — qualquer `CASHIER` chamando a API
    diretamente via HTTP enxergava/acessava todas as vendas da loja (a tela
    `/vendas` só bloqueava no frontend). Adicionado `userFilter` condicional na
    listagem e checagem de posse pós-fetch (403) no detalhe. **Testado ao vivo**:
    CASHIER foi de ver 48 vendas para 0 (não tem nenhuma própria); 403 ao tentar
    abrir uma venda específica do ADMIN.
  - **`7ded77c`** (Landed Cost — fundação): `Invoice.freight`/`otherExpenses`
    (migração `20260713021023_add_invoice_expenses`); `apportionLandedCost`
    (rateio proporcional ao valor de cada item) centralizado em
    `apps/api/src/lib/inventory.ts` inicialmente, aplicado em `/confirm`,
    `/manual` e na edição completa — `InvoiceItem.unitCost` continua guardando
    o valor original do documento; o custo rateado só atualiza
    `costPrice`/`averageCost` do produto. `totalAmount` passou a ser recalculado
    de forma uniforme (`produtos + frete + despesas`) nas três rotas, inclusive
    `/confirm` — decisão deliberada de sobrescrever o `vNF` bruto do XML por uma
    fórmula única e auditável (sistema é gerencial, não fiscal). **Testado ao
    vivo**: compra manual com 2 itens + frete + despesas gerou `totalAmount` e
    custos rateados exatamente como calculado à mão.
  - **`9bcc95a`** (Compra Manual → wizard de 2 etapas): **Achado de UX real**
    (não premissa falsa) — a tela original deixava o operador definir "Novo
    Preço Venda"/Margem na mesma etapa onde ainda editava Custo Base/Frete/
    Despesas, invalidando a margem informada assim que o rateio mudava.
    `ManualPurchase` virou `step` (1|2): Etapa 1 sem colunas de preço
    (`ManualPurchaseItemRow` ganhou prop `showPricing`, default `true` —
    `EditPurchaseModal` não foi tocado); Etapa 2 (`RepricingRow`, novo
    componente) com grid Custo Antigo/Custo Novo Rateado/Preço Venda Antigo/
    Novo/Margem-Markup sobre o custo já rateado. `apportionLandedCost` **movido**
    de `apps/api/src/lib/inventory.ts` para `packages/shared/src/pricing.ts`
    (mesmo arquivo de `priceFromMargin`/`markupFromPrice`) — o frontend passou a
    precisar da fórmula pra prévia da Etapa 2, então virou fonte única
    compartilhada em vez de duplicada.
  - **`b4609d0`** (cadastro in-line de produto no XML): **Achados de premissa**
    — não existe `confirmXmlImportSchema`/`PurchaseItems` (é
    `confirmInvoiceSchema`/`InvoiceItem`); `Product.brand`/`group`/`subgroup` são
    strings livres sem tabelas próprias (não há `brandId`/`groupId`/`subgroupId`
    — "Select" virou o mesmo padrão de autocomplete texto-livre `SmartFilterInput`
    já usado em `ProductPickerModal`); não existe hook `useSettings` (reaproveitado
    o `useQuery(['settings','product-form'])` já presente no arquivo). Item do XML
    sem De/Para ganhou link "Ou cadastrar como novo produto" → `NewProductInlineForm`
    (Nome/SKU/Código de barras pré-preenchidos do XML, Marca/Grupo/Subgrupo com
    sugestão, obrigatoriedade dinâmica das Configurações). Backend: `/confirm`
    resolve o `variantId` de cada item **antes** de criar a `Invoice` — itens com
    `newProductData` criam Produto+Variante **dentro da mesma transação**
    (`tx.product.create`), usando o custo já rateado como custo inicial; se algo
    falhar depois, nem a nota nem o produto pela metade ficam salvos.
    `confirmInvoiceItemSchema.variantId` virou opcional, pareado com
    `newProductData` opcional (`superRefine`: exatamente um dos dois, e
    `newSalePrice` obrigatório para produto novo — não há "preço atual" pra
    manter). **Testado ao vivo**: `POST /confirm` com um item `newProductData`
    (frete+despesas rateados) criou produto/variante com
    `costPrice=averageCost=28,75` exatamente como calculado à mão; as duas
    validações de guarda (falta de preço, `variantId`+`newProductData` juntos)
    rejeitaram com 400.
  - **`5b3f5dd`** (frete/despesas editáveis também no XML): Etapa 1 do XML
    ganhou os mesmos inputs de Frete/Outras Despesas da Compra Manual
    (`NumInput`, pré-preenchidos com `vFrete`/`vOutro` do XML, editáveis para
    refletir frete "por fora"/FOB); "Total da nota" no cabeçalho virou dinâmico
    (`produtos + frete + despesas`, não mais o `vNF` estático). Etapa 2 passou a
    recalcular o rateio **no cliente** (`landedCosts`, `useMemo` sobre
    `apportionLandedCost` compartilhado) a partir do estado editável, em vez de
    confiar no `apportionedUnitCost` que vinha congelado de `/parse` — esse
    campo virou código morto e foi **removido** (schema, tipo do frontend, e o
    cálculo em `/parse`) em vez de deixado para trás sem uso.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em todos
  os commits.

---

## 12. Pendências, bloqueios e dívidas técnicas

1. ~~**[BLOQUEIO] Docker não instalado**~~ **RESOLVIDO (2026-06-02)**.
2. ~~**Deploy Railway não configurado**~~ **RESOLVIDO (2026-06-03)**: sistema em produção em https://exodus-web-production.up.railway.app.
3. **`npm audit`**: 3 vulnerabilidades reportadas (1 moderada, 2 críticas) em deps transitivas — revisar antes de escalar.
4. **Sem testes automatizados** (Vitest/Supertest) — apenas smoke test manual.
5. ~~**BrasilAPI** ainda não integrada no formulário de fornecedor~~ **RESOLVIDO
   (2026-07-02)**: CEP via BrasilAPI (endereço completo) + CNPJ via ReceitaWS
   (proxeada pelo backend, ver §5 Cadastros).
6. **Cadastro de produto** cria 1 variante por vez (multi-variante a fazer) —
   ainda vale para a tela de Produtos; o cadastro in-line na importação de XML
   (2026-07-13, ver §5 Compras/§11) cobre só o caso pontual de item sem De/Para
   durante a importação, sempre 1 variante, não substitui essa pendência.
7. ~~**Pagamento único por venda**~~ **RESOLVIDO** (PDV-B): split de pagamento + "A prazo".
8. **Estoque pode ficar negativo** em vendas offline (decisão consciente). Avaliar política de bloqueio/alerta.
9. **JWT sem refresh token** e sem revogação (expira em 12h).
10. **Recibo/impressão no Android — ainda não confirmada em dispositivo real**:
    motor migrado para impressão via iframe isolado (`lib/iframePrint.ts`, ver
    Onda 2026-07-11 em §11), depois de uma blindagem CSS estática (Onda
    2026-07-10c) não ter resolvido a página em branco relatada pelo Comandante no
    Android. **Nenhuma das correções desta sequência foi validada em tablet
    Android real ainda** — só análise de código/typecheck/build. Testar bobina e
    A4 no tablet do balcão antes de considerar esta pendência encerrada; se o
    iframe também falhar, o próximo suspeito é o próprio driver/spooler de
    impressão do fabricante do tablet, não mais o código do app.
11. **Ícones PWA** usam um único SVG (sem PNGs 192/512 dedicados).
12. ~~**Tela de Suprimento/Sangria** usa `window.prompt()`~~ **RESOLVIDO** (Onda Caixa): modal próprio com observação.
13. **Tipos de recebimento customizados** são tratados como "à vista não-dinheiro": o backend reconhece apenas os códigos literais `CASH` (entra no `expectedCash`) e `A_PRAZO` (gera parcelas). Um tipo novo com kind CASH/A_PRAZO não teria esse comportamento especial — por isso a tela de Configurações só permite adicionar tipos `OTHER` (os 5 base são fixos quanto a code/kind).
14. ~~**Edição de venda** simplifica o pagamento para forma única~~ **RESOLVIDO (2026-06-05)**: edição agora aceita "a prazo" com parcelas; split de formas múltiplas segue sendo reaberto somente na criação (excluir e refazer para split).
15. **Tela de Cadastros (`/cadastros`)**: o Comandante sinalizou que ainda há
    pontos pendentes de refinamento nesta tela, **ainda não detalhados/
    especificados**. Retomar com ele antes da próxima onda de Cadastros para
    levantar o escopo exato (possíveis candidatos a confirmar: paginação para
    bases grandes de clientes/fornecedores — hoje busca até 100 registros por
    tipo sem paginação; edição de fornecedor com múltiplos contatos; outros
    itens ainda não relatados).
16. ~~**Geração de PDF real + Web Share API para o recibo (mobile)**~~ **TENTADO
    E REVERTIDO (2026-07-10)**: implementado (`jspdf`+`html2canvas`, ver Onda
    2026-07-10b em §11), passou por 3 rodadas de correção de layout
    mobile/desktop, e foi **revertido por ordem explícita do Comandante** — a
    abordagem via captura de canvas (`html2canvas`) é considerada incompatível
    com o Dynamic Measurement Engine nativo do projeto (`window.print()` +
    `@page` dinâmico). Decisão final: **não usar `html2canvas`/geração de PDF via
    blob para o recibo** — o motor de impressão nativo já entrega "Salvar como
    PDF"/"Compartilhar" através do próprio spooler do SO (Android/iOS) quando o
    usuário chama `window.print()`, sem depender de rasterização client-side.
    Botão do PDV renomeado para "📄 Imprimir / Salvar PDF (A4)" para deixar essa
    rota explícita ao operador. Não reabrir sem alinhamento novo do Comandante.

---

## 13. Pedidos de avaliação (para o Gemini)

Gostaríamos de análise crítica especialmente sobre:

1. **Estratégia offline-first**: a fila Dexie + idempotência por `clientRef` é
   robusta o suficiente? Riscos de divergência de estoque ao sincronizar várias
   vendas offline simultâneas de caixas diferentes?
2. **Modelo de dados**: a introdução de `StockMovement` e `SupplierProductMapping`
   está adequada? Falta alguma entidade para um ERP de varejo (ex.: devoluções,
   transferências, promoções, múltiplos depósitos)?
3. **Política de estoque negativo** (§12.7): manter, bloquear ou alertar?
4. **Segurança**: pontos de atenção no fluxo JWT/RBAC; necessidade de refresh
   token; rate limiting; sanitização do parser de XML (XXE/entidades externas).
5. **Precificação**: as fórmulas de margem (sobre venda) e markup (sobre custo) em
   `pricing.ts` estão corretas e completas para o varejo de cosméticos?
6. **Sugestão de compra** (§4.6): o algoritmo (média simples × lead time) é
   suficiente, ou recomendaria sazonalidade/estoque de segurança/curva ABC?
7. **Arquitetura geral**: o monorepo e a separação `shared` estão saudáveis para
   escalar? Sugestões de testes prioritários.

---

## 14. Próximos passos sugeridos (ordem proposta)

> **Backlog de funcionalidades pedido pelos sócios: 100% concluído.** Os itens
> abaixo são de **maturidade/robustez**, não solicitados ainda.

1. **Suíte de testes**: Vitest (unit em `pricing`/`nfe-parser` + vendas split/a prazo
   + financeiro baixa/estorno) e integração das rotas. **Prioridade alta** dado o tamanho.
2. **Validar em produção** os fluxos novos (venda a prazo→contas a receber, baixa
   parcial, dashboard, tipos de recebimento customizados).
3. Integração BrasilAPI no cadastro de fornecedor (autocomplete de CNPJ — §4.2).
4. Cadastro multi-variante de produto (formulário dinâmico de variantes).
5. Tela de **devoluções** de venda (estorno de itens com `StockMovement`).
6. Endurecer segurança: refresh token, rate limiting, validação XXE no parser XML.
7. Resolver `npm audit` (3 vulnerabilidades em deps transitivas).

---

## 15. Deploy no Railway (monolito) — ATIVO

**URL de produção:** https://exodus-web-production.up.railway.app

**Credenciais de acesso:** admin@exodus.local / admin12345 · caixa@exodus.local / caixa12345

**Estrutura Railway (conta helomramos40@gmail.com, projeto `exodus-software`):**
- Serviço `exodus-web`: build via `Dockerfile`, healthcheck `/health`, variáveis `JWT_SECRET` e `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
- Banco `Postgres` gerenciado pelo Railway.
- `PORT` é injetada automaticamente; `HOST`, `NODE_ENV`, `WEB_DIST` vêm do Dockerfile.
- O CMD roda `prisma migrate deploy` antes de `node dist/server.js` → migrações aplicadas automaticamente a cada deploy.

**Deploy = AUTOMÁTICO (2026-06-04):** o serviço `exodus-web` está **vinculado ao GitHub**
com **auto-deploy na branch `main`**. **Todo `git push` para `main` dispara build + deploy
em produção** e aplica as migrações pendentes. ⚠️ Por isso: **só fazer push de código
validado** (`npm run typecheck` e `npm run build` antes). Não há mais deploy manual via
`railway up`.

**⚠️ IMPORTANTE:** o projeto `soothing-strength` (sistema de sobrancelhas) está na mesma conta e **JAMAIS deve ser tocado**.

**Custo:** Railway não tem tier gratuito permanente. O monolito (1 serviço + 1 Postgres) minimiza os serviços faturados.

---

> **Lembrete de manutenção:** ao concluir qualquer tarefa, atualize §5, §11 e §12
> e a data no topo. Este arquivo é a fonte de verdade do progresso.
