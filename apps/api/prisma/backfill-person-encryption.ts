// ============================================================================
// Backfill de Criptografia — Plano Mestre V2.0, Frente 2 (LGPD)
// ----------------------------------------------------------------------------
// A extensão `withEncryption` (lib/encryption.ts) só cifra o que passa por
// ela a partir de agora — todo `Person.document`/`email`/`phone` gravado
// ANTES desta Frente continua em texto claro no banco. `decryptField` tolera
// isso na leitura (não quebra), mas os dados continuam expostos em texto
// claro até este script rodar. Roda em modo DRY-RUN por padrão (só relata o
// que faria); exige `CONFIRM_BACKFILL=1` no ambiente para gravar de verdade.
//
// Uso:
//   npx tsx prisma/backfill-person-encryption.ts               # dry-run
//   CONFIRM_BACKFILL=1 npx tsx prisma/backfill-person-encryption.ts  # aplica
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { encryptDeterministic, encryptRandom, isEncrypted } from '../src/lib/encryption.js';

const prisma = new PrismaClient();
const APPLY = process.env.CONFIRM_BACKFILL === '1';

async function main() {
  console.log('============================================================');
  console.log(` Backfill de Criptografia de Person — modo ${APPLY ? 'APLICAR' : 'DRY-RUN'}`);
  console.log('============================================================\n');

  // Client cru (sem `withEncryption`) — precisamos ver o texto claro/ciphertext
  // exatamente como está gravado, sem a extensão decifrar/cifrar por baixo.
  const people = await prisma.person.findMany({
    select: { id: true, companyId: true, document: true, email: true, phone: true },
  });

  let pending = 0;
  let alreadyDone = 0;

  for (const person of people) {
    const patch: Record<string, string> = {};

    if (person.document && !isEncrypted(person.document)) {
      patch.document = encryptDeterministic(person.document);
    }
    if (person.email && !isEncrypted(person.email)) {
      patch.email = encryptRandom(person.email);
    }
    if (person.phone && !isEncrypted(person.phone)) {
      patch.phone = encryptRandom(person.phone);
    }

    if (Object.keys(patch).length === 0) {
      alreadyDone++;
      continue;
    }

    pending++;
    console.log(
      `${APPLY ? 'Cifrando' : '[dry-run] Cifraria'} Person ${person.id} (empresa ${person.companyId}): ${Object.keys(patch).join(', ')}`,
    );
    if (APPLY) {
      await prisma.person.update({ where: { id: person.id }, data: patch });
    }
  }

  console.log(`\nTotal: ${people.length} pessoa(s). Já cifradas/sem dado: ${alreadyDone}. ${APPLY ? 'Cifradas agora' : 'Pendentes'}: ${pending}.`);
  if (!APPLY && pending > 0) {
    console.log('\nNenhuma alteração foi gravada (dry-run). Rode com CONFIRM_BACKFILL=1 para aplicar.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
