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
