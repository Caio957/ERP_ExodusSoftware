import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

/**
 * Singleton do PrismaClient. Em dev, evita esgotar o pool com hot-reload
 * mantendo a instância no globalThis.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
