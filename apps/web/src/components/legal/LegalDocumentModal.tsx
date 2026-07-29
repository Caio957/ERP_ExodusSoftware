import { createPortal } from 'react-dom';
import { X, type LucideIcon } from 'lucide-react';

/**
 * Modal Padrão Ouro genérico para exibir um documento legal (Termos de Uso,
 * Política de Privacidade) sem sair da tela onde foi aberto — usado pelo
 * onboarding público para o usuário poder ler o documento e continuar o
 * formulário com os dados já digitados intactos (o modal só sobrepõe a
 * tela, nunca desmonta o formulário por trás).
 */
export function LegalDocumentModal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="modal-overlay">
      <div className="modal-sheet flex h-[85dvh] w-full flex-col overflow-hidden !p-0 sm:max-w-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2.5">
            <span className="icon-tile h-9 w-9">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="font-display text-lg font-bold">{title}</h3>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
