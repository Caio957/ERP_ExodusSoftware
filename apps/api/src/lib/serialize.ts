import { Prisma } from '@prisma/client';

/** Converte Decimal do Prisma para number (JSON-friendly, 2 casas). */
export function toMoney(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

/** Converte recursivamente quaisquer Decimal de um objeto em number. */
export function serializeDecimals<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (input instanceof Prisma.Decimal) return input.toNumber() as unknown as T;
  if (input instanceof Date) return input;
  if (Array.isArray(input)) return input.map((i) => serializeDecimals(i)) as unknown as T;
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      out[key] = serializeDecimals(val);
    }
    return out as T;
  }
  return input;
}
