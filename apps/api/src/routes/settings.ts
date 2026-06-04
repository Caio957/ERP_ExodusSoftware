import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { productFormSettingsSchema } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';

const PRODUCT_FORM_KEY = 'product_form';

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
}
