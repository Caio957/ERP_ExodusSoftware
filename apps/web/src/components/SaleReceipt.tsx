// Comprovante de venda (não fiscal) em dois formatos: cupom térmico 58/80mm
// para a mini-impressora do balcão e folha A4 estilizada para impressora comum.
// O CSS @media print (index.css) deixa visível apenas a classe `.print-area`;
// o disparo de window.print() (medição de altura + @page dinâmico + remoção
// física dos irmãos do DOM) fica a cargo de components/PrintReceiptModal.tsx.

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const methodLabel: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'PIX',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  A_PRAZO: 'A prazo',
  SPLIT: 'Múltiplas formas',
};
const labelOf = (m: string) => methodLabel[m] ?? m;

export interface CompanyInfo {
  name?: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
}

/**
 * Linhas de identificação da empresa (documento, endereço, telefone, e-mail)
 * já formatadas e filtradas — reaproveitadas pelo cupom térmico (uma linha
 * por item) e pela folha A4 (mesmo bloco, estilo diferente). O nome da
 * empresa fica de fora: cada formato já o exibe como título, separadamente.
 */
function companyInfoLines(company: CompanyInfo): string[] {
  return [
    company.document?.trim() ? `CNPJ/CPF: ${company.document.trim()}` : null,
    company.address?.trim() || null,
    company.phone?.trim() ? `Tel: ${company.phone.trim()}` : null,
    company.email?.trim() || null,
  ].filter((line): line is string => Boolean(line));
}

export interface SaleReceiptData {
  code: number;
  soldAt: string | Date;
  clientName?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  notes?: string | null;
}

export type ReceiptFormat = 'thermal' | 'a4';

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleString('pt-BR');
}

/** Cupom térmico (58/80mm) com cabeçalho da loja, NºDOC e itens. */
function ThermalSaleReceipt({
  company,
  sale,
  width = '80mm',
}: {
  company: CompanyInfo;
  sale: SaleReceiptData;
  width?: '58mm' | '80mm';
}) {
  const storeName = company.name?.trim() || 'Exodus Cosméticos';
  return (
    <div
      className="print-area mx-auto bg-white font-mono text-[12px] leading-tight text-black"
      // Largura física fixa (80mm ≈ 302px) já é imune ao viewport, mas o
      // `minWidth: 300px` é uma trava extra (blindagem) para o cupom de 80mm
      // nunca refluir/esmagar caso o motor de impressão leia o DOM numa tela
      // estreita de celular durante a medição off-screen. Não aplicado ao
      // 58mm (variante mais estreita, hoje não usada).
      style={{ width, minWidth: width === '80mm' ? '300px' : undefined }}
    >
      <div className="px-2 py-2">
        <div className="text-center">
          <div className="text-sm font-bold uppercase">{storeName}</div>
          {companyInfoLines(company).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>

        <div className="my-1 border-t border-dashed border-black" />
        <div className="flex justify-between">
          <span>Venda #{sale.code}</span>
          <span>{fmtDate(sale.soldAt)}</span>
        </div>
        <div>Cliente: {sale.clientName?.trim() || 'Consumidor Final'}</div>

        <div className="my-1 border-t border-dashed border-black" />
        {sale.items.map((it, i) => (
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
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{brl(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Desconto</span>
            <span>- {brl(sale.discount)}</span>
          </div>
        )}
        {sale.surcharge > 0 && (
          <div className="flex justify-between">
            <span>Acréscimo</span>
            <span>+ {brl(sale.surcharge)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>{brl(sale.total)}</span>
        </div>

        <div className="my-1 border-t border-dashed border-black" />
        <div className="font-bold">Pagamento</div>
        {sale.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{labelOf(p.method)}</span>
            <span>{brl(p.amount)}</span>
          </div>
        ))}

        {sale.notes?.trim() && (
          <>
            <div className="my-1 border-t border-dashed border-black" />
            <div className="font-bold">Obs.</div>
            <div className="whitespace-pre-wrap">{sale.notes}</div>
          </>
        )}

        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center">Obrigada pela preferência! 💄</div>
        <div className="text-center text-[10px]">Comprovante não fiscal</div>
      </div>
    </div>
  );
}

/** Comprovante em folha A4, mais convidativo (impressora comum). */
function A4SaleReceipt({ company, sale }: { company: CompanyInfo; sale: SaleReceiptData }) {
  const storeName = company.name?.trim() || 'Exodus Cosméticos';
  return (
    <div className="print-area mx-auto bg-white text-slate-900" style={{ width: '210mm', maxWidth: '100%' }}>
      <div className="p-10">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b-2 border-brand-500 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-2xl font-bold text-white">
              {storeName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-display text-2xl font-bold">{storeName}</div>
              {companyInfoLines(company).map((line, i) => (
                <div key={i} className="text-sm text-slate-500">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comprovante de venda</div>
            <div className="font-display text-3xl font-bold text-brand-600">#{sale.code}</div>
            <div className="text-sm text-slate-500">{fmtDate(sale.soldAt)}</div>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          <span className="font-semibold">Cliente:</span> {sale.clientName?.trim() || 'Consumidor Final'}
        </div>

        {/* Itens */}
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-400">
              <th className="py-2">Produto</th>
              <th className="text-center">Qtd</th>
              <th className="text-right">Unitário</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{it.description}</td>
                <td className="text-center">{it.quantity}</td>
                <td className="text-right">{brl(it.unitPrice)}</td>
                <td className="text-right font-medium">{brl(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totais */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{brl(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Desconto</span>
                <span>- {brl(sale.discount)}</span>
              </div>
            )}
            {sale.surcharge > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Acréscimo</span>
                <span>+ {brl(sale.surcharge)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
              <span>TOTAL</span>
              <span>{brl(sale.total)}</span>
            </div>
          </div>
        </div>

        {/* Pagamento */}
        <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="mb-1 font-semibold">Forma(s) de pagamento</div>
          {sale.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-slate-600">
              <span>{labelOf(p.method)}</span>
              <span>{brl(p.amount)}</span>
            </div>
          ))}
        </div>

        {sale.notes?.trim() && (
          <div className="mt-4 text-sm text-slate-600">
            <span className="font-semibold">Obs.:</span> {sale.notes}
          </div>
        )}

        <div className="mt-8 text-center text-sm text-slate-500">
          Obrigada pela preferência! 💄
          <div className="mt-1 text-xs text-slate-400">Documento sem valor fiscal.</div>
        </div>
      </div>
    </div>
  );
}

/** Renderiza o comprovante no formato escolhido. */
export function SaleReceipt({
  company,
  sale,
  format,
}: {
  company: CompanyInfo;
  sale: SaleReceiptData;
  format: ReceiptFormat;
}) {
  return format === 'a4' ? (
    <A4SaleReceipt company={company} sale={sale} />
  ) : (
    <ThermalSaleReceipt company={company} sale={sale} />
  );
}
