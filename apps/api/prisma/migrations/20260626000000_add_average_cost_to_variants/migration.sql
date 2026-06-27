-- AddColumn: averageCost ao ProductVariant (Custo Médio Ponderado)
-- DEFAULT 0: variantes existentes partem do CMP zerado; o valor correto
-- será calculado nas próximas entradas de nota ou ajustado manualmente.
ALTER TABLE "ProductVariant" ADD COLUMN "averageCost" DECIMAL(10,2) NOT NULL DEFAULT 0;
