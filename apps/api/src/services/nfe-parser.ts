import { XMLParser } from 'fast-xml-parser';

/** Garante array mesmo quando o XML traz um único elemento. */
function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

const onlyDigits = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

export interface RawNfeItem {
  supplierItemCode: string;
  supplierBarcode: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  cfop: string;
}

export interface RawNfeDuplicate {
  number: string;
  dueDate: string;
  amount: number;
}

export interface RawNfe {
  accessKey: string;
  issueDate: string;
  nfeNumber: string;
  supplier: { document: string; name: string };
  totalAmount: number;
  items: RawNfeItem[];
  duplicates: RawNfeDuplicate[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // mantém strings; convertemos números explicitamente
});

/**
 * Faz o parsing de um XML de NFe (modelo 55) para uma estrutura normalizada.
 * Tolerante a NFe com ou sem o envelope nfeProc/protNFe.
 */
export function parseNfeXml(xml: string): RawNfe {
  const doc = parser.parse(xml);

  const nfe = doc?.nfeProc?.NFe ?? doc?.NFe;
  const infNFe = nfe?.infNFe;
  if (!infNFe) {
    throw new Error('XML não é uma NFe válida (infNFe ausente)');
  }

  // Chave de acesso: atributo Id ("NFe" + 44 dígitos) ou chNFe do protocolo
  const idAttr: string = infNFe['@_Id'] ?? '';
  const accessKey =
    onlyDigits(idAttr).length >= 44
      ? onlyDigits(idAttr).slice(-44)
      : onlyDigits(doc?.nfeProc?.protNFe?.infProt?.chNFe);

  const emit = infNFe.emit ?? {};
  const ide = infNFe.ide ?? {};
  const total = infNFe.total?.ICMSTot ?? {};

  const items: RawNfeItem[] = toArray(infNFe.det).map((det: any) => {
    const prod = det?.prod ?? {};
    const ean = onlyDigits(prod.cEAN);
    return {
      supplierItemCode: String(prod.cProd ?? ''),
      supplierBarcode: ean && ean !== '' && ean.toUpperCase?.() !== 'SEM' ? ean : null,
      description: String(prod.xProd ?? ''),
      quantity: Number(prod.qCom ?? 0),
      unitCost: Number(prod.vUnCom ?? 0),
      cfop: String(prod.CFOP ?? ''),
    };
  });

  const duplicates: RawNfeDuplicate[] = toArray(infNFe.cobr?.dup).map((dup: any) => ({
    number: String(dup?.nDup ?? ''),
    dueDate: String(dup?.dVenc ?? ide.dhEmi ?? ide.dEmi ?? ''),
    amount: Number(dup?.vDup ?? 0),
  }));

  return {
    accessKey,
    issueDate: String(ide.dhEmi ?? ide.dEmi ?? ''),
    nfeNumber: String(ide.nNF ?? ''),
    supplier: {
      document: onlyDigits(emit.CNPJ ?? emit.CPF),
      name: String(emit.xNome ?? ''),
    },
    totalAmount: Number(total.vNF ?? 0),
    items,
    duplicates,
  };
}
