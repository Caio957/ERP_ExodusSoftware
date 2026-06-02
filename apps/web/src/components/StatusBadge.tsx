import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useOnline } from '../hooks/useOnline';
import { flushQueue } from '../lib/sync';

/** Indicador de conectividade + tamanho da fila offline de vendas. */
export function StatusBadge() {
  const online = useOnline();
  const pending = useLiveQuery(
    () => db.saleQueue.where('status').equals('PENDING').count(),
    [],
    0,
  );
  const failed = useLiveQuery(
    () => db.saleQueue.where('status').equals('ERROR').count(),
    [],
    0,
  );

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium ${
          online ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {online ? 'Online' : 'Offline'}
      </span>
      {pending > 0 && (
        <button
          onClick={() => void flushQueue()}
          className="rounded-full bg-brand-100 px-3 py-1 font-medium text-brand-700"
          title="Sincronizar agora"
        >
          {pending} na fila ↻
        </button>
      )}
      {failed > 0 && (
        <span className="rounded-full bg-rose-100 px-3 py-1 font-medium text-rose-700">
          {failed} com erro
        </span>
      )}
    </div>
  );
}
