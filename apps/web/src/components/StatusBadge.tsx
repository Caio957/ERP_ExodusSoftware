import { useLiveQuery } from 'dexie-react-hooks';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
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
      <span className={online ? 'badge-success' : 'badge-warning'}>
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
      </span>
      {pending > 0 && (
        <button
          onClick={() => void flushQueue()}
          className="badge-brand transition hover:bg-brand-200"
          title="Sincronizar agora"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {pending} na fila
        </button>
      )}
      {failed > 0 && (
        <span className="badge-danger" title="Vendas com erro de sincronização">
          <AlertTriangle className="h-3.5 w-3.5" />
          {failed}
        </span>
      )}
    </div>
  );
}
