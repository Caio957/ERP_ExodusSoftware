import { AlertTriangle, DoorOpen } from 'lucide-react';
import { useAuth } from '../store/auth';

/**
 * Faixa de aviso fixa de sessão de suporte (Plano Mestre V2.0, Frente 4 —
 * "Acessar Loja"). Só renderiza durante uma sessão de impersonate — nunca em
 * uso normal (`impersonatingCompanyName` é null fora desse modo). Ver
 * `store/auth.ts` (`impersonateLogin`/`exitImpersonate`) para a estratégia
 * de troca de token.
 *
 * "Encerrar Suporte" restaura a sessão real do super admin e força um
 * reload completo (não `navigate`) de propósito: garante que o React Query
 * remonte com cache limpo, sem risco de uma tela ainda mostrar dado da
 * empresa-alvo por uma fração de segundo após sair dela.
 */
export function ImpersonateBanner() {
  const { impersonatingCompanyName, exitImpersonate } = useAuth();
  if (!impersonatingCompanyName) return null;

  function doExit() {
    exitImpersonate();
    window.location.href = '/admin/contratos';
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-3 py-2 text-center text-xs font-bold text-ink-900 sm:text-sm"
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, #fbbf24 0px, #fbbf24 14px, #1e293b 14px, #1e293b 28px)',
      }}
    >
      <span className="flex items-center gap-1.5 rounded-md bg-ink-900/95 px-2.5 py-1 text-amber-300 shadow-soft">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        MODO SUPORTE: você está operando na loja &quot;{impersonatingCompanyName}&quot;
      </span>
      <button
        className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-2.5 py-1 text-white shadow-soft transition hover:bg-ink-900/80"
        onClick={doExit}
      >
        <DoorOpen className="h-4 w-4" /> Encerrar Suporte
      </button>
    </div>
  );
}
