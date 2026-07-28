import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { onboardingSchema } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { ConflictError } from '../lib/errors.js';

/**
 * Onboarding público de lojistas (Plano Mestre V2.0 — Frente 1). Rota
 * DELIBERADAMENTE pública (sem `authenticate`): é o ponto de entrada de um
 * cliente novo que ainda não tem conta. Usa o Prisma CRU de propósito, nunca
 * `withTenant`/`tenantDb` — não há tenant no contexto ainda; a própria
 * operação é a que cria a empresa. `Company` e `User` não têm campos
 * criptografados (só `Person` é coberto por `withEncryption`), então o Prisma
 * cru é suficiente.
 *
 * Fluxo (transação atômica): cria a `Company` com status `PENDING` + o
 * primeiro `User` ADMIN vinculado a ela. A empresa fica aguardando aprovação
 * manual da equipe Exodus — o login só é liberado quando um admin da Exodus
 * mudar o status para `ACTIVE` (guarda em `routes/auth.ts`).
 */
export async function onboardingRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/', { schema: { body: onboardingSchema } }, async (req, reply) => {
    const { companyName, cnpj, adminName, email, password } = req.body;

    // `Company.document` é @unique global — bloqueia CNPJ já cadastrado.
    const existingCompany = await prisma.company.findUnique({ where: { document: cnpj } });
    if (existingCompany) {
      throw new ConflictError('Já existe uma empresa cadastrada com este CNPJ.');
    }

    // `User.email` deixou de ser @unique global (virou
    // @@unique([companyId, email])) — então para bloquear e-mail duplicado no
    // auto-cadastro público usamos `findFirst` (varre todos os tenants). Aqui
    // é deliberadamente estrito: um e-mail que já exista em QUALQUER empresa
    // não pode iniciar um novo onboarding, evitando que alguém amarre uma
    // empresa nova a um e-mail de terceiro.
    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      throw new ConflictError('Já existe um usuário cadastrado com este e-mail.');
    }

    const passwordHash = await hashPassword(password);

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: { name: companyName, document: cnpj, status: 'PENDING' },
      });
      await tx.user.create({
        data: {
          name: adminName,
          email,
          passwordHash,
          role: 'ADMIN',
          companyId: created.id,
        },
      });
      return created;
    });

    return reply.status(201).send({
      message:
        'Cadastro recebido! Seu acesso está pendente de aprovação pela equipe Exodus. ' +
        'Você será avisado assim que a conta for liberada.',
      companyId: company.id,
      status: 'PENDING' as const,
    });
  });
}
