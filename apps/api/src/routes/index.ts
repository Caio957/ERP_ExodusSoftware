import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { adminRoutes } from './admin.js';
import { productRoutes } from './products.js';
import { personRoutes } from './persons.js';
import { invoiceRoutes } from './invoices.js';
import { saleRoutes } from './sales.js';
import { cashRoutes } from './cash.js';
import { financialRoutes } from './financial.js';
import { purchaseSuggestionRoutes } from './purchase-suggestions.js';
import { settingsRoutes } from './settings.js';
import { dashboardRoutes } from './dashboard.js';

/** Registra todos os grupos de rotas sob seus respectivos prefixos. */
export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(adminRoutes, { prefix: '/admin' });
  await app.register(productRoutes, { prefix: '/products' });
  await app.register(personRoutes, { prefix: '/persons' });
  await app.register(invoiceRoutes, { prefix: '/invoices' });
  await app.register(saleRoutes, { prefix: '/sales' });
  await app.register(cashRoutes, { prefix: '/cash' });
  await app.register(financialRoutes, { prefix: '/financial' });
  await app.register(purchaseSuggestionRoutes, { prefix: '/purchase-suggestions' });
  await app.register(settingsRoutes, { prefix: '/settings' });
  await app.register(dashboardRoutes, { prefix: '/dashboard' });
}
