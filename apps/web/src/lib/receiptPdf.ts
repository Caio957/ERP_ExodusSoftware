import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SaleReceipt, type CompanyInfo, type ReceiptFormat, type SaleReceiptData } from '../components/SaleReceipt';

// Largura de captura fixa em px (96dpi) — independente do viewport do
// dispositivo. html2canvas por padrão fotografa o elemento na largura de
// layout atual; num celular isso é a largura da tela (~360px), esmagando o
// comprovante A4 (210mm ≈ 794px) ou o cupom térmico (80mm ≈ 302px) antes
// mesmo da captura. Forçar `width`/`windowWidth` elimina essa dependência
// do viewport por completo (mesma causa raiz já corrigida no motor de
// impressão nativo — ver PdvPage.tsx/PrintReceiptModal.tsx).
const CAPTURE_WIDTH_PX: Record<ReceiptFormat, number> = {
  thermal: 302, // 80mm a 96dpi
  a4: 794, // 210mm a 96dpi
};
const PAPER_WIDTH_MM: Record<ReceiptFormat, number> = {
  thermal: 80,
  a4: 210,
};

/**
 * Gera o PDF do comprovante como Blob — motor de compartilhamento (Web
 * Share API), independente do motor de impressão nativo (`window.print()`).
 * Reaproveita o mesmo `<SaleReceipt>` usado na impressão (fonte única de
 * verdade visual), renderizado fora da árvore React do app numa largura
 * física fixa, capturado com html2canvas e embutido num PDF de página
 * única (jsPDF) do tamanho exato do papel. `jspdf`/`html2canvas` são
 * importados dinamicamente: só entram no bundle quando o usuário realmente
 * usa "Compartilhar", sem pesar no carregamento inicial do PWA.
 */
export async function generateReceiptPdfBlob(
  company: CompanyInfo,
  sale: SaleReceiptData,
  format: ReceiptFormat,
): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  const width = CAPTURE_WIDTH_PX[format];
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '-9999px';
  host.style.left = '-9999px';
  host.style.width = `${width}px`;
  host.style.background = '#ffffff';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(createElement(SaleReceipt, { company, sale, format }));
      // Duplo rAF: garante que o React já commitou o DOM antes da captura.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: 2, // nitidez do texto no PDF (~192dpi efetivo)
      width,
      windowWidth: width,
    });

    const pdfWidthMm = PAPER_WIDTH_MM[format];
    const pdfHeightMm = (canvas.height / canvas.width) * pdfWidthMm;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidthMm, Math.max(pdfHeightMm, 1)],
    });
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidthMm, pdfHeightMm);
    return doc.output('blob');
  } finally {
    root.unmount();
    host.remove();
  }
}

const isMobileUA = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Dispara o modal nativo de compartilhamento (Web Share API, com arquivo)
 * para o PDF gerado. Sem suporte (desktop / navegador antigo): baixa o
 * arquivo automaticamente. Cancelamento do usuário no modal nativo
 * (`AbortError`) é silencioso — não é uma falha, e não deve iniciar um
 * download como "fallback" (o usuário decidiu não compartilhar, ponto).
 */
export async function shareOrDownloadReceipt(
  blob: Blob,
  filename: string,
  shareData: { title: string; text: string },
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const canUseWebShare =
    isMobileUA() && !!navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }));

  if (canUseWebShare) {
    try {
      await navigator.share({ ...shareData, files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Falha real (navegador reporta suporte mas rejeita) → cai no download abaixo.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
