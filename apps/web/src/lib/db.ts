import Dexie, { type Table } from 'dexie';
import type { CreateSaleInput } from '@exodus/shared';

/** Venda retida na fila offline (IndexedDB) até sincronizar (Requisito 4.4). */
export interface QueuedSale {
  clientRef: string; // chave de idempotência (uuid)
  payload: CreateSaleInput;
  createdAt: number;
  status: 'PENDING' | 'SYNCED' | 'ERROR';
  attempts: number;
  lastError?: string;
}

/** Espelho local de variantes para busca por código de barras offline. */
export interface CachedVariant {
  id: string;
  barcode: string | null;
  sku: string;
  description: string;
  salePrice: number;
  stockQty: number;
  productName: string;
  brand: string;
}

class ExodusDB extends Dexie {
  saleQueue!: Table<QueuedSale, string>;
  variants!: Table<CachedVariant, string>;

  constructor() {
    super('exodus');
    this.version(1).stores({
      saleQueue: 'clientRef, status, createdAt',
      variants: 'id, barcode, sku',
    });
  }
}

export const db = new ExodusDB();
