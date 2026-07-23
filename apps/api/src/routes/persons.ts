import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createPersonSchema, updatePersonSchema, paginationQuery, PersonType } from '@exodus/shared';
import { AppError, BusinessError, NotFoundError } from '../lib/errors.js';
import { tenantDb } from '../lib/tenant.js';

export async function personRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Proxy da consulta de CNPJ (ReceitaWS): o browser é bloqueado por CORS ao
  // chamar a ReceitaWS diretamente (sem Access-Control-Allow-Origin); um
  // servidor Node não sofre essa restrição, então o front consulta esta rota
  // interna em vez da ReceitaWS direto.
  r.get(
    '/cnpj/:cnpj',
    { preHandler: app.authenticate, schema: { params: z.object({ cnpj: z.string().min(1) }) } },
    async (req) => {
      const res = await fetch(`https://receitaws.com.br/v1/cnpj/${req.params.cnpj}`);
      // Payload externo e livre (não controlamos o contrato da ReceitaWS).
      const data = (await res.json()) as Record<string, unknown>;
      // A ReceitaWS responde 200 mesmo em erro (CNPJ inválido, rate limit
      // etc.), sinalizando a falha só pelo campo status.
      if (data.status === 'ERROR') {
        const message = typeof data.message === 'string' ? data.message : 'Erro na consulta do CNPJ';
        throw new AppError(400, message, 'CNPJ_LOOKUP_ERROR');
      }
      return data;
    },
  );

  // GET /api/persons?type=SUPPLIER&search=...
  // Ganhou `preHandler: app.authenticate` nesta rodada — não tinha NENHUMA
  // autenticação antes (achado ao mapear as rotas para a Fase 4), o que
  // tornava essa rota pública e, mais grave, impossível de escopar por
  // tenant (sem req.user não há companyId nenhum para filtrar). Sem esse
  // preHandler, o isolamento multi-tenant desta rota não teria como existir.
  r.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: paginationQuery.extend({ type: PersonType.optional() }),
      },
    },
    async (req) => {
      const { db } = tenantDb(req);
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
        db.person.count({ where }),
        db.person.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);
      return { total, page, pageSize, items };
    },
  );

  // Mesmo achado do GET '/' acima — ganhou autenticação nesta rodada.
  r.get(
    '/:id',
    { preHandler: app.authenticate, schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const { db } = tenantDb(req);
      const person = await db.person.findFirst({ where: { id: req.params.id } });
      if (!person) throw new NotFoundError('Pessoa');
      return person;
    },
  );

  r.post(
    '/',
    { preHandler: app.authenticate, schema: { body: createPersonSchema } },
    async (req, reply) => {
      const { db, companyId } = tenantDb(req);
      const person = await db.person.create({ data: { ...req.body, companyId } });
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
      const { db } = tenantDb(req);
      const existing = await db.person.findFirst({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Pessoa');
      return db.person.update({ where: { id: req.params.id }, data: req.body });
    },
  );

  // Exclusão protegida: bloqueia se houver vendas, notas ou títulos vinculados.
  r.delete(
    '/:id',
    { preHandler: app.authenticate, schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req, reply) => {
      const { db } = tenantDb(req);
      const person = await db.person.findFirst({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!person) throw new NotFoundError('Pessoa');

      const [sales, invoices, accounts] = await Promise.all([
        db.sale.count({ where: { clientId: req.params.id } }),
        db.invoice.count({ where: { supplierId: req.params.id } }),
        db.financialAccount.count({ where: { personId: req.params.id } }),
      ]);
      if (sales > 0 || invoices > 0 || accounts > 0) {
        throw new BusinessError(
          'Pessoa possui vendas, notas ou títulos vinculados e não pode ser excluída.',
        );
      }

      await db.person.delete({ where: { id: req.params.id } });
      return reply.status(204).send();
    },
  );

  /**
   * Anonimização (Plano Mestre V2.0, Frente 3 — Direito ao Esquecimento).
   * Alternativa ao `DELETE` quando a pessoa tem vendas/notas/títulos
   * vinculados (ou mesmo sem vínculo, se só se quer "esquecer" os dados sem
   * apagar o histórico): sempre `UPDATE`, nunca `DELETE` — preserva o `id`
   * para não quebrar `Sale.clientId`/`Invoice.supplierId`/
   * `FinancialAccount.personId`. Só ADMIN (não existe papel de "dono da
   * loja" separado neste sistema — `UserRole` é só `ADMIN`/`CASHIER`; ADMIN
   * já É o dono/gestor da loja).
   * Os novos valores passam pelo `db.person.update` normal — a extensão
   * `withEncryption` (Frente 2, `lib/encryption.ts`) cifra `document`/
   * `email`/`phone` automaticamente, como cifraria qualquer outra escrita.
   */
  r.post(
    '/:id/anonymize',
    { preHandler: app.authorize(['ADMIN']), schema: { params: z.object({ id: z.string().uuid() }) } },
    async (req) => {
      const { db } = tenantDb(req);
      const existing = await db.person.findFirst({ where: { id: req.params.id } });
      if (!existing) throw new NotFoundError('Pessoa');

      const anonId = crypto.randomUUID();
      const anonymized = await db.person.update({
        where: { id: req.params.id },
        data: {
          name: 'Cliente Anonimizado',
          // Nome fantasia/apelido também identifica a pessoa — limpo junto.
          tradeName: null,
          document: `ANON-${anonId}`,
          email: `anon-${anonId}@exodus-deleted.com`,
          phone: '00000000000',
          zipCode: null,
          street: null,
          number: null,
          district: null,
          city: null,
          state: null,
        },
      });

      return {
        message: 'Dados da pessoa foram anonimizados com sucesso.',
        person: anonymized,
      };
    },
  );
}
