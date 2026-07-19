// ============================================================================
// Backfill Multi-Tenant — Plano Mestre V2.0, Fase 2 (Povoamento)
// ----------------------------------------------------------------------------
// HISTÓRICO — este script já foi executado com sucesso (2026-07-19,
// CONFIRM_BACKFILL=1): criou a empresa "Inquilino Zero" (id determinístico
// abaixo) e vinculou a ela todos os registros pré-existentes que ainda
// estavam com `companyId = NULL` (9 linhas: 2 User, 1 Product, 1
// ProductVariant, 1 CashRegister, 4 StockMovement — as demais 11 tabelas já
// estavam vazias neste ambiente).
//
// A Fase 4 (mesmo dia) tornou `companyId` OBRIGATÓRIO (`NOT NULL`) em todas
// as 15 tabelas de negócio — exceto `User`, que continua opcional de
// propósito (ver nota no cabeçalho de schema.prisma sobre o papel
// SYSTEM_ADMIN futuro, §4 do Plano Mestre). Isso torna a lógica original
// deste arquivo (`countPending`/`apply` por tabela, buscando `companyId:
// null`) permanentemente inaplicável nessas 15 tabelas: o banco não aceita
// mais NULL nelas, então NUNCA MAIS haverá linha pendente para encontrar —
// manter aquela lógica viva só acumularia erros de tipo a cada geração do
// Prisma Client, sem nenhum ganho real.
//
// `User.companyId = null` continua existindo, mas deixou de ser um estado
// "pendente de correção" — a partir da Fase 4, `null` em User é o sinal
// INTENCIONAL de uma conta global (futuro SYSTEM_ADMIN, sem tenant único).
// "Backfillar" esses usuários para o Inquilino Zero automaticamente seria
// incorreto: destruiria exatamente a distinção que a Fase 4 criou. Por isso
// este script não tem mais nenhuma ação seguro-por-padrão a oferecer — ele
// existe só como registro do que foi feito.
// ============================================================================

const TENANT_ZERO_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ZERO_NAME = 'Inquilino Zero (Loja Original)';

console.log('============================================================');
console.log(' Backfill Multi-Tenant — Plano Mestre V2.0, Fase 2 (RETIRADO)');
console.log('============================================================\n');
console.log(`Este script já rodou com sucesso e seu trabalho está feito:`);
console.log(`  Empresa "${TENANT_ZERO_NAME}" (${TENANT_ZERO_ID}) já existe`);
console.log('  e todos os dados pré-existentes já foram vinculados a ela.');
console.log('\nA partir da Fase 4, `companyId` é obrigatório em todas as tabelas');
console.log('de negócio (exceto User, deliberadamente) — não há mais nada para');
console.log('este script fazer. Mantido apenas como registro histórico.');
