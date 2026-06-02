import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin12345', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@exodus.local' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@exodus.local',
      role: 'ADMIN',
      passwordHash,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'caixa@exodus.local' },
    update: {},
    create: {
      name: 'Operador de Caixa',
      email: 'caixa@exodus.local',
      role: 'CASHIER',
      passwordHash: await bcrypt.hash('caixa12345', 10),
    },
  });

  console.log('✅ Seed concluído:');
  console.log(`   ADMIN   -> ${admin.email} / admin12345`);
  console.log(`   CASHIER -> ${cashier.email} / caixa12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
