export interface ReceiptItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Props {
  items: ReceiptItem[];
  total: number;
  paymentMethod: string;
  width?: string;
  storeName?: string;
  soldAt?: Date;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const methodLabel: Record<string, string> = {
  PIX: 'PIX',
  CREDIT: 'Crédito',
  DEBIT: 'Débito',
  CASH: 'Dinheiro',
  A_PRAZO: 'A prazo',
  SPLIT: 'Múltiplas formas',
};

/**
 * Recibo otimizado para bobina térmica 58/80mm (Requisito 4.7).
 * A impressão é disparada via window.print() — ver printReceipt().
 */
export function ThermalReceipt({
  items,
  total,
  paymentMethod,
  width = '80mm',
  storeName = 'Exodus Cosméticos',
  soldAt = new Date(),
}: Props) {
  return (
    <div
      className="thermal-receipt w-full bg-white font-mono text-[12px] leading-tight text-black text-center whitespace-pre-wrap"
      style={{ width }}
    >
      <div className="px-2 py-2">
        <div className="text-center">
          <div className="text-sm font-bold uppercase">{storeName}</div>
          <div>Rua Principal, 123 - Centro</div>
          <div>Montes Claros - MG</div>
          <div>Tel: (38) 99999-9999</div>
          <div>Comprovante (não fiscal)</div>
          <div>{soldAt.toLocaleString('pt-BR')}</div>
        </div>

        <div className="my-1 border-t border-dashed border-black" />

        {items.map((it, i) => (
          <div key={i} className="mb-1">
            <div className="truncate">{it.description}</div>
            <div className="flex justify-between">
              <span>
                {it.quantity} x {brl(it.unitPrice)}
              </span>
              <span>{brl(it.quantity * it.unitPrice)}</span>
            </div>
          </div>
        ))}

        <div className="my-1 border-t border-dashed border-black" />

        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{brl(total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pagamento</span>
          <span>{methodLabel[paymentMethod] ?? paymentMethod}</span>
        </div>

        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center">Obrigada pela preferência! 💄</div>
      </div>
    </div>
  );
}

/** Dispara a impressão nativa do navegador (pareada à mini impressora). */
export function printReceipt() {
  window.print();
}
