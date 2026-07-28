# CLAUDE.md — Painel de Progresso do Projeto Exodus Software

> **Para a IA (Claude):** este é o documento-fonte do estado do projeto. **Leia-o
> integralmente antes de qualquer implementação** e **atualize-o ao final de cada
> entrega** (seções "Estado atual", "Validações" e "Pendências"). Arquivos
> `CLAUDE.md` são carregados automaticamente como contexto pelo Claude Code.
>
> **Para o avaliador externo (Gemini):** este documento descreve o que já foi
> construído, as decisões tomadas e os pontos onde queremos sua análise. As
> perguntas direcionadas estão na seção **§13 — Pedidos de avaliação**.

- **Última atualização:** 2026-07-28
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
  2026-07-12/13 em §11) e ✅ **`feature/conta-banco` mesclada via PR #21** (`1862448`,
  2026-07-15 — separação Caixa Físico (DIARIO) / Conta Banco (BANCO) reaproveitando a
  tabela `CashRegister` existente, ver Onda 2026-07-15 em §11) e ✅ **`feature/pdv-
  selecao-caixa` mesclada via PR #22** (`e708158`, 2026-07-16 — propaga o seletor
  Caixa Físico/Conta Banco para o PDV e para Vendas: seleção de destino no checkout,
  cálculo de saldo condicional por tipo, rastreabilidade de caixa + injeção virtual de
  estorno na timeline, e seleção de destino ao recriar o financeiro de uma venda; ver
  Onda 2026-07-15/16 em §11) e ✅ **`feature/edicao-venda-selecao-caixa` mesclada via
  PR #23** (`68f9579`, 2026-07-18 — fecha o §14.1: seleção de destino também na
  edição de venda (Mini-PDV) e na baixa do Financeiro; o estorno do Financeiro
  **autodetecta** o caixa de origem em vez de perguntar (princípio de partidas
  dobradas); e botão "Excluir financeiro" relocado para o rodapé do
  `ViewPurchaseModal` em Compras, sempre visível quando há financeiro e desabilitado
  com dica quando já há baixa — ver Onda 2026-07-17/18 em §11) — ver §11 para o
  histórico completo de commits de todas.
  **`main` e `origin/main` estavam em sincronia em `68f9579`** até a
  sequência de branches abaixo. **§14.1 (propagar o seletor Caixa Físico/
  Conta Banco) está concluído** — PDV, Vendas e Financeiro (settle/reverse)
  já propagam o seletor.
  ✅ **`feature/multi-tenant` mesclada na `main`** (commit direto `230e74d`,
  sem PR — ver nota de drift original em §14.1b) — implementa a arquitetura
  multi-tenant completa (Plano Mestre V2.0): schema (`Company` + `companyId`
  em 16 tabelas), Prisma Client Extension `withTenant` (isolamento lógico
  por tenant em toda rota de negócio), JWT com `companyId`, isolamento da
  fila offline do Dexie por tenant, e `User.email`/`ProductVariant.sku`/
  `barcode`/`Person.document` migrados de `@unique` global para
  `@@unique([companyId, campo])` com login capaz de desambiguar e-mail
  colidente entre empresas — ver Onda 2026-07-19 em §11 para o
  detalhamento completo (Fases 1-2 `b2039ad`, prep. Fase 3 `0b0ff54`,
  Fase 4 `7f7d001`, Fase 3 frontend `e3c534b`, última leva `230e74d`) —
  seguida, ainda na mesma branch antes dela virar `main`, pelo cadastro
  multi-variante de produto (`eb1b2dd`, 2026-07-20, ver Onda 2026-07-20 em
  §11 e §12 item 6 — ficou sem registro neste documento até a reconciliação
  desta rodada, por ter avançado em paralelo à branch que documentou o
  merge da LGPD abaixo).
  ✅ **`feature/lgpd-encryption` mesclada na `main` via PR #24** (`6d68e3c`,
  2026-07-23 — Plano Mestre V2.0: Segurança/LGPD, Frentes 2-4: criptografia
  de `Person.document`/`email`/`phone` (`withEncryption`), anonimização
  (`POST /persons/:id/anonymize`, ADMIN-only) e impersonate administrativo
  com auditoria obrigatória (`POST /api/admin/impersonate` + `AuditLog`) —
  ver Onda 2026-07-22b/c/d e 2026-07-23 em §11 para o detalhamento completo
  de cada frente, e Onda 2026-07-23c para o deploy em produção e a
  execução do backfill de criptografia contra o banco real).
  **`main` e `origin/main` estão em sincronia em `6d68e3c`.**
  ✅ **`feature/tenant-onboarding` mesclada na `main` via PR #25**
  (`3d2d2a5`, 2026-07-27) — Frente 1 (Onboarding de Novas Lojas) completa:
  onboarding público + guarda de login por status (`a28220b`) e o painel
  administrativo de aprovação de contratos — backend (`routes/admin.ts` +
  `packages/shared/src/schemas/admin.ts`, commit `b056a42`). Ver Onda
  2026-07-27 em §11 para a reconciliação ponto a ponto com a arquitetura de
  Segurança/LGPD (criptografia, `AuditLog`, desambiguação de login).
  **`main` e `origin/main` estão em sincronia em `3d2d2a5`.**
  ✅ **`feature/admin-contracts-panel` (frontend do Back-Office — Painel de
  Gestão de Contratos + Impersonate)** — sinal `isSuperAdmin` em `/auth/me`,
  rota protegida `/admin/contratos` (`<SuperAdminRoute>`) e
  `AdminContractsPage.tsx` (Padrão Ouro) — commit `ae6b65c`; botão "Acessar
  Loja", `<ImpersonateBanner>` e a estratégia de troca de token no Zustand
  (`impersonateLogin`/`exitImpersonate`) — ver Onda 2026-07-28/2026-07-28b
  em §11. Push para `origin` autorizado pelo Comandante — aguardando
  abertura do PR.
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
- ✅ **Multi-tenant** (Plano Mestre V2.0, branch `feature/multi-tenant`, ver Onda
  2026-07-19 em §11): model `Company` + `companyId` obrigatório em 15 das 16
  tabelas de negócio (`User` continua opcional, de propósito — reservado para
  um futuro papel `SYSTEM_ADMIN` sem tenant único). `lib/tenant.ts` expõe
  `withTenant(companyId)` (Prisma Client Extension que injeta `companyId` em
  toda leitura/escrita em massa) e `tenantDb(req)` (atalho de rota: deriva o
  client escopado + o `companyId` sempre do JWT, nunca do body). Toda rota de
  negócio foi varrida para usar esse client em vez do Prisma cru.
  **Constraints globais → tenant-scoped**: `User.email`, `ProductVariant.sku`/
  `barcode` e `Person.document` deixaram de ser `@unique` global e viraram
  `@@unique([companyId, campo])` — sem isso, duas lojas diferentes jamais
  poderiam cadastrar o mesmo código de barras de fabricante ou o mesmo
  fornecedor (CPF/CNPJ), por exemplo. `Company.document` e `Invoice.accessKey`
  permanecem globais (identidade do próprio tenant / identificador único
  nacional da NFe, respectivamente).
- ✅ **Auth/RBAC**: `/auth/login` (busca por e-mail SEM filtro de tenant,
  valida a senha contra todos os candidatos e só pede a empresa
  explicitamente — `needsCompanySelection` — se mais de uma conferir; nunca
  revela a lista antes de validar a senha, para não vazar enumeration),
  `/auth/register` (ADMIN, sempre no tenant de quem cria), `/auth/me`; guards
  `authenticate` e `authorize(roles)`. JWT carrega `companyId` (nullable).
- ✅ **Error handler global** (§Req 4.8): trata Zod, AppError, Prisma (P2002/P2025)
  e erros inesperados; 404 padronizado; SPA fallback para rotas do front.
- ✅ **Produtos**: CRUD completo; filtros por `search`, `brand`, `group`, `subgroup`;
  busca vazia retorna todos; variantes com lote/validade **opcionais** (controlado
  por `Product.tracksLotValidity`); `DELETE` protegido (bloqueia se houver vendas/notas);
  **`POST /products/adjust-stock`** (acerto de estoque → `StockMovement ADJUST`).
- ✅ **Pessoas**: CRUD cliente/fornecedor (document opcional); **`DELETE`** com proteção
  (bloqueia se houver vendas/notas/títulos vinculados).
  **Criptografia de dados sensíveis (Plano Mestre V2.0, Frente 2 — LGPD)**:
  `Person.document`/`email`/`phone` são cifrados em repouso, de forma
  transparente para toda rota que já usa `tenantDb(req)`/`withTenant`. Nova
  extensão do Prisma `withEncryption` (`lib/encryption.ts`, mesmo espírito de
  `withTenant`), composta por baixo de `withTenant` (`withEncryption(prisma).
  $extends({name:'withTenant',...})` em `lib/tenant.ts`) — qualquer `tx` de um
  `db.$transaction()` já herda as duas. Dois esquemas: `document`
  **determinístico** (AES-256-CBC, IV derivado via HMAC-SHA256 do próprio
  texto claro — mesmo texto claro sempre produz o mesmo ciphertext) para
  continuar suportando busca exata (`where: { document: '...' }`, usado em
  `/invoices/parse` para casar fornecedor por CNPJ) e a constraint
  `@@unique([companyId, document])`; `email`/`phone` **não-determinístico**
  (AES-256-GCM, IV aleatório por chamada, autenticado) — mais forte, mas sem
  busca por igualdade (nenhuma rota precisa disso hoje). `ENCRYPTION_KEY`
  (32 bytes hex/base64, `env.ts`, fail-fast no boot) — trocar a chave em
  produção torna ilegível tudo que já foi cifrado com a anterior.
  **Arquitetura da extensão**: `query.person.$allOperations` só mexe em
  argumentos (cifra `data`/`create`/`update` nas escritas, cifra
  `where.document` nas leituras — inclusive recursivamente dentro de
  `AND`/`OR`/`NOT`, usado pela busca de `GET /persons`); `result.person.
  {document,email,phone}` são campos computados que decifram o valor cru —
  **diferente de um hook em `query`, o componente `result` do Prisma Client
  Extensions se aplica automaticamente também a relações aninhadas**
  (`FinancialAccount.person`, `Invoice.supplier`, `Sale.client` via
  `include`), que um hook de `query` escopado a `person` jamais veria (só
  dispara quando `Person` é o model raiz da chamada) — confirmado ao vivo.
  **Tolerância a dado legado**: valores sem os prefixos reconhecidos
  (`encdet1:`/`encgcm1:`) são devolvidos como vieram em vez de tentar decifrar
  e quebrar — cobre registros gravados antes desta Frente 2. Script
  `prisma/backfill-person-encryption.ts` (dry-run por padrão, `CONFIRM_
  BACKFILL=1` para aplicar, mesmo padrão de `backfill-tenant.ts`) migra o que
  já existe — **✅ já rodado em produção** (`CONFIRM_BACKFILL=1` via Console
  do Railway, ver Onda 2026-07-23c em §11): o banco real de produção está
  cifrado, não só o de dev.
  **Incidente local resolvido** (relato de Caio, Onda 2026-07-23c): um erro
  500 (`ERR_OSSL_BAD_DECRYPT`) apareceu no ambiente local — registros
  gravados com uma `ENCRYPTION_KEY` antiga (de uma rotação de chave local)
  ficaram indecifráveis com a chave nova, já que a chave em si não fica
  registrada no valor cifrado (diferente do prefixo de esquema). Resolvido
  limpando os registros presos à chave antiga (dado de teste local, sem
  relação com produção). Lição: `decryptField` tolera texto **claro**
  legado, mas não tolera ciphertext cifrado com uma chave **diferente** da
  atual — trocar `ENCRYPTION_KEY` sempre exige ou manter a chave antiga
  disponível para decifrar o legado, ou rodar o backfill de novo com a
  chave nova antes de descartar a antiga.
  **Limitação conhecida e documentada no código**: `document: { contains:
  ... }` (usado pelo parâmetro `search` de `GET /persons`) não funciona mais
  sob criptografia determinística — não há como buscar substring em
  ciphertext. Não é regressão prática: a única tela real (`RegistrationsPage.tsx`)
  já filtra 100% client-side desde a Onda 2026-07-02 e nunca envia `search`
  ao backend; o parâmetro ficou vestigial. Outros operadores não suportados
  (`startsWith`, `not`, etc.) são deixados intactos — na prática, não
  encontram nada, sem quebrar a requisição.
  **Testado ao vivo**: create/update grava ciphertext real no Postgres
  (confirmado lendo com Prisma cru, sem a extensão); busca exata por
  `document` encontra o registro; busca por `document` inexistente retorna
  vazio sem erro; `select` parcial (sem document/email/phone) não vaza os
  campos; include aninhado (`FinancialAccount.person`) decifra
  corretamente; unicidade `@@unique([companyId, document])` continua
  bloqueando duplicata (P2002); dado legado em texto claro (inserido via
  Prisma cru, simulando um registro pré-Frente 2) é lido sem quebrar. Dados
  de teste removidos ao final.
  **Anonimização / Direito ao Esquecimento (Plano Mestre V2.0, Frente 3 —
  LGPD)**: **`POST /persons/:id/anonymize`** — **só `ADMIN`**
  (`authorize(['ADMIN'])`). ⚠️ **Histórico de RBAC nesta rota** (relevante
  para não repetir o erro): a versão original já era `ADMIN`-only; uma
  rodada intermediária afrouxou para `authenticate` simples (qualquer
  usuário do tenant, inclusive `CASHIER`), por instrução explícita de uma
  mensagem; o Comandante reverteu isso **no mesmo dia**, por ser risco
  grave de negócio — operador de caixa nunca pode anonimizar/destruir
  dados de cliente. O estado atual (e definitivo) é `ADMIN`-only. Sempre
  `UPDATE`, nunca `DELETE`: preserva o `id` para não quebrar
  `Sale.clientId`/`Invoice.supplierId`/`FinancialAccount.personId` —
  exatamente o cenário que hoje bloqueia o `DELETE` normal (vendas/notas/
  títulos vinculados); a anonimização é a alternativa para "esquecer" os
  dados reais sem apagar o histórico. **Proteção contra IDOR** (independente
  do RBAC por papel, em camada adicional): `db.person.findFirst({ where: {
  id } })` via `tenantDb` já injeta `companyId` do token no `where`
  (extensão `withTenant`) — um `id` de outra empresa nunca resolve, 404 em
  vez de vazar/alterar dado alheio (confirmado ao vivo). Sobrescreve `name`
  ("Anônimo (LGPD)"), `tradeName` (também identifica a pessoa, limpo
  junto), `document` (`ANON-{uuid}` — único mesmo com N pessoas
  anonimizadas na mesma empresa, cada UUID é distinto, então
  `@@unique([companyId, document])` nunca colide), `email`
  (`anon-{uuid}@lgpd.local`), `phone` (`null`) e todo o endereço
  (`zipCode`/`street`/`number`/`district`/`city`/`state`, todos para
  `null`) — `crypto.randomUUID()` nativo do Node. Os novos valores passam
  pelo `db.person.update` comum, e a extensão `withEncryption` (Frente 2,
  acima) cifra `document`/`email`/`phone` automaticamente como cifraria
  qualquer outra escrita — o `ANON-{uuid}` fica duplamente ilegível no
  banco (texto já ofuscado, depois cifrado). **Achado de premissa** (desde
  a primeira rodada, ainda válido): a missão original pedia atualizar um
  campo `updatedAt`, mas `Person` **não tem `updatedAt`/`createdAt`** no
  schema — nenhuma migração foi criada só para isso; o passo continua
  omitido. **Testado ao vivo (estado atual, pós-correção)**: usuário
  `CASHIER` tentando anonimizar → **403** (confirmado bloqueado); `ADMIN`
  → 200, com `name`/`document`/`email`/`phone` sobrescritos corretamente e
  cifrados no banco. **Testes anteriores, ainda válidos** (nenhuma outra
  parte da rota mudou nesta correção): pessoa vinculada a um
  `FinancialAccount` real manteve `personId` íntegro após anonimizada;
  teste de IDOR dedicado (pessoa criada direto no banco em empresa
  "estranha") → 404. Dados de teste removidos ao final de cada rodada.
- ✅ **Impersonate administrativo + Auditoria (Plano Mestre V2.0, Frente 4)
  — em produção**: **`POST /api/admin/impersonate`** (`routes/admin.ts`,
  novo — rotas globais fora do isolamento multi-tenant comum, sempre Prisma
  cru, nunca `withTenant`/`tenantDb`). Suporte técnico da Exodus troca o
  contexto de tenant para o de um cliente sem precisar de login próprio
  naquela empresa. **Autorização** (bypass deliberadamente simples até
  existir um papel/painel de admin global de verdade — `SYSTEM_ADMIN`,
  ainda não implementado): compara `req.user.email` com a env var
  `SUPER_ADMIN_EMAIL` (nova, `env.ts`, **opcional** — diferente do padrão
  fail-fast de `JWT_SECRET`/`ENCRYPTION_KEY` porque, se não configurada, o
  endpoint simplesmente fica indisponível para todo mundo: nenhum e-mail
  real é jamais igual a `undefined`, então o bypass falha **fechado** por
  padrão, em vez de derrubar o boot de toda a API por uma variável que nem
  todo ambiente precisa configurar no dia 1) — **já configurada no
  Railway**. **Model `AuditLog`** (sem `@relation`/FK de propósito — um log
  de auditoria precisa sobreviver à exclusão do usuário/empresa que
  referencia, é o próprio registro jurídico de "quem acessou o quê";
  também sem `companyId`, é uma tabela GLOBAL, nunca escopada por
  `withTenant`): grava `adminUserId`/`targetCompanyId`/`action`
  (`'IMPERSONATE_LOGIN'`) **antes** de emitir o token — se o registro
  falhar, a troca de contexto também falha (proteção jurídica sem exceção).
  O token novo mantém `sub`/`email`/`name` do admin REAL (rastreabilidade),
  troca só `companyId` para o tenant-alvo — é só isso que
  `withTenant`/`tenantDb` olham, então basta para "enganá-lo" e escopar
  toda rota de negócio subsequente para a empresa do cliente — e adiciona
  `isImpersonating: true` + `originalUserId` (`jwtPayloadSchema`, shared,
  ambos opcionais) para o frontend exibir uma faixa de aviso (**ainda não
  implementado no frontend** — "Missão 2" do próximo passo, ver §14).
  **Migração `AuditLog` aplicada** (`npx prisma migrate dev --name
  add_audit_log`, rodada e commitada — ver Onda 2026-07-23 em §11) e
  **deploy em produção confirmado**: segundo relato de Caio (Onda
  2026-07-23c em §11), a rota foi testada via Postman contra produção com
  sucesso (200), incluindo a correção de um 400 de validação (era preciso
  enviar `targetCompanyId` em formato UUID estrito) — e `AuditLog` está
  gravando os acessos corretamente. **Testado ao vivo nesta sessão** (antes
  da migração existir): sem `SUPER_ADMIN_EMAIL` → 403 (fail closed);
  `CASHIER` → 403; empresa-alvo inexistente → 404; servidor não caiu com o
  erro esperado de tabela ausente antes da migração. O fluxo de sucesso
  completo (token real emitido) foi confirmado por Caio em produção via
  Postman, não re-testado diretamente por mim nesta sessão.
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
  **Rastreabilidade de caixa + realocação dinâmica** (onda 2026-07-15/16 — ver
  §11): `GET /:id` inclui `cashRegister: { select: { type } } }` (exibido como
  `RegisterTypeBadge` no `ViewSaleModal`). `POST /:id/financial` (regerar
  financeiro) aceita `targetRegisterType: 'DIARIO'|'BANCO'` opcional
  (`regenerateSaleFinancialSchema`, shared): quando informado, busca o
  `CashRegister` `OPEN` daquele tipo do usuário logado (`findFirst({userId,
  status:'OPEN',type})`, mesmo padrão de `requireOpenRegister` em
  `financial.ts`), lança `AppError(400)` se não achar, e move
  `Sale.cashRegisterId` para o caixa encontrado na mesma transação que reativa
  `financialGenerated` — o lançamento some da timeline do caixa antigo e passa a
  contar na do novo automaticamente (todo o resto — `expectedCash`,
  `/movements`, `/report` — já era escopado por `cashRegisterId`).
  `SalePayment` não referencia caixa nenhum (só `saleId`), então mover o
  `cashRegisterId` da venda basta — não há "pagamentos" para recriar.
  **Mesma seleção também na edição completa** (onda 2026-07-18 — ver §11):
  `updateSale` (`PUT /sales/:id`, sempre recria o financeiro) ganhou um
  terceiro parâmetro `userId` e a mesma lógica de realocação de
  `targetRegisterType` — `updateSaleSchema` (shared) ganhou o campo opcional;
  o Mini-PDV de edição (`EditSaleModal`) abre o `RegisterSelectionModal`
  compartilhado ao salvar (depois da calculadora de troco, se dinheiro) em vez
  do antigo `window.confirm` genérico.
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
  **Caixa Físico / Conta Banco** (`CashRegister.type`, onda 2026-07-15 — ver
  §11): coluna `type String @default("DIARIO")` (`'DIARIO'` | `'BANCO'`, enum
  `CashRegisterType` em `packages/shared/src/enums.ts`) reaproveita a **mesma
  tabela e as mesmas rotas** de sempre — nenhuma tabela/rota nova. `/current`,
  `/registers` e `/report` passaram a exigir `type` na querystring
  (`cashRegisterTypeQuerySchema`, default `'DIARIO'`) e filtrar por ele **no
  mesmo objeto `where` do RBAC já existente** (`{ ...rbac, type }`), sem alterar
  a lógica de dono que essas rotas já tinham. `/current` continua
  **estritamente individual** (sem bypass de ADMIN, como sempre foi).
  `/open` agora recebe `type` no corpo (default `'DIARIO'`, então todo caller
  antigo continua abrindo caixa físico sem precisar saber do campo novo) e
  **escopa a checagem de "já aberto" por tipo** — um operador pode ter um caixa
  físico e uma conta banco abertos ao mesmo tempo (são livros independentes);
  só não pode abrir dois do mesmo tipo.
  **Cálculo de saldo condicional por tipo** (`liquidPaymentFilter(registerType)`,
  onda 2026-07-15 — ver §11): `computeExpectedCash` (`/current`, `/:id/close`,
  `/:id/summary`) e o `cashInDrawer` de `/report` distinguem DIARIO (só
  `method: 'CASH'` conta — gaveta física só soma dinheiro de verdade) de BANCO
  (`method: { not: 'A_PRAZO' }` — PIX/débito/crédito contam como "líquido" da
  conta, só "a prazo" fica de fora por virar conta a receber, não
  caixa-equivalente). `AccountSettlement`/`CashTransaction` não precisaram do
  mesmo tratamento — `CashTransaction` não tem coluna `method`, já era
  agnóstica ao tipo do caixa.
  **Injeção virtual de estorno na timeline** (`saleTimelineEntries(sale,
  operator?)`, onda 2026-07-16 — ver §11): quando `Sale.financialGenerated`
  é `false`, `GET /:id/movements` e `GET /report` passam a devolver, além da
  entrada normal da venda, uma entrada **sintética** (`type: 'REVERSAL'` —
  deliberadamente **não** `'BLEED'`, para não inflar a soma de sangrias que
  `CashPrintButton` usa no recibo impresso de fechamento) com descrição
  `"Estorno: Venda #{code}"`, timestamp `soldAt + 1ms` — não é uma
  `CashTransaction` real gravada (evita dupla dedução), só um recurso visual
  para o operador entender por que o saldo caiu quando o financeiro de uma
  venda é excluído.
- ✅ **Financeiro**: listar com **filtros avançados** — `orderBy`
  (`code`/`description`/`dueDate`/`amount`) + `orderDir`, e `statusFilter` semântico
  (`ALL`/`OPEN`/`OVERDUE`/`NOT_OVERDUE`/`PARTIAL`/`PAID`, este último com
  precedência sobre o `status`/`dueFrom`/`dueTo` simples quando presente — "hoje"
  calculado com o mesmo offset `-03:00` explícito do `/cash/report`, evitando o
  mesmo bug de fuso já documentado); `/installments` (N parcelas, fornecedor/
  cliente obrigatório); **`/:id/settle`** (baixa parcial/total, grava em
  `AccountSettlement`) e **`/:id/reverse`** (estorno da última baixa) — **ambas
  integradas ao Caixa**: criam uma `CashTransaction` de compensação na mesma
  transação (`settle` de RECEIVABLE → `SUPPLY`; de PAYABLE → `BLEED`; `reverse`
  faz o inverso), com descrição `"Baixa: {desc}"`/`"Estorno de Baixa: {desc}"` —
  essas descrições são o que o Caixa usa para bloquear edição/exclusão indevida
  (acima). **Seleção de caixa por tipo** (onda 2026-07-17/18 — ver §11):
  `requireOpenRegister` (pegava o primeiro caixa `OPEN` do operador, sem
  distinguir DIARIO/BANCO — ambíguo desde que os dois podem estar abertos ao
  mesmo tempo) foi substituída por `requireRegisterOfType(tx, userId, type)`.
  `/:id/settle` recebe `targetRegisterType` **obrigatório** no body
  (`settleAccountSchema`, shared) — o operador escolhe o destino no
  `RegisterSelectionModal` ao confirmar a baixa. `/:id/reverse` **NÃO**
  recebe esse campo do frontend (decisão deliberada do Comandante: perguntar
  ao usuário violaria o princípio de partidas dobradas — o estorno tem que
  sair do mesmo "livro" onde o dinheiro entrou) — em vez disso,
  `findOriginalRegisterType` descobre o tipo do caixa original correlacionando
  a `CashTransaction` da baixa por assinatura (mesma descrição `"Baixa:
  {desc}"`, mesmo valor, mesmo `type` SUPPLY/BLEED, a mais recente por
  `createdAt`, já que `AccountSettlement` não tem FK direta para
  `CashTransaction`), e então usa esse tipo descoberto em
  `requireRegisterOfType` para achar o caixa `OPEN` correspondente do operador
  — 400 se não estiver aberto. `PUT/DELETE` bloqueados por origem (nota/venda)
  **e por baixa existente**. Cada título tem **`code` sequencial**; status
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
  **Seletor de empresa** (multi-tenant, ver Onda 2026-07-19 em §11): quando o
  mesmo e-mail + senha conferem em mais de uma empresa (`/auth/login` retorna
  `needsCompanySelection`), a tela troca o formulário por um card de seleção
  (reaproveita 100% o design system — `icon-tile`, `btn-ghost`, `gradient-text`,
  nenhuma classe nova) sem pedir e-mail/senha de novo; "Voltar" retoma o
  formulário normal. Fluxo sem colisão (o caso comum, hoje 100% dos logins
  reais) continua idêntico a sempre — zero fricção nova.
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
  **Seleção de destino no checkout** (`RegisterSelectionModal`, componente
  compartilhado em `components/`, onda 2026-07-15/16 — ver §11): venda que não
  seja 100% "A prazo" abre esse modal antes de ser efetivamente registrada,
  para o operador escolher Caixa Físico ou Conta Banco quando os dois estão
  abertos ao mesmo tempo — sugestão inteligente por forma de pagamento
  predominante (Dinheiro → Físico; PIX/Débito/Crédito/outras → Conta Banco,
  com fallback para Físico se a Conta Banco sugerida não estiver aberta).
  Venda 100% "A prazo" pula o modal silenciosamente (não gera lançamento de
  caixa nenhum). A trava de entrada do PDV continua sendo só o Caixa Físico
  aberto — a Conta Banco só é consultada para saber se está disponível como
  destino no checkout.
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
  **Rastreabilidade + realocação de caixa** (onda 2026-07-15/16 — ver §11):
  `ViewSaleModal` mostra `RegisterTypeBadge` ("Destino: Caixa Físico"/"Conta
  Banco", ícone `Wallet`/`Landmark` — mesma convenção visual de `CashPage.tsx`/
  `PdvPage.tsx`) ao lado do `FinancialBadge` quando a venda tem
  `cashRegister` vinculado. **"Gerar financeiro" não dispara mais a mutation
  direto** — abre o `RegisterSelectionModal` (mesmo componente compartilhado do
  PDV, `components/RegisterSelectionModal.tsx`) para o operador escolher em
  qual caixa a venda volta a contar quando tem os dois abertos; tipo sugerido
  parte de `sale.cashRegister?.type` (fallback pela forma de pagamento). Ao
  confirmar, `targetRegisterType` vai no corpo de `POST /:id/financial` — o
  backend realoca `Sale.cashRegisterId`, então o lançamento some da timeline
  do caixa antigo e aparece na do novo automaticamente. "Excluir financeiro"
  não pede destino (não precisa).
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
  **Validação Zod dinâmica**: `buildVariantSchema(barcodeReq, tracksLotValidity,
  requireAverageCost)` gera o schema de variante em runtime, reaproveitado tanto no
  cadastro quanto na edição; `submit()`/`handleSave()` usam `safeParse` — erros por
  campo exibidos inline. Campos numéricos usam `z.coerce.number().min(0).catch(0)`
  para evitar "Dados inválidos" com campo vazio.
  **Cadastro multi-variante** (commit `eb1b2dd`, 2026-07-20, ver §11): o modal "Novo
  produto" (`ProductForm`) deixou de aceitar só 1 variante por produto — `variants:
  NewVariantRow[]` (client-side, chave `crypto.randomUUID()`) permite cadastrar
  várias variantes (ex.: perfume 50ml/100ml, batom em várias cores) numa única
  chamada a `POST /api/products`, que **já** aceitava `variants[]` desde sempre
  (nenhuma mudança de backend/contrato foi necessária — só a UI criava sempre 1).
  Cada linha tem SKU/código de barras/descrição/estoque inicial/lote-validade e
  precificação (custo/margem-markup/venda) **independentes**; botão "+ Adicionar
  variante" + remover por linha (bloqueado em 1, batendo com
  `createProductSchema.variants.min(1)`). `buildProductFormSchema` (schema de
  1 variante só) foi **removido** — virou código morto com a mudança.
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
  **Alternador Caixa Físico / Conta Banco** (`RegisterTypeToggle`, onda
  2026-07-15 — ver §11): pílula segmentada logo abaixo do cabeçalho da página
  (ícone `Wallet`/`Landmark`, mesmo `bg-brand-gradient`/`shadow-brand` do
  design system — nenhuma classe nova). Estado `registerType` mora só em
  `CashPage` e é passado como **prop** para as três abas (`CurrentCash`,
  `CashHistory`, `PeriodicReport`) — **nenhuma estrutura de aba foi
  duplicada**, elas só reagem ao filtro (`queryKey`/querystring `type`
  incorporados às queries React Query já existentes: `cash-current`,
  `cash-registers`, `cash-report`). `CashHistory` reseta o detalhe selecionado
  (`useEffect`) ao trocar o toggle, para não deixar o operador preso vendo o
  detalhe de um registro do tipo anterior enquanto a lista de trás já mudou de
  filtro. `POST /open` passa a enviar `type: registerType` no corpo.
  **Rótulos condicionais por tipo de saldo** (onda 2026-07-15/16 — ver §11): a
  aba "Caixa Atual" já distinguia "Saldo atual da conta"/"Saldo atual em
  caixa"; o `SummaryCard` da aba "Relatório" (antes fixo em "Dinheiro em
  gaveta") agora lê "Saldo em Conta" quando `registerType === 'BANCO'`, para
  bater com o cálculo condicional do backend (`liquidPaymentFilter`, acima).
  **Timeline com estorno virtual visível**: quando uma venda tem o financeiro
  excluído, a linha sintética `type: 'REVERSAL'` injetada pelo backend aparece
  como saída (vermelho/menos) tanto em `RegisterMovements` (Caixa Atual/
  Histórico — nenhuma mudança necessária, o ícone/cor já caem no branch
  genérico de "não-SUPPLY") quanto em `PeriodicReport` (precisou alargar o
  `type === 'BLEED'` explícito para também casar com `REVERSAL`, e trocar o
  rótulo fixo "Sangria" pela própria descrição do lançamento — "Estorno: Venda
  #X" — nesse caso específico).
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
  **Botão "Excluir financeiro" no rodapé do `ViewPurchaseModal`** (onda
  2026-07-17/18 — ver §11): a mutation (`DELETE /api/invoices/:id/financial`)
  e as flags `hasFinancial`/`hasPaid` já existiam; o gap real era o botão ficar
  **escondido** (não desabilitado) quando havia parcela já baixada, sem
  explicar ao operador por que a edição estava bloqueada. Relocado do painel
  "Contas a pagar" para o rodapé (antes de "Editar", estilo outline
  avermelhado); agora **sempre aparece** quando `hasFinancial`, ficando só
  **desabilitado** com `title` explicativo quando `hasPaid` — resolve o "beco
  sem saída" apontado pelo Comandante (editar uma compra com financeiro
  gerado exigia excluir o financeiro primeiro, mas não havia como fazer isso
  visivelmente quando já houvesse baixa).
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
  **Seleção/autodetecção de caixa por tipo** (onda 2026-07-17/18 — ver §11):
  `SettleModal` abre o `RegisterSelectionModal` compartilhado (mesmo
  componente do PDV/Vendas) ao confirmar a baixa — sem seletor de forma de
  pagamento no modal (baixa não registra "método"), o `defaultType` sugerido
  é sempre `'DIARIO'`, mesmo fallback do checkout do PDV. **O estorno NÃO
  pergunta nada** — o botão "Estornar última baixa" voltou a um
  `window.confirm` simples; o backend descobre sozinho em qual caixa a baixa
  original entrou e lança a compensação lá (ver bullet do Financeiro acima,
  `findOriginalRegisterType`) — decisão explícita do Comandante para não abrir
  margem a furo contábil (o estorno tem que sair do mesmo livro onde entrou,
  nunca de um escolhido livremente).
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
- ✅ **Back-Office da Exodus — Painel de Gestão de Contratos + Impersonate**
  (Plano Mestre V2.0, Frente 1, frontend — ver Onda 2026-07-28/2026-07-28b
  em §11): rota protegida
  `/admin/contratos` (`AdminContractsPage.tsx`), acessível **apenas** a quem
  tem `user.isSuperAdmin === true` no store Zustand — sinal novo, lido
  fresco de `GET /auth/me` a cada login (mesmo raciocínio de
  `allowedPages`/`companyId`: nunca no JWT, sempre recalculado no backend
  comparando o e-mail do usuário com `SUPER_ADMIN_EMAIL`). Eixo de
  autorização **separado** do RBAC por papel (`ADMIN`/`CASHIER` de tenant) —
  um `ADMIN` comum de uma loja cliente é bloqueado normalmente.
  `<SuperAdminRoute>` (`components/SuperAdminRoute.tsx`) é a trava de UX no
  frontend (redireciona para `/pdv` se `isSuperAdmin` for `false`); a
  autorização real continua sendo `assertSuperAdmin` no backend
  (`routes/admin.ts`), reavaliada a cada chamada administrativa — a rota
  frontend nunca é, sozinha, o limite de segurança. Página em Padrão Ouro:
  cabeçalho com faixa de aviso de área restrita, abas por status
  (`PENDING`/`ACTIVE`/`REJECTED`/`BLOCKED`/Todas), busca client-side
  (nome/CNPJ/administrador) sobre a lista já filtrada por aba, e botões de
  ação por linha (Aprovar/Rejeitar/Bloquear/Reativar) que chamam `PATCH
  /api/admin/companies/:id/status` (`useMutation`) — salvaguarda
  anti-autobloqueio do backend replicada na UI (botão "Bloquear" desabilitado
  na própria empresa do super admin). Entrada de acesso discreta: ícone
  `ShieldCheck` no header do `Layout.tsx`, visível só quando
  `user.isSuperAdmin` — **não** entra na lista `navItems`/sidebar/bottom-nav
  (esses são filtrados por `canAccess(pageKey)`, um conceito de RBAC de
  tenant que não se aplica aqui). Novo método `api.patch` em `lib/api.ts`
  (faltava — só existiam `get`/`post`/`put`/`del`).
  **Impersonate ("Acessar Loja") — Missão 2, ver Onda 2026-07-28b em §11**:
  botão na linha de cada empresa `ACTIVE` (exceto a do próprio super admin)
  dispara `POST /api/admin/impersonate`; `store/auth.ts` ganhou
  `impersonateLogin`/`exitImpersonate`/`originalAdminToken`/
  `originalAdminUser`/`impersonatingCompanyName` — a sessão real do super
  admin fica guardada para retorno sem novo login, e o `user` ativo é
  reconstruído localmente (não via `GET /auth/me`, que sempre devolveria o
  `companyId` do PRÓPRIO usuário, não o da empresa-alvo). `<ImpersonateBanner>`
  fica fixa no topo do `Layout` (faixa "MODO SUPORTE" + botão "Encerrar
  Suporte") sempre que `impersonatingCompanyName` não for nulo; entrar e
  sair fazem `window.location.href` (reload completo, não `navigate`) para
  remontar o React Query do zero, sem risco de cache de um tenant vazar
  para o outro por uma fração de segundo.

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

**Isolamento multi-tenant do Dexie** (Plano Mestre V2.0, ver Onda 2026-07-19 em
§11): `saleQueue`/`variants` (schema Dexie v2) carregam `companyId` — gravado
pelo `enqueueSale`/`cacheVariants` a partir da sessão ativa, e usado para
filtrar `flushQueue`/`retryFailed`/`lookupByBarcode`, para que a fila/cache
local de um tenant nunca seja lida nem sincronizada sob a sessão de outro no
mesmo dispositivo (risco real: tablet reaproveitado entre lojas). `logout()`
(`store/auth.ts`) **recusa sair** se ainda houver vendas locais não
sincronizadas do tenant ativo (tenta um flush final se online antes de
bloquear) — evita apagar dinheiro real ainda não confirmado no servidor;
só então purga `saleQueue`+`variants` e o token/estado. Migração v1→v2 do
Dexie carimba linhas pré-existentes (sem `companyId`) com o tenant da sessão
ativa no momento do upgrade, em vez de descartá-las.

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
| `Company` (nova) + `companyId` em 15 tabelas de negócio | Multi-tenant (Plano Mestre V2.0) — arquitetura de isolamento lógico por empresa, ver §5/§11 Onda 2026-07-19. `User.companyId` continua opcional (deliberado — futuro `SYSTEM_ADMIN`). |
| `User.email`, `ProductVariant.sku`/`barcode`, `Person.document`: `@unique` global → `@@unique([companyId, campo])` | Fecha o único risco real de colisão entre tenants (ex.: duas lojas com o mesmo código de barras de fabricante). `Company.document`/`Invoice.accessKey` permanecem globais de propósito. |

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
| — | Caixa: Caixa Físico / Conta Banco (toggle por tipo) | `CashRegister.type`, `routes/cash.ts`, `CashPage.tsx` | ✅ |
| — | Compra manual multi-produto + nº doc + contas a pagar | `routes/invoices.ts` (`/manual`), `PurchasesPage.tsx` | ✅ |
| — | Financeiro: baixa parcial + estorno + filtros + código | `AccountSettlement`, `routes/financial.ts`, `FinancialPage.tsx` | ✅ |
| — | Acerto de estoque (inventário) | `routes/products.ts` (`/adjust-stock`), `StockAdjustPage.tsx` | ✅ |
| — | Dashboard financeiro por período | `routes/dashboard.ts`, `DashboardPage.tsx` | ✅ |
| — | Configurações (ADMIN): produto, recebimentos, empresa | `routes/settings.ts`, `pages/SettingsPage.tsx`, `Setting` model | ✅ |

---

## 9. Modelo de dados (entidades)

`Company` 1—N (todas as tabelas de negócio via `companyId`), `User`, `Product`
1—N `ProductVariant`, `Person` (CLIENT|SUPPLIER), `Invoice` 1—N `InvoiceItem`,
`SupplierProductMapping`, `CashRegister` 1—N `CashTransaction`/`Sale`, `Sale`
1—N `SaleItem`/`SalePayment`, `StockMovement`, `FinancialAccount` 1—N
`AccountSettlement`, `Setting` (chave/valor, `@@unique([companyId, key])`).
Campos `role`, `type`, `status` etc. são `String` no Prisma (flexibilidade) mas
**validados por `z.enum`** na borda (`packages/shared/src/enums.ts`) — exceto o
método de pagamento da venda, **relaxado para string** (tipos de recebimento
configuráveis). Detalhe completo: `apps/api/prisma/schema.prisma`.

**Migrações (todas aditivas/seguras, lista não exaustiva — ver
`apps/api/prisma/migrations/`):** `0_init`, `add_lot_validity_control`,
`add_settings`, `sale_discount_surcharge_notes`, `financial_account_sale_link`,
`sale_payments`, `invoice_document_notes`, `financial_settlements_code`,
`sale_code_financial_flag`, `product_person_code`,
`20260626000000_add_average_cost_to_variants`, `20260702000000_add_person_trade_name`,
`20260710011551_add_invoice_nfe_number`, `20260710041311_add_code_to_stock_adjustments`,
`20260713021023_add_invoice_expenses` (`Invoice.freight`/`Invoice.otherExpenses` —
landed cost, ver §5 Compras e Onda 2026-07-13 em §11),
`20260714020913_add_cash_register_type` (`CashRegister.type` — Caixa Físico/Conta
Banco, ver §5 Caixa e Onda 2026-07-15 em §11),
`20260719023334_add_company_multi_tenant` (model `Company` + `companyId`
nullable em 16 tabelas — Fase 1),
`20260719030000_adjust_setting_composite_key` (`Setting.key` deixa de ser PK,
vira `@@unique([companyId, key])`),
`20260719032607_company_id_required` (`companyId` obrigatório em 15 tabelas —
Fase 4) e `20260719050000_tenant_scoped_unique_constraints` (`User.email`,
`ProductVariant.sku`/`barcode`, `Person.document`: `@unique` global →
`@@unique([companyId, campo])`) — as 4 últimas ainda só na branch
`feature/multi-tenant`, ver §5/§11 Onda 2026-07-19. Aplicadas automaticamente
no Railway a cada deploy (`prisma migrate deploy`) assim que a branch for
mesclada na `main`.

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

- ✅ **Onda 2026-07-15 — Caixa Físico / Conta Banco** (2026-07-15): branch
  `feature/conta-banco` — **mesclada via PR #21** (`1862448`), commit único
  `7fb684e`. Regra arquitetural seguida à risca (pedido do Comandante): **sem
  tabela nova, sem rota nova** — a distinção inteira vive numa única coluna a
  mais na tabela `CashRegister` já existente.
  - **Schema**: `CashRegister.type String @default("DIARIO")` + `@@index([type])`
    (migração aditiva `20260714020913_add_cash_register_type`, sem migração de
    dados — todo registro pré-existente já nasce `'DIARIO'` pelo default).
  - **Shared**: enum `CashRegisterType = z.enum(['DIARIO', 'BANCO'])`
    (`enums.ts`, mesmo padrão de `CashRegisterStatus`); `openCashSchema` ganhou
    `type` (default `'DIARIO'`); novo `cashRegisterTypeQuerySchema` reutilizado
    nas 3 rotas de leitura.
  - **Backend** (`routes/cash.ts`): `/current`, `/registers` e `/report`
    passaram a filtrar por `type` **no mesmo objeto `where` do RBAC já
    existente**, sem tocar na lógica de dono (`ADMIN` vê tudo, `CASHIER` só o
    próprio — auditado linha a linha nesta onda, nada regrediu). `/current`
    permanece estritamente individual, sem bypass de ADMIN. `/open` escopa a
    checagem de "já aberto" por tipo — operador pode ter um caixa físico e uma
    conta banco abertos ao mesmo tempo (livros independentes); só não pode
    abrir dois do mesmo tipo.
  - **Frontend** (`CashPage.tsx`): `RegisterTypeToggle` (pílula segmentada,
    ícones `Wallet`/`Landmark`) com estado único em `CashPage`, passado como
    prop para as 3 abas (`CurrentCash`, `CashHistory`, `PeriodicReport`) — elas
    só ganharam o filtro nas queries React Query já existentes
    (`cash-current`/`cash-registers`/`cash-report` com `registerType` na
    `queryKey` + querystring `type` na chamada), nenhuma estrutura de aba foi
    duplicada. `CashHistory` reseta o detalhe selecionado ao trocar o toggle.
  - **Ambiente local estava desatualizado no início desta onda**: `main` local
    e a branch de trabalho anterior (`feature/xml-import-visual`) estavam 87
    commits atrás do `origin/main` real (faltavam os PRs #7→#20 inteiros, já
    mesclados em produção) — sincronizado (`git pull` + nova branch a partir do
    `origin/main` atualizado) antes de iniciar qualquer alteração, para não
    nascer a feature em cima de uma base obsoleta.
  - **Testado ao vivo end-to-end** (2026-07-15): ambiente completo local
    (Docker + Postgres + migrações + seed + API + Web) validado pelo
    Comandante no navegador — abrir caixa físico e conta banco em paralelo,
    alternar as 3 abas com o toggle, sangria/suprimento em cada tipo. **Já em
    produção** (push do PR #21 disparou o auto-deploy do Railway).
  `npm run typecheck` (shared+api+web) → **0 erros**.

- ✅ **Onda 2026-07-15/16 — Propagação Caixa Físico/Conta Banco para PDV e
  Vendas** (2026-07-15 a 2026-07-16): branch `feature/pdv-selecao-caixa`
  (criada a partir da `main` pós-merge da PR #21) — **mesclada via PR #22**
  (`e708158`, 2026-07-16). 5 commits (`8cd99a9`→`cd9b105`). Continuação
  direta do §14.1 (propagar o
  toggle da onda anterior para além da tela de Caixa) — cobre PDV e Vendas;
  o Financeiro propriamente dito (`/financial/:id/settle`/`/reverse`,
  `NewEntryModal`/`SettleModal`) **fica pendente para a próxima onda** (ver
  §12 item 17). Nenhuma migração/mudança de schema nesta branch.
  - **`8cd99a9`** (seleção de destino no checkout do PDV): **achado de
    premissa** — a missão original propunha rotear a venda no backend por
    `targetRegisterType` (`findFirst({userId, status:'OPEN'})`), mas
    `createSale` já recebia `cashRegisterId` direto no payload e resolvia por
    `findUnique({where:{id}})` — nunca fez lookup implícito, então não havia
    nada para "rotear" no servidor; a lacuna era 100% frontend. `PdvPage.tsx`
    passou a buscar também `/api/cash/current?type=BANCO`; `doSale` decide o
    destino antes de `submitSale` (renomeado do antigo `doSale` monolítico):
    venda 100% "A prazo" pula direto (sem lançamento de caixa); as demais
    calculam a forma de pagamento dominante (por soma, cobre split) e abrem o
    novo `RegisterSelectionModal` com sugestão inteligente (Dinheiro→Físico,
    resto→Conta Banco, com fallback para Físico se a Conta Banco sugerida não
    estiver aberta). Os três caminhos de finalização (pagamento rápido, modal
    de confirmação, split) já convergiam para essa função, então um único
    ponto de interceptação bastou. **Testado ao vivo**: com os dois caixas
    abertos, `POST /api/sales` com `cashRegisterId` da Conta Banco criou a
    venda corretamente atribuída a ela (confirmado via
    `GET /cash/:id/movements`); venda de teste excluída depois.
  - **`9e36a78`** (cálculo de saldo condicional por tipo): `computeExpectedCash`
    filtrava `SalePayment` só por `method: 'CASH'` **incondicionalmente** —
    uma Conta Banco nunca contava PIX/cartão no próprio saldo, mesmo esses
    sendo o "dinheiro" daquele livro. Novo `liquidPaymentFilter(registerType)`:
    DIARIO mantém a regra estrita (`method: 'CASH'`); BANCO passa a usar
    `method: { not: 'A_PRAZO' }` (tudo entra, só "a prazo" fica de fora por
    virar conta a receber, não caixa-equivalente). `AccountSettlement`/
    `CashTransaction` **não precisaram do mesmo tratamento** — checado e
    confirmado que `CashTransaction` não tem coluna `method`, então a
    agregação já era agnóstica ao tipo de caixa. `GET /report`'s
    `cashInDrawer` sofria do mesmo viés — corrigido com um `isLiquid(method)`
    equivalente. Frontend: `SummaryCard` da aba Relatório (antes fixo em
    "Dinheiro em gaveta") passou a ler "Saldo em Conta" quando
    `registerType === 'BANCO'` (a aba Caixa Atual já tinha essa distinção de
    uma onda anterior). **Testado ao vivo**: venda PIX vinculada ao BANCO
    moveu `expectedCash` 410→670 (+260 exato); uma venda PIX de controle
    vinculada ao DIARIO deixou o saldo físico intacto (360→360);
    `GET /report?type=BANCO` bateu exatamente com `/current` (670). Vendas de
    teste excluídas depois.
  - **`3bdceee`** (rastreabilidade + investigação de bug inexistente): a
    missão original alegava que excluir o financeiro de uma venda vinculada
    ao BANCO não revertia o saldo corretamente — **premissa falsa**,
    verificada ao vivo antes de tocar em qualquer código: `DELETE
    /:id/financial` já só alterna `financialGenerated`, e a agregação de
    `computeExpectedCash` já filtra por esse flag independente do tipo de
    caixa (fix do commit anterior nesta mesma branch já cobria isso). Uma
    venda PIX de teste no BANCO confirmou o ciclo exato: criar moveu
    410→670, excluir o financeiro voltou para 410 em ponto, `cashRegisterId`
    intacto. O que era real: `GET /sales/:id` não incluía `cashRegister`
    (frontend não tinha como saber a qual caixa uma venda pertencia) e
    `ViewSaleModal` não tinha indicador visual nenhum para isso — corrigido
    com `cashRegister: { select: { type } } }` no include e um novo
    `RegisterTypeBadge` (mesma convenção de ícone/cor de `CashPage.tsx`/
    `PdvPage.tsx`) ao lado do `FinancialBadge`.
  - **`239af17`** (injeção virtual de estorno na timeline): quando uma venda
    tem o financeiro excluído, o saldo do caixa cai mas a timeline não
    mostrava nenhum motivo visível — só a venda original (agora "sem
    financeiro"), sem nenhuma linha explicando o porquê da queda. Novo
    `saleTimelineEntries(sale, operator?)` (compartilhado por
    `GET /:id/movements` e `GET /report`, substituindo `.map()`s quase
    duplicados) injeta uma entrada sintética adicional quando
    `financialGenerated === false` — **não é uma `CashTransaction` real**
    (evita dupla dedução), só um objeto formatado para a UI. **Desvio
    deliberado da missão**: o `type` sugerido era `'BLEED'`, mas
    `CashPrintButton` (recibo impresso de fechamento) soma movimentos com um
    filtro explícito `type === 'BLEED'` — usar o mesmo valor inflaria essa
    soma com uma "sangria" fantasma no papel impresso. Usado `type:
    'REVERSAL'` (valor distinto, automaticamente fora de todo filtro
    `=== 'BLEED'` já existente); `PeriodicReport` precisou de um alargamento
    pontual (`type === 'BLEED'` → também casa `REVERSAL`) e troca do rótulo
    fixo "Sangria" pela descrição real do lançamento nesse caso
    (`"Estorno: Venda #X"`); `RegisterMovements` não precisou de nenhuma
    mudança (o ícone/cor já cai no branch genérico "não-SUPPLY"). Também:
    `Sale` não tem `updatedAt` (só `createdAt`/`soldAt`) — o timestamp da
    entrada virtual é `soldAt + 1ms` (marcador sintético de "logo depois",
    não um evento real registrado). **Testado ao vivo**: venda PIX no BANCO
    apareceu como uma entrada só; após excluir o financeiro, a mesma consulta
    passou a trazer a venda (agora `financialGenerated: false`) **e** a
    entrada virtual `REVERSAL` com a descrição/valor batendo — confirmado
    também no timeline consolidado de `/report`.
  - **`cd9b105`** (seleção de destino na recriação do financeiro de Vendas):
    o botão "Gerar financeiro" (`ViewSaleModal`, `SalesPage.tsx`) sempre
    recriava o financeiro no mesmo caixa de origem da venda. `RegisterSelectionModal`
    **extraído** do PdvPage.tsx para `components/RegisterSelectionModal.tsx`
    (componente global, mesmas props/convenção já usada em todo o app —
    `onClose`, não `onCancel`; renderização condicional pelo pai, sem prop
    `isOpen` — a sugestão de nomenclatura da missão foi adaptada ao padrão
    real do codebase, não ao inverso); reaproveitado no PDV sem mudar
    comportamento. Novo `regenerateSaleFinancialSchema` (shared,
    `{ targetRegisterType: CashRegisterType.optional() }`) no body de
    `POST /:id/financial`; `setSaleFinancialGenerated` passou a aceitar
    `{ userId, targetRegisterType }` — quando informado, busca o
    `CashRegister` `OPEN` daquele tipo do usuário logado (mesmo padrão
    `findFirst` de `requireOpenRegister` em `financial.ts`), lança
    `AppError(400)` se não achar, e move `Sale.cashRegisterId` na mesma
    transação que reativa `financialGenerated`. **Achado de premissa**:
    "recriar os pagamentos" (texto da missão) não corresponde a nenhum
    comportamento real — `SalePayment` só referencia `saleId`, nunca um
    caixa; mover só o `cashRegisterId` da venda já é suficiente, e é
    exatamente isso que faz o lançamento sumir/aparecer nas timelines (todas
    já escopadas por esse campo). `SalesPage.tsx`: clique em "Gerar
    financeiro" agora abre o `RegisterSelectionModal` em vez de disparar a
    mutation direto; tipo sugerido vem de `sale.cashRegister?.type` (fallback
    pela forma de pagamento). **Testado ao vivo**: venda de teste de R$10 no
    DIARIO — excluir financeiro tirou os R$10 do DIARIO (370→360); regerar
    com destino BANCO moveu `cashRegisterId` para o caixa Conta Banco, manteve
    o DIARIO em 360 e somou os R$10 no BANCO (430→440) — exatamente "some de
    um caixa, aparece no outro". Venda de teste excluída ao final, saldos
    restaurados.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em
  todos os commits.

- ✅ **Onda 2026-07-17/18 — Fecha o §14.1: seleção de caixa em Vendas
  (edição) e Financeiro (baixa/estorno); botão "Excluir financeiro" em
  Compras** (2026-07-17 a 2026-07-18): branch `feature/edicao-venda-selecao-
  caixa` (criada a partir da `main` pós-merge da PR #22) — **mesclada via
  PR #23** (`68f9579`). 4 commits (`0cb9996`→`1acd74a`). Sem migração/mudança
  de schema em nenhum commit.
  - **`0cb9996`** (seleção de destino na edição de venda): `updateSaleSchema`
    (shared) ganhou `targetRegisterType` opcional; `updateSale`
    (`services/sales.ts`) passou a receber `userId` como terceiro parâmetro
    (threaded de `req.user.sub` na rota `PUT /sales/:id`) e, quando o tipo é
    informado, busca o `CashRegister` `OPEN` do usuário logado daquele tipo e
    move `Sale.cashRegisterId` na mesma transação que recria o financeiro —
    mesmo mecanismo já usado em `setSaleFinancialGenerated` (onda anterior).
    `EditSaleModal` (`SalesPage.tsx`): `handleSaveClick` calcula um
    `defaultType` (Dinheiro→DIARIO, resto→BANCO) e abre o
    `RegisterSelectionModal` compartilhado em vez do antigo `window.confirm`
    genérico — pagamento em dinheiro passa primeiro pela calculadora de
    troco, só then abrindo o seletor de caixa. **Desvio deliberado**: o
    estado de controle usa `{ defaultType } | null` (mesmo padrão de
    `changeConfig`, já existente no arquivo) em vez do `{ isOpen: boolean,
    defaultType }` sugerido na missão — nenhum modal do projeto usa prop
    `isOpen`, o pai sempre renderiza condicionalmente. **Testado ao vivo**:
    venda de R$15 no DIARIO (360→375); editada trocando pagamento para PIX e
    destino para BANCO — `cashRegisterId` mudou, DIARIO voltou a 360, BANCO
    subiu para 445 (+15).
  - **`5aab3ac`** (seleção de destino na baixa/estorno do Financeiro):
    `settleAccountSchema` ganhou `targetRegisterType` **obrigatório** (não
    opcional, diferente do padrão de Vendas/PDV — aqui a missão pediu
    eliminar de vez a ambiguidade); novo `reverseAccountSchema` com o mesmo
    campo, também obrigatório. `requireOpenRegister` (`routes/financial.ts`,
    pegava o primeiro caixa `OPEN` sem distinguir tipo) **substituída** por
    `requireRegisterOfType(tx, userId, type)`, usada em `/:id/settle` e
    `/:id/reverse` (que ganhou `body: reverseAccountSchema`). `SettleModal` e
    o botão "Estornar última baixa" (`FinancialPage.tsx`) passaram a abrir o
    `RegisterSelectionModal` compartilhado. **Achado de premissa**: a missão
    sugeria usar "o método selecionado no select do modal" para sugerir
    DIARIO/BANCO, mas `SettleModal` nunca teve seletor de forma de pagamento
    (baixa não registra "método") — sem esse sinal, `defaultType` cai para
    `'DIARIO'` (mesmo fallback do PDV). **Testado ao vivo**: título a pagar
    de R$20 baixado no DIARIO (150→130); título a receber de R$10 baixado no
    BANCO (470→480); estorno do segundo **direcionado deliberadamente para o
    DIARIO** (diferente do caixa da baixa original) confirmou que a
    compensação ia para onde o operador escolhesse — comportamento que a
    onda seguinte reverteria por ser, na visão do Comandante, uma falha
    conceitual grave.
  - **`578f183`** (correção: estorno autodetecta o caixa de origem): o
    Comandante identificou que perguntar ao operador qual caixa usar no
    **estorno** fere o princípio de partidas dobradas — o estorno tem que
    sair obrigatoriamente do mesmo "livro" onde o dinheiro entrou, nunca de
    um escolhido livremente (abriria margem a furo contábil). Reverte parte
    do commit anterior: `reverseAccountSchema` removido do shared por
    completo (rota `/:id/reverse` volta a não ter `body`);
    `FinancialPage.tsx` volta ao `window.confirm("Deseja realmente estornar a
    última baixa?")` simples, sem `RegisterSelectionModal` no estorno (que
    permanece **só** na baixa, em `SettleModal`). Novo
    `findOriginalRegisterType(tx, account, settlement)` (`routes/
    financial.ts`): como `AccountSettlement` não tem FK direta para
    `CashTransaction` (o `/settle` grava as duas em paralelo, sem vínculo
    formal no schema), a correlação é feita pela assinatura exata que o
    `/settle` sempre grava — mesma descrição (`"Baixa: {descrição}"`), mesmo
    valor, mesmo `type` (SUPPLY/BLEED conforme RECEIVABLE/PAYABLE), a mais
    recente por `createdAt` (sempre estornamos a baixa mais recente do
    título). O tipo do caixa encontrado alimenta `requireRegisterOfType`
    (reaproveitada sem alterações) para validar que o operador tem
    **especificamente aquele tipo** aberto — 400 caso contrário. **Testado ao
    vivo**: título a pagar de R$33 baixado no DIARIO e título a receber de
    R$17 baixado no BANCO, ambos estornados **sem enviar nenhum body** —
    os dois saldos voltaram exatamente aos valores anteriores à baixa, cada
    um no seu próprio caixa, confirmando a detecção automática em ambos os
    sentidos.
  - **`1acd74a`** (botão "Excluir financeiro" em Compras): **achado de
    premissa** — a missão partia do princípio de que o `ViewPurchaseModal`
    (`PurchasesPage.tsx` — não existe `PurchasesPage/ViewPurchaseModal.tsx`
    como o texto sugeria) não tinha esse botão; na verdade a mutation
    (`DELETE /api/invoices/:id/financial`) e as flags `hasFinancial`/
    `hasPaid` já existiam havia ondas. O gap real: o botão ficava **escondido
    por completo** quando havia baixa (`hasFinancial && !hasPaid`), em vez de
    aparecer desabilitado com uma explicação — o "beco sem saída" de verdade
    era a falta de qualquer pista visual do motivo do bloqueio. Relocado do
    painel "Contas a pagar" (link de texto) para o rodapé do modal, antes do
    botão "Editar" (estilo outline avermelhado, ícone `Ban` — mesma
    convenção visual de Vendas); agora renderiza sempre que `hasFinancial`,
    só ficando `disabled` com o `title` explicativo pedido pela missão quando
    `hasPaid`. Reaproveitada a mutation e o `window.confirm` já existentes.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros** em
  todos os commits.

- ✅ **Onda 2026-07-19 — Arquitetura Multi-Tenant (Plano Mestre V2.0)**
  (2026-07-19): branch `feature/multi-tenant` (criada a partir de `68f9579`)
  — **mesclada na `main`** (commit direto `230e74d`, sem PR — ver nota de
  drift no topo do documento). Reestrutura o ERP de single-tenant
  para multi-tenant real, em 4 fases + uma leva final de blindagem.
  Documento externo "Plano Mestre V2.0" definiu as fases; execução em modo
  **MANUAL** (Comandante aprovou cada etapa antes de codar).
  - **Fase 1+2 — Preparação Silenciosa + Povoamento** (`b2039ad`): model
    `Company` (`id`/`name`/`document?`) + `companyId String?` nullable em 16
    tabelas de negócio (zero impacto — migração `20260719023334_add_company_
    multi_tenant`, puramente aditiva). `Setting.key` deixou de ser PK
    (colidiria entre empresas) e virou `id` + `@@unique([companyId, key])`
    (migração `20260719030000_adjust_setting_composite_key`, escrita à mão —
    Prisma exige confirmação interativa para esse tipo de aviso, não suportada
    em ambiente não-interativo). `prisma/backfill-tenant.ts` (dry-run por
    padrão) executado de verdade com `CONFIRM_BACKFILL=1`: criou a empresa
    determinística **"Inquilino Zero"** (`00000000-0000-0000-0000-
    000000000001`) e vinculou a ela as 9 linhas pré-existentes (2 User, 1
    Product, 1 ProductVariant, 1 CashRegister, 4 StockMovement).
  - **Fase 3 (preparação) — JWT + base do `withTenant`** (`0b0ff54`):
    `JwtPayload`/`AuthResponse` (shared) ganharam `companyId: string | null`;
    `/auth/login` passou a incluir a claim; novo `apps/api/src/lib/tenant.ts`
    com `withTenant(companyId)` — Prisma Client Extension
    (`$extends`/`$allModels`/`$allOperations`) que injeta `companyId` no
    `where` (leituras/updateMany/deleteMany em massa) ou no `data` (create/
    createMany) de 16 modelos — ainda **não conectada a nenhuma rota** nesta
    fase.
  - **Fase 4 — `companyId` obrigatório + varredura de rotas** (`7f7d001`):
    `companyId` virou `String` (obrigatório) em 15 tabelas via migração
    `20260719032607_company_id_required` (`User` continua opcional — reserva
    para um futuro papel `SYSTEM_ADMIN` cross-tenant, §4 do Plano Mestre).
    **Todas** as rotas de negócio (`auth`, `products`, `persons`, `invoices`,
    `sales`/`services/sales.ts`, `cash`, `financial`, `dashboard`,
    `purchase-suggestions`) migradas do `prisma` cru para `tenantDb(req)`
    (atalho que resolve `{ db, companyId }` do JWT, lança `ForbiddenError` se
    faltar). **Limitação conhecida do Prisma Client Extensions**: operações
    por seletor único (`findUnique`/`update`/`delete`/`upsert`) não são
    escopadas pela extensão — cada uma foi reescrita manualmente para
    `findFirst` (ou `findFirst` + validação de posse antes de agir por id).
    `Prisma.TransactionClient` e o tipo do `tx` recebido dentro de um
    `db.$transaction()` do client estendido **não são mutuamente atribuíveis**
    (branding genérico interno do Prisma) — contornado com interfaces
    estruturais mínimas (`SettingCapableClient` em `lib/settings.ts`,
    `FinancialTxClient` em `financial.ts`) descrevendo só os métodos
    realmente usados. `backfill-tenant.ts` **aposentado** (reescrito como
    registro histórico) — com `companyId` `NOT NULL`, sua lógica original de
    "achar `companyId: null`" nunca mais encontra nada. **IDOR reais
    fechados como subproduto da varredura**: `GET /persons` e `GET /products`
    (+ `by-barcode`) não tinham **nenhuma autenticação** (rotas públicas);
    `createSale`/`updateSale` e `/invoices/confirm` não validavam se um
    `variantId` vindo do cliente pertencia ao tenant; `PUT/DELETE
    /cash/transactions/:id` não checava posse por tenant. `npm run typecheck`
    → 0 erros nos 3 workspaces.
  - **Validação real do `withTenant`** (mesmo dia, script `test-tenant-flow.ts`
    na raiz, **temporário, apagado depois**): login real →
    `POST /api/persons` **sem enviar `companyId` no body** → consulta direta
    ao Postgres confirmou a coluna preenchida sozinha pela extensão, a partir
    só do JWT. Prova de ponta a ponta de que o cliente nunca precisa (e não
    consegue) informar o tenant manualmente.
  - **Fase 3 (frontend) — isolamento multi-tenant da fila offline** (`e3c534b`):
    `AuthUser` (`store/auth.ts`) passou a carregar `companyId` (lido de
    `/auth/me`, fonte fresca — mesmo raciocínio já aplicado a `allowedPages`).
    Dexie (`lib/db.ts`) subiu para `version(2)`: `saleQueue`/`variants`
    ganharam `companyId`; migração v1→v2 **carimba** linhas pré-existentes com
    o tenant da sessão ativa (não descarta vendas genuinamente pendentes de
    sincronizar — dinheiro real). `enqueueSale`/`flushQueue`/`retryFailed`
    (`lib/sync.ts`) e `cacheVariants`/`lookupByBarcode` (`lib/products.ts`)
    passaram a taguear/filtrar por `companyId` da sessão ativa. `logout()`
    virou assíncrono e **recusa sair** se sobrar item de `saleQueue` do
    tenant ativo (tenta um flush final se online; só então purga
    `saleQueue`+`variants`+token/estado) — decisão deliberada para nunca
    apagar uma venda local ainda não confirmada no servidor. Backend ganhou
    um `code` de erro distinto (`NO_TENANT`, `lib/errors.ts`/`lib/tenant.ts`)
    para sessões com JWT sem `companyId` (ex.: token emitido antes desta
    migração) — `apiFetch` (`lib/api.ts`) intercepta especificamente esse
    código para deslogar automaticamente, **sem** afetar o 403 comum de
    RBAC por papel. **Validado ao vivo pelo Comandante no navegador**:
    logout bloqueado com venda pendente offline; sincronizou e permitiu sair
    ao voltar a conexão; migração v1→v2 carimbou uma fila v1 simulada em vez
    de descartá-la.
  - **Constraints globais → tenant-scoped + login com desambiguação**
    (mesmo dia, **implementado e validado, commit ainda pendente** — ver
    aviso no topo do documento): `User.email`, `ProductVariant.sku`/
    `barcode`, `Person.document` deixaram de ser `@unique` sozinhos e
    viraram `@@unique([companyId, campo])` (migração
    `20260719050000_tenant_scoped_unique_constraints`, escrita à mão pelo
    mesmo motivo de sempre — aviso interativo do Prisma; sem backfill
    necessário, já que só existe o Inquilino Zero hoje). `Company.document`/
    `Invoice.accessKey` permanecem globais de propósito. **`/auth/login`
    redesenhado** (`routes/auth.ts`): busca todas as contas com o e-mail
    (`findMany`, deliberadamente sem filtro de tenant), valida a senha
    contra cada uma **antes** de decidir qualquer coisa (nunca revela quais/
    quantas empresas têm conta com aquele e-mail para quem não provou a
    senha — evita enumeration), e só retorna `{ needsCompanySelection: true,
    companies }` (sem token) se mais de uma conferir — caso raro
    (contador/franqueado com mesma senha em duas lojas). Novos schemas
    `loginNeedsCompanySchema`/`loginResponseSchema`/`LoginCompanyOption`
    (shared); `loginSchema` ganhou `companyId?`. Frontend
    (`LoginPage.tsx`/`store/auth.ts`): `login()` retorna `LoginResult`
    (`{ok:true}` ou `{ok:false, companies}`); tela alterna para um card de
    seleção de empresa nesse segundo caso, reaproveitando 100% o design
    system. **`prisma/seed.ts` corrigido**: os usuários de bootstrap local
    (`admin@exodus.local`/`caixa@exodus.local`) eram criados **sem
    `companyId`** (campo era opcional, ninguém tinha notado — só não dava
    problema porque o backfill da Fase 2 já tinha corrigido retroativamente
    os dois únicos usuários existentes); corrigido para primeiro garantir a
    empresa "Inquilino Zero" (mesmo id determinístico do backfill) e só
    então criar os usuários já com `companyId`, usando o seletor de chave
    composta `companyId_email` no `upsert`. `error-handler.ts`: mensagem do
    `P2002` filtra `companyId` da lista de campos exibida ("Registro já
    existe (sku)", não "(companyId, sku)"). **Achado durante a regeneração
    do Prisma Client**: `npx prisma generate` falhou (`EPERM` no
    `query_engine-windows.dll.node`) porque o `dev:api` de uma sessão
    anterior ainda estava de pé (4 processos `node`/`tsx watch`
    remanescentes, terminal diferente do que o Comandante achava ter
    fechado) — resolvido localizando os PIDs reais via
    `Get-CimInstance Win32_Process` e encerrando-os explicitamente após
    confirmação. **Validado ao vivo**: `curl` direto em `/auth/login`
    confirmou `needsCompanySelection` com as duas empresas; segundo request
    com `companyId` emitiu token normalmente; Comandante testou o seletor na
    tela real criando uma segunda `Company` + um segundo usuário
    `admin@exodus.local`/`admin12345` **direto no banco** (script
    descartável, sem migração) — visual e fluxo aprovados; dados de teste
    removidos ao final (`prisma.user.delete`/`prisma.company.delete`,
    confirmado com re-consulta). `npm run typecheck` (shared+api+web) →
    **0 erros**.
  - **Pendência real identificada, fora do escopo desta onda**: não existe
    nenhuma rota de provisionamento de tenant — `Company` só nasce via
    script/inserção direta no banco. Ver §12.

- ✅ **Onda 2026-07-20 — Kickoff "Motor da Loja: Catálogo e Estoque"
  (multi-variante no cadastro de produto)** (2026-07-20): branch
  `feature/multi-tenant`, commit `eb1b2dd` (topo da branch antes de ela
  virar `main`). Sprint curto, iniciado a partir da sugestão do Gemini
  (§14.1b) de investir no módulo de Catálogo/Estoque.
  - **Achado de premissa (backend)**: a missão pedia criar/atualizar
    `routes/products.ts` com `GET`/`POST` tenant-isolados e citava um model
    `Inventory` — **nenhum dos dois existe como gap real**. `routes/
    products.ts` já tinha `GET /` (lista paginada/filtros/ordenação) e
    `POST /` (cria produto + variantes + `StockMovement` inicial) completos e
    escopados por `tenantDb(req)` desde a Fase 4 (ver Onda 2026-07-19), e já
    registrado em `routes/index.ts`. Não existe model `Inventory` — estoque
    vive em `ProductVariant.stockQty` + o ledger `StockMovement`. **Nenhuma
    linha de backend foi tocada** — reescrever um arquivo em produção já
    validado sem gap real seria risco de regressão sem ganho.
  - **Gap real identificado e fechado (frontend)**: `ProductForm`
    (`ProductsPage.tsx`, modal "Novo produto") só permitia cadastrar 1
    variante por produto, apesar de `POST /api/products` **já aceitar**
    `variants: CreateVariantInput[]` (sem nenhuma mudança de contrato
    necessária). Reescrito para multi-variante — ver §5 Produtos para o
    detalhamento completo (`NewVariantRow[]`, `addVariant`/`removeVariant`,
    precificação independente por linha). `buildProductFormSchema` (schema
    de "exatamente 1 variante") **removido** — virou código morto;
    `buildVariantSchema` (por linha) foi reaproveitado tal como já usado por
    `EditProductModal`. Cobre o caso de uso citado (perfume 50ml/100ml,
    batom em várias cores) numa única chamada ao endpoint que já existia.
  - ⚠️ **Achado ao reconciliar com a Onda 2026-07-22b/§14 seguintes**: este
    commit ficou sem registro em `CLAUDE.md` até agora — a sessão que
    documentou o merge da `feature/lgpd-encryption` (PR #24, ver Onda
    2026-07-23c) não tinha visibilidade deste commit paralelo (ambos
    avançaram a partir de `230e74d` de forma independente antes de
    convergirem em `main`). §12 item 6 estava incorretamente listado como
    pendência até esta correção.
  `npm run typecheck -w @exodus/web` → **0 erros**.

- ✅ **Onda 2026-07-22b — Criptografia de Dados Sensíveis (Plano Mestre
  V2.0, Frente 2 — LGPD)** (2026-07-22): branch `feature/lgpd-encryption`
  (criada a partir da `main`, **independente** da branch de onboarding —
  ver nota de drift em §14.1b/topo do documento sobre as duas frentes
  seguirem em paralelo sem merge ainda). Commit único. Cifra
  `Person.document`/`email`/`phone` em repouso.
  - **`lib/encryption.ts`** (novo): duas primitivas sobre o módulo nativo
    `crypto`. `encryptDeterministic`/`decryptDeterministic` (AES-256-CBC,
    IV derivado via HMAC-SHA256 do texto claro) para `document` — precisa
    suportar busca exata. `encryptRandom`/`decryptRandom` (AES-256-GCM, IV
    aleatório, autenticado) para `email`/`phone`. **Achado de design
    corrigido durante a implementação**: a missão original sugeria "IV
    derivado" sem detalhar o armazenamento — um IV puramente derivado do
    texto claro não pode ser re-derivado na hora de decifrar (o texto claro
    é exatamente o que ainda não temos); o IV continua sendo GRAVADO junto
    do ciphertext (como em qualquer CBC), só que agora de forma
    reproduzível — a mesma entrada sempre grava o mesmo IV, e é isso que
    faz a busca por igualdade bater. Prefixos versionados (`encdet1:`/
    `encgcm1:`) permitem ao decrypt reconhecer o esquema certo por valor, e
    — crucial num sistema já em produção com dados reais — diferenciar
    ciphertext de texto legado ainda não migrado (`decryptField` devolve
    texto sem prefixo reconhecido intacto, em vez de tentar decifrar e
    quebrar).
  - **`withEncryption`** (mesmo arquivo): extensão do Prisma com DOIS
    componentes de responsabilidades separadas — `query.person.
    $allOperations` só mexe em argumentos (cifra `data`/`create`/`update`
    nas escritas; cifra `where.document` nas leituras, descendo
    recursivamente por `AND`/`OR`/`NOT`); `result.person.
    {document,email,phone}` são campos computados que decifram o retorno.
    **Achado de arquitetura não previsto na missão, descoberto e validado
    ao vivo**: um hook de `query` escopado a `person` só dispara quando
    `Person` é o model RAIZ da chamada — nunca veria `FinancialAccount.
    findFirst({ include: { person: true } })`, `Invoice`+`supplier: true`
    ou `Sale`+`client: true` (relações aninhadas), que ficariam com
    document/email/phone cru (cifrado) vazando no JSON de resposta dessas
    telas. O componente `result` do Prisma Client Extensions resolve isso
    nativamente — computa o campo em QUALQUER lugar que uma linha de
    `Person` apareça na resposta, aninhada ou não — sem precisar de nenhum
    tratamento especial nessas três rotas. Confirmado ao vivo com um
    `FinancialAccount` de teste incluindo `person: true`.
  - **Integração**: `withTenant` (`lib/tenant.ts`) passou a compor
    `withEncryption(prisma).$extends({name:'withTenant', ...})` em vez de
    partir do `prisma` cru — toda rota que já usa `tenantDb(req)` ganha
    criptografia transparente para `Person` sem precisar saber disso; o
    `tx` de um `db.$transaction()` herda as duas extensões (comportamento
    nativo do Prisma, confirmado ao vivo com `tx.person.create` dentro da
    transação de `/invoices/confirm`).
  - **`ENCRYPTION_KEY`** (`env.ts`): 32 bytes em hex ou base64, validado
    com `.refine()` e fail-fast no boot — mesmo padrão de `JWT_SECRET`.
    Adicionada a `.env.example` e ao `.env` local (gitignorados).
  - **Limitação documentada, não corrigida (impossível de corrigir)**:
    `document: { contains: search }` (usado pelo parâmetro `search` de
    `GET /persons`) para de funcionar sob criptografia determinística —
    não existe esquema que suporte busca por substring em ciphertext sem
    trocar a arquitetura inteira (ex.: um índice cego por n-gramas, fora de
    escopo). **Confirmado que não é uma regressão prática**: a única tela
    real (`RegistrationsPage.tsx`, "busca onisciente" da Onda 2026-07-02)
    já filtra 100% client-side e nunca envia `search` para o backend — o
    parâmetro já estava vestigial antes desta onda.
  - **Script de backfill** (`prisma/backfill-person-encryption.ts`, novo,
    mesmo padrão dry-run de `backfill-tenant.ts`): migra `Person`s já
    existentes em texto claro. **Não fazia falta rodar nesta sessão** — o
    banco de dev usado para os testes ao vivo não tinha nenhum `Person`
    pré-existente (dry-run confirmou "0 pendentes"); **fica pendente rodar
    contra produção** antes de considerar a Frente 2 realmente completa
    (ver §12.20).
  - **Testado ao vivo, ponta a ponta, contra o dev API**: `POST /api/persons`
    real via HTTP retornou os 3 campos em texto claro; leitura direta do
    Postgres com Prisma CRU (sem a extensão) confirmou ciphertext de
    verdade gravado (`encdet1:.../encgcm1:...`), não texto claro; busca
    exata por `document` encontrou o registro certo; busca por `document`
    inexistente voltou vazia sem erro; `select` parcial (só
    `id`/`name`/`tradeName`, mesmo formato de `GET /settings/sales`) não
    vazou os campos cifrados; `include` aninhado em `FinancialAccount`
    decifrou corretamente (e com `select` parcial dentro do include,
    também não vazou); tentativa de duplicar `document` na mesma empresa
    bloqueada por `@@unique([companyId, document])` (P2002), provando que
    o esquema determinístico preserva a unicidade; um registro inserido
    via Prisma cru simulando dado legado pré-Frente-2 foi lido sem quebrar.
    Todos os dados de teste removidos ao final (nenhum resíduo).
  `npm run typecheck` + `npm run build` (api) → **0 erros**.

- ✅ **Onda 2026-07-22c — Anonimização / Direito ao Esquecimento (Plano
  Mestre V2.0, Frente 3 — LGPD)** (2026-07-22): mesma branch
  `feature/lgpd-encryption` (continuação direta da Frente 2 — anonimização
  depende da extensão de criptografia recém-criada). Commit único.
  `POST /api/persons/:id/anonymize` (`routes/persons.ts`, só ADMIN) —
  sempre `UPDATE`, nunca `DELETE`: sobrescreve `name`/`tradeName`/
  `document`/`email`/`phone`/endereço com valores ofuscados
  (`ANON-{crypto.randomUUID()}`/`anon-{uuid}@exodus-deleted.com`/
  `00000000000`/`null`), preservando o `id` para não quebrar
  `Sale.clientId`/`Invoice.supplierId`/`FinancialAccount.personId`. Os
  novos valores passam pelo `db.person.update` comum — a extensão
  `withEncryption` da Frente 2 cifra `document`/`email`/`phone`
  automaticamente, sem nenhum código extra: o `ANON-{uuid}` fica
  duplamente ilegível no banco (texto ofuscado, depois cifrado).
  **Achado de premissa**: a missão pedia atualizar um campo `updatedAt` em
  `Person` — o model **não tem** `updatedAt`/`createdAt` no schema; não foi
  criada uma migração só para isso (fora do escopo pedido, afetaria toda
  leitura/serialização de `Person` sem necessidade real) — o passo foi
  simplesmente omitido, sem impacto no restante da funcionalidade. Nenhum
  schema novo no `packages/shared` foi necessário — o único "param" é
  `id: uuid()`, já coberto pelo padrão inline (`z.object({ id: z.string().
  uuid() })`) que toda outra rota deste arquivo já usa; não havia
  precedente de expor esse tipo de schema trivial no pacote compartilhado.
  **Testado ao vivo**: pessoa de teste vinculada a um `FinancialAccount`
  real — `DELETE /persons/:id` normal bloqueado com 422 (prova de que a
  anonimização é mesmo a alternativa necessária); `POST .../anonymize`
  retornou 200 com todos os campos sobrescritos; leitura direta do
  Postgres (Prisma cru, sem a extensão) confirmou `document`/`email`
  cifrados (`encdet1:`/`encgcm1:`) por cima do texto já anonimizado, não o
  texto puro `ANON-{uuid}`; `FinancialAccount.personId` continuou
  apontando para o mesmo `id` (integridade referencial preservada); 404
  para id inexistente; 403 para usuário `CASHIER` (RBAC). Dados de teste
  removidos ao final.
  `npm run typecheck` + `npm run build` (api) → **0 erros**.

- ✅ **Onda 2026-07-22d — Impersonate Administrativo + Auditoria (Plano
  Mestre V2.0, Frente 4 — fecha a frente Segurança/LGPD)** (2026-07-22,
  **migração aplicada e fluxo completo validado em 2026-07-23** — ver
  Onda 2026-07-23 abaixo e §12.21):
  mesma branch `feature/lgpd-encryption`. Commit único.
  - **Schema**: novo model `AuditLog` (`id`/`adminUserId`/`targetCompanyId`/
    `action`/`createdAt`) — deliberadamente sem `@relation`/FK (sobrevive à
    exclusão do que referencia — é o próprio registro jurídico) e sem
    `companyId` (tabela global, nunca escopada por `withTenant`). **Por
    pedido explícito do Comandante, a migração (`prisma migrate dev`) foi
    deixada para ele rodar** — só `npx prisma generate` (codegen puro, não
    toca no banco) foi executado, o suficiente para `tx.auditLog.create`
    tipar corretamente e o typecheck/build passarem.
  - **`env.ts`**: `SUPER_ADMIN_EMAIL` nova, opcional (não fail-fast) — nota
    própria no código explicando a escolha (endpoint fica indisponível pra
    todo mundo se não configurada, em vez de derrubar o boot da API).
  - **`jwtPayloadSchema`** (shared): ganhou `isImpersonating`/
    `originalUserId`, ambos opcionais — não quebra nenhum token já emitido
    (campos ausentes = sessão normal).
  - **`routes/admin.ts`** (novo, prefixo `/admin`): `POST /impersonate`
    exige `authenticate` (qualquer usuário logado pode chamar), mas só
    passa da checagem de e-mail == `SUPER_ADMIN_EMAIL`. Busca a `Company`
    alvo (404 se não existir) → grava `AuditLog` (`action:
    'IMPERSONATE_LOGIN'`) **antes** de assinar o token — se a auditoria
    falhar, a troca de contexto falha junto, sem exceção. Token novo:
    `sub`/`email`/`name` do admin real (rastreabilidade), `companyId` do
    tenant-alvo (é só isso que `withTenant`/`tenantDb` olham — basta pra
    escopar toda rota de negócio subsequente pro cliente), `role: 'ADMIN'`,
    `isImpersonating: true`, `originalUserId`.
  - **Testado ao vivo até o limite possível sem a migração**: sem
    `SUPER_ADMIN_EMAIL` configurada → 403 em qualquer usuário (fail
    closed, confirmado); com a variável configurada para
    `admin@exodus.local`, login como `CASHIER` → 403 (não é o super
    admin); `admin@exodus.local` contra `targetCompanyId` inexistente →
    404 (checagem de empresa roda antes de qualquer escrita);
    `admin@exodus.local` contra a empresa real ("Inquilino Zero") → 500
    exatamente em `tx.auditLog.create` ("table `public.AuditLog` does not
    exist"), confirmando que autorização + busca de empresa + montagem do
    payload estão corretos, faltando só a tabela existir; servidor
    permaneceu no ar depois do erro (handler global tratou normalmente,
    sem crash). **Fluxo de sucesso completo (token emitido de verdade)
    ainda não foi validado** — depende da migração, que é a próxima ação
    do Comandante (ver §12).
  `npm run typecheck` + `npm run build` (shared+api) → **0 erros**.

- ✅ **Onda 2026-07-23 — Segurança/LGPD: migração do AuditLog aplicada +
  segunda rodada de Anonimização (RBAC revisto)** (2026-07-23): mesma
  branch `feature/lgpd-encryption`, dois commits.
  - **Migração `20260723025004_add_audit_log`**: o Comandante rodou
    `npx prisma migrate dev --name add_audit_log` (ação que ficou
    deliberadamente para ele, ver Onda 2026-07-22d) — a tabela `AuditLog`
    agora existe de verdade. Arquivo de migração commitado (puramente
    aditivo — `CREATE TABLE` + 2 índices, sem risco de deploy).
  - **Anonimização revisada**: o Comandante voltou com uma segunda versão
    da missão da Onda 2026-07-22c, com três mudanças deliberadas em
    relação à primeira: (1) **RBAC afrouxado** de `authorize(['ADMIN'])`
    para `app.authenticate` simples (qualquer usuário do tenant, não só
    ADMIN); (2) `name` mudou de `"Cliente Anonimizado"` para `"Anônimo
    (LGPD)"`; (3) `email` mudou de dominio `@exodus-deleted.com` para
    `@lgpd.local`, e `phone` de `'00000000000'` para `null`. Endpoint e
    arquitetura permanecem os mesmos (`POST /persons/:id/anonymize`,
    sempre `UPDATE`, cifra automática via `withEncryption`) — só os
    literais e o guard mudaram. Ver §5 (bullet Pessoas) para o texto
    atual completo.
  - **Testado ao vivo**: fluxo completo de impersonate agora funciona de
    ponta a ponta (tabela existe) — não re-testado nesta onda especificamente
    (já validado na Onda 2026-07-22d até o limite possível; a única
    novidade operacional é a tabela existir, sem mudança de código no
    impersonate). Anonimização re-testada com o novo RBAC: usuário
    `CASHIER` anonimizou com sucesso (200, antes seria 403); valores
    literais novos confirmados na resposta e no ciphertext gravado; teste
    de IDOR dedicado — pessoa criada direto no banco em uma empresa
    "estranha" (fora do tenant do token) → 404, nunca encontrada nem
    alterada; `FinancialAccount.personId` continuou íntegro. Dados de
    teste (incluindo a empresa estranha) removidos ao final.
  `npm run typecheck` → **0 erros**.

- ✅ **Onda 2026-07-23b — Correção crítica de RBAC: anonimização volta a
  ser ADMIN-only** (2026-07-23): mesma branch `feature/lgpd-encryption`,
  commit único. O Comandante identificou, logo depois da Onda 2026-07-23,
  que o afrouxamento de RBAC daquela mesma onda (`authorize(['ADMIN'])` →
  `app.authenticate`) era um risco grave de negócio — operador de caixa
  (`CASHIER`) não pode ter permissão para anonimizar/destruir dados de
  cliente. Revertido: `POST /persons/:id/anonymize` voltou a exigir
  `preHandler: app.authorize(['ADMIN'])`. Nenhuma outra parte da rota
  mudou (valores anonimizados, proteção IDOR via `tenantDb`, cifra
  automática via `withEncryption` — tudo intacto). **Testado ao vivo**:
  `CASHIER` → 403 (bloqueado, confirmado); `ADMIN` → 200, anonimização
  funcionando normalmente com os valores da Onda 2026-07-23 (`"Anônimo
  (LGPD)"`, `@lgpd.local`, `phone: null`). Dados de teste removidos ao
  final. `npm run typecheck` → **0 erros**.
  **Lição registrada no próprio código** (comentário na rota): o histórico
  de RBAC desta rota específica (ADMIN-only → afrouxado → ADMIN-only de
  novo) fica documentado inline para não se repetir.

- ✅ **Onda 2026-07-23c — Merge para `main`, deploy em produção e backfill
  de criptografia executado (Plano Mestre V2.0: Segurança/LGPD completo em
  produção)** (2026-07-23). Origem: relato consolidado de Caio (dossiê
  gerado com apoio do Gemini, repassado por Helom), **não uma sessão de
  Claude Code documentada em primeira mão** — as ações abaixo (merge,
  deploy, testes via Postman, backfill em produção) foram feitas fora
  desta ferramenta; o texto aqui é a transcrição desse relato para o
  registro central do projeto, mais a verificação que dava para fazer
  localmente (git log/branches).
  - **Merge**: `feature/lgpd-encryption` → `main` via **PR #24** (`6d68e3c`).
    Cobre as Frentes 2, 3 e 4 completas (Ondas 2026-07-22b/c/d e
    2026-07-23/23b) — criptografia de `Person`, anonimização e impersonate
    administrativo com auditoria.
  - **Deploy Railway**: subiu com sucesso (`ACTIVE`) com as novas variáveis
    de ambiente (`ENCRYPTION_KEY`, `SUPER_ADMIN_EMAIL`) já configuradas.
  - **Backfill de criptografia executado em produção**: `CONFIRM_
    BACKFILL=1 npx tsx apps/api/prisma/backfill-person-encryption.ts`
    rodado direto no Console do Railway — a base de produção real
    (clientes/fornecedores já cadastrados antes desta Frente) está
    cifrada, fechando a pendência que o §12.20 apontava.
  - **Incidente local + correção** (`ERR_OSSL_BAD_DECRYPT`, 500): registros
    de teste presos a uma `ENCRYPTION_KEY` local antiga (rotacionada em
    algum momento) ficaram indecifráveis — resolvido limpando esses
    registros; sem relação com o banco de produção. Ver nota técnica em §5
    (bullet Pessoas) sobre a implicação disso para rotação de chave.
  - **Impersonate validado em produção via Postman**: `POST
    /api/admin/impersonate` retornou 200 com um `targetCompanyId` em
    formato UUID estrito (um 400 de validação apareceu primeiro por causa
    do formato do payload enviado, corrigido no teste); `AuditLog`
    confirmado gravando os acessos.
  - **Achado desta sessão, não coberto pelo relato de Caio**: a Frente 1
    (Onboarding de Novas Lojas, `POST /api/onboarding`) **não faz parte
    deste merge** — o commit (`1e0b103`) existe só na branch LOCAL
    `feature/tenant-onboarding`, nunca enviada ao GitHub. Ver nota no topo
    do documento e §12.19 — importa porque o próximo passo de frontend
    ("Missão 1", §14) presume essa rota já existir em produção, e ela não
    existe.
  `git log`/`git branch --contains` (verificação direta desta sessão) →
  merge confirmado, onboarding confirmado ausente de `main`.

- ✅ **Onda 2026-07-27 — Reconciliação da Frente 1 (Onboarding) com a
  arquitetura de Segurança/LGPD** (2026-07-27): branch `feature/tenant-
  onboarding`, reconstruída do zero por Helom (com apoio de outro agente
  de IA — commit `a28220b` tem `Co-Authored-By: Claude Opus 4.8`) a partir
  da `main` já pós-merge da LGPD (`c6c301e`) — **não** a branch órfã antiga
  (`1e0b103`, que não existe mais: `git show 1e0b103` retorna `Not a valid
  object name`). Missão: verificar e adequar esse código à arquitetura
  atual (criptografia, `AuditLog`, desambiguação de login), sem commitar
  nada — só relatar. Nenhum código novo escrito nesta onda; só investigação,
  testes ao vivo e uma migração aplicada localmente.
  - **Achado principal — a preocupação do Caio não se confirmou**: a
    hipótese era que a guarda de login por status (`COMPANY_NOT_ACTIVE`)
    quebraria o seletor de desambiguação multi-tenant (`needsCompanySelection`)
    quando o mesmo e-mail existe em uma empresa `ACTIVE` e outra `PENDING`.
    Rastreamento manual do código (`routes/auth.ts`) já mostrava a ordem
    certa: valida senha contra TODOS os candidatos → filtra para só os de
    empresa `ACTIVE` (`activeMatches`) → só DEPOIS decide entre bloquear
    (0 matches), desambiguar (>1 match) ou logar direto (exatamente 1
    match). Confirmado ao vivo com 3 cenários reais (usuário de teste
    `reconciliacao.teste@exodus.local`, senha compartilhada):
    1. E-mail só na empresa `PENDING` recém-criada via `/api/onboarding` →
       login bloqueado com 403 `COMPANY_NOT_ACTIVE` e mensagem "aguardando
       aprovação".
    2. Mesmo e-mail/senha TAMBÉM cadastrado numa empresa `ACTIVE`
       ("Inquilino Zero") → login **direto**, token da empresa `ACTIVE`,
       **sem** pedir seleção — a `PENDING` fica completamente invisível
       nesse fluxo.
    3. Mesmo e-mail/senha numa SEGUNDA empresa `ACTIVE` também (3 contas no
       total: 2 `ACTIVE` + 1 `PENDING`) → `needsCompanySelection: true`
       com a lista mostrando **só as duas `ACTIVE`** — a `PENDING` some do
       seletor sozinha, sem nenhum tratamento especial ter sido necessário
       no código do Helom.
    **Nenhuma alteração de código foi necessária** para o Requisito 1 da
    missão — a implementação original já estava correta.
  - **Auditoria (`AuditLog`)**: `PATCH /api/admin/companies/:id/status`
    (`routes/admin.ts`, ainda não commitado no momento desta onda) grava
    `{ adminUserId, targetCompanyId, action: 'COMPANY_STATUS_' + status }`
    — campos batem exatamente com o schema (`AuditLog` não tem `@relation`,
    então qualquer string serve para `action`, sem constraint). Testado ao
    vivo: aprovar a empresa de teste (`PENDING` → `ACTIVE`) gravou um
    registro `COMPANY_STATUS_ACTIVE` correto, convivendo na mesma tabela
    com o `IMPERSONATE_LOGIN` real do Caio (nenhuma colisão). Salvaguarda
    anti-autobloqueio (`id === req.user.companyId && status !== 'ACTIVE'`)
    testada tentando bloquear a própria empresa do super admin → 422
    `BUSINESS_RULE`, bloqueado como esperado.
  - **`withEncryption`/`Person`**: `grep` em `routes/onboarding.ts` e
    `routes/admin.ts` não encontrou nenhuma chamada `.person.` — as duas
    rotas só tocam `Company`/`User`/`AuditLog`, nenhum dos quais passa pela
    extensão `withEncryption` (escopada só a `Person`). Nenhum conflito
    possível, confirmado por leitura de código (não precisou de teste ao
    vivo específico para isso).
  - **RBAC do painel**: `assertSuperAdmin` (extraído do impersonate,
    reaproveitado por `GET /companies` e `PATCH /companies/:id/status`)
    testado ao vivo — `admin@exodus.local` (ADMIN comum, não é o
    `SUPER_ADMIN_EMAIL`) → 403 em `GET /api/admin/companies`, confirmando
    que o painel não vaza para admins de tenant comuns.
  - **Migração aplicada localmente**: `20260725014349_add_company_status`
    estava no repositório mas não tinha sido aplicada neste ambiente —
    rodado `npx prisma migrate deploy` (não-interativo, só aplica
    pendentes) + `npx prisma generate`. Confirmado que o backfill da
    migração (`UPDATE "Company" SET status = 'ACTIVE'`) preservou as
    empresas reais já existentes (`Inquilino Zero` e `Império dos
    Cosméticos`) como `ACTIVE`, sem travar ninguém.
  - **Metodologia de teste sensível**: os testes de login precisavam da
    senha real do usuário `SUPER_ADMIN_EMAIL` (`exodus.developer@exodus.com`),
    que não era conhecida nesta sessão. Em vez de usar uma conta
    descartável, o hash de senha original desse usuário real foi lido e
    guardado ANTES de qualquer alteração, substituído por uma senha de
    teste temporária só durante os testes, e **restaurado ao valor exato
    original** ao final (confirmado por comparação de string após a
    restauração). Todos os usuários/empresas/`AuditLog` de teste criados
    foram removidos ao final; nenhum resíduo.
  `npm run typecheck` (shared+api+web) → **0 erros** (nenhuma mudança de
  código nesta onda, só a migração local e o CLAUDE.md).

- ✅ **Onda 2026-07-28 — Frontend do Back-Office: Painel de Gestão de
  Contratos (Plano Mestre V2.0, Frente 1)** (2026-07-28): branch
  `feature/admin-contracts-panel` (criada a partir da `main` já pós-merge da
  PR #25, `3d2d2a5`) — **commitada em `ae6b65c`** após aprovação do
  Comandante (mesmo protocolo da Onda 2026-07-27: implementar + validar +
  reportar antes de commitar). Missão explícita do Caio: por
  razão de processo/segurança, começar o frontend do pacote Multi-tenant/
  LGPD pelo **Back-Office** (gestão de contratos), não pelo onboarding
  público — a infraestrutura de aprovação precisa existir antes de abrir a
  porta de auto-cadastro.
  - **Sinal `isSuperAdmin` (backend, `GET /auth/me`)**: gap identificado
    antes de qualquer código de frontend — não existia NENHUM sinal, nem no
    JWT nem em `/me`, para o React saber se o usuário logado é o super
    admin (`SUPER_ADMIN_EMAIL`). Resolvido replicando o padrão já usado
    para `allowedPages`/`companyId`: `/me` lê fresco do banco a cada
    chamada e calcula `isSuperAdmin = user.email === env.SUPER_ADMIN_EMAIL`
    (nunca grava no JWT — evitaria refletir uma troca de
    `SUPER_ADMIN_EMAIL` só depois de até 12h; nunca expõe o valor da env
    var em si, só o resultado do comparativo). **Puramente um sinal de
    UX** — a autorização de verdade continua 100% no backend
    (`assertSuperAdmin`, `routes/admin.ts`), reavaliada a cada chamada
    administrativa real; o frontend nunca é, sozinho, o limite de
    segurança.
  - **`<SuperAdminRoute>`** (`components/SuperAdminRoute.tsx`, novo):
    componente próprio, não uma variante de `ProtectedRoute roles={[...]}`
    — `isSuperAdmin` é um eixo ortogonal ao RBAC por papel (`ADMIN`/
    `CASHIER` são conceitos de dentro do tenant; super admin é "funcionário
    da Exodus dona do SaaS"). Redireciona para `/login` sem sessão, para
    `/pdv` se `user.isSuperAdmin` for `false` — inclusive para um `ADMIN`
    comum de loja cliente. Registrada em `App.tsx` aninhada dentro de
    `ProtectedRoute` + `Layout` (reaproveita o header/logout/StatusBadge
    "de graça"; a rota `/admin/contratos` não entra em `navItems` do
    `Layout.tsx`, então fica naturalmente ausente da sidebar/bottom-nav/
    drawer sem precisar de nenhum tratamento especial nesses componentes).
  - **`AdminContractsPage.tsx`** (novo, Padrão Ouro): cabeçalho com
    `icon-tile-gold` + faixa de aviso "área restrita" (`ShieldAlert`);
    abas por status (`PENDING`/`ACTIVE`/`REJECTED`/`BLOCKED`/Todas, mesmo
    padrão `btn-primary`/`btn-ghost` de Financeiro); busca client-side
    (nome/CNPJ-CPF/nome ou e-mail do administrador) sobre a lista já
    filtrada por aba — mesmo espírito da "busca onisciente" de Cadastros,
    sem round-trip extra por tecla; tabela com empresa, administrador(es),
    data de cadastro, badge de status e ações por linha. Ações condicionadas
    ao status atual (`PENDING` → Aprovar/Rejeitar; `ACTIVE` → Bloquear;
    `REJECTED`/`BLOCKED` → Reativar), cada uma com `window.confirm` antes de
    disparar `PATCH /api/admin/companies/:id/status` (`useMutation` +
    `qc.invalidateQueries`); toast de confirmação reaproveitando o mesmo
    padrão visual do PDV (`fixed bottom-24 ... animate-slide-up`). Erros de
    mutation via `window.alert` (mesmo padrão de `FinancialPage.tsx`/
    `SettingsPage.tsx` para ações de lista); erro de carregamento da lista
    via banner inline com botão "Tentar novamente". **Salvaguarda
    anti-autobloqueio replicada na UI**: botão "Bloquear" desabilitado
    (com `title` explicativo) quando a linha é a própria empresa do super
    admin logado (`company.id === user.companyId`) — o backend já barra
    isso com 422, mas evita um clique fadado a falhar.
  - **`api.patch`** (`lib/api.ts`, novo): faltava — só existiam `get`/
    `post`/`put`/`del`; a rota de aprovação é `PATCH`. Adicionado seguindo
    exatamente o mesmo formato dos demais métodos do objeto `api`.
  - **Entrada de acesso no Layout**: ícone `ShieldCheck` discreto no header
    (`Layout.tsx`), ao lado do avatar/botão de logout, renderizado só
    quando `user?.isSuperAdmin` — não fazia parte do pedido literal da
    missão ("roteamento e proteção" + "tela"), mas sem algum ponto de
    entrada real a "fundação da área restrita" ficaria inacessível exceto
    digitando a URL de cabeça; decisão de escopo mínimo, não uma feature à
    parte.
  - **Testado ao vivo, ponta a ponta, contra a API local** (não só
    typecheck/build): reaproveitada a mesma técnica seria de teste de
    credencial real já usada na Onda 2026-07-27 — hash de senha do usuário
    `SUPER_ADMIN_EMAIL` (`exodus.developer@exodus.com`) lido e guardado
    ANTES de qualquer alteração, substituído por senha de teste conhecida,
    e **restaurado ao valor exato original** ao final (confirmado por
    comparação de string). Confirmado via curl: `GET /auth/me` como o
    super admin → `isSuperAdmin: true`; como `admin@exodus.local` (`ADMIN`
    comum de tenant, mesmo papel `ADMIN`) → `isSuperAdmin: false` **e**
    `GET /api/admin/companies` → 403 (prova de que os dois eixos de
    autorização — `role` e `isSuperAdmin` — são independentes, um `ADMIN`
    de loja não vaza para o painel só por ter o papel certo). Duas
    empresas de teste (`PENDING`) criadas direto no banco, com um
    ADMIN cada (para popular a coluna "Administrador(es)"); todo o ciclo
    de transições exercitado via `PATCH .../status`: Aprovar
    (PENDING→ACTIVE), Rejeitar (PENDING→REJECTED), Bloquear
    (ACTIVE→BLOCKED, numa empresa de terceiro), Reativar
    (REJECTED→ACTIVE) — todas as 4 confirmadas com o `status` de retorno
    batendo; salvaguarda anti-autobloqueio testada tentando `BLOCKED` na
    própria empresa do super admin ("Inquilino Zero") → 422
    `BUSINESS_RULE`, exatamente como o botão desabilitado da UI previne.
    Dados de teste (2 `Company`, 2 `User`, `AuditLog` correlato) removidos
    ao final via script descartável (apagado depois); `passwordHash`
    restaurado, confirmado idêntico ao original por comparação de string.
  - **Gargalo real identificado na listagem, não corrigido nesta onda
    (fora do escopo pedido — "concentre-se estritamente na proteção da
    rota e na listagem/aprovação")**: `GET /api/admin/companies` não tem
    paginação (`skip`/`take`) nem busca no servidor — traz **todas** as
    empresas do filtro de status de uma vez, e a busca por nome/CNPJ/
    administrador implementada nesta onda é inteira client-side, sobre
    esse retorno completo. Para o volume atual (poucos tenants) é
    imperceptível; se a base de clientes crescer bastante, essa rota
    precisará do mesmo tratamento de paginação/servidor que outras listas
    grandes do sistema já têm (Vendas, Compras, Financeiro). Registrado
    como pendência de maturidade, não como bug.
  `npm run typecheck` + `npm run build` (shared+api+web) → **0 erros**.

- ✅ **Onda 2026-07-28b — Interface do Impersonate: "Acessar Loja", faixa
  "MODO SUPORTE" e troca de sessão no Zustand (Missão 2 do frontend)**
  (2026-07-28): mesma branch `feature/admin-contracts-panel`, continuação
  direta da Onda 2026-07-28 (contracts panel, já commitada em `ae6b65c`).
  Fecha o §12.21 e a "Missão 2" de §14.1d.
  - **O desafio real**: o `/auth/me` sempre lê `companyId` fresco do
    **próprio usuário** no banco (não do JWT — mesmo raciocínio de
    `allowedPages`, nunca confiar numa claim com até 12h de idade). Chamar
    `/me` com o token de impersonate devolveria o `companyId` do super
    admin, não o da empresa-alvo, quebrando a troca de tenant no frontend
    de forma silenciosa mesmo com o backend correto. Por isso
    `impersonateLogin` **não chama `/me`** — monta o `user` da sessão
    disfarçada localmente a partir do usuário real já em memória
    (`sub`/`email`/`name` não mudam — o próprio backend preserva isso no
    token, base da rastreabilidade em `AuditLog`) + os dois campos que o
    token novo realmente altera: `role: 'ADMIN'` (forçado pelo backend) e
    `companyId` (que já vem pronto em `company.id` na resposta do
    `POST /impersonate`, sem round-trip nenhum).
  - **`store/auth.ts`**: `originalAdminToken`/`originalAdminUser`
    guardam a sessão REAL do super admin antes de `impersonateLogin`
    sobrescrever `token`/`user` — é daí que `exitImpersonate()` restaura
    sem exigir novo login. `impersonatingCompanyName` funciona como a
    própria flag "está impersonando?" (`null` = sessão normal), consumida
    por `isImpersonating()` e por `<ImpersonateBanner>`. `logout()` também
    passou a limpar os três campos novos — sem isso, um "Sair" comum no
    meio de uma sessão de suporte deixaria `originalAdminToken` órfão no
    localStorage com `token: null`, um estado inconsistente (achado
    durante a implementação, não pedido explicitamente, mas decorrência
    direta do novo estado introduzido).
  - **Dexie deliberadamente intocado**: `saleQueue`/`variants` já são
    filtrados por `companyId` em toda leitura (`lib/sync.ts`,
    `lib/products.ts` — isolamento multi-tenant da Onda 2026-07-19), então
    o cache do tenant do super admin fica simplesmente inerte durante o
    impersonate, e continua íntegro quando ele volta — purgar (como
    `logout()` faz) arriscaria apagar uma venda offline pendente do
    próprio super admin, se ele tiver alguma.
  - **`<ImpersonateBanner>`** (`components/ImpersonateBanner.tsx`, novo):
    faixa com listras diagonais âmbar/grafite (`repeating-linear-gradient`)
    e o texto num "pill" escuro sobreposto para contraste; só renderiza
    quando `impersonatingCompanyName !== null`. Botão "Encerrar Suporte"
    chama `exitImpersonate()` e força `window.location.href =
    '/admin/contratos'`.
  - **Encaixe no `Layout.tsx` sem sobrepor o header**: o header já é
    `sticky top-0`; dois elementos irmãos ambos `sticky top-0` não
    empilham, **se sobrepõem**. Resolvido envolvendo banner + header num
    único `<div className="sticky top-0 z-30">` (o header perdeu a própria
    stickiness, herdada do wrapper) — funciona para qualquer altura de
    faixa, inclusive se ela quebrar em duas linhas no mobile, sem
    matemática de offset em pixels. **Efeito colateral conhecido e aceito
    conscientemente**: a sidebar (`sticky top-16`, assume header de 4rem)
    fica com o offset levemente curto quando a faixa está visível — só um
    pequeno gap cosmético, nunca sobreposição/conteúdo escondido, e só
    durante um modo raro e temporário; não corrigido com um valor fixo em
    rem porque destoaria ainda mais se a faixa quebrasse linha.
  - **Botão "Acessar Loja"** (`AdminContractsPage.tsx`): aparece só em
    empresas `status === 'ACTIVE'` que não sejam a do próprio super admin
    (mesmo raciocínio já aplicado ao botão "Bloquear"). `window.confirm`
    antes de disparar, coerente com o resto da tela e justificado pelo
    peso da ação (acesso total a dado real de cliente, com rastro
    obrigatório em `AuditLog`). No sucesso, chama `impersonateLogin` e
    força `window.location.href = '/dashboard'` — reload completo, não
    `navigate()`: remonta o React Query do zero, eliminando o risco de uma
    tela ainda exibir cache da empresa do super admin por uma fração de
    segundo após a troca de tenant.
  - **Validação**: `npm run typecheck` + `npm run build` (shared+api+web)
    → **0 erros**. Não testado ao vivo via curl nesta onda — a rota
    `POST /api/admin/impersonate` e o `AuditLog` já foram exaustivamente
    validados em produção em ondas anteriores (Onda 2026-07-23c); o que
    mudou aqui é só a camada de frontend consumindo uma rota já
    comprovada, e a troca de token no Zustand não tem como ser exercitada
    de forma significativa fora do navegador — recomendado teste manual no
    browser antes do merge.

---

## 12. Pendências, bloqueios e dívidas técnicas

1. ~~**[BLOQUEIO] Docker não instalado**~~ **RESOLVIDO (2026-06-02)**.
2. ~~**Deploy Railway não configurado**~~ **RESOLVIDO (2026-06-03)**: sistema em produção em https://exodus-web-production.up.railway.app.
3. **`npm audit`**: 3 vulnerabilidades reportadas (1 moderada, 2 críticas) em deps transitivas — revisar antes de escalar.
4. **Sem testes automatizados** (Vitest/Supertest) — apenas smoke test manual.
5. ~~**BrasilAPI** ainda não integrada no formulário de fornecedor~~ **RESOLVIDO
   (2026-07-02)**: CEP via BrasilAPI (endereço completo) + CNPJ via ReceitaWS
   (proxeada pelo backend, ver §5 Cadastros).
6. ~~**Cadastro de produto** cria 1 variante por vez~~ **RESOLVIDO (2026-07-20)**:
   `ProductForm` (`ProductsPage.tsx`, commit `eb1b2dd`) agora cadastra N
   variantes numa única chamada — ver §5 Produtos e Onda 2026-07-20 em §11.
   Esta entrada ficou incorretamente marcada como pendente até esta correção
   porque o commit avançou numa branch paralela à que documentou o merge da
   LGPD (ver nota na própria Onda 2026-07-20). O cadastro in-line na
   importação de XML (2026-07-13) continua sendo um fluxo à parte (sempre
   1 variante, contexto de item de nota sem De/Para).
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
17. ~~**Propagar Caixa Físico/Conta Banco para o Financeiro**~~ **RESOLVIDO
    (2026-07-18)**: Onda 2026-07-15/16 (PDV + Vendas, PR #22) e Onda
    2026-07-17/18 (edição de Vendas + baixa/estorno do Financeiro, PR #23) —
    ver §11. `requireOpenRegister` (pegava o primeiro `CashRegister OPEN` sem
    distinguir tipo) foi substituída por `requireRegisterOfType` em
    `/financial/:id/settle` (recebe `targetRegisterType` obrigatório do
    `RegisterSelectionModal`) e `/:id/reverse` (**autodetecta** o tipo pela
    baixa original via `findOriginalRegisterType` — decisão deliberada do
    Comandante de **não** perguntar no estorno, por princípio de partidas
    dobradas). Único resíduo menor, não bloqueante: `POST
    /financial/installments` (lançamento manual) ainda não indica em qual
    "livro" o título vai refletir quando for baixado — só é decidido depois,
    no momento da baixa em si (`SettleModal` já pergunta lá). Considerado
    aceitável: o `RegisterSelectionModal` na baixa já cobre a decisão real.
18. ~~**`feature/multi-tenant` tem trabalho não commitado**~~ **RESOLVIDO**:
    commit `230e74d` (constraints tenant-scoped + login com desambiguação,
    Onda 2026-07-19 em §11) — branch inteira mesclada na `main` há tempo,
    confirmado via `git log`.
19. ~~**Rota de provisionamento de tenant implementada, mas ainda não está
    EM PRODUÇÃO/`main`**~~ **RESOLVIDO (2026-07-27)**: `feature/tenant-
    onboarding` mesclada na `main` via **PR #25** (`3d2d2a5`) —
    `POST /api/onboarding`, a guarda de login por status
    (`COMPANY_NOT_ACTIVE`) e o painel administrativo de aprovação
    (`routes/admin.ts`, commit `b056a42`) estão todos em `main`. Reconciliação
    completa com `withTenant`/`withEncryption`/`AuditLog` documentada na
    Onda 2026-07-27 em §11. A arquitetura multi-tenant já tem porta de
    entrada real disponível — falta só o frontend consumir (ver §14.1d: o
    Back-Office/Painel de Contratos já foi construído em 2026-07-28, a
    tela pública de onboarding continua deliberadamente adiada).
20. ~~**Criptografia LGPD (Frente 2): configurar `ENCRYPTION_KEY` no
    Railway + rodar o backfill em produção**~~ **RESOLVIDO (2026-07-23)**:
    ambas as ações confirmadas — `ENCRYPTION_KEY` configurada no Railway,
    boot em produção OK; backfill (`CONFIRM_BACKFILL=1`) rodado direto no
    Console do Railway contra o banco real. Ver §5 (bullet Pessoas) e
    Onda 2026-07-23c em §11 para o detalhamento completo.
21. ~~**Migração do `AuditLog` (Frente 4) + `SUPER_ADMIN_EMAIL` em
    produção**~~ **RESOLVIDO (2026-07-23)**: migração rodada e commitada;
    `SUPER_ADMIN_EMAIL` configurada no Railway; `POST /api/admin/
    impersonate` testado com sucesso em produção via Postman (ver Onda
    2026-07-23c em §11). ~~**Frontend do impersonate**~~ **RESOLVIDO
    (2026-07-28)**: botão "Acessar Loja" + faixa de aviso "MODO SUPORTE" +
    estratégia de troca de token no Zustand implementados — ver §5 (bullet
    Back-Office) e Onda 2026-07-28 em §11 para o detalhamento completo.
    Commitado e enviado ao GitHub — branch `feature/admin-contracts-panel`
    pronta para abertura de PR.

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

### 14.1 Concluído — pedido explícito do Comandante (PRIORIDADE)

~~**Propagar o seletor Caixa Físico/Conta Banco (§11 Onda 2026-07-15) para
PDV, Vendas e Financeiro.**~~ **RESOLVIDO (2026-07-18)** em duas ondas — ver
§11 e §12 item 17 para o detalhamento completo:
- Onda 2026-07-15/16 (PR #22): PDV (checkout) + Vendas (badge de
  rastreabilidade + seleção ao recriar financeiro).
- Onda 2026-07-17/18 (PR #23): edição completa de Vendas (Mini-PDV) +
  Financeiro (`/settle` pergunta via `RegisterSelectionModal`, `/reverse`
  autodetecta o caixa original sem perguntar — decisão deliberada do
  Comandante por princípio de partidas dobradas).

Nenhuma pauta fixa aberta no momento — a próxima onda parte do backlog de
maturidade (§14.2) ou de novo pedido direto do Comandante.

### 14.1b Multi-tenant (Plano Mestre V2.0) — ✅ mesclado, ver §11 Onda 2026-07-19

**Estado**: schema, `withTenant`, JWT, isolamento do Dexie e constraints
tenant-scoped (com login capaz de desambiguar e-mail colidente) estão
implementados, validados e **mesclados na `main`** (commit `230e74d`, sem
PR registrado — ver nota de drift no topo do documento).

**Pendência real que sobrevive daqui**: rota de provisionamento de tenant
(§12.19) — hoje não existe nenhum jeito real de nascer uma segunda empresa
em produção além de inserir direto no banco (a implementação existe, mas
está presa numa branch local nunca enviada ao GitHub — ver §12.19). Sem
isso, a arquitetura multi-tenant não tem porta de entrada de uso — e é
bloqueio direto da "Missão 1" do frontend (§14.1d).

> **Nota**: o Comandante recebeu do Gemini (avaliador externo, §13) uma
> sugestão de que o próximo grande objetivo seria a construção do módulo de
> **Catálogo e Estoque** (variações/SKUs, preço, controle de quantidade).
> Registrado aqui como **sugestão externa relatada, não uma decisão tomada
> nesta sessão** — o módulo de Produtos já existe e está ✅ no §5; se a
> intenção for uma reformulação maior dele, vale alinhar com o Comandante o
> escopo exato antes de iniciar, já que não foi detalhado em nenhuma
> conversa registrada neste documento.

### 14.1c Segurança de Dados / LGPD (Plano Mestre V2.0, Frentes 2–4) — ✅
**100% CONCLUÍDO E EM PRODUÇÃO** (2026-07-23)

`feature/lgpd-encryption` **mesclada na `main` via PR #24** (`6d68e3c`) e
**já em produção no Railway**, com o backfill de criptografia já rodado
contra o banco real (Onda 2026-07-23c em §11). As três frentes:

- ✅ **Frente 2 — Criptografia**: `Person.document`/`email`/`phone`
  cifrados em repouso, transparente via `withEncryption`. Backfill de
  produção executado.
- ✅ **Frente 3 — Anonimização / Direito ao Esquecimento**:
  `POST /persons/:id/anonymize`, sempre `UPDATE`, só `ADMIN` (RBAC
  corrigido e confirmado), IDOR testado e bloqueado.
- ✅ **Frente 4 — Impersonate + Auditoria**: `POST /api/admin/impersonate`
  + model `AuditLog`, migração aplicada, testado em produção via Postman
  (relato de Caio).

Nenhuma pendência de backend restante nestas três frentes — só frontend
(ver Missões 1 e 2 logo abaixo) e a ressalva sobre a Frente 1/Onboarding
(§12.19, não faz parte deste pacote e continua fora da `main`).

### 14.1d Próximo passo: Frontend das Frentes de Segurança (plano de Caio,
2026-07-23)

Com o backend "selado", o próximo foco combinado pelos sócios é 100%
frontend (React/Vite). Duas missões foram propostas por Caio nesta ordem —
**mas o Caio decidiu, na prática, inverter a sequência por questão de
processo/segurança** (ver terceira entrada abaixo): construir primeiro o
Back-Office (gestão de contratos) antes de abrir a porta pública de
onboarding.

**Missão 1 — Tela de Onboarding (pública)**: fluxo visual para um novo
lojista se cadastrar sozinho, consumindo a rota de criação de tenant/
company. A rota (`POST /api/onboarding`) **está mesclada na `main` via PR
#25** (`3d2d2a5`, ver §14.1e) — deixou de ser bloqueio técnico. **Ainda não
iniciada** — deliberadamente adiada pelo Caio (2026-07-28): "por questões
estritas de segurança e processo", o Back-Office precisa existir primeiro,
para não abrir auto-cadastro público sem ter como triar/aprovar quem entra.

✅ **Missão 2 — Interface do Impersonate (Admin)** — **CONCLUÍDA
(2026-07-28)**: botão "Acessar Loja" no painel do Super Admin (dispara
`POST /api/admin/impersonate` com o UUID da empresa) + `<ImpersonateBanner>`
persistente (topo do ERP, faixa "MODO SUPORTE") quando a sessão ativa tem
`isImpersonating: true` — ver §5 (bullet Back-Office) e Onda 2026-07-28b em
§11 para o detalhamento completo (estratégia de troca de token no Zustand,
motivo de não reaproveitar `GET /auth/me` nesse fluxo, e por que o reload é
completo em vez de `navigate`).
⚠️ **Não confundir com a "Missão 2" de §14.1e** (nomenclatura reaproveitada
pelo Caio para duas coisas diferentes em relatos separados): esta aqui é a
**interface de impersonate no frontend**; a outra é o **painel
administrativo de aprovação de contratos no backend** (implementado por
Helom, ver §14.1e) — são frentes distintas, ambas concluídas agora.

✅ **Terceira peça, construída antes das duas acima (2026-07-28) — Painel
do Super Admin (Gestão de Contratos), frontend**: fundação do Back-Office
pedida explicitamente pelo Caio como pré-requisito de segurança/processo
antes de qualquer uma das duas missões originais — "Precisamos da
infraestrutura de gestão pronta antes de abrirmos a porta para novos
cadastros". Cobre roteamento protegido (`<SuperAdminRoute>`, sinal
`isSuperAdmin` em `/auth/me`) + `AdminContractsPage.tsx` (listar/aprovar/
rejeitar/bloquear/reativar `Company`) — ver §5 (bullet Back-Office) e Onda
2026-07-28 em §11 para o detalhamento completo. **Implementada, testada ao
vivo e commitada** (`ae6b65c`, aprovada pelo Comandante — mesmo protocolo
da Onda 2026-07-27).

### 14.1e Onboarding de Lojas — backend reconstruído e reconciliado
(branch `feature/tenant-onboarding`, ver §11 Onda 2026-07-27)

Helom construiu, numa sessão separada, o backend completo da Frente 1
(usando outro agente de IA — commit `a28220b` tem `Co-Authored-By: Claude
Opus 4.8`) — duas partes que Caio rotulou como **"Missão 1"** e
**"Missão 2"** no pedido de reconciliação (nomenclatura própria desta
frente, distinta das Missões 1/2 do frontend em §14.1d):

- ✅ **"Missão 1" (backend) — Onboarding público + guarda de login por
  status**: commitada (`a28220b`). `POST /api/onboarding` (pública) cria
  `Company` (status `PENDING`) + primeiro `User` ADMIN numa transação;
  `Company.status` (`PENDING`/`ACTIVE`/`REJECTED`/`BLOCKED`, migração
  `20260725014349_add_company_status` com backfill `ACTIVE` para toda
  empresa pré-existente); guarda em `/auth/login` bloqueia contas cuja
  empresa não está `ACTIVE` (`code: 'COMPANY_NOT_ACTIVE'`).
- ✅ **"Missão 2" (backend) — Painel de aprovação de contratos**:
  commitada (`b056a42`, 2026-07-27) — `routes/admin.ts` +
  `packages/shared/src/schemas/admin.ts`. `GET /api/admin/companies`
  (lista tenants por status, com os ADMINs de cada um) e `PATCH
  /api/admin/companies/:id/status` (aprova/rejeita/suspende/reativa, grava
  `AuditLog` antes de aplicar, salvaguarda anti-autobloqueio). Ambas atrás
  do mesmo `assertSuperAdmin` do impersonate.

**Reconciliação com a arquitetura de Segurança/LGPD (Frentes 2-4),
verificada e testada ao vivo nesta sessão (2026-07-27)** — ver Onda
2026-07-27 em §11 para o detalhamento completo dos testes; resumo:
nenhum conflito real encontrado, a guarda de `PENDING` já harmoniza
corretamente com a desambiguação de login multi-tenant, o `AuditLog` já
usa o schema certo, e nada nas rotas novas toca `Person`/`withEncryption`.
`npm run typecheck` (shared+api+web) → **0 erros**.

✅ **Frente fechada (2026-07-27)**: branch `feature/tenant-onboarding`
mesclada na `main` via **PR #25** (`3d2d2a5`) — Missões 1 e 2 (backend)
ambas em `main`. Ver §12.19 (RESOLVIDO) e a nova entrada no topo do
documento. O que resta desta frente é 100% frontend — ver §14.1d (Missões
1/2 do frontend, ainda pendentes; terceira peça — o Back-Office desta
seção — já entregue em 2026-07-28).

### 14.2 Maturidade/robustez (backlog de funcionalidades dos sócios: 100% concluído)

> Os itens abaixo não foram solicitados ainda — são sugestões de maturidade.

1. **Suíte de testes**: Vitest (unit em `pricing`/`nfe-parser` + vendas split/a prazo
   + financeiro baixa/estorno) e integração das rotas. **Prioridade alta** dado o tamanho.
2. **Validar em produção** os fluxos novos (venda a prazo→contas a receber, baixa
   parcial, dashboard, tipos de recebimento customizados).
3. Integração BrasilAPI no cadastro de fornecedor (autocomplete de CNPJ — §4.2).
4. ~~Cadastro multi-variante de produto~~ **RESOLVIDO (2026-07-20)** — ver §5
   Produtos e Onda 2026-07-20 em §11.
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
