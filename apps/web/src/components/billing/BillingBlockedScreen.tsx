import { createPortal } from 'react-dom';
import { Lock, LifeBuoy, LogOut } from 'lucide-react';
import { PixPanel } from './PixPanel';
import { useAuth } from '../../store/auth';
import type { BillingFlags, CurrentBilling } from '../../hooks/useBillingStatus';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Ver nota sobre `timeZone: 'UTC'` em BillingNoticeModal. */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * Estágio 3 — bloqueio total por inadimplência.
 *
 * Deliberadamente NÃO é um modal: não tem botão de fechar, não fecha no Esc,
 * não fecha clicando no fundo e não respeita a dispensa por sessão dos outros
 * estágios. Cobre a tela inteira (inclusive header e bottom nav) para que não
 * haja navegação possível — a única saída é regularizar o pagamento.
 *
 * A trava de verdade continua sendo o backend (guarda do Pilar 2b, que recusa
 * as rotas de negócio com 403 BILLING_BLOCKED); esta tela existe para explicar
 * o motivo e entregar o caminho de saída, não como mecanismo de segurança.
 *
 * "Sair" é a única ação permitida — sem ela um operador ficaria preso na
 * sessão, sem conseguir nem trocar de usuário no tablet.
 */
export function BillingBlockedScreen({
  billing,
  flags,
}: {
  billing: CurrentBilling;
  flags: BillingFlags;
}) {
  const logout = useAuth((s) => s.logout);

  async function doLogout() {
    const result = await logout();
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    window.location.href = '/login';
  }

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="billing-blocked-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-ink-900/95 p-4 backdrop-blur-md"
    >
      <div className="mx-auto my-auto flex min-h-full max-w-md items-center">
        <div className="w-full space-y-4 rounded-3xl border border-white/10 bg-white p-6 shadow-elevated">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 text-white shadow-soft">
              <Lock className="h-7 w-7" />
            </span>
            <div>
              <h1 id="billing-blocked-title" className="font-display text-xl font-extrabold text-ink-900">
                Acesso bloqueado
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Sua mensalidade está em atraso há{' '}
                <strong className="text-rose-600">
                  {flags.daysOverdue} {flags.daysOverdue === 1 ? 'dia' : 'dias'}
                </strong>
                . Regularize o pagamento para liberar o sistema.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Valor
              </div>
              <div className="font-display text-lg font-extrabold text-ink-900">
                {brl(billing.amount)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Vencimento
              </div>
              <div className="font-display text-lg font-extrabold text-rose-600">
                {fmtDate(billing.dueDate)}
              </div>
            </div>
          </div>

          <PixPanel pixPayload={billing.pixPayload} />

          <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs font-medium text-brand-800">
            <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
            Já pagou? Entre em contato com o suporte da Exodus para confirmarmos a baixa e liberarmos
            o acesso.
          </div>

          <button type="button" className="btn-ghost w-full" onClick={doLogout}>
            <LogOut className="h-5 w-5" /> Sair
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
