-- Plano Mestre V2.0 — Constraints globais -> tenant-scoped
-- ----------------------------------------------------------------------------
-- User.email, ProductVariant.sku/barcode e Person.document deixam de ser
-- únicos globalmente e passam a ser únicos POR EMPRESA (companyId, campo).
-- Escrita manual (não via `prisma migrate dev`) porque o Prisma exige
-- confirmação interativa para avisos de "unique constraint pode falhar com
-- duplicados" mesmo quando, como aqui, não há risco real: hoje só existe o
-- tenant "Inquilino Zero", então toda linha já compartilha o mesmo
-- companyId — a unicidade composta é automaticamente satisfeita pelas
-- mesmas linhas que já respeitavam a constraint global antiga. Sem backfill
-- necessário.
--
-- Company.document e Invoice.accessKey ficam deliberadamente GLOBAIS (não
-- fazem parte desta migração) — ver cabeçalho de schema.prisma.

-- User.email
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_companyId_email_key" ON "User"("companyId", "email");

-- ProductVariant.sku / barcode
DROP INDEX "ProductVariant_sku_key";
DROP INDEX "ProductVariant_barcode_key";
CREATE UNIQUE INDEX "ProductVariant_companyId_sku_key" ON "ProductVariant"("companyId", "sku");
CREATE UNIQUE INDEX "ProductVariant_companyId_barcode_key" ON "ProductVariant"("companyId", "barcode");

-- Person.document
DROP INDEX "Person_document_key";
CREATE UNIQUE INDEX "Person_companyId_document_key" ON "Person"("companyId", "document");
