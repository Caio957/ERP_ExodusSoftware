# Exodus Software

ERP gerencial para lojas de maquiagem e cosméticos. **Sem emissão fiscal** — foco
em estoque, compras, financeiro, fluxo de caixa e PDV de balcão (tablet, Touch UI,
leitor de código de barras e operação **offline-first**).

## Stack

| Camada    | Tecnologias |
|-----------|-------------|
| Frontend  | PWA · React + Vite + TypeScript · Tailwind · Dexie.js (offline) · React Query · Zustand |
| Backend   | Node.js · Fastify · TypeScript · Zod · Prisma ORM |
| Banco     | PostgreSQL (Docker local / Supabase) |
| Auth      | JWT + bcrypt, RBAC (`ADMIN` / `CASHIER`) |

## Estrutura (monorepo npm workspaces)

```
.
├── apps/
│   ├── api/        # Backend Fastify + Prisma
│   └── web/        # PWA React (tablet do balcão)
├── packages/
│   └── shared/     # Contratos Zod, enums e cálculo de margem/markup (back ↔ front)
└── docker-compose.yml
```

## Pré-requisitos

- Node.js >= 20
- **Docker Desktop** (para o Postgres local) — ainda não instalado nesta máquina.
  Alternativa: aponte `DATABASE_URL` para um Supabase.

## Como rodar

```bash
# 1. Dependências
npm install

# 2. Banco de dados (sobe o Postgres em container)
npm run db:up

# 3. Cria o .env do backend a partir do exemplo
cp .env.example apps/api/.env      # (já existe um .env de dev pronto)

# 4. Aplica as migrações + gera o Prisma Client
npm run db:migrate                 # dev: cria/aplica migração
#   ou, com a migração já versionada:
#   npm run db:generate && npx prisma migrate deploy -w @exodus/api

# 5. Popula usuários de exemplo
npm run db:seed
#   ADMIN   -> admin@exodus.local / admin12345
#   CASHIER -> caixa@exodus.local / caixa12345

# 6. Sobe API (porta 3333) e Web (porta 5173) em terminais separados
npm run dev:api
npm run dev:web
```

> **Supabase:** basta trocar `DATABASE_URL` em `apps/api/.env` pela connection
> string do painel (Settings → Database) e rodar `npx prisma migrate deploy -w @exodus/api`.
> A migração inicial já está versionada em `apps/api/prisma/migrations/0_init`.

## Validação já executada

- ✅ `npm run typecheck` (shared + api + web) sem erros
- ✅ Build do backend (`tsup`) e smoke test (`apps/api/scripts/smoke.ts`):
  health 200, validação Zod 400, auth 401, rota inexistente 404
- ✅ Build de produção do frontend (Vite + PWA: `sw.js` + manifest)

## Mapa de requisitos → código

| Requisito | Onde |
|-----------|------|
| 4.1 Margem/Markup bidirecional | `packages/shared/src/pricing.ts` · `apps/web/.../ProductsPage.tsx` |
| 4.1 Lote/validade obrigatórios | `ProductVariant.batch` · `schemas/product.ts` |
| 4.2 BrasilAPI (CNPJ) | `schemas/person.ts` (campos de endereço) · *frontend de fornecedor a integrar* |
| 4.3 Entrada de XML + De/Para | `services/nfe-parser.ts` · `routes/invoices.ts` · `components/XmlImport.tsx` |
| 4.3 CFOP flexível | `InvoiceItem.cfop` registrado como vem no XML |
| 4.4 PDV offline-first | `lib/db.ts` (Dexie) · `lib/sync.ts` · `hooks/useBarcodeScanner.ts` · `PdvPage.tsx` |
| 4.5 Controle de caixa + RBAC | `routes/cash.ts` · `CashPage.tsx` (resumo só ADMIN) |
| 4.6 Sugestão de compra | `routes/purchase-suggestions.ts` · `PurchasesPage.tsx` |
| 4.7 Recibo 58/80mm | `components/ThermalReceipt.tsx` + `window.print()` |
| 4.8 Resiliência/Logs | `plugins/error-handler.ts` (backend) · `components/ErrorBoundary.tsx` (frontend) |

## Decisões de arquitetura (divergências do schema base)

O schema Prisma foi **corrigido e estendido** (mantendo a base do briefing):
adição de `User.passwordHash`, relações faltantes (Invoice→Supplier, CashRegister→User,
Sale→User/Client, FinancialAccount→Invoice/Person), tabela `SupplierProductMapping`
(De/Para), `ProductVariant.batch`, `StockMovement` (razão de estoque) e
`Person.document` opcional para clientes de balcão. Ver cabeçalho de
`apps/api/prisma/schema.prisma`.
