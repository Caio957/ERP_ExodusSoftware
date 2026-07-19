/*
  Warnings:

  - Made the column `companyId` on table `AccountSettlement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CashRegister` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `CashTransaction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `FinancialAccount` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `InvoiceItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Person` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `ProductVariant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Sale` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `SaleItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `SalePayment` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `Setting` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `StockMovement` required. This step will fail if there are existing NULL values in that column.
  - Made the column `companyId` on table `SupplierProductMapping` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AccountSettlement" DROP CONSTRAINT "AccountSettlement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CashRegister" DROP CONSTRAINT "CashRegister_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CashTransaction" DROP CONSTRAINT "CashTransaction_companyId_fkey";

-- DropForeignKey
ALTER TABLE "FinancialAccount" DROP CONSTRAINT "FinancialAccount_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SalePayment" DROP CONSTRAINT "SalePayment_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Setting" DROP CONSTRAINT "Setting_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "SupplierProductMapping" DROP CONSTRAINT "SupplierProductMapping_companyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- AlterTable
ALTER TABLE "AccountSettlement" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CashRegister" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "CashTransaction" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "FinancialAccount" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceItem" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SaleItem" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SalePayment" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Setting" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "SupplierProductMapping" ALTER COLUMN "companyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductMapping" ADD CONSTRAINT "SupplierProductMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashTransaction" ADD CONSTRAINT "CashTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalePayment" ADD CONSTRAINT "SalePayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSettlement" ADD CONSTRAINT "AccountSettlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
