import type { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { purchaseSuggestionQuerySchema } from '@exodus/shared';
import { toMoney } from '../lib/serialize.js';
import { tenantDb } from '../lib/tenant.js';

/**
 * Sugestão de compra (Requisito 4.6).
 * Retorna TODOS os produtos (variantes activas), com sugestão calculada a partir
 * da média de vendas na janela × lead time. Produtos sem vendas no período
 * aparecem com avgPerDay=0 e suggestedQty=0.
 * Filtros opcionais: brand, group, subgroup.
 */
export async function purchaseSuggestionRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    { preHandler: app.authorize(['ADMIN']), schema: { querystring: purchaseSuggestionQuerySchema } },
    async (req) => {
      const { db } = tenantDb(req);
      const { windowDays, leadTimeDays, brand, group, subgroup } = req.query;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      // Monta filtro de produto
      const productWhere: Record<string, unknown> = {};
      if (brand) productWhere.brand = { contains: brand, mode: 'insensitive' };
      if (group) productWhere.group = { contains: group, mode: 'insensitive' };
      if (subgroup) productWhere.subgroup = { contains: subgroup, mode: 'insensitive' };

      // Busca todas as variantes (com filtro de produto)
      const variants = await db.productVariant.findMany({
        where: { product: Object.keys(productWhere).length ? productWhere : undefined },
        include: { product: true },
        orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
      });

      if (variants.length === 0) return { windowDays, leadTimeDays, suggestions: [] };

      // Vendas agregadas na janela para as variantes encontradas
      const variantIds = variants.map((v) => v.id);
      const grouped = await db.saleItem.groupBy({
        by: ['variantId'],
        where: {
          variantId: { in: variantIds },
          sale: { soldAt: { gte: since } },
        },
        _sum: { quantity: true },
      });
      const soldMap = new Map(grouped.map((g) => [g.variantId, g._sum.quantity ?? 0]));

      const suggestions = variants.map((variant) => {
        const sold = soldMap.get(variant.id) ?? 0;
        const avgPerDay = sold / windowDays;
        const required = Math.ceil(avgPerDay * leadTimeDays);
        const suggestedQty = Math.max(0, required - variant.stockQty);
        return {
          variantId: variant.id,
          sku: variant.sku,
          description: variant.description,
          productCode: variant.product.code,
          productName: variant.product.name,
          brand: variant.product.brand,
          group: variant.product.group,
          subgroup: variant.product.subgroup ?? null,
          stockQty: variant.stockQty,
          soldInWindow: sold,
          avgPerDay: Number(avgPerDay.toFixed(2)),
          suggestedQty,
          lastCost: toMoney(variant.costPrice),
        };
      });

      // Ordena: com sugestão > 0 primeiro (desc), depois os demais por nome
      suggestions.sort((a, b) => {
        if (b.suggestedQty !== a.suggestedQty) return b.suggestedQty - a.suggestedQty;
        return a.productName.localeCompare(b.productName);
      });

      return { windowDays, leadTimeDays, suggestions };
    },
  );
}
