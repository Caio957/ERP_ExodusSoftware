import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, X } from 'lucide-react';
import { api } from '../lib/api';
import { SaleReceipt, type CompanyInfo, type ReceiptFormat, type SaleReceiptData } from './SaleReceipt';
import { printElementViaIframe } from '../lib/iframePrint';

const PRINT_ROOT_ID = 'sale-receipt-print-root';

/**
 * Modal de impressão de comprovante — motor único, validado no PDV,
 * reaproveitado aqui para a consulta de Vendas. Imprimir diretamente o
 * preview on-screen (window.print() sobre um `<div>` com scroll/overflow
 * recortado pelo modal) produz páginas em branco: o navegador não sabe a
 * altura real do cupom nem tem um `@page` dimensionado a ele. Este motor
 * mede o recibo fora da tela e depois clona o HTML medido para um iframe
 * isolado (ver lib/iframePrint.ts) — o WebView do Android é um source
 * conhecido de página em branco ao imprimir o documento principal de uma
 * SPA diretamente, e o iframe evita essa negociação de visibilidade/altura
 * com o resto do app.
 */
export function PrintReceiptModal({
  sale,
  company: companyFallback,
  onClose,
}: {
  sale: SaleReceiptData;
  company: CompanyInfo;
  onClose: () => void;
}) {
  // Fonte da verdade própria: não depende de o chamador ter passado um
  // `company` fresco (ex.: prop capturada antes de a config ser salva).
  // `companyFallback` só é usado enquanto esta query ainda não resolveu.
  const { data: companyFromApi, isLoading: companyLoading } = useQuery({
    queryKey: ['settings', 'company'],
    queryFn: () => api.get<CompanyInfo>('/api/settings/company'),
  });
  const company = companyFromApi ?? companyFallback;

  const [format, setFormat] = useState<ReceiptFormat>('thermal');
  const [printMode, setPrintMode] = useState<ReceiptFormat | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!printMode) return;

    // Timeout: aguarda o React renderizar o recibo fora da tela (portal)
    // para medir a altura real do cupom antes de clonar o HTML para o iframe.
    const t1 = window.setTimeout(() => {
      let height = 0;
      if (printMode === 'thermal' && receiptRef.current) {
        // scrollHeight captura a altura real (mesmo com collapsing margins);
        // +15px de sobra para a guilhotina não cortar a última linha.
        height = receiptRef.current.scrollHeight + 15;
      }
      const pageStyle =
        printMode === 'thermal'
          ? `@page { margin: 0; size: 80mm ${height > 0 ? height + 'px' : 'auto'}; }`
          : `@page { margin: 10mm; size: A4 portrait; }`;

      printElementViaIframe(PRINT_ROOT_ID, pageStyle).then(() => {
        setPrintMode(null);
      });
    }, 50);

    return () => {
      window.clearTimeout(t1);
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
              <button
                className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                // `printMode !== null` mantém o botão travado durante a janela
                // assíncrona de medição + clonagem para o iframe (ver
                // lib/iframePrint.ts), evitando cliques repetidos que
                // engasgam o navegador do celular.
                disabled={companyLoading || printMode !== null}
                onClick={() => setPrintMode(format)}
              >
                <Printer className="h-4 w-4" />
                {companyLoading
                  ? 'Carregando dados da empresa...'
                  : printMode !== null
                    ? 'Preparando impressão...'
                    : 'Imprimir'}
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 p-6">
              <SaleReceipt company={company} sale={sale} format={format} />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Sem <style> de @page no documento principal: o motor de impressão
          via iframe (lib/iframePrint.ts) recebe o `pageStyle` diretamente
          como argumento e injeta dentro do documento isolado do iframe. */}
      {printMode && createPortal(
        // A4 ancora em 210mm (não `w-full`): no celular, `w-full` = largura do
        // viewport esmagava a folha (o `maxWidth:100%` do template A4 clampava
        // 210mm à largura do celular) e o `@page A4` escalava o layout quebrado.
        // O cupom térmico já é imune (largura física fixa de 80mm), então
        // mantém `w-full`.
        <div
          id={PRINT_ROOT_ID}
          className={`bg-white text-black ${printMode === 'a4' ? 'w-[210mm]' : 'w-full'}`}
        >
          <div ref={receiptRef} className="mx-auto flex w-full justify-center">
            <SaleReceipt company={company} sale={sale} format={printMode} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
