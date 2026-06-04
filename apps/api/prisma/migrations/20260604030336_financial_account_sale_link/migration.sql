-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "saleId" TEXT;

-- CreateIndex
CREATE INDEX "FinancialAccount_saleId_idx" ON "FinancialAccount"("saleId");

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

