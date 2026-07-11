/**
 * Motor de impressão via iframe isolado — contorna o bug conhecido do
 * WebView do Android (Chromium) que gera página em branco ao rodar
 * `window.print()` diretamente sobre o documento principal de uma SPA
 * complexa. O iframe é um documento HTML totalmente à parte: o spooler de
 * impressão do Android só enxerga o conteúdo clonado ali dentro, sem
 * precisar negociar visibilidade/altura com o resto do app React.
 */
export function printElementViaIframe(rootId: string, pageStyle: string): Promise<void> {
  return new Promise((resolve) => {
    const printEl = document.getElementById(rootId);
    if (!printEl) {
      resolve();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    // Clona todo o CSS do documento principal (Tailwind incluso) — o iframe
    // não herda estilo nenhum do documento pai por padrão.
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprovante</title>
          ${styles}
          <style>
            ${pageStyle}
            body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>
          ${printEl.innerHTML}
        </body>
      </html>
    `);
    iframeDoc.close();

    iframe.onload = () => {
      // Delay seguro para o WebView do Android terminar de renderizar o
      // HTML/CSS clonado antes de abrir o diálogo nativo de impressão.
      window.setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        // Limpeza após o envio ao spooler — `window.print()` não é
        // confiavelmente síncrono em todos os WebViews mobile, então a
        // remoção do iframe é por timeout, não por um evento de conclusão.
        window.setTimeout(() => {
          iframe.remove();
          resolve();
        }, 500);
      }, 300);
    };
  });
}
