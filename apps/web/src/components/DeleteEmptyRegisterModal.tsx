import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '../lib/api';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Modal de exclusão de caixa vazio (Padrão Ouro, React Portal). Só é aberto
 * quando o caixa não tem nenhuma movimentação (só o valor de abertura). Dá
 * três saídas ao operador: cancelar, manter o histórico fechando o caixa
 * automaticamente (finalCash = initialCash, diferença R$ 0,00), ou excluir
 * de vez. As duas mutations invalidam `cash-current` + `cash-registers` pra
 * a tela voltar sozinha ao estado de "abrir caixa".
 */
export function DeleteEmptyRegisterModal({
  registerId,
  initialCash,
  onClose,
  onDone,
}: {
  registerId: string;
  initialCash: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['cash-current'] });
    qc.invalidateQueries({ queryKey: ['cash-registers'] });
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/api/cash/registers/${registerId}`),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao excluir o caixa'),
  });

  // "Não, manter e fechar caixa": em vez de excluir, fecha o caixa com
  // finalCash = initialCash — como não houve movimentação, a diferença é
  // exatamente R$ 0,00 e o registro fica preservado nos relatórios.
  const closeMutation = useMutation({
    mutationFn: () => api.post(`/api/cash/${registerId}/close`, { finalCash: initialCash }),
    onSuccess: () => {
      invalidate();
      onDone();
    },
    onError: (e) => window.alert(e instanceof ApiError ? e.message : 'Falha ao fechar o caixa'),
  });

  const busy = deleteMutation.isPending || closeMutation.isPending;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet flex flex-col overflow-hidden !p-0 sm:max-w-md">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h3 className="font-display text-lg font-bold">Excluir caixa vazio</h3>
          </div>
          <button className="text-slate-400 hover:text-slate-700 disabled:opacity-50" onClick={onClose} disabled={busy}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-slate-600">
            Este caixa está vazio. Ao excluí-lo, o valor de abertura (
            <strong className="text-ink-900">{brl(initialCash)}</strong>) será removido do sistema e
            não constará mais nos relatórios de fechamento.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Se preferir manter o histórico, você pode apenas fechar o caixa — ele fecha
            automaticamente com diferença de R$ 0,00.
          </p>
        </div>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button className="btn-ghost w-full" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn-primary w-full" disabled={busy} onClick={() => closeMutation.mutate()}>
            {closeMutation.isPending ? 'Fechando...' : 'Não, manter e fechar caixa'}
          </button>
          <button className="btn-danger w-full" disabled={busy} onClick={() => deleteMutation.mutate()}>
            {deleteMutation.isPending ? 'Excluindo...' : 'Sim, excluir definitivamente'}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
