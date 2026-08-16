/**
 * Helpers de data ancorados no fuso da loja (America/Sao_Paulo, UTC-3).
 *
 * Nenhum deles usa `setHours(0,0,0,0)`: em produção (Railway) o processo roda
 * em **UTC**, não no fuso da loja — zerar a hora localmente fecharia o dia às
 * 21:00 de Brasília e cortaria lançamentos noturnos. O mesmo raciocínio já
 * estava documentado no relatório periódico de `routes/cash.ts` (fronteiras
 * com offset `-03:00` explícito).
 *
 * Extraído de `routes/financial.ts` (onde nasceu privado) quando o módulo de
 * Faturamento SaaS virou um segundo consumidor — mesmo precedente de
 * `calcWeightedAverageCost` (lib/inventory.ts) e `apportionLandedCost`
 * (shared/pricing.ts): ao surgir o 2º consumidor, a regra vira fonte única em
 * vez de ser duplicada.
 */

/** Meia-noite (00:00) do dia de calendário de `date` no fuso da loja. */
export function startOfDayBr(date: Date): Date {
  // `en-CA` produz exatamente `YYYY-MM-DD`, o formato que o construtor de Date
  // aceita de volta com o offset explícito.
  const localDateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(`${localDateStr}T00:00:00.000-03:00`);
}

/** Meia-noite de HOJE no fuso da loja. */
export function todayStartBr(): Date {
  return startOfDayBr(new Date());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Diferença em DIAS DE CALENDÁRIO (fuso da loja) entre `target` e `reference`:
 * positivo = ainda vai vencer · 0 = vence hoje · negativo = já venceu há N dias.
 *
 * Compara meia-noite com meia-noite, então o horário gravado em cada instante
 * é irrelevante (uma fatura que vence hoje dá 0 tanto às 00h05 quanto às
 * 23h55) e o fuso do processo (UTC em produção) não interfere. `Math.round`
 * cobre qualquer fração residual caso o Brasil volte a adotar horário de verão
 * (a âncora fixa `-03:00` passaria a divergir em 1h em parte do ano).
 */
export function diffDaysBr(target: Date, reference: Date = new Date()): number {
  return Math.round(
    (startOfDayBr(target).getTime() - startOfDayBr(reference).getTime()) / MS_PER_DAY,
  );
}
