# CLAUDE.md — Painel de Progresso do Projeto Exodus Software

> **Para a IA (Claude):** este é o documento-fonte do estado do projeto. **Leia-o
> integralmente antes de qualquer implementação** e **atualize-o ao final de cada
> entrega** (seções "Estado atual", "Validações" e "Pendências"). Arquivos
> `CLAUDE.md` são carregados automaticamente como contexto pelo Claude Code.
>
> **Para o avaliador externo (Gemini):** este documento descreve o que já foi
> construído, as decisões tomadas e os pontos onde queremos sua análise. As
> perguntas direcionadas estão na seção **§13 — Pedidos de avaliação**.

- **Última atualização:** 2026-06-05
- **Idioma do projeto:** Português (pt-BR) em toda comunicação e documentação.
- **Equipe:** Caio e Helom (sócios). O repositório é a fonte única; ambos importam
  o código em suas máquinas, então **este CLAUDE.md é o registro de onde paramos** —
  mantê-lo fiel a cada entrega é essencial.
- **Repositório:** https://github.com/Caio957/ERP_ExodusSoftware (branch `main`).
- **URL de produção:** https://exodus-web-production.up.railway.app
- **Deploy:** **automático a cada `git push` na `main`** (GitHub → Railway). Migrações
  aplicadas no deploy. ⚠️ Só pushar código validado (typecheck + build).
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
│           │                   # ThermalReceipt, XmlImport (upload de arquivo)
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
- ✅ **Cadastros** (`/cadastros`, autenticado): CRUD de **clientes e fornecedores**
  (nome, CPF/CNPJ, telefone, e-mail, endereço) com exclusão protegida por origem.
- ✅ **Vendas** (ADMIN, `/vendas`): **NºDOC sequencial** em todas as vendas; consulta
  com coluna de status do financeiro; **botão Visualizar** (ver itens, pagamentos,
  contas a receber) antes de decidir; **editar** (itens/qtd/preço/desconto/acréscimo/
  observação/cliente/pagamento — incluindo **"A prazo" com parcelas**); **excluir**
  (estorna estoque + remove financeiro); **excluir/gerar financeiro** (reversível —
  venda sai/entra no caixa e recebimentos); **imprimir** — cupom térmico aprimorado
  ou folha A4 estilizada com dados da empresa (escolha na hora).
- ✅ **Produtos**: filtros (marca/grupo/subgrupo) + busca; editar produto e variantes
  (asteriscos `*` também no modal Editar); excluir (com confirmação + bloqueio por
  origem); toggle **"controlar lote e validade"** (lote/validade só obrigatórios
  quando marcado); **descrição da variante opcional** (fallback = nome do produto);
  **marca/grupo/subgrupo obrigatórios conforme a config da loja**; precificação:
  o **último percentual editado (margem OU markup) recalcula o preço de venda**,
  alterar o custo mantém o percentual e atualiza a venda.
- ✅ **Caixa**: card gradiente com **saldo atual** (`expectedCash`); suprimento/sangria
  via **modal próprio com observação** (sem `window.prompt`); **timeline de
  movimentações** unindo vendas (leitura) + sangrias/suprimentos (editáveis/excluíveis
  só com o caixa aberto); **resumo de recebimentos por forma** (ADMIN); **histórico de
  caixas de outros dias** com detalhe e resumo; fechamento por modal.
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
  padrão), **Recebimentos** (tipos de pagamento configuráveis: renomear/ativar/adicionar,
  consumidos dinamicamente pelo PDV) e **Empresa** (dados cadastrais do contratante).
- ✅ **Recibo térmico** 58/80mm + `window.print()` (§4.7).
- ✅ **PWA**: manifest + Service Worker (Workbox) com cache de app shell e API.

---

## 6. Sincronização offline-first (detalhe — §4.4)

Decisão: **fila própria no IndexedDB (Dexie)** em vez de Background Sync nativo
(suporte irregular entre navegadores). Fluxo:

1. Venda no PDV → `enqueueSale()` gera `clientRef` (uuid) e grava em `saleQueue`
   com status `PENDING`. O caixa recebe **sucesso imediato**.
2. `startSyncEngine()` (em `main.tsx`) dispara `flushQueue()` ao **evento `online`**,
   ao iniciar e a cada 30s.
3. `flushQueue()` envia o lote para `POST /api/sales/sync`. O backend é
   **idempotente**: `clientRef` já gravado retorna `DUPLICATE` (não duplica venda).
4. Sucesso (`CREATED`/`DUPLICATE`) → remove da fila; `ERROR` → marca para retry.

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
| `ProductVariant.batch` (nullable) | Lote agora **opcional** — obrigatório só quando `Product.tracksLotValidity = true` (configurável por produto). |
| `Product.tracksLotValidity` (booleano) | Liga/desliga exigência de lote/validade por produto (migração `add_lot_validity_control`). |
| `Person.document` opcional (mantém `@unique`) | Clientes de balcão sem CPF; no Postgres, múltiplos `NULL` não colidem. |
| Campos de endereço em `Person` | Autocompletar via BrasilAPI (§4.2). |
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
| 4.2 | BrasilAPI (CNPJ) | Campos de endereço no schema/Zod prontos | 🟡 (falta autocomplete no front) |
| 4.3 | Entrada de XML + De/Para | `services/nfe-parser.ts`, `routes/invoices.ts`, `components/XmlImport.tsx` (upload) | ✅ |
| 4.3 | Compra manual (sem XML) | `routes/invoices.ts` (`/manual`), `pages/PurchasesPage.tsx` | ✅ |
| 4.3 | CFOP flexível | `InvoiceItem.cfop` | ✅ |
| 4.3 | Contas a Pagar das duplicatas | `routes/invoices.ts` (confirm) | ✅ |
| 4.4 | PDV offline-first | `lib/db.ts`, `lib/sync.ts`, `hooks/useBarcodeScanner.ts`, `PdvPage.tsx` | ✅ |
| 4.5 | Caixa (abrir/fechar/sangria/suprimento) | `routes/cash.ts`, `CashPage.tsx` (saldo em tempo real) | ✅ |
| 4.5 | Resumo financeiro só ADMIN | `routes/cash.ts` (`/summary`), `routes/financial.ts` | ✅ |
| 4.6 | Sugestão de compra | `routes/purchase-suggestions.ts`, `PurchasesPage.tsx` | ✅ |
| 4.7 | Recibo 58/80mm + print | `components/ThermalReceipt.tsx` | ✅ |
| 4.8 | Resiliência/Logs | `plugins/error-handler.ts`, `components/ErrorBoundary.tsx` | ✅ |
| — | Produtos: filtros + editar + excluir | `routes/products.ts` (GET filtros, DELETE protegido), `ProductsPage.tsx` | ✅ |
| — | PDV: desconto/acréscimo/observação + valor unitário editável | `PdvPage.tsx`, `services/sales.ts` | ✅ |
| — | Vendas: split de pagamento + "A prazo" (parcelas) | `SalePayment`, `services/sales.ts`, `PdvPage.tsx` (modal) | ✅ |
| — | Vendas: consulta + editar/excluir | `routes/sales.ts` (PUT/DELETE), `SalesPage.tsx` | ✅ |
| — | Cadastros de clientes/fornecedores | `routes/persons.ts`, `RegistrationsPage.tsx` | ✅ |
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

**Migrações (9, todas aditivas/seguras):** `0_init`, `add_lot_validity_control`,
`add_settings`, `sale_discount_surcharge_notes`, `financial_account_sale_link`,
`sale_payments`, `invoice_document_notes`, `financial_settlements_code`,
`sale_code_financial_flag`. Aplicadas automaticamente no Railway a cada deploy
(`prisma migrate deploy`).

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
- ⬜ **Testes automatizados (unit/integration)**: ainda não há suíte (ver §12/§13).

---

## 12. Pendências, bloqueios e dívidas técnicas

1. ~~**[BLOQUEIO] Docker não instalado**~~ **RESOLVIDO (2026-06-02)**.
2. ~~**Deploy Railway não configurado**~~ **RESOLVIDO (2026-06-03)**: sistema em produção em https://exodus-web-production.up.railway.app.
3. **`npm audit`**: 3 vulnerabilidades reportadas (1 moderada, 2 críticas) em deps transitivas — revisar antes de escalar.
4. **Sem testes automatizados** (Vitest/Supertest) — apenas smoke test manual.
5. **BrasilAPI** ainda não integrada no formulário de fornecedor (§4.2).
6. **Cadastro de produto** cria 1 variante por vez (multi-variante a fazer).
7. ~~**Pagamento único por venda**~~ **RESOLVIDO** (PDV-B): split de pagamento + "A prazo".
8. **Estoque pode ficar negativo** em vendas offline (decisão consciente). Avaliar política de bloqueio/alerta.
9. **JWT sem refresh token** e sem revogação (expira em 12h).
10. **Recibo**: layout 58/80mm pronto, mas **não testado em impressora térmica real**.
11. **Ícones PWA** usam um único SVG (sem PNGs 192/512 dedicados).
12. ~~**Tela de Suprimento/Sangria** usa `window.prompt()`~~ **RESOLVIDO** (Onda Caixa): modal próprio com observação.
13. **Tipos de recebimento customizados** são tratados como "à vista não-dinheiro": o backend reconhece apenas os códigos literais `CASH` (entra no `expectedCash`) e `A_PRAZO` (gera parcelas). Um tipo novo com kind CASH/A_PRAZO não teria esse comportamento especial — por isso a tela de Configurações só permite adicionar tipos `OTHER` (os 5 base são fixos quanto a code/kind).
14. ~~**Edição de venda** simplifica o pagamento para forma única~~ **RESOLVIDO (2026-06-05)**: edição agora aceita "a prazo" com parcelas; split de formas múltiplas segue sendo reaberto somente na criação (excluir e refazer para split).

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
