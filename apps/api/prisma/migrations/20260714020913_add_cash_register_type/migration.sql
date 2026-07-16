-- AlterTable
ALTER TABLE "CashRegister" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'DIARIO';

-- CreateIndex
CREATE INDEX "CashRegister_type_idx" ON "CashRegister"("type");
