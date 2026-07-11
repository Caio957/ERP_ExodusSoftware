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
// A4SaleReceipt normalmente usa `210mm` como largura CSS — o motor de
// renderização interno do html2canvas (fora do pipeline nativo do browser)
// é uma fonte documentada de erro no cálculo de unidades físicas (mm/cm/in).
// `widthPx` (prop opcional de SaleReceipt) sobrescreve para px puro só
// durante a captura, eliminando essa ambiguidade; 800 é o valor usado aqui
// (arredondamento de 210mm ≈ 794px, folga imperceptível no papel real).
const CAPTURE_WIDTH_PX: Record<ReceiptFormat, number> = {
  thermal: 302, // 80mm a 96dpi
  a4: 800,
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
  // Estilo 100% inline (nenhuma classe Tailwind) — nada aqui depende de CSS
  // externo/cascata para definir a largura. `position: absolute` (não
  // `fixed`) + inserido no fluxo normal do documento: `position: fixed` com
  // coordenadas negativas é conhecido por gerar captura quebrada/cortada em
  // mobile Safari/Chrome, porque o viewport visual (barra de endereço
  // recolhendo/expandindo) desalinha o `getBoundingClientRect()` de
  // elementos `fixed` no momento da leitura do html2canvas. `absolute`
  // ancora no documento (não no viewport), imune a esse recálculo.
  // `display` nunca é tocado (fica no padrão `block` de uma `<div>`) — se
  // fosse `none`, o html2canvas ignoraria o elemento por completo.
  host.style.display = 'block';
  host.style.position = 'absolute';
  host.style.top = '0';
  host.style.left = '-99999px';
  host.style.width = `${width}px`;
  host.style.minWidth = `${width}px`;
  host.style.backgroundColor = '#ffffff';
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(createElement(SaleReceipt, { company, sale, format, widthPx: width }));
      // Duplo rAF: garante que o React já commitou o DOM antes da captura.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    // Duas redes de segurança adicionais, além do duplo rAF acima — o
    // Comandante relatou colunas somem/layout quebra mesmo no desktop, o que
    // aponta para uma corrida de timing, não só um quirk de viewport mobile:
    //  1) `document.fonts.ready`: o comprovante usa fontes customizadas
    //     (Inter/Plus Jakarta Sans); se a captura ocorrer antes do
    //     `@font-face` aplicar, o texto é medido com a fonte fallback do
    //     sistema (largura diferente), o que pode empurrar/cortar colunas —
    //     mais determinístico que um sleep fixo, pois espera o evento real.
    //  2) Pausa fixa de 500ms como rede final, cobrindo qualquer efeito
    //     assíncrono residual que nem o rAF nem `fonts.ready` peguem.
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 500));

    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: 2, // nitidez do texto no PDF (~192dpi efetivo)
      width,
      windowWidth: width,
      useCORS: true,
      // Zera o offset de rolagem da página real na hora de localizar o
      // elemento — outro gatilho documentado de captura deslocada/cortada
      // em mobile quando o host está fora da área visível.
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
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
