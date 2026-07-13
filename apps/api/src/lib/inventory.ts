/**
 * Custo Médio Ponderado (CMP) — fórmula padrão de ERP para reavaliação de
 * inventário a cada entrada de nota. Fonte única usada por `/invoices/confirm`
 * (XML) e `/invoices/manual` (compra manual): evita que as duas rotas
 * divirjam com o tempo e reintroduzam o bug de sobrescrever o custo médio
 * com o custo da entrada em vez de ponderar pelo estoque existente.
 *
 * Regra: se o estoque atual for <= 0, o novo CMP é o custo exato desta
 * entrada (não há o que ponderar). Caso contrário, pondera o valor total em
 * estoque (estoque atual × CMP atual) com o valor total da entrada
 * (quantidade × custo da entrada), dividido pela soma das quantidades.
 */
export function calcWeightedAverageCost(
  currentStockQty: number,
  currentAverageCost: number,
  incomingQty: number,
  incomingCost: number,
): number {
  if (currentStockQty <= 0) return incomingCost;
  const totalCurrentValue = currentStockQty * currentAverageCost;
  const totalIncomingValue = incomingQty * incomingCost;
  const newAverageCost = (totalCurrentValue + totalIncomingValue) / (currentStockQty + incomingQty);
  return Math.round(newAverageCost * 100) / 100;
}

/**
 * Landed cost: rateia frete + outras despesas da nota entre os itens,
 * proporcionalmente ao valor de cada um (qtd × custo original) dentro do
 * total de produtos da compra. Fonte única usada por `/invoices/confirm`,
 * `/invoices/manual` e a edição completa — mesma motivação de
 * `calcWeightedAverageCost` (evitar que as rotas divirjam).
 *
 * `InvoiceItem.unitCost` continua guardando o custo original do documento
 * (auditoria/conciliação com o fornecedor); o valor retornado aqui — que já
 * embute a fatia rateada — é o que atualiza `costPrice`/`averageCost` do
 * produto (o custo real de aquisição, refletido na tela de reprecificação).
 *
 * Sem despesas extras ou sem valor de produtos para ratear (ex.: todos os
 * itens com custo zero), retorna os custos originais inalterados.
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
    return Math.round((it.unitCost + share / it.quantity) * 100) / 100;
  });
}
