import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function sanitizeBr(s: string): string {
  let v = s.replace(/\./g, ',');
  v = v.replace(/[^\d,]/g, '');
  v = v.replace(/^,/, '');
  const parts = v.split(',');
  if (parts.length > 1) v = parts[0] + ',' + parts.slice(1).join('');
  return v.replace(/^0+(?=\d)/, '');
}

/** Calculadora de troco para pagamento em dinheiro (PDV e edição de venda). */
export function ChangeCalculatorModal({
  total,
  onClose,
  onConfirm,
}: {
  total: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const toRaw = (n: number) => (n !== 0 ? String(n).replace('.', ',') : '');
  const [raw, setRaw] = useState('');
  const skipSync = useRef(false);
  const received = parseFloat(raw.replace(',', '.')) || 0;
  const change = round2(received - total);
  const insufficient = received > 0 && received < total;

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(toRaw(received));
  }, [received]);

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-md flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
          <h3 className="font-display text-lg font-bold">Pagamento em Dinheiro</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-500">Total da venda</span>
            <span className="text-xl font-bold">{brl(total)}</span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Valor recebido</label>
            <input
              type="text"
              inputMode="decimal"
              value={raw}
              autoFocus
              placeholder="0,00"
              onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
              onChange={(e) => {
                const cleaned = sanitizeBr(e.target.value);
                setRaw(cleaned);
                skipSync.current = true;
              }}
              onFocus={(e) => e.target.select()}
              className="input h-12 text-right text-lg font-semibold"
            />
            {insufficient && (
              <p className="mt-1 text-xs font-medium text-rose-600">Valor insuficiente para cobrir o total.</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-sm text-slate-500">Troco a devolver</span>
            <span className={`text-xl font-bold ${change > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {change > 0 ? brl(change) : '—'}
            </span>
          </div>
        </div>

        <footer className="shrink-0 flex gap-2 border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
          <button
            className="btn-ghost flex-1 text-sm"
            onClick={onConfirm}
          >
            Valor exato (Pular)
          </button>
          <button
            className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={received < total}
            onClick={onConfirm}
          >
            Confirmar venda
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
