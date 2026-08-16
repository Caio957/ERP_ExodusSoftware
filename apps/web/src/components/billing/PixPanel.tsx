import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, QrCode } from 'lucide-react';

/**
 * Bloco de pagamento PIX — QR Code + Copia e Cola + botão de copiar.
 * Fonte única reaproveitada pelos três estágios da UX do lojista (lembrete,
 * aviso de atraso e tela de bloqueio) e pelo "Ver PIX" do painel do Super
 * Admin, para o pagamento ser sempre apresentado do mesmo jeito.
 *
 * `QRCodeSVG` (e não a variante em canvas): vetor escala sem borrar em
 * qualquer densidade de tela, que é o que importa num tablet de balcão sendo
 * apontado para a câmera de um celular.
 */
export function PixPanel({ pixPayload, compact = false }: { pixPayload: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pixPayload);
    } catch {
      // WebView antigo do Android (ou contexto sem permissão de clipboard):
      // cai no caminho legado, que ainda funciona onde a Clipboard API não vai.
      const ta = document.createElement('textarea');
      ta.value = pixPayload;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
          <QRCodeSVG value={pixPayload} size={compact ? 148 : 196} level="M" />
        </div>
      </div>

      <div>
        <span className="label flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5" /> PIX Copia e Cola
        </span>
        <code className="block max-h-24 overflow-y-auto break-all rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
          {pixPayload}
        </code>
      </div>

      <button type="button" className={copied ? 'btn-gold w-full' : 'btn-primary w-full'} onClick={copy}>
        {copied ? (
          <>
            <Check className="h-5 w-5" /> Copiado!
          </>
        ) : (
          <>
            <Copy className="h-5 w-5" /> Copiar PIX
          </>
        )}
      </button>
    </div>
  );
}
