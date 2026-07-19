import type { CreateSaleInput } from '@exodus/shared';
import { api, ApiError } from './api';
import { db, type QueuedSale } from './db';
import { useAuth } from '../store/auth';

interface SyncResultItem {
  clientRef: string | null;
  status: 'CREATED' | 'DUPLICATE' | 'ERROR';
  id?: string;
  message?: string;
}

/**
 * Enfileira uma venda. Gera o `clientRef` (idempotência) e grava no IndexedDB.
 * O cliente recebe sucesso imediato; o envio acontece no flush.
 */
export async function enqueueSale(
  payload: Omit<CreateSaleInput, 'clientRef'>,
): Promise<QueuedSale> {
  const companyId = useAuth.getState().user?.companyId;
  if (!companyId) {
    throw new Error('Não é possível registrar a venda: sessão sem empresa associada.');
  }
  const clientRef = crypto.randomUUID();
  const queued: QueuedSale = {
    clientRef,
    companyId,
    payload: { ...payload, clientRef, soldAt: payload.soldAt ?? new Date() },
    createdAt: Date.now(),
    status: 'PENDING',
    attempts: 0,
  };
  await db.saleQueue.add(queued);
  return queued;
}

let flushing = false;

/**
 * Envia todas as vendas pendentes em um único lote para /api/sales/sync.
 * Idempotente: vendas já gravadas voltam como DUPLICATE e são removidas da fila.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number } | null> {
  if (flushing || !navigator.onLine) return null;
  const companyId = useAuth.getState().user?.companyId;
  if (!companyId) return null;
  flushing = true;
  try {
    const all = await db.saleQueue.where('status').equals('PENDING').toArray();
    // Isolamento na leitura: só envia itens do tenant da sessão ativa. Na
    // prática a fila já é purgada no logout (store/auth.ts), então itens de
    // outro companyId não deveriam existir aqui — mantido como rede de
    // segurança, não como única camada de proteção.
    const pending = all.filter((item) => item.companyId === companyId);
    if (all.length !== pending.length) {
      console.warn(
        `flushQueue: ${all.length - pending.length} item(ns) da fila pertencem a outro tenant e foram ignorados.`,
      );
    }
    if (pending.length === 0) return { sent: 0, failed: 0 };

    const { results } = await api.post<{ results: SyncResultItem[] }>('/api/sales/sync', {
      sales: pending.map((p) => p.payload),
    });

    const byRef = new Map(results.map((r) => [r.clientRef, r]));
    let sent = 0;
    let failed = 0;

    await db.transaction('rw', db.saleQueue, async () => {
      for (const item of pending) {
        const result = byRef.get(item.clientRef);
        if (!result || result.status === 'ERROR') {
          failed++;
          await db.saleQueue.update(item.clientRef, {
            status: 'ERROR',
            attempts: item.attempts + 1,
            lastError: result?.message ?? 'Sem resposta do servidor',
          });
        } else {
          sent++;
          // Sucesso (CREATED/DUPLICATE): remove da fila.
          await db.saleQueue.delete(item.clientRef);
        }
      }
    });

    return { sent, failed };
  } catch (err) {
    // Falha de rede/credencial: mantém tudo PENDING para tentar depois.
    if (err instanceof ApiError && err.status === 401) throw err;
    return null;
  } finally {
    flushing = false;
  }
}

/** Reprocessa vendas que falharam, voltando-as para PENDING. */
export async function retryFailed(): Promise<void> {
  const companyId = useAuth.getState().user?.companyId;
  if (!companyId) return;
  await db.saleQueue
    .where('status')
    .equals('ERROR')
    .and((item) => item.companyId === companyId)
    .modify({ status: 'PENDING' });
  await flushQueue();
}

/** Liga o flush automático ao restabelecimento da rede + intervalo de retry. */
export function startSyncEngine(): () => void {
  const onOnline = () => void flushQueue();
  window.addEventListener('online', onOnline);
  void flushQueue(); // tenta ao iniciar
  const interval = window.setInterval(() => void flushQueue(), 30_000);

  return () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(interval);
  };
}
