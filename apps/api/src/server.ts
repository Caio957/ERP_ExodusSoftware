import { buildApp } from './app.js';
import { env } from './env.js';
import { prisma } from './lib/prisma.js';

const app = buildApp();

async function main() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 Exodus API rodando em http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Encerramento gracioso
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`Recebido ${signal}, encerrando...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

void main();
