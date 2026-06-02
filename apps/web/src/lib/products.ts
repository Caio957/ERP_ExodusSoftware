import { api, ApiError } from './api';
import { db, type CachedVariant } from './db';

interface VariantApi {
  id: string;
  sku: string;
  barcode: string | null;
  description: string;
  salePrice: number;
  stockQty: number;
  product: { name: string; brand: string };
}

function toCached(v: VariantApi): CachedVariant {
  return {
    id: v.id,
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
export async function cacheVariants(variants: CachedVariant[]): Promise<void> {
  if (variants.length) await db.variants.bulkPut(variants);
}

/**
 * Busca uma variante por código de barras. Online: consulta a API e atualiza
 * o cache; offline (ou falha de rede): cai para o IndexedDB (Requisito 4.4).
 */
export async function lookupByBarcode(barcode: string): Promise<CachedVariant | null> {
  if (navigator.onLine) {
    try {
      const v = await api.get<VariantApi>(
        `/api/products/variants/by-barcode/${encodeURIComponent(barcode)}`,
      );
      const cached = toCached(v);
      await db.variants.put(cached);
      return cached;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      // Falha de rede -> tenta o cache abaixo.
    }
  }
  return (await db.variants.where('barcode').equals(barcode).first()) ?? null;
}
