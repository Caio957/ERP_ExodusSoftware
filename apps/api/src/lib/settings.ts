import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type PrismaOrTx = typeof prisma | Prisma.TransactionClient;

// Setting.key deixou de ser a chave primária — agora a unicidade é composta
// com companyId (@@unique([companyId, key]), Fase 1 do Plano Mestre
// Multi-Tenant). O Prisma não aceita `null` no seletor tipado de compound
// unique indexes que envolvem um campo nullable (o tipo gerado exige
// `companyId: string`), então em vez de findUnique/upsert usamos
// findFirst + create/update manual. `companyId` fica `null` até uma fase
// posterior resolver o tenant por requisição.
export async function getSetting(key: string, client: PrismaOrTx = prisma) {
  return client.setting.findFirst({ where: { companyId: null, key } });
}

export async function upsertSetting(
  key: string,
  value: Prisma.InputJsonValue,
  client: PrismaOrTx = prisma,
) {
  const existing = await client.setting.findFirst({ where: { companyId: null, key } });
  if (existing) {
    return client.setting.update({ where: { id: existing.id }, data: { value } });
  }
  return client.setting.create({ data: { key, value } });
}
