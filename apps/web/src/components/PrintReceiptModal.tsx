import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { SaleReceipt, type CompanyInfo, type ReceiptFormat, type SaleReceiptData } from './SaleReceipt';

const PRINT_ROOT_ID = 'sale-receipt-print-root';

/**
 * Modal de impressão de comprovante — motor único, validado no PDV
 * (Dynamic Measurement Engine), reaproveitado aqui para a consulta de
 * Vendas. Imprimir diretamente o preview on-screen (window.print() sobre
 * um `<div>` com scroll/overflow recortado pelo modal) produz páginas em
 * branco: o navegador não sabe a altura real do cupom nem tem um `@page`
 * dimensionado a ele. Este motor mede o recibo fora da tela antes de
 * chamar `window.print()`, injeta um `@page` com o tamanho exato e remove
 * fisicamente o resto do app do DOM impresso — não só com `visibility:hidden`,
 * que mantém a altura fantasma e gera folhas extras em branco.
 */
export function PrintReceiptModal({
  sale,
  company,
  onClose,
}: {
  sale: SaleReceiptData;
  company: CompanyInfo;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ReceiptFormat>('thermal');
  const [printMode, setPrintMode] = useState<ReceiptFormat | null>(null);
  const [receiptHeight, setReceiptHeight] = useState(0);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!printMode) return;
    const afterPrint = () => {
      setPrintMode(null);
      setReceiptHeight(0);
    };
    window.addEventListener('afterprint', afterPrint);

    // Timeout 1: aguarda o React renderizar o recibo fora da tela para medir.
    const t1 = window.setTimeout(() => {
      if (printMode === 'thermal' && receiptRef.current) {
        // scrollHeight captura a altura real (mesmo com collapsing margins);
        // +15px de sobra para a guilhotina não cortar a última linha.
        setReceiptHeight(receiptRef.current.scrollHeight + 15);
      }
      // Timeout 2: aguarda o estado de altura atualizar o <style> antes de imprimir.
      window.setTimeout(() => window.print(), 50);
    }, 50);

    return () => {
      window.clearTimeout(t1);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [printMode]);

  return (
    <>
      {createPortal(
        <div className="modal-overlay print:hidden">
          <div className="modal-sheet w-full sm:max-w-3xl flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
            <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
              <h2 className="font-display text-lg font-bold">Imprimir comprovante</h2>
              <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="shrink-0 flex items-center gap-2 border-b border-slate-100 p-4">
              <div className="flex flex-1 rounded-xl bg-slate-100 p-1">
                <button
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${format === 'thermal' ? 'bg-white shadow-soft' : 'text-slate-500'}`}
                  onClick={() => setFormat('thermal')}
                >
                  Cupom térmico
                </button>
                <button
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${format === 'a4' ? 'bg-white shadow-soft' : 'text-slate-500'}`}
                  onClick={() => setFormat('a4')}
                >
                  Folha A4
                </button>
              </div>
              <button className="btn-primary shrink-0" onClick={() => setPrintMode(format)}>
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 p-6">
              <SaleReceipt company={company} sale={sale} format={format} />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {printMode && (
        <style>{printMode === 'thermal'
          ? `
    @page { margin: 0; size: 80mm ${receiptHeight > 0 ? receiptHeight + 'px' : 'auto'}; }
    @media print {
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; }
      body { margin: 0; padding: 0; background: white; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `
          : `
    @page { margin: 10mm; size: A4 portrait; }
    @media print {
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { position: absolute !important; left: 0 !important; top: 0 !important; display: block !important; }
      body { margin: 0; padding: 0; background: white; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  `
        }</style>
      )}

      {printMode && createPortal(
        <div id={PRINT_ROOT_ID} className="fixed top-[-9999px] left-[-9999px] w-full bg-white text-black">
          <div ref={receiptRef} className="mx-auto flex w-full justify-center">
            <SaleReceipt company={company} sale={sale} format={printMode} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
