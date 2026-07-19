import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

// Formato mínimo que qualquer client (PrismaClient cru, Prisma.TransactionClient,
// o client estendido por `withTenant`, ou o `tx` de um `db.$transaction`) precisa
// satisfazer para estas duas funções. Evita lutar contra os tipos genéricos
// internos que o Prisma Client Extensions cunha (branding), que fazem
// `Prisma.TransactionClient` e o client estendido não serem diretamente
// atribuíveis um ao outro mesmo tendo exatamente os mesmos métodos na prática.
type SettingRow = { id: string; key: string; value: Prisma.JsonValue; companyId: string; updatedAt: Date };
type SettingCapableClient = {
  setting: {
    findFirst(args: { where: { companyId: string; key: string } }): Promise<SettingRow | null>;
    create(args: { data: { key: string; value: Prisma.InputJsonValue; companyId: string } }): Promise<SettingRow>;
    update(args: { where: { id: string }; data: { value: Prisma.InputJsonValue } }): Promise<SettingRow>;
  };
};

// Setting.key deixou de ser a chave primária — a unicidade agora é composta
// com companyId (@@unique([companyId, key])). O Prisma não aceita `null`
// (ou omitir o campo) no seletor tipado de compound unique indexes, então em
// vez de findUnique/upsert usamos findFirst + create/update manual.
// `companyId` é sempre explícito aqui (não depende só da extensão
// `withTenant` do client passado) — o tipo `SettingCreateInput` exige o
// campo em tempo de compilação, já que ele é obrigatório desde a Fase 4.
export async function getSetting(
  companyId: string,
  key: string,
  client: SettingCapableClient = prisma,
) {
  return client.setting.findFirst({ where: { companyId, key } });
}

export async function upsertSetting(
  companyId: string,
  key: string,
  value: Prisma.InputJsonValue,
  client: SettingCapableClient = prisma,
) {
  const existing = await client.setting.findFirst({ where: { companyId, key } });
  if (existing) {
    return client.setting.update({ where: { id: existing.id }, data: { value } });
  }
  return client.setting.create({ data: { key, value, companyId } });
}
