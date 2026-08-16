import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldOff, SlidersHorizontal, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';

/** Campos de cobrança que o painel do Super Admin edita por empresa. */
export interface CompanyBillingSettings {
  billingReminderDays: number;
  billingBlockGraceDays: number;
  billingExempt: boolean;
}

/**
 * Política de cobrança de um tenant (Super Admin). Pré-preenchido com os
 * valores REAIS — `GET /api/admin/companies` passou a devolvê-los nesta onda
 * justamente para não editar às cegas.
 *
 * Envia só os campos alterados: o backend grava um `AuditLog` a cada chamada
 * (e um segundo, específico, quando `billingExempt` é tocado), então mandar o
 * objeto inteiro poluiria a auditoria com "mudanças" que não mudaram nada.
 */
export function BillingSettingsModal({
  companyId,
  companyName,
  current,
  onClose,
  onSaved,
}: {
  companyId: string;
  companyName: string;
  current: CompanyBillingSettings;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [reminder, setReminder] = useState(String(current.billingReminderDays));
  const [grace, setGrace] = useState(String(current.billingBlockGraceDays));
  const [exempt, setExempt] = useState(current.billingExempt);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: Partial<CompanyBillingSettings>) =>
      api.patch(`/api/admin/companies/${companyId}/billing-settings`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'companies'] });
      onSaved(`Política de cobrança de "${companyName}" atualizada.`);
      onClose();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar a política de cobrança.'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const reminderNum = Number(reminder);
    const graceNum = Number(grace);
    if (!Number.isInteger(reminderNum) || reminderNum < 0 || reminderNum > 30) {
      setError('Aviso prévio deve ser um número inteiro entre 0 e 30 dias.');
      return;
    }
    if (!Number.isInteger(graceNum) || graceNum < 0 || graceNum > 30) {
      setError('Carência deve ser um número inteiro entre 0 e 30 dias.');
      return;
    }

    // Só o que mudou (ver nota no cabeçalho sobre auditoria).
    const payload: Partial<CompanyBillingSettings> = {};
    if (reminderNum !== current.billingReminderDays) payload.billingReminderDays = reminderNum;
    if (graceNum !== current.billingBlockGraceDays) payload.billingBlockGraceDays = graceNum;
    if (exempt !== current.billingExempt) payload.billingExempt = exempt;

    // O backend recusa corpo vazio (`.refine` do schema) — evita a ida à rede.
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    save.mutate(payload);
  }

  return createPortal(
    <div className="modal-overlay">
      <form
        onSubmit={submit}
        className="modal-sheet flex max-h-[92dvh] w-full flex-col overflow-hidden !p-0 sm:max-w-lg"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2.5">
            <span className="icon-tile h-9 w-9">
              <SlidersHorizontal className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold leading-tight">Política de cobrança</h3>
              <p className="text-xs text-slate-500">{companyName}</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="label">Aviso prévio (dias antes do vencimento)</span>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={reminder}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setReminder(e.target.value.replace(/\D/g, ''))}
            />
            <span className="mt-1 block text-xs text-slate-400">
              A partir de quantos dias antes do vencimento o lojista vê o lembrete amigável.
            </span>
          </label>

          <label className="block">
            <span className="label">Carência (dias após o vencimento)</span>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={grace}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setGrace(e.target.value.replace(/\D/g, ''))}
            />
            <span className="mt-1 block text-xs text-slate-400">
              Quantos dias de atraso são tolerados antes do bloqueio. Com {grace || 0}, o acesso é
              bloqueado no {(Number(grace) || 0) + 1}º dia de atraso.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-amber-600"
              checked={exempt}
              onChange={(e) => setExempt(e.target.checked)}
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-bold text-amber-900">
                <ShieldOff className="h-4 w-4" /> Isentar de bloqueio
              </span>
              <span className="mt-0.5 block text-xs font-medium text-amber-800">
                Chave-mestra: com a isenção ligada, esta empresa <strong>nunca</strong> é bloqueada
                por atraso — ela continua vendo os avisos, mas mantém o acesso indefinidamente.
                Cada mudança fica registrada em auditoria.
              </span>
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
