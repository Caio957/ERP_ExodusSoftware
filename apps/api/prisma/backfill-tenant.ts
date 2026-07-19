// ============================================================================
// Backfill Multi-Tenant — Plano Mestre V2.0, Fase 2 (Povoamento)
// ----------------------------------------------------------------------------
// Cria a empresa "Inquilino Zero" (id determinístico, sempre o mesmo em toda
// execução) e vincula a ela todos os registros que ainda estão com
// `companyId = NULL` em todas as tabelas vitais do schema.
//
// ⚠️ NÃO EXECUTAR sem revisão explícita do Comandante.
//
// Por segurança, o script roda em modo DRY-RUN por padrão: ele só CONTA e
// IMPRIME quantas linhas seriam afetadas em cada tabela, sem escrever nada no
// banco. Para aplicar de verdade, é preciso passar a variável de ambiente
// CONFIRM_BACKFILL=1 explicitamente:
//
//   npx tsx apps/api/prisma/backfill-tenant.ts                 # dry-run (seguro)
//   CONFIRM_BACKFILL=1 npx tsx apps/api/prisma/backfill-tenant.ts   # aplica de fato
//
// Todas as atualizações rodam dentro de uma única transação — ou tudo é
// aplicado, ou nada é (sem estado intermediário em caso de falha no meio).
// ============================================================================

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Id determinístico (sempre o mesmo) para a empresa "0001" — torna o upsert
// idempotente mesmo rodando o script mais de uma vez.
const TENANT_ZERO_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ZERO_NAME = 'Inquilino Zero (Loja Original)';

const DRY_RUN = process.env.CONFIRM_BACKFILL !== '1';

// Uma entrada por tabela vital — mantém o script explícito (sem acesso
// dinâmico a `prisma[modelName]`) para preservar a tipagem estrita do projeto.
type TableBackfill = {
  label: string;
  countPending: () => Promise<number>;
  apply: (tx: Prisma.TransactionClient) => Promise<{ count: number }>;
};

const tables: TableBackfill[] = [
  {
    label: 'User',
    countPending: () => prisma.user.count({ where: { companyId: null } }),
    apply: (tx) => tx.user.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'Product',
    countPending: () => prisma.product.count({ where: { companyId: null } }),
    apply: (tx) => tx.product.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'ProductVariant',
    countPending: () => prisma.productVariant.count({ where: { companyId: null } }),
    apply: (tx) => tx.productVariant.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'Person',
    countPending: () => prisma.person.count({ where: { companyId: null } }),
    apply: (tx) => tx.person.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'Invoice',
    countPending: () => prisma.invoice.count({ where: { companyId: null } }),
    apply: (tx) => tx.invoice.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'InvoiceItem',
    countPending: () => prisma.invoiceItem.count({ where: { companyId: null } }),
    apply: (tx) => tx.invoiceItem.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'SupplierProductMapping',
    countPending: () => prisma.supplierProductMapping.count({ where: { companyId: null } }),
    apply: (tx) =>
      tx.supplierProductMapping.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'CashRegister',
    countPending: () => prisma.cashRegister.count({ where: { companyId: null } }),
    apply: (tx) => tx.cashRegister.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'CashTransaction',
    countPending: () => prisma.cashTransaction.count({ where: { companyId: null } }),
    apply: (tx) => tx.cashTransaction.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'Sale',
    countPending: () => prisma.sale.count({ where: { companyId: null } }),
    apply: (tx) => tx.sale.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'SaleItem',
    countPending: () => prisma.saleItem.count({ where: { companyId: null } }),
    apply: (tx) => tx.saleItem.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'SalePayment',
    countPending: () => prisma.salePayment.count({ where: { companyId: null } }),
    apply: (tx) => tx.salePayment.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'StockMovement',
    countPending: () => prisma.stockMovement.count({ where: { companyId: null } }),
    apply: (tx) => tx.stockMovement.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'Setting',
    countPending: () => prisma.setting.count({ where: { companyId: null } }),
    apply: (tx) => tx.setting.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'FinancialAccount',
    countPending: () => prisma.financialAccount.count({ where: { companyId: null } }),
    apply: (tx) =>
      tx.financialAccount.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
  {
    label: 'AccountSettlement',
    countPending: () => prisma.accountSettlement.count({ where: { companyId: null } }),
    apply: (tx) =>
      tx.accountSettlement.updateMany({ where: { companyId: null }, data: { companyId: TENANT_ZERO_ID } }),
  },
];

async function main() {
  console.log('============================================================');
  console.log(' Backfill Multi-Tenant — Plano Mestre V2.0, Fase 2');
  console.log(`  Modo: ${DRY_RUN ? 'DRY-RUN (nenhuma escrita será feita)' : '⚠️  APLICAÇÃO REAL'}`);
  console.log('============================================================\n');

  // Diagnóstico prévio (roda sempre, mesmo em dry-run) — mostra o que seria afetado.
  console.log('Contagem de registros pendentes (companyId = NULL) por tabela:');
  let totalPending = 0;
  for (const t of tables) {
    const n = await t.countPending();
    totalPending += n;
    console.log(`  ${t.label.padEnd(24, ' ')} ${n}`);
  }
  console.log(`  ${'TOTAL'.padEnd(24, ' ')} ${totalPending}\n`);

  if (DRY_RUN) {
    console.log('Dry-run concluído — nenhuma linha foi alterada.');
    console.log('Para aplicar de verdade, rode novamente com CONFIRM_BACKFILL=1.');
    return;
  }

  console.log(`Criando/confirmando empresa "${TENANT_ZERO_NAME}" (id fixo ${TENANT_ZERO_ID})...`);
  const company = await prisma.company.upsert({
    where: { id: TENANT_ZERO_ID },
    update: {},
    create: {
      id: TENANT_ZERO_ID,
      name: TENANT_ZERO_NAME,
    },
  });
  console.log(`  -> Empresa OK: ${company.name} (${company.id})\n`);

  console.log('Aplicando backfill em transação única...');
  await prisma.$transaction(
    async (tx) => {
      for (const t of tables) {
        const result = await t.apply(tx);
        console.log(`  ${t.label.padEnd(24, ' ')} ${result.count} linha(s) atualizada(s)`);
      }
    },
    { timeout: 60_000 },
  );

  console.log('\n✅ Backfill concluído com sucesso — todos os registros pré-existentes agora pertencem a');
  console.log(`   "${TENANT_ZERO_NAME}" (${TENANT_ZERO_ID}).`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill falhou:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
