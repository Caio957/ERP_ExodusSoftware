const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface CashReceiptData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  userName?: string;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  initialCash: number;
  totalSupply: number;
  totalBleed: number;
  totalSales: number;
  expectedCash: number;
  finalCash?: number | null;
  difference?: number | null;
  width?: string;
}

/**
 * Relatório de fechamento/resumo de caixa otimizado para bobina térmica
 * 58/80mm — mesma estética monocromática do ThermalReceipt (Requisito 4.7).
 */
export function CashReceipt({
  storeName = 'Exodus Cosméticos',
  storeAddress,
  storePhone,
  userName,
  openedAt,
  closedAt,
  initialCash,
  totalSupply,
  totalBleed,
  totalSales,
  expectedCash,
  finalCash,
  difference,
  width = '80mm',
}: CashReceiptData) {
  const opened = new Date(openedAt);
  const closed = closedAt ? new Date(closedAt) : null;
  const hasClose = finalCash != null;
  const isShort = (difference ?? 0) < 0;

  return (
    <div
      className="thermal-receipt w-full bg-white font-mono text-[12px] leading-tight text-black text-center whitespace-pre-wrap"
      style={{ width }}
    >
      <div className="px-2 py-2">
        <div className="text-center">
          <div className="text-sm font-bold uppercase">{storeName}</div>
          {storeAddress && <div>{storeAddress}</div>}
          {storePhone && <div>Tel: {storePhone}</div>}
          <div className="mt-1 font-bold">RELATÓRIO DE CAIXA</div>
        </div>

        <div className="my-1 border-t border-dashed border-black" />

        <div className="text-left">
          {userName && <Row label="Operador" value={userName} />}
          <Row label="Abertura" value={opened.toLocaleString('pt-BR')} />
          {closed && <Row label="Fechamento" value={closed.toLocaleString('pt-BR')} />}
        </div>

        <div className="my-1 border-t border-dashed border-black" />

        <div className="text-left">
          <Row label="Saldo inicial" value={brl(initialCash)} />
          <Row label="(+) Suprimentos" value={brl(totalSupply)} />
          <Row label="(-) Sangrias" value={brl(totalBleed)} />
          <Row label="(+) Vendas/Recebimentos" value={brl(totalSales)} />
        </div>

        <div className="my-1 border-t border-dashed border-black" />

        <div className="flex justify-between text-sm font-bold">
          <span>SALDO ESPERADO</span>
          <span>{brl(expectedCash)}</span>
        </div>

        {hasClose && (
          <>
            <div className="my-1 border-t border-dashed border-black" />
            <div className="text-left">
              <Row label="Contado na gaveta" value={brl(finalCash ?? 0)} />
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>{isShort ? 'QUEBRA' : 'SOBRA'}</span>
              <span>{brl(Math.abs(difference ?? 0))}</span>
            </div>
          </>
        )}

        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center text-[10px]">Impresso em {new Date().toLocaleString('pt-BR')}</div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
