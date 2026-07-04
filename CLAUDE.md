# CLAUDE.md — Painel de Progresso do Projeto Exodus Software

> **Para a IA (Claude):** este é o documento-fonte do estado do projeto. **Leia-o
> integralmente antes de qualquer implementação** e **atualize-o ao final de cada
> entrega** (seções "Estado atual", "Validações" e "Pendências"). Arquivos
> `CLAUDE.md` são carregados automaticamente como contexto pelo Claude Code.
>
> **Para o avaliador externo (Gemini):** este documento descreve o que já foi
> construído, as decisões tomadas e os pontos onde queremos sua análise. As
> perguntas direcionadas estão na seção **§13 — Pedidos de avaliação**.

- **Última atualização:** 2026-07-03
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
  instrução explícita. Branch ativa no momento: **`feature/refinamento-vendas`**
  (commits `82c98f7`→`6508dbf` — ainda não mesclada; ver §11).
  ✅ **Divergência anterior resolvida (2026-07-03)**: as três branches em
  paralelo (`feature/tela-produtos-caio`, `feature/estoque-tipo-movimentacao`
  e `feature/refinamento-cadastros`), incluindo os marcadores de conflito
  Git não resolvidos que haviam ficado no `CLAUDE.md` da `main`, foram todas
  reconciliadas e mescladas via PR #5. `main` e `origin/main` estão em
  sincronia em `2992176`.
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
- ✅ **Entrada de XML/NFe** (§4.3): `/invoices/parse`, `/invoices/confirm`,
  `/invoices/mappings`; **`/invoices/manual`** (compra multi-produto: nº de documento
  sequencial, novo preço de venda por item, lote por item, contas a pagar parceladas);
  **`GET/PUT/DELETE /invoices/:id`** (detalhe/editar/excluir com estorno de estoque).
- ✅ **Vendas**: `/sales` e `/sales/sync` (lote offline) com **idempotência por
  `clientRef`**; **split de pagamento** (tabela `SalePayment`) e **"A prazo"** (gera
  contas a receber); **`PUT/DELETE /sales/:id`** (editar/excluir com estorno de estoque
  + remoção do financeiro vinculado); desconto/acréscimo/observação por venda;
  **`Sale.code` sequencial (NºDOC)**; **`Sale.financialGenerated`** (excluir/gerar
  financeiro: `DELETE/POST /sales/:id/financial`); edição agora suporta split/"a
  prazo" (parcelas → contas a receber); `GET /sales/:id` inclui `payments` e
  `financialAccounts`.
- ✅ **Caixa**: abrir, sangria/suprimento, fechar; `/current` com `expectedCash`
  (somado por `SalePayment` em dinheiro); **`/cash/registers`** (histórico),
  **`/cash/:id/movements`** (timeline vendas+manuais), **`PUT/DELETE /cash/transactions/:id`**
  (só com caixa aberto); **`/summary`** por forma — **só ADMIN**.
  **`GET /cash/report`** (Relatório Periódico/Extrato Consolidado): recebe
  `startDate`/`endDate`, RBAC igual ao `/registers` (ADMIN vê a loja toda,
  operador só os próprios caixas); fronteiras de data ancoradas em **UTC-3
  explícito** (`T00:00:00.000-03:00` / `T23:59:59.999-03:00` — servidor roda em
  UTC, então `setUTCHours`/`setHours` puros cortavam movimentos noturnos locais);
  inclui caixas `OPEN` e `CLOSED` (sem filtro de status); `summary.cashInDrawer`
  = `totalInitialCash + vendas em dinheiro + totalSupply - totalBleed -
  totalCollected` (`totalCollected` = soma do `finalCash` dos caixas já
  fechados — dinheiro recolhido sai da gaveta).
- ✅ **Financeiro**: listar com **filtros** (tipo, status, pessoa, período, busca);
  `/installments` (N parcelas, fornecedor/cliente obrigatório); **`/:id/settle`** (baixa
  parcial/total, grava em `AccountSettlement`) e **`/:id/reverse`** (estorno da última
  baixa); `PUT/DELETE` bloqueados por origem (nota/venda) **e por baixa existente**.
  Cada título tem **`code` sequencial**; status `PENDING|PARTIAL|PAID`.
- ✅ **Configurações** (tabela `Setting`, JSON): `/settings/product-form` (campos
  obrigatórios), **`/settings/company`** (dados da empresa), **`/settings/payment-types`**
  (tipos de recebimento). GET autenticado, PUT ADMIN.
- ✅ **Dashboard** (§novo, ADMIN): `GET /dashboard?from&to` — agrega vendas, recebimentos
  por forma, série diária e situação de contas a pagar/receber.
- ✅ **Sugestão de compra** (§4.6): média de vendas na janela × lead time.

### Frontend
- ✅ **Shell**: ErrorBoundary, Layout touch, ProtectedRoute (RBAC), StatusBadge
  (online/fila com ícones lucide-react).
- ✅ **Login**: layout split (painel de marca + formulário), botão "preencher demo",
  `autoCapitalize=none`, trim na validação.
- ✅ **PDV** (§4.4): scanner de teclado, **busca vazia lista todos os produtos**,
  carrinho com **valor unitário editável por item**, **desconto e acréscimo** sobre o
  subtotal (entrada em R$ e em %), **observação** livre da venda, **seletor de cliente**
  (busca ou cadastro rápido), **fila offline (Dexie)** com sucesso imediato, modal de
  recibo. Caixa fechado mostra tela de bloqueio.
  **Pagamento:** 4 formas à vista (atalho) + modal com **split (múltiplas formas)** e
  **"A prazo"** (nº de parcelas, 1º vencimento, intervalo → gera contas a receber).
  **Motor de impressão dual** (`printMode` state): botões "🖨️ Bobina (80mm)" e "📄 Papel A4"
  no modal pós-venda; `handlePrint` mede altura do recibo via `receiptRef.offsetHeight`
  (Dynamic Measurement Engine), injeta `@page` com dimensões exatas e chama `window.print()`.
  Bloco A4 reutiliza `<SaleReceipt format="a4">` (mesmo visual da tela Vendas); code real
  obtido via `POST /api/sales` com `clientRef` idempotente ao finalizar online.
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
  edição sem cliente selecionado.
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
- ✅ **Caixa**: card gradiente com **saldo atual** (`expectedCash`); suprimento/sangria
  via **modal próprio com observação** (sem `window.prompt`); **timeline de
  movimentações** unindo vendas (leitura) + sangrias/suprimentos (editáveis/excluíveis
  só com o caixa aberto); **resumo de recebimentos por forma** (ADMIN); **histórico de
  caixas de outros dias** com detalhe e resumo; fechamento por modal. Todos os
  modais (Sangria/Suprimento/Fechamento) via **React Portal**
  (`createPortal(..., document.body)`) — mesmo padrão da tela de Produtos, imune
  ao containing block do `animate-fade-in`. **Impressão de resumo/fechamento**
  (`CashPrintButton` + `CashReceipt.tsx`): motor térmico dual reaproveitado do
  PDV — mede a altura real do recibo (`scrollHeight + 15px` de sobra para a
  guilhotina) e injeta `@page` dinâmico; usa `createPortal` com `id`s dedicados
  (`thermal-print-root`/`a4-print-root`) e `body > *:not(#id) { display:none }`
  no CSS de impressão para eliminar páginas fantasma (o app shell some
  fisicamente do DOM impresso em vez de só ficar `visibility:hidden` ocupando
  espaço); `.thermal-receipt` mantém `position:absolute` no `index.css` (raiz
  do papel 80mm ancorada no topo, ignorando o "lixo" invisível abaixo).
  **Terceira aba "Relatório"** (`PeriodicReport`): seletor de período (padrão =
  mês corrente), cards de resumo (Total de vendas, Dinheiro em gaveta,
  Suprimentos, Sangrias, Fechamentos/Recolhido) e timeline consolidada de
  todos os caixas do período (ícone + operador + valor com sinal).
- ✅ **Compras**: sugestão de compra; importação de XML por **upload de arquivo .xml**;
  **compra manual multi-produto** (vários itens, observação, **nº de documento
  sequencial**, **novo preço de venda por item** mostrando o atual, **lote/validade por
  item**, e **contas a pagar parceladas** opcionais do total); **aba "Compras lançadas"**
  para consultar, editar (observação) e **excluir** (estorna estoque + remove contas a
  pagar pendentes; bloqueado se houver título já baixado).
- ✅ **Financeiro**: lançamento manual a pagar/receber com **N parcelas** e
  **fornecedor/cliente obrigatório**; cada título tem **código sequencial** (`code`);
  **baixa parcial** (registra liquidações em `AccountSettlement`, mostra saldo restante)
  e **quitação integral com desconto**; **estorno da última baixa**; **filtros** por
  período (vencimento) e busca por descrição/pessoa; **títulos vencidos destacados**;
  edição/exclusão **bloqueadas** para origem nota/venda e para títulos já baixados.
- ✅ **Dashboard** (ADMIN, `/dashboard`): visão financeira por **período** — vendas
  (total/qtd/ticket), recebimentos por forma, série diária (gráfico corrigido) e
  situação de contas a pagar/receber (aberto e vencido); **card Receitas − Despesas**
  (saldo +/− do período).
- ✅ **Acerto de estoque** (ADMIN, `/estoque`): inventário — informa a quantidade
  contada e o motivo; registra a diferença como `StockMovement` tipo `ADJUST`;
  **histórico de acertos** com editar (recalcula estoque) e apagar (reverte diff).
  Endpoints: `GET/PUT/DELETE /products/stock-adjustments(/:id)`.
- ✅ **Configurações** (ADMIN) em abas: **Produto** (campos obrigatórios + lote/validade
  padrão + **modelo de precificação** `pricingMode`: Margem ou Markup — radio group;
  + **`requireAverageCost`**: torna o custo médio obrigatório no cadastro/edição;
  todos persistidos em `Setting`, consumidos dinamicamente pelo formulário de produto),
  **Recebimentos** (tipos de pagamento configuráveis: renomear/ativar/adicionar,
  consumidos dinamicamente pelo PDV), **Empresa** (dados cadastrais do contratante) e
  **Usuários** (CRUD completo: criar/editar/excluir; definir quais telas cada operador
  pode acessar via checkboxes — `allowedPages` granular por usuário).
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
| 4.7 | Recibo 58/80mm + print | `components/ThermalReceipt.tsx`, `components/SaleReceipt.tsx`, motor dual em `PdvPage.tsx` | ✅ |
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

**Migrações (12, todas aditivas/seguras):** `0_init`, `add_lot_validity_control`,
`add_settings`, `sale_discount_surcharge_notes`, `financial_account_sale_link`,
`sale_payments`, `invoice_document_notes`, `financial_settlements_code`,
`sale_code_financial_flag`, `product_person_code`,
`20260626000000_add_average_cost_to_variants` (já mesclada na `main` via PR #2),
`20260702000000_add_person_trade_name` (pendente de merge — ver ⚠️ no topo).
Aplicadas automaticamente no Railway a cada deploy (`prisma migrate deploy`).

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
- ⬜ **Testes automatizados (unit/integration)**: ainda não há suíte (ver §12/§13).

---

## 12. Pendências, bloqueios e dívidas técnicas

1. ~~**[BLOQUEIO] Docker não instalado**~~ **RESOLVIDO (2026-06-02)**.
2. ~~**Deploy Railway não configurado**~~ **RESOLVIDO (2026-06-03)**: sistema em produção em https://exodus-web-production.up.railway.app.
3. **`npm audit`**: 3 vulnerabilidades reportadas (1 moderada, 2 críticas) em deps transitivas — revisar antes de escalar.
4. **Sem testes automatizados** (Vitest/Supertest) — apenas smoke test manual.
5. ~~**BrasilAPI** ainda não integrada no formulário de fornecedor~~ **RESOLVIDO
   (2026-07-02)**: CEP via BrasilAPI (endereço completo) + CNPJ via ReceitaWS
   (proxeada pelo backend, ver §5 Cadastros).
6. **Cadastro de produto** cria 1 variante por vez (multi-variante a fazer).
7. ~~**Pagamento único por venda**~~ **RESOLVIDO** (PDV-B): split de pagamento + "A prazo".
8. **Estoque pode ficar negativo** em vendas offline (decisão consciente). Avaliar política de bloqueio/alerta.
9. **JWT sem refresh token** e sem revogação (expira em 12h).
10. **Recibo**: motor dual (térmico + A4) implementado no PDV; layout 80mm ainda **não testado em impressora térmica física real** (apenas Chrome "Salvar como PDF").
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
