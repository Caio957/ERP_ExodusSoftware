-- Setting: troca a chave primária de `key` (global) para um `id` próprio, e a
-- unicidade de `key` passa a ser composta com `companyId`
-- (@@unique([companyId, key])) — necessário para permitir, em fases
-- posteriores do Plano Mestre Multi-Tenant, que cada empresa tenha sua
-- própria "company_profile"/"product_form"/"payment_types"/"sales" sem
-- colidir com a de outra empresa.
--
-- Escrita manualmente (não via `prisma migrate dev`) para garantir um
-- backfill seguro de `id` nas linhas já existentes em produção — o
-- `@default(uuid())` do Prisma é gerado no client, não no banco, então uma
-- simples `ADD COLUMN "id" TEXT NOT NULL` falharia em qualquer linha
-- pré-existente.

-- 1. Remove a PK antiga (baseada em `key`)
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_pkey";

-- 2. Adiciona a nova coluna `id` (nullable por enquanto)
ALTER TABLE "Setting" ADD COLUMN "id" TEXT;

-- 3. Backfill: gera um uuid para cada linha já existente
UPDATE "Setting" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- 4. Agora que todas as linhas têm id, torna a coluna obrigatória
ALTER TABLE "Setting" ALTER COLUMN "id" SET NOT NULL;

-- 5. Promove `id` a chave primária
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_pkey" PRIMARY KEY ("id");

-- 6. Unicidade composta (companyId, key) — substitui a antiga unicidade
--    implícita de `key` sozinho. Nota: como `companyId` é nullable e o
--    Postgres trata NULLs como distintos entre si em índices únicos, esta
--    constraint NÃO impede múltiplas linhas com a mesma `key` e
--    `companyId IS NULL` simultaneamente — hoje isso não é um problema na
--    prática porque todo acesso ao Setting passa por upsert/findUnique via
--    routes/settings.ts, que sempre localiza a linha existente antes de
--    criar uma nova. A unicidade estrita entre tenants reais só passa a
--    valer de fato a partir do momento em que `companyId` for preenchido.
CREATE UNIQUE INDEX "Setting_companyId_key_key" ON "Setting"("companyId", "key");
