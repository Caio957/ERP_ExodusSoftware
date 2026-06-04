-- AlterTable
ALTER TABLE "FinancialAccount" ADD COLUMN     "code" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "AccountSettlement" (
    "id" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountSettlement_financialAccountId_idx" ON "AccountSettlement"("financialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_code_key" ON "FinancialAccount"("code");

-- AddForeignKey
ALTER TABLE "AccountSettlement" ADD CONSTRAINT "AccountSettlement_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

