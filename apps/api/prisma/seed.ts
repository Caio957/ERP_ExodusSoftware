import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Mesmo id determinístico usado no backfill da Fase 2 (prisma/backfill-tenant.ts)
// — um `db:migrate` + `db:seed` num ambiente novo já nasce com a mesma
// identidade de tenant usada em todo o histórico de testes manuais do
// projeto, em vez de criar usuários "órfãos" (companyId null).
const TENANT_ZERO_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ZERO_NAME = 'Inquilino Zero (Loja Original)';

async function main() {
  const company = await prisma.company.upsert({
    where: { id: TENANT_ZERO_ID },
    update: {},
    create: { id: TENANT_ZERO_ID, name: TENANT_ZERO_NAME },
  });

  const passwordHash = await bcrypt.hash('admin12345', 10);

  // User.email deixou de ser globalmente único (Plano Mestre V2.0 —
  // constraints globais → tenant-scoped) — o seletor do upsert usa a chave
  // composta gerada pelo Prisma para @@unique([companyId, email]).
  const admin = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'admin@exodus.local' } },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@exodus.local',
      role: 'ADMIN',
      passwordHash,
      companyId: company.id,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: 'caixa@exodus.local' } },
    update: {},
    create: {
      name: 'Operador de Caixa',
      email: 'caixa@exodus.local',
      role: 'CASHIER',
      passwordHash: await bcrypt.hash('caixa12345', 10),
      companyId: company.id,
    },
  });

  console.log('✅ Seed concluído:');
  console.log(`   Empresa -> ${company.name} (${company.id})`);
  console.log(`   ADMIN   -> ${admin.email} / admin12345`);
  console.log(`   CASHIER -> ${cashier.email} / caixa12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
