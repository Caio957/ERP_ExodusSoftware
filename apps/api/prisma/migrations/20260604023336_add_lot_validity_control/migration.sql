-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "tracksLotValidity" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "batch" DROP NOT NULL;
