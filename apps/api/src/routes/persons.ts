import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createPersonSchema, updatePersonSchema, paginationQuery, PersonType } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

export async function personRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /api/persons?type=SUPPLIER&search=...
  r.get(
    '/',
    {
      schema: {
        querystring: paginationQuery.extend({ type: PersonType.optional() }),
      },
    },
    async (req) => {
      const { page, pageSize, search, type } = req.query;
      const where = {
        ...(type ? { type } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { document: { contains: search } },
              ],
            }
          : {}),
      };
      const [total, items] = await Promise.all([
        prisma.person.count({ where }),
        prisma.person.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return { total, page, pageSize, items };
    },
  );

  r.get(
    '/:id',
    { schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const person = await prisma.person.findUnique({ where: { id: req.params.id } });
      if (!person) throw new NotFoundError('Pessoa');
      return person;
    },
  );

  r.post(
    '/',
    { preHandler: app.authenticate, schema: { body: createPersonSchema } },
    async (req, reply) => {
      const person = await prisma.person.create({ data: req.body });
      return reply.status(201).send(person);
    },
  );

  r.put(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: { params: z.object({ id: z.string().uuid() }), body: updatePersonSchema },
    },
    async (req) => {
      return prisma.person.update({ where: { id: req.params.id }, data: req.body });
    },
  );
}
