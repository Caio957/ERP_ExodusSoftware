-- Onboarding de lojistas (Plano Mestre V2.0 — Frente 1): ciclo de vida do
-- tenant. Coluna nasce com default 'PENDING' (toda empresa criada pela rota
-- pública /api/onboarding fica aguardando aprovação da Exodus).
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Backfill: empresas que JÁ EXISTIAM antes desta feature já estão operando em
-- produção (Inquilino Zero e clientes reais) — são grandfathered para ACTIVE,
-- senão a guarda de login (só ACTIVE loga) travaria todo mundo. Só o
-- auto-cadastro futuro nasce PENDING, pelo default acima.
UPDATE "Company" SET "status" = 'ACTIVE';
