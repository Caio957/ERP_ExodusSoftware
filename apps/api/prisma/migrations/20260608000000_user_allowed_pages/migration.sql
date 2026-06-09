-- Adiciona campo allowedPages em User para controle granular de acesso por página
-- null = usa padrão do papel (ADMIN = tudo, CASHIER = PDV/Produtos/Caixa/Cadastros)
ALTER TABLE "User" ADD COLUMN "allowedPages" JSONB;
