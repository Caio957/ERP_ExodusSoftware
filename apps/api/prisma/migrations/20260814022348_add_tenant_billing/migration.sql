-- Faturamento SaaS (Pilar 1): campos de controle de mensalidade em Company +
-- nova tabela TenantBilling (histórico de faturas). `pixPayload` é cifrado em
-- repouso pela extensão `withEncryption` (AES-256-GCM) na camada de aplicação —
-- no banco é apenas TEXT.

-- AlterTable: controle de faturamento SaaS. Colunas com DEFAULT — empresas já
-- existentes herdam os valores padrão sem backfill.
ALTER TABLE "Company" ADD COLUMN     "billingBlockGraceDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "billingExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingReminderDays" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "TenantBilling" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "pixPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBilling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantBilling_companyId_idx" ON "TenantBilling"("companyId");

-- CreateIndex
CREATE INDEX "TenantBilling_status_idx" ON "TenantBilling"("status");

-- CreateIndex
CREATE INDEX "TenantBilling_dueDate_idx" ON "TenantBilling"("dueDate");

-- CreateIndex
CREATE INDEX "TenantBilling_companyId_status_idx" ON "TenantBilling"("companyId", "status");

-- AddForeignKey
ALTER TABLE "TenantBilling" ADD CONSTRAINT "TenantBilling_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
