import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wallet, Landmark } from 'lucide-react';

/**
 * Seleção de destino financeiro (Caixa Físico vs Conta Banco) — Padrão Ouro
 * (`createPortal`, header/body/footer rígidos). Usado no PDV (antes de
 * registrar uma venda que não seja 100% "A prazo") e em Vendas (ao regerar o
 * financeiro de uma venda existente), sempre que o operador tem os dois
 * caixas abertos ao mesmo tempo e precisa escolher em qual "livro" o
 * lançamento entra.
 */
export function RegisterSelectionModal({
  defaultType,
  diarioAvailable,
  bancoAvailable,
  onConfirm,
  onClose,
}: {
  defaultType: 'DIARIO' | 'BANCO';
  diarioAvailable: boolean;
  bancoAvailable: boolean;
  onConfirm: (type: 'DIARIO' | 'BANCO') => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<'DIARIO' | 'BANCO'>(defaultType);

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet w-full sm:max-w-sm flex flex-col h-auto max-h-[90dvh] overflow-hidden !p-0">
        <header className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-4">
          <h3 className="font-display text-lg font-bold">Em qual caixa registrar?</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <p className="text-sm text-slate-500">
            Você tem mais de um caixa aberto — escolha em qual "livro" este lançamento vai entrar.
          </p>
          <button
            type="button"
            disabled={!diarioAvailable}
            onClick={() => setSelected('DIARIO')}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected === 'DIARIO' ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
              <Wallet className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-slate-800">Caixa Físico</span>
              <span className="block text-xs text-slate-500">
                {diarioAvailable ? 'Dinheiro em espécie (DIARIO)' : 'Não está aberto'}
              </span>
            </span>
          </button>
          <button
            type="button"
            disabled={!bancoAvailable}
            onClick={() => setSelected('BANCO')}
            className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected === 'BANCO' ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
            }`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-gradient text-ink-900">
              <Landmark className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-slate-800">Conta Banco</span>
              <span className="block text-xs text-slate-500">
                {bancoAvailable ? 'PIX, cartão, transferência (BANCO)' : 'Não está aberta'}
              </span>
            </span>
          </button>
        </div>

        <footer className="shrink-0 flex gap-2 border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary flex-1" onClick={() => onConfirm(selected)}>
            Confirmar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
