import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  productFormSettingsSchema,
  companyProfileSchema,
  paymentTypesSchema,
  salesSettingsSchema,
  DEFAULT_PAYMENT_TYPES,
} from '@exodus/shared';
import { getSetting, upsertSetting } from '../lib/settings.js';
import { tenantDb } from '../lib/tenant.js';

const PRODUCT_FORM_KEY = 'product_form';
const COMPANY_KEY = 'company_profile';
const PAYMENT_TYPES_KEY = 'payment_types';
const SALES_KEY = 'sales';

export async function settingsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // Lê a config do formulário de produto (qualquer usuário autenticado — o
  // formulário usa para saber quais campos exigir). Defaults se não houver.
  r.get('/product-form', { preHandler: app.authenticate }, async (req) => {
    const { db, companyId } = tenantDb(req);
    const setting = await getSetting(companyId, PRODUCT_FORM_KEY, db);
    return productFormSettingsSchema.parse(setting?.value ?? {});
  });

  // Salva a config (somente ADMIN).
  r.put(
    '/product-form',
    { preHandler: app.authorize(['ADMIN']), schema: { body: productFormSettingsSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      const setting = await upsertSetting(companyId, PRODUCT_FORM_KEY, req.body, db);
      return productFormSettingsSchema.parse(setting.value);
    },
  );

  // --- Dados da empresa contratante -----------------------------------------
  r.get('/company', { preHandler: app.authenticate }, async (req) => {
    const { db, companyId } = tenantDb(req);
    const setting = await getSetting(companyId, COMPANY_KEY, db);
    return companyProfileSchema.parse(setting?.value ?? {});
  });

  r.put(
    '/company',
    { preHandler: app.authorize(['ADMIN']), schema: { body: companyProfileSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      const setting = await upsertSetting(companyId, COMPANY_KEY, req.body, db);
      return companyProfileSchema.parse(setting.value);
    },
  );

  // --- Tipos de recebimento (formas de pagamento configuráveis) -------------
  r.get('/payment-types', { preHandler: app.authenticate }, async (req) => {
    const { db, companyId } = tenantDb(req);
    const setting = await getSetting(companyId, PAYMENT_TYPES_KEY, db);
    if (!setting) return { types: DEFAULT_PAYMENT_TYPES };
    return paymentTypesSchema.parse(setting.value);
  });

  r.put(
    '/payment-types',
    { preHandler: app.authorize(['ADMIN']), schema: { body: paymentTypesSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      const setting = await upsertSetting(companyId, PAYMENT_TYPES_KEY, req.body, db);
      return paymentTypesSchema.parse(setting.value);
    },
  );

  // --- Cliente padrão de vendas (substitui o fallback hardcoded "Balcão") ---
  // Qualquer usuário autenticado lê (PDV precisa saber o padrão ao abrir).
  r.get('/sales', { preHandler: app.authenticate }, async (req) => {
    const { db, companyId } = tenantDb(req);
    const setting = await getSetting(companyId, SALES_KEY, db);
    const parsed = salesSettingsSchema.parse(setting?.value ?? {});

    // Resolve o Person aqui para o front não precisar de uma segunda requisição.
    let defaultPerson: { id: string; name: string; tradeName: string | null } | null = null;
    if (parsed.defaultPersonId) {
      defaultPerson = await db.person.findFirst({
        where: { id: parsed.defaultPersonId },
        select: { id: true, name: true, tradeName: true },
      });
    }

    return { ...parsed, defaultPerson };
  });

  r.put(
    '/sales',
    { preHandler: app.authorize(['ADMIN']), schema: { body: salesSettingsSchema } },
    async (req) => {
      const { db, companyId } = tenantDb(req);
      const setting = await upsertSetting(companyId, SALES_KEY, req.body, db);
      return salesSettingsSchema.parse(setting.value);
    },
  );
}
