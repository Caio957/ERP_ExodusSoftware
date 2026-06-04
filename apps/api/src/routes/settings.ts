import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  productFormSettingsSchema,
  companyProfileSchema,
  paymentTypesSchema,
  DEFAULT_PAYMENT_TYPES,
} from '@exodus/shared';
import { prisma } from '../lib/prisma.js';

const PRODUCT_FORM_KEY = 'product_form';
const COMPANY_KEY = 'company_profile';
const PAYMENT_TYPES_KEY = 'payment_types';

export async function settingsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Lê a config do formulário de produto (qualquer usuário autenticado — o
  // formulário usa para saber quais campos exigir). Defaults se não houver.
  r.get('/product-form', { preHandler: app.authenticate }, async () => {
    const setting = await prisma.setting.findUnique({ where: { key: PRODUCT_FORM_KEY } });
    return productFormSettingsSchema.parse(setting?.value ?? {});
  });

  // Salva a config (somente ADMIN).
  r.put(
    '/product-form',
    { preHandler: app.authorize(['ADMIN']), schema: { body: productFormSettingsSchema } },
    async (req) => {
      const value = req.body;
      const setting = await prisma.setting.upsert({
        where: { key: PRODUCT_FORM_KEY },
        create: { key: PRODUCT_FORM_KEY, value },
        update: { value },
      });
      return productFormSettingsSchema.parse(setting.value);
    },
  );

  // --- Dados da empresa contratante -----------------------------------------
  r.get('/company', { preHandler: app.authenticate }, async () => {
    const setting = await prisma.setting.findUnique({ where: { key: COMPANY_KEY } });
    return companyProfileSchema.parse(setting?.value ?? {});
  });

  r.put(
    '/company',
    { preHandler: app.authorize(['ADMIN']), schema: { body: companyProfileSchema } },
    async (req) => {
      const setting = await prisma.setting.upsert({
        where: { key: COMPANY_KEY },
        create: { key: COMPANY_KEY, value: req.body },
        update: { value: req.body },
      });
      return companyProfileSchema.parse(setting.value);
    },
  );

  // --- Tipos de recebimento (formas de pagamento configuráveis) -------------
  r.get('/payment-types', { preHandler: app.authenticate }, async () => {
    const setting = await prisma.setting.findUnique({ where: { key: PAYMENT_TYPES_KEY } });
    if (!setting) return { types: DEFAULT_PAYMENT_TYPES };
    return paymentTypesSchema.parse(setting.value);
  });

  r.put(
    '/payment-types',
    { preHandler: app.authorize(['ADMIN']), schema: { body: paymentTypesSchema } },
    async (req) => {
      const setting = await prisma.setting.upsert({
        where: { key: PAYMENT_TYPES_KEY },
        create: { key: PAYMENT_TYPES_KEY, value: req.body },
        update: { value: req.body },
      });
      return paymentTypesSchema.parse(setting.value);
    },
  );
}
