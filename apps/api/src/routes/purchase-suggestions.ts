import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { purchaseSuggestionQuerySchema } from '@exodus/shared';
import { prisma } from '../lib/prisma.js';
import { toMoney } from '../lib/serialize.js';

/**
 * Sugestão de compra (Requisito 4.6).
 * necessidade = média de vendas/dia (janela) * tempo de reposição (lead time).
 * Sugere reposição quando o estoque atual < necessidade.
 */
export async function purchaseSuggestionRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    { preHandler: app.authorize(['ADMIN']), schema: { querystring: purchaseSuggestionQuerySchema } },
    async (req) => {
      const { windowDays, leadTimeDays } = req.query;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      const grouped = await prisma.saleItem.groupBy({
        by: ['variantId'],
        where: { sale: { soldAt: { gte: since } } },
        _sum: { quantity: true },
      });
      if (grouped.length === 0) return { windowDays, leadTimeDays, suggestions: [] };

      const variants = await prisma.productVariant.findMany({
        where: { id: { in: grouped.map((g) => g.variantId) } },
        include: { product: true },
      });
      const variantById = new Map(variants.map((v) => [v.id, v]));

      const suggestions = grouped
        .map((g) => {
          const variant = variantById.get(g.variantId);
          if (!variant) return null;
          const sold = g._sum.quantity ?? 0;
          const avgPerDay = sold / windowDays;
          const required = Math.ceil(avgPerDay * leadTimeDays);
          const suggestedQty = required - variant.stockQty;
          if (suggestedQty <= 0) return null;
          return {
            variantId: variant.id,
            sku: variant.sku,
            description: variant.description,
            productName: variant.product.name,
            brand: variant.product.brand,
            stockQty: variant.stockQty,
            soldInWindow: sold,
            avgPerDay: Number(avgPerDay.toFixed(2)),
            required,
            suggestedQty,
            lastCost: toMoney(variant.costPrice),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => b.suggestedQty - a.suggestedQty);

      return { windowDays, leadTimeDays, suggestions };
    },
  );
}
