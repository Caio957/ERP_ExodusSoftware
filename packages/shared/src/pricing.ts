/**
 * Cálculo bidirecional de Margem e Markup (Requisito 4.1).
 *
 * Definições adotadas:
 *  - Markup  (%) = (preçoVenda - custo) / custo * 100        → sobre o custo
 *  - Margem  (%) = (preçoVenda - custo) / preçoVenda * 100   → sobre a venda
 *
 * Estas funções são puras e compartilhadas entre backend (conferência) e
 * frontend (campos que se recalculam ao vivo). Trabalhamos com `number`;
 * a persistência usa Decimal(10,2) no Prisma para evitar erro de ponto
 * flutuante em valores monetários.
 */

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Preço de venda a partir do custo e do markup (% sobre o custo). */
export function priceFromMarkup(cost: number, markupPercent: number): number {
  return round2(cost * (1 + markupPercent / 100));
}

/** Preço de venda a partir do custo e da margem (% sobre a venda). */
export function priceFromMargin(cost: number, marginPercent: number): number {
  if (marginPercent >= 100) {
    throw new Error('Margem deve ser menor que 100%.');
  }
  return round2(cost / (1 - marginPercent / 100));
}

/** Markup (% sobre o custo) a partir do custo e do preço de venda. */
export function markupFromPrice(cost: number, salePrice: number): number {
  if (cost <= 0) return 0;
  return round2(((salePrice - cost) / cost) * 100);
}

/** Margem (% sobre a venda) a partir do custo e do preço de venda. */
export function marginFromPrice(cost: number, salePrice: number): number {
  if (salePrice <= 0) return 0;
  return round2(((salePrice - cost) / salePrice) * 100);
}

/** Converte markup (%) em margem (%). */
export function markupToMargin(markupPercent: number): number {
  return round2((markupPercent / (100 + markupPercent)) * 100);
}

/** Converte margem (%) em markup (%). */
export function marginToMarkup(marginPercent: number): number {
  if (marginPercent >= 100) {
    throw new Error('Margem deve ser menor que 100%.');
  }
  return round2((marginPercent / (100 - marginPercent)) * 100);
}

export interface PricingSnapshot {
  cost: number;
  salePrice: number;
  markupPercent: number;
  marginPercent: number;
  profit: number;
}

/** Snapshot completo de precificação a partir de custo + preço de venda. */
export function pricingSnapshot(cost: number, salePrice: number): PricingSnapshot {
  return {
    cost: round2(cost),
    salePrice: round2(salePrice),
    markupPercent: markupFromPrice(cost, salePrice),
    marginPercent: marginFromPrice(cost, salePrice),
    profit: round2(salePrice - cost),
  };
}

/**
 * Landed cost: rateia frete + outras despesas de uma compra entre os itens,
 * proporcionalmente ao valor de cada um (qtd × custo original) dentro do
 * total de produtos. Compartilhada entre backend (persistência do custo
 * real em costPrice/averageCost) e frontend (prévia visual na Etapa 2 da
 * Compra Manual e do XmlImport, antes mesmo de confirmar) — mesma
 * motivação das funções de margem/markup acima: uma fórmula, sem risco de
 * o preview do front divergir do que o backend efetivamente grava.
 *
 * Sem despesas extras ou sem valor de produtos para ratear, retorna os
 * custos originais inalterados.
 */
export function apportionLandedCost(
  items: Array<{ quantity: number; unitCost: number }>,
  freight: number,
  otherExpenses: number,
): number[] {
  const extra = freight + otherExpenses;
  const productsTotal = items.reduce((acc, it) => acc + it.quantity * it.unitCost, 0);
  if (extra <= 0 || productsTotal <= 0) {
    return items.map((it) => it.unitCost);
  }
  return items.map((it) => {
    const weight = (it.quantity * it.unitCost) / productsTotal;
    const share = extra * weight;
    return round2(it.unitCost + share / it.quantity);
  });
}
