import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CalendarClock, X } from 'lucide-react';
import { PixPanel } from './PixPanel';
import type { BillingFlags, CurrentBilling } from '../../hooks/useBillingStatus';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * O vencimento é gravado ancorado em meia-noite de Brasília (= 03:00Z, ver
 * `dueDateBr` em schemas/billing.ts), justamente para o dia de calendário ser
 * o mesmo lido em UTC. Formatar com `timeZone: 'UTC'` mantém essa garantia em
 * qualquer fuso do dispositivo — inclusive no Acre (UTC-5), onde ler no fuso
 * local exibiria o dia anterior.
 */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

type Tone = 'reminder' | 'overdue';

/**
 * Estágios 1 e 2 da UX de cobrança do lojista, no mesmo componente porque a
 * estrutura é idêntica — muda o tom, o texto e o rótulo do botão de saída:
 *
 *  - `reminder`: a fatura ainda vai vencer (dentro de `billingReminderDays`).
 *    Aviso amigável, sem urgência.
 *  - `overdue`: já venceu, mas ainda dentro da carência
 *    (`billingBlockGraceDays`). Deixa explícito que o acesso será bloqueado, e
 *    o botão de fechar exige um reconhecimento consciente disso.
 *
 * Ambos são dispensáveis (Esc, X ou o botão do rodapé) — o bloqueio de fato é
 * outro componente (`BillingBlockedScreen`), esse sim sem saída.
 */
export function BillingNoticeModal({
  tone,
  billing,
  flags,
  onDismiss,
}: {
  tone: Tone;
  billing: CurrentBilling;
  flags: BillingFlags;
  onDismiss: () => void;
}) {
  // Esc fecha (acessibilidade básica) — só nestes estágios dispensáveis.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const isOverdue = tone === 'overdue';

  const title = isOverdue ? 'Mensalidade em atraso' : 'Mensalidade a vencer';
  const Icon = isOverdue ? AlertTriangle : CalendarClock;
  const dismissLabel = isOverdue
    ? 'Estou ciente de que o acesso poderá ser bloqueado'
    : 'Lembrar mais tarde';

  const daysLeft = flags.daysUntilDue ?? 0;
  const headline = isOverdue
    ? `Sua mensalidade venceu ${
        flags.daysOverdue === 1 ? 'ontem' : `há ${flags.daysOverdue} dias`
      }.`
    : daysLeft === 0
      ? 'Sua próxima mensalidade vence hoje.'
      : `Sua próxima mensalidade vence em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}.`;

  return createPortal(
    <div className="modal-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-notice-title"
        className="modal-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden !p-0 sm:max-w-md"
      >
        <header
          className={`flex shrink-0 items-center justify-between gap-3 border-b p-4 ${
            isOverdue ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                isOverdue ? 'bg-amber-500 text-white shadow-soft' : 'icon-tile'
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 id="billing-notice-title" className="font-display text-lg font-bold leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500">Vencimento em {fmtDate(billing.dueDate)}</p>
            </div>
          </div>
          <button
            className="shrink-0 text-slate-400 hover:text-slate-700"
            aria-label="Fechar"
            onClick={onDismiss}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div
            className={`rounded-xl border p-3 text-sm font-semibold ${
              isOverdue
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-brand-200 bg-brand-50 text-brand-800'
            }`}
          >
            {headline}
            {isOverdue && (
              <p className="mt-1 text-xs font-medium text-amber-800">
                Regularize o pagamento para não perder o acesso ao sistema. Após a carência, a loja
                é bloqueada automaticamente.
              </p>
            )}
          </div>

          <div className="flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Valor</span>
            <span className="font-display text-2xl font-extrabold gradient-text">
              {brl(billing.amount)}
            </span>
          </div>

          <PixPanel pixPayload={billing.pixPayload} compact />
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" className="btn-ghost w-full" onClick={onDismiss}>
            {dismissLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
