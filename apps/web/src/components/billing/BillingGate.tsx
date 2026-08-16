import { useState } from 'react';
import { useAuth } from '../../store/auth';
import { useBillingStatus } from '../../hooks/useBillingStatus';
import { BillingNoticeModal } from './BillingNoticeModal';
import { BillingBlockedScreen } from './BillingBlockedScreen';

/**
 * Chave da dispensa "por sessão". Inclui o id da fatura E o tom de propósito:
 *  - trocando a fatura (mês seguinte), o aviso volta a aparecer;
 *  - escalando de "lembrete" para "atraso", o aviso volta mesmo que o lembrete
 *    já tenha sido dispensado — são mensagens de gravidade diferente.
 */
const dismissKey = (tone: string, billingId: string) =>
  `exodus_billing_dismissed:${tone}:${billingId}`;

/**
 * Orquestra a UX progressiva de cobrança do lojista. Montado uma única vez, no
 * `Layout` (shell autenticado), então vale para qualquer tela do ERP.
 *
 * Escalada: lembrete → aviso de atraso (dentro da carência) → bloqueio total.
 */
export function BillingGate() {
  const user = useAuth((s) => s.user);
  const isImpersonating = useAuth((s) => s.impersonatingCompanyName !== null);
  const { billing, flags } = useBillingStatus();

  // `useState` (e não leitura direta do sessionStorage no render) para que
  // dispensar o modal re-renderize e o faça sumir na hora.
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  /**
   * Suprimido em dois casos, deliberadamente:
   *
   *  - **impersonate**: a guarda do backend (Pilar 2b) libera o suporte
   *    justamente para ele poder entrar numa loja bloqueada e ajudar. Mostrar
   *    a tela de bloqueio aqui contradiria o backend e inutilizaria o recurso.
   *  - **super admin**: a empresa sede da Exodus não é um tenant faturado (e a
   *    guarda também o isenta no servidor).
   */
  if (isImpersonating || user?.isSuperAdmin) return null;
  if (!billing || !flags) return null;

  // Bloqueio ignora QUALQUER dispensa — não é um aviso, é o estado do acesso.
  if (flags.isBlocked) return <BillingBlockedScreen billing={billing} flags={flags} />;

  const tone = flags.isOverdue ? 'overdue' : flags.shouldShowReminder ? 'reminder' : null;
  if (!tone) return null;

  const key = dismissKey(tone, billing.id);
  // sessionStorage (não estado em memória): sobrevive a um F5 dentro da aba —
  // num tablet de balcão, reabrir o mesmo aviso a cada recarga vira ruído.
  // Escopo de aba, então uma nova sessão sempre volta a avisar.
  if (dismissed[key] || sessionStorage.getItem(key) === '1') return null;

  function dismiss() {
    sessionStorage.setItem(key, '1');
    setDismissed((prev) => ({ ...prev, [key]: true }));
  }

  return <BillingNoticeModal tone={tone} billing={billing} flags={flags} onDismiss={dismiss} />;
}
