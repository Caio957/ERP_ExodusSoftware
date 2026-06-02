# CLAUDE.md — Painel de Progresso do Projeto Exodus Software

> **Para a IA (Claude):** este é o documento-fonte do estado do projeto. **Leia-o
> integralmente antes de qualquer implementação** e **atualize-o ao final de cada
> entrega** (seções "Estado atual", "Validações" e "Pendências"). Arquivos
> `CLAUDE.md` são carregados automaticamente como contexto pelo Claude Code.
>
> **Para o avaliador externo (Gemini):** este documento descreve o que já foi
> construído, as decisões tomadas e os pontos onde queremos sua análise. As
> perguntas direcionadas estão na seção **§13 — Pedidos de avaliação**.

- **Última atualização:** 2026-06-02
- **Idioma do projeto:** Português (pt-BR) em toda comunicação e documentação.
- **Fase atual:** Fundação concluída e validada por tipos/build. Migração ainda
  não aplicada a banco real (bloqueio de ambiente — ver §12).

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
├── tsconfig.base.json          # config TS estrita compartilhada
├── .env.example                # modelo de variáveis
├── README.md                   # guia de execução
├── CLAUDE.md                   # ESTE documento
├── packages/
│   └── shared/                 # contratos compartilhados back ↔ front
│       └── src/
│           ├── enums.ts        # enums de domínio (z.enum)
│           ├── pricing.ts      # margem/markup bidirecional (puro)
│           └── schemas/        # Zod: auth, person, product, invoice, sale, cash, financial, common
├── apps/
│   ├── api/                    # Backend Fastify
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # modelo de dados (ver §9)
│   │   │   ├── seed.ts         # usuários de exemplo
│   │   │   └── migrations/0_init/migration.sql  # migração inicial (gerada offline)
│   │   ├── scripts/smoke.ts    # smoke test via app.inject()
│   │   └── src/
│   │       ├── server.ts       # bootstrap + shutdown gracioso
│   │       ├── app.ts          # buildApp(): plugins, type provider Zod, rotas
│   │       ├── env.ts          # validação de env com Zod (fail-fast)
│   │       ├── lib/            # prisma, errors, password, serialize
│   │       ├── plugins/        # auth (JWT+RBAC), error-handler global
│   │       ├── services/       # nfe-parser, sales (idempotência)
│   │       └── routes/         # auth, products, persons, invoices, sales, cash, financial, purchase-suggestions
│   └── web/                    # PWA React
│       └── src/
│           ├── main.tsx        # QueryClient + ErrorBoundary + startSyncEngine
│           ├── App.tsx         # rotas + ProtectedRoute (RBAC)
│           ├── lib/            # api (fetch+JWT), token, db (Dexie), sync, products
│           ├── hooks/          # useOnline, useBarcodeScanner
│           ├── store/          # auth (Zustand persist)
│           ├── components/     # Layout, ProtectedRoute, ErrorBoundary, StatusBadge, ThermalReceipt, XmlImport
│           └── pages/          # Login, Pdv, Products, Cash, Purchases, Financial
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
- ✅ **Auth/RBAC**: `/auth/login`, `/auth/register` (ADMIN), `/auth/me`; guards
  `authenticate` e `authorize(roles)`.
- ✅ **Error handler global** (§Req 4.8): trata Zod, AppError, Prisma (P2002/P2025)
  e erros inesperados, logando rota + payload; 404 padronizado.
- ✅ **Produtos**: CRUD, busca por barcode (PDV), criação com variantes + estoque
  inicial (StockMovement).
- ✅ **Pessoas**: CRUD cliente/fornecedor (document opcional).
- ✅ **Entrada de XML/NFe** (§4.3): `/invoices/parse` (normaliza + resolve De/Para
  por mapping e por EAN), `/invoices/confirm` (cria nota, dá entrada no estoque,
  salva De/Para, gera Contas a Pagar das duplicatas), `/invoices/mappings`.
- ✅ **Vendas**: `/sales` e `/sales/sync` (lote offline) com **idempotência por
  `clientRef`**; baixa de estoque + razão.
- ✅ **Caixa**: abrir, sangria/suprimento, fechar (com diferença); **resumo só ADMIN**.
- ✅ **Financeiro**: listar/criar/baixar contas (ADMIN).
- ✅ **Sugestão de compra** (§4.6): média de vendas na janela × lead time.

### Frontend
- ✅ **Shell**: ErrorBoundary, Layout touch, ProtectedRoute (RBAC), StatusBadge
  (online/fila).
- ✅ **Login** + store de auth com persistência.
- ✅ **PDV** (§4.4): scanner de teclado, busca, carrinho, 4 formas de pagamento,
  **fila offline (Dexie)** com sucesso imediato, modal de recibo.
- ✅ **Produtos**: lista + form de criação com **margem/markup bidirecional**.
- ✅ **Caixa**: abertura/sangria/suprimento/fechamento.
- ✅ **Compras**: sugestão de compra + **importação de XML com De/Para inline**.
- ✅ **Financeiro**: contas a pagar/receber + baixa.
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
| `ProductVariant.batch` (lote, obrigatório) | Rastreabilidade de cosméticos (§4.1). |
| `Person.document` opcional (mantém `@unique`) | Clientes de balcão sem CPF; no Postgres, múltiplos `NULL` não colidem. |
| Campos de endereço em `Person` | Autocompletar via BrasilAPI (§4.2). |
| `SupplierProductMapping` (nova) | Persistir o **De/Para** fornecedor↔variante (§4.3). |
| Relações faltantes | `Invoice→supplier`, `CashRegister→user`, `Sale→user/client`, `FinancialAccount→invoice/person`. |
| `StockMovement` (nova) | Razão (ledger) de estoque para auditoria e base da sugestão de compra. |
| `Sale.clientRef @unique` + `soldAt` | Idempotência da fila offline e data real da venda. |

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
| 4.1 | Lote/validade obrigatórios | `ProductVariant.batch`, `schemas/product.ts` | ✅ |
| 4.2 | BrasilAPI (CNPJ) | Campos de endereço no schema/Zod prontos | 🟡 (falta o autocomplete no front) |
| 4.3 | Entrada de XML + De/Para | `services/nfe-parser.ts`, `routes/invoices.ts`, `components/XmlImport.tsx` | ✅ |
| 4.3 | CFOP flexível | `InvoiceItem.cfop` | ✅ |
| 4.3 | Contas a Pagar das duplicatas | `routes/invoices.ts` (confirm) | ✅ |
| 4.4 | PDV offline-first | `lib/db.ts`, `lib/sync.ts`, `hooks/useBarcodeScanner.ts`, `PdvPage.tsx` | ✅ |
| 4.5 | Caixa (abrir/fechar/sangria/suprimento) | `routes/cash.ts`, `CashPage.tsx` | ✅ |
| 4.5 | Resumo financeiro só ADMIN | `routes/cash.ts` (`/summary`), `routes/financial.ts` | ✅ |
| 4.6 | Sugestão de compra | `routes/purchase-suggestions.ts`, `PurchasesPage.tsx` | ✅ |
| 4.7 | Recibo 58/80mm + print | `components/ThermalReceipt.tsx` | ✅ |
| 4.8 | Resiliência/Logs | `plugins/error-handler.ts`, `components/ErrorBoundary.tsx` | ✅ |

---

## 9. Modelo de dados (entidades)

`User`, `Product` 1—N `ProductVariant`, `Person` (CLIENT|SUPPLIER),
`Invoice` 1—N `InvoiceItem`, `SupplierProductMapping`, `CashRegister` 1—N
`CashTransaction`/`Sale`, `Sale` 1—N `SaleItem`, `StockMovement`,
`FinancialAccount`. Campos `role`, `type`, `status`, `paymentMethod` etc. são
`String` no Prisma (flexibilidade) mas **validados por `z.enum`** na borda
(`packages/shared/src/enums.ts`). Detalhe completo: `apps/api/prisma/schema.prisma`.

---

## 10. Convenções de código

- **TypeScript estrito** (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- Contratos e tipos **derivados de Zod** (`z.infer`) — sem duplicar tipos.
- Erros de domínio via classes `AppError` (`lib/errors.ts`); o handler global
  converte em resposta `{ statusCode, code, message }`.
- Comentários de domínio em **português**; identificadores em inglês.
- Componentes React touch-first (classes utilitárias `.btn`, `.input`, `.card`,
  alvos `min-h-touch`).

---

## 11. Validações já executadas

- ✅ `npm run typecheck` (shared + api + web) → **0 erros**.
- ✅ Backend `tsup` build OK + **smoke test** (`apps/api/scripts/smoke.ts`):
  `/health` 200 · login inválido 400 (Zod) · `/auth/me` sem token 401 · rota
  inexistente 404.
- ✅ Frontend `vite build` OK + PWA (`sw.js`, `manifest.webmanifest`).
- ⬜ **Testes automatizados (unit/integration)**: ainda não há suíte (ver §12/§13).
- ⬜ **Execução contra banco real**: pendente do Docker (§12).

---

## 12. Pendências, bloqueios e dívidas técnicas

1. **[BLOQUEIO] Docker não instalado** na máquina (nem `psql`). A migração foi
   **gerada offline** (`prisma migrate diff`) mas **não aplicada**. Concluir:
   instalar Docker Desktop → `npm run db:up` → `npm run db:migrate` → `npm run db:seed`.
   Alternativa imediata: apontar `DATABASE_URL` para Supabase e `migrate deploy`.
2. **`npm audit`**: 3 vulnerabilidades reportadas (1 moderada, 2 críticas) em deps
   transitivas — revisar antes de produção.
3. **Sem testes automatizados** (Vitest/Supertest) — só smoke test manual.
4. **BrasilAPI** ainda não integrada no formulário de fornecedor (§4.2).
5. **Cadastro de produto** cria 1 variante por vez (multi-variante a fazer).
6. **Pagamento único por venda** (sem split de pagamento) — conforme briefing.
7. **Estoque pode ficar negativo** em vendas offline (decisão consciente: a loja já
   entregou o produto; sinaliza ajuste). Avaliar política de bloqueio/alerta.
8. **JWT sem refresh token** e sem revogação (expira em 12h).
9. **Recibo**: layout 58/80mm pronto, mas **não testado em impressora térmica real**.
10. **Ícones PWA** usam um único SVG (sem PNGs 192/512 dedicados).

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

1. Subir banco (Docker/Supabase) e validar fluxos end-to-end reais.
2. Suíte de testes: Vitest (unit em `pricing`/`nfe-parser`) + integração das rotas.
3. Integração BrasilAPI no cadastro de fornecedor.
4. Cadastro multi-variante de produto + edição de estoque/preço.
5. Tela de devoluções e ajustes de estoque (com `StockMovement`).
6. Endurecer segurança (refresh token, rate limit, validação do XML).
7. Resolver `npm audit`.

---

> **Lembrete de manutenção:** ao concluir qualquer tarefa, atualize §5, §11 e §12
> e a data no topo. Este arquivo é a fonte de verdade do progresso.
