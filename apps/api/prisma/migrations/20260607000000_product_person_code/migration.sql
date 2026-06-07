-- Código sequencial único de produto (somente leitura pelo cliente).
ALTER TABLE "Product" ADD COLUMN "code" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- Código sequencial único de pessoa (clientes e fornecedores compartilham a mesma sequência).
ALTER TABLE "Person" ADD COLUMN "code" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Person_code_key" ON "Person"("code");
