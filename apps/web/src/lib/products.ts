import { api, ApiError } from './api';
import { db, type CachedVariant } from './db';
import { useAuth } from '../store/auth';

interface VariantApi {
  id: string;
  sku: string;
  barcode: string | null;
  description: string;
  salePrice: number;
  stockQty: number;
  product: { name: string; brand: string };
}

function toCached(v: VariantApi, companyId: string): CachedVariant {
  return {
    id: v.id,
    companyId,
    barcode: v.barcode,
    sku: v.sku,
    description: v.description,
    salePrice: v.salePrice,
    stockQty: v.stockQty,
    productName: v.product.name,
    brand: v.product.brand,
  };
}

/** Atualiza o espelho local de variantes (para busca offline). */
export async function cacheVariants(variants: Omit<CachedVariant, 'companyId'>[]): Promise<void> {
  const companyId = useAuth.getState().user?.companyId;
  if (!companyId || !variants.length) return;
  await db.variants.bulkPut(variants.map((v) => ({ ...v, companyId })));
}

/**
 * Busca uma variante por código de barras. Online: consulta a API e atualiza
 * o cache; offline (ou falha de rede): cai para o IndexedDB (Requisito 4.4).
 * Isolamento por tenant (Plano Mestre V2.0, Fase 3): o cache só é
 * escrito/lido com o `companyId` da sessão ativa — nunca mistura catálogo de
 * empresas diferentes no mesmo dispositivo.
 */
export async function lookupByBarcode(barcode: string): Promise<CachedVariant | null> {
  const companyId = useAuth.getState().user?.companyId;
  if (!companyId) return null;

  if (navigator.onLine) {
    try {
      const v = await api.get<VariantApi>(
        `/api/products/variants/by-barcode/${encodeURIComponent(barcode)}`,
      );
      const cached = toCached(v, companyId);
      await db.variants.put(cached);
      return cached;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      // Falha de rede -> tenta o cache abaixo.
    }
  }
  return (
    (await db.variants
      .where('barcode')
      .equals(barcode)
      .and((v) => v.companyId === companyId)
      .first()) ?? null
  );
}
