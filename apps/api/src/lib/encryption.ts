import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { env } from '../env.js';

/**
 * Criptografia de dados sensíveis (Plano Mestre V2.0, Frente 2 — LGPD).
 * Dois esquemas, conforme o campo precisa ou não suportar busca exata:
 *
 *  - `document` (CPF/CNPJ): determinístico (AES-256-CBC com IV derivado via
 *    HMAC-SHA256 do próprio texto claro) — o mesmo texto claro sempre produz
 *    o mesmo ciphertext, então `where: { document: '...' }` continua
 *    funcionando igual no Prisma, e a constraint `@@unique([companyId,
 *    document])` continua bloqueando duplicata corretamente. Trade-off
 *    consciente e inerente a qualquer esquema de busca por igualdade sobre
 *    dado cifrado: dois registros com o mesmo documento produzem o mesmo
 *    ciphertext (é exatamente esse padrão que a unicidade já depende para
 *    funcionar) — não dá pra ter as duas coisas (busca exata + ciphertext
 *    sempre distinto) ao mesmo tempo.
 *  - `email`/`phone`: não-determinístico (AES-256-GCM com IV aleatório a
 *    cada chamada, autenticado). Mais forte, mas o mesmo texto claro produz
 *    ciphertexts diferentes toda vez — não há busca por igualdade hoje
 *    nessas colunas (nenhuma rota faz `where: { email: ... }`/`{ phone: ... }`
 *    em Person), então essa troca não custa nada na prática.
 *
 * Prefixos versionados (`encgcm1:`/`encdet1:`) permitem: (a) o decrypt
 * reconhecer o formato certo por campo sem precisar saber de fora qual
 * esquema foi usado; (b) versionar o formato no futuro sem quebrar leituras
 * de dados já gravados; (c) — crucial em um sistema já em produção com dados
 * reais — distinguir um valor já cifrado de um valor legado ainda em texto
 * claro (gravado antes desta Frente 2), que `decryptField` devolve inalterado
 * em vez de tentar decifrar e falhar. Ver `prisma/backfill-person-encryption.ts`
 * para o script que migra o que já existe.
 */

const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc';
const GCM_PREFIX = 'encgcm1:';
const CBC_PREFIX = 'encdet1:';
const GCM_IV_LEN = 12; // 96 bits — tamanho recomendado para GCM
const GCM_TAG_LEN = 16;
const CBC_IV_LEN = 16; // tamanho de bloco do AES

let cachedKey: Buffer | null = null;

/** Resolve `ENCRYPTION_KEY` (hex de 64 chars ou base64) para 32 bytes crus. */
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = env.ENCRYPTION_KEY;
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    // Já coberto por fail-fast no boot (env.ts), mas mantido aqui também —
    // esta função pode ser chamada a partir de um script (backfill) que não
    // necessariamente passou pela validação do Zod de env.ts.
    throw new Error('ENCRYPTION_KEY deve representar exatamente 32 bytes (AES-256) em hex ou base64.');
  }
  cachedKey = key;
  return key;
}

// --- AES-256-GCM (email, phone) --------------------------------------------

export function encryptRandom(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(GCM_IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM_GCM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return GCM_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptRandom(value: string): string {
  const key = getKey();
  const raw = Buffer.from(value.slice(GCM_PREFIX.length), 'base64');
  const iv = raw.subarray(0, GCM_IV_LEN);
  const authTag = raw.subarray(GCM_IV_LEN, GCM_IV_LEN + GCM_TAG_LEN);
  const encrypted = raw.subarray(GCM_IV_LEN + GCM_TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM_GCM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// --- AES-256-CBC determinístico (document) ----------------------------------

/** IV = HMAC-SHA256(chave, texto claro), truncado para 16 bytes — função pura
 *  do texto claro, então a mesma entrada sempre produz o mesmo IV. O IV ainda
 *  é armazenado junto do ciphertext (como em qualquer CBC): decifrar não
 *  re-deriva o IV a partir de um texto claro que ainda não temos, usa o que
 *  foi gravado. A determinação só importa para a GRAVAÇÃO ser reproduzível
 *  (mesmo texto claro → mesmos bytes armazenados → busca por igualdade bate). */
function deriveIv(key: Buffer, plain: string): Buffer {
  return crypto.createHmac('sha256', key).update(plain).digest().subarray(0, CBC_IV_LEN);
}

export function encryptDeterministic(plain: string): string {
  const key = getKey();
  const iv = deriveIv(key, plain);
  const cipher = crypto.createCipheriv(ALGORITHM_CBC, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return CBC_PREFIX + Buffer.concat([iv, encrypted]).toString('base64');
}

function decryptDeterministic(value: string): string {
  const key = getKey();
  const raw = Buffer.from(value.slice(CBC_PREFIX.length), 'base64');
  const iv = raw.subarray(0, CBC_IV_LEN);
  const encrypted = raw.subarray(CBC_IV_LEN);
  const decipher = crypto.createDecipheriv(ALGORITHM_CBC, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// --- Helpers genéricos usados pela extensão / backfill ----------------------

export function isEncrypted(value: string): boolean {
  return value.startsWith(GCM_PREFIX) || value.startsWith(CBC_PREFIX);
}

/**
 * Decifra um valor no formato reconhecido; um valor sem os prefixos
 * conhecidos é devolvido intacto — tratado como dado legado em texto claro
 * (registro anterior à Frente 2, ainda não migrado pelo backfill), não como
 * erro. Evita que a extensão do Prisma quebre a leitura de dados existentes.
 */
export function decryptField(value: string | null): string | null {
  if (value == null || value === '') return value;
  if (value.startsWith(GCM_PREFIX)) return decryptRandom(value);
  if (value.startsWith(CBC_PREFIX)) return decryptDeterministic(value);
  return value;
}

function encryptWritableData(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  // Person
  if (typeof next.document === 'string' && next.document !== '') {
    next.document = encryptDeterministic(next.document);
  }
  if (typeof next.email === 'string' && next.email !== '') {
    next.email = encryptRandom(next.email);
  }
  if (typeof next.phone === 'string' && next.phone !== '') {
    next.phone = encryptRandom(next.phone);
  }
  // TenantBilling — PIX Copia e Cola (não-determinístico, GCM: não precisa de
  // busca por igualdade). O helper é compartilhado entre os dois models; cada
  // um só tem os campos que tem, então Person nunca vê `pixPayload` e
  // TenantBilling nunca vê document/email/phone — sem contaminação cruzada.
  if (typeof next.pixPayload === 'string' && next.pixPayload !== '') {
    next.pixPayload = encryptRandom(next.pixPayload);
  }
  return next;
}

/**
 * Encripta filtros de igualdade sobre `document` em um `where` (a única
 * coluna com esquema determinístico, logo a única que suporta comparação
 * direta no banco). Cobre o formato plano (`document: 'x'`), `{ equals }` e
 * `{ in: [...] }`, e desce recursivamente por combinadores lógicos
 * (`AND`/`OR`/`NOT` — usados pela busca de `GET /persons`). Outros operadores
 * (`contains`, `startsWith`, `not`, ...) não têm como funcionar sob
 * criptografia determinística e são deixados intactos — na prática, deixam
 * de encontrar resultado (ver nota em `routes/persons.ts`).
 */
function encryptWhereDocument(where: unknown): unknown {
  if (!where || typeof where !== 'object') return where;
  const w = where as Record<string, unknown>;
  const next: Record<string, unknown> = { ...w };

  if (typeof next.document === 'string') {
    next.document = encryptDeterministic(next.document);
  } else if (next.document && typeof next.document === 'object') {
    const filter = next.document as Record<string, unknown>;
    if (typeof filter.equals === 'string') {
      next.document = { ...filter, equals: encryptDeterministic(filter.equals) };
    } else if (Array.isArray(filter.in)) {
      next.document = {
        ...filter,
        in: filter.in.map((v) => (typeof v === 'string' ? encryptDeterministic(v) : v)),
      };
    }
  }

  for (const key of ['AND', 'OR', 'NOT'] as const) {
    if (Array.isArray(next[key])) {
      next[key] = (next[key] as unknown[]).map(encryptWhereDocument);
    } else if (next[key] && typeof next[key] === 'object') {
      next[key] = encryptWhereDocument(next[key]);
    }
  }

  return next;
}

const WRITE_OPS_WITH_DATA = new Set(['create', 'update', 'createMany']);
const OPS_WITH_WHERE = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Extensão do Prisma que torna a criptografia transparente para toda rota
 * que já usa o model `Person` — mesmo espírito de `withTenant` (lib/tenant.ts).
 * Dois componentes com responsabilidades separadas de propósito:
 *
 *  - `query.person.$allOperations`: só mexe em ARGUMENTOS (nunca no retorno)
 *    — encripta `data`/`create`/`update` nas escritas, e `where.document` nas
 *    leituras/updates/deletes por igualdade.
 *  - `result.person.{document,email,phone}`: campos computados que decifram
 *    o valor cru vindo do banco. Diferente de um hook em `query`, o
 *    componente `result` do Prisma Client Extensions se aplica automaticamente
 *    também a relações aninhadas (`Sale.client`, `Invoice.supplier`,
 *    `FinancialAccount.person` via `include`), que um hook de `query` escopado
 *    a `person` jamais veria (ele só dispara quando `Person` é o model RAIZ
 *    da chamada). Fazer as duas coisas nesse mesmo hook duplicaria a
 *    decriptação nesses casos.
 */
export function withEncryption(client: typeof prisma = prisma) {
  return client.$extends({
    name: 'withEncryption',
    query: {
      person: {
        async $allOperations({ operation, args, query }) {
          const a = args as Record<string, unknown>;

          if (OPS_WITH_WHERE.has(operation) && a.where) {
            a.where = encryptWhereDocument(a.where);
          }

          if (WRITE_OPS_WITH_DATA.has(operation) && a.data) {
            a.data = Array.isArray(a.data)
              ? a.data.map((d) => encryptWritableData(d as Record<string, unknown>))
              : encryptWritableData(a.data as Record<string, unknown>);
          }

          if (operation === 'upsert') {
            if (a.create) a.create = encryptWritableData(a.create as Record<string, unknown>);
            if (a.update) a.update = encryptWritableData(a.update as Record<string, unknown>);
          }

          return query(a);
        },
      },

      // TenantBilling — cifra `pixPayload` nas escritas. Só mexe em `data`/
      // `create`/`update`; NÃO há `encryptWhere` porque `pixPayload` é GCM
      // (não-determinístico) e nenhuma rota busca por igualdade nesse campo.
      tenantBilling: {
        async $allOperations({ operation, args, query }) {
          const a = args as Record<string, unknown>;

          if (WRITE_OPS_WITH_DATA.has(operation) && a.data) {
            a.data = Array.isArray(a.data)
              ? a.data.map((d) => encryptWritableData(d as Record<string, unknown>))
              : encryptWritableData(a.data as Record<string, unknown>);
          }

          if (operation === 'upsert') {
            if (a.create) a.create = encryptWritableData(a.create as Record<string, unknown>);
            if (a.update) a.update = encryptWritableData(a.update as Record<string, unknown>);
          }

          return query(a);
        },
      },
    },
    result: {
      person: {
        document: {
          needs: { document: true },
          compute(person: { document: string | null }) {
            return decryptField(person.document);
          },
        },
        email: {
          needs: { email: true },
          compute(person: { email: string | null }) {
            return decryptField(person.email);
          },
        },
        phone: {
          needs: { phone: true },
          compute(person: { phone: string | null }) {
            return decryptField(person.phone);
          },
        },
      },

      // Decifra `pixPayload` de forma transparente ao ler qualquer TenantBilling
      // (também em relações aninhadas, ex.: `Company.tenantBillings` via include).
      tenantBilling: {
        pixPayload: {
          needs: { pixPayload: true },
          compute(billing: { pixPayload: string | null }) {
            return decryptField(billing.pixPayload);
          },
        },
      },
    },
  });
}
