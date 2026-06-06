-- AlterTable
-- NºDOC sequencial da venda (SERIAL preenche automaticamente as vendas existentes).
ALTER TABLE "Sale" ADD COLUMN     "code" SERIAL NOT NULL;

-- Controle de financeiro gerado (vendas existentes já contam no caixa/recebimentos).
ALTER TABLE "Sale" ADD COLUMN     "financialGenerated" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_code_key" ON "Sale"("code");
