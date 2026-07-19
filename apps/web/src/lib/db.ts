import Dexie, { type Table } from 'dexie';
import type { CreateSaleInput } from '@exodus/shared';

/** Venda retida na fila offline (IndexedDB) até sincronizar (Requisito 4.4). */
export interface QueuedSale {
  clientRef: string; // chave de idempotência (uuid)
  /**
   * Tenant dono do item (Plano Mestre V2.0, Fase 3). Usado para isolar a
   * fila entre sessões de empresas diferentes no mesmo dispositivo — nunca
   * sincroniza/lê um item que não seja da sessão ativa.
   */
  companyId: string;
  payload: CreateSaleInput;
  createdAt: number;
  status: 'PENDING' | 'SYNCED' | 'ERROR';
  attempts: number;
  lastError?: string;
}

/** Espelho local de variantes para busca por código de barras offline. */
export interface CachedVariant {
  id: string;
  /** Tenant dono da linha de cache — mesmo raciocínio de `QueuedSale.companyId`. */
  companyId: string;
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

    // v2 — Plano Mestre V2.0, Fase 3: isolamento multi-tenant da fila/cache
    // local. Linhas da v1 não têm `companyId` (a coluna não existia). Em vez
    // de descartá-las às cegas — o que apagaria vendas genuinamente
    // pendentes de sincronizar, dinheiro real ainda não confirmado no
    // servidor —, o upgrade atribui a elas o tenant da sessão ativa no
    // momento da migração: premissa segura porque, até este ponto, todo
    // dispositivo em campo só operou com um único tenant por vez. Sem
    // sessão ativa (ninguém logado no momento do upgrade), não há como
    // atribuir com segurança — essas linhas são descartadas. O cache de
    // variantes é sempre limpo: nunca representa dado ainda não
    // sincronizado, é seguro e barato reconstruir no próximo ciclo online.
    this.version(2)
      .stores({
        saleQueue: 'clientRef, status, createdAt, companyId',
        variants: 'id, barcode, sku, companyId',
      })
      .upgrade(async (tx) => {
        let companyId: string | null = null;
        try {
          const raw = localStorage.getItem('exodus_auth');
          companyId = raw ? (JSON.parse(raw)?.state?.user?.companyId ?? null) : null;
        } catch {
          companyId = null;
        }

        if (companyId) {
          await tx.table('saleQueue').toCollection().modify({ companyId });
        } else {
          await tx.table('saleQueue').clear();
        }
        await tx.table('variants').clear();
      });
  }
}

export const db = new ExodusDB();
