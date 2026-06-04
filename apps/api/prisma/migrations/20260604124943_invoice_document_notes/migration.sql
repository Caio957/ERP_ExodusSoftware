-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "documentNumber" INTEGER,
ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_documentNumber_idx" ON "Invoice"("documentNumber");

