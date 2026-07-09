import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { type PaymentType, DEFAULT_PAYMENT_TYPES } from '@exodus/shared';
import { api } from '../lib/api';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Padrão BR de vírgula decimal (mesmo helper usado em PDV/Vendas/Produtos).
function sanitizeBr(s: string): string {
  let v = s.replace(/\./g, ',');
  v = v.replace(/[^\d,]/g, '');
  v = v.replace(/^,/, '');
  const parts = v.split(',');
  if (parts.length > 1) v = parts[0] + ',' + parts.slice(1).join('');
  return v.replace(/^0+(?=\d)/, '');
}

export interface PurchaseInstallment {
  dueDate: string;
  amount: number;
}

/**
 * Motor financeiro de compras — split de formas de pagamento + parcelamento
 * A_PRAZO, espelho do `PaymentModal` do PDV sem o conceito de cliente (o
 * fornecedor já está resolvido antes desta etapa em ambos os fluxos).
 * Extraído da Etapa 3 da importação de XML para ser reaproveitado também na
 * Compra Manual — única fonte de verdade para "como gerar as parcelas".
 *
 * Reporta ao pai, via `onChange`, o array final de parcelas já resolvido
 * (cada linha à vista vira uma parcela única vencendo hoje; a linha A_PRAZO,
 * se houver, já vem parcelada conforme Parcelas/1º vencimento/Condição) e se
 * o split fecha exatamente com `totalAmount`.
 */
export function PurchaseFinancialEngine({
  totalAmount,
  onChange,
}: {
  totalAmount: number;
  onChange: (installments: PurchaseInstallment[], isValid: boolean) => void;
}) {
  const { data: ptData } = useQuery({
    queryKey: ['payment-types'],
    queryFn: () => api.get<{ types: PaymentType[] }>('/api/settings/payment-types'),
  });
  const paymentTypes = (ptData?.types ?? DEFAULT_PAYMENT_TYPES).filter((t) => t.active);

  const [lines, setLines] = useState<{ method: string; amount: number }[]>(() => [
    { method: 'CASH', amount: round2(totalAmount) },
  ]);
  const [parcels, setParcels] = useState(2);
  const [firstDue, setFirstDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [conditionStr, setConditionStr] = useState('30');
  const [customDates, setCustomDates] = useState<Record<number, string>>({});

  // Se o total mudar depois de montado (ex.: Compra Manual com o motor já
  // aberto e o usuário edita/adiciona itens), a 1ª linha absorve a diferença
  // — as demais formas, já fixadas manualmente, não são mexidas.
  const prevTotal = useRef(totalAmount);
  useEffect(() => {
    if (totalAmount === prevTotal.current) return;
    prevTotal.current = totalAmount;
    setLines((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0]!;
      const othersSum = round2(prev.slice(1).reduce((a, x) => a + x.amount, 0));
      return [{ ...first, amount: Math.max(0, round2(totalAmount - othersSum)) }, ...prev.slice(1)];
    });
  }, [totalAmount]);

  const paidLines = round2(lines.reduce((a, l) => a + (l.amount || 0), 0));
  const remainingLines = round2(totalAmount - paidLines);
  const aPrazoTotal = round2(
    lines.filter((l) => l.method === 'A_PRAZO').reduce((a, l) => a + (l.amount || 0), 0),
  );

  // Valida se o 1º vencimento é uma data real antes de usá-la.
  const firstDueDate = firstDue.trim() ? new Date(firstDue + 'T00:00:00') : null;
  const firstDueValid = !!firstDueDate && !isNaN(firstDueDate.getTime());

  // Formata YYYY-MM-DD usando data LOCAL (evita shift de fuso horário UTC-3).
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function genInstallments() {
    if (!firstDueValid || !firstDueDate) return [];
    const n = Math.max(1, Math.floor(parcels));
    const base = Math.floor((aPrazoTotal / n) * 100) / 100;
    const parts: { dueDate: string; amount: number }[] = [];
    let acc = 0;
    // Parser: "30" → [30]; "30/60/90" → [30,60,90]; "30-60" → [30,60]
    const intervals = conditionStr
      .split(/[\/\-,. ]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((v) => !isNaN(v) && v > 0);
    const multiInterval = intervals.length > 1;
    const fallbackInterval = intervals[intervals.length - 1] ?? 30;
    for (let i = 0; i < n; i++) {
      const amount = i === n - 1 ? round2(aPrazoTotal - acc) : base;
      acc = round2(acc + amount);
      let dueDate: string;
      if (multiInterval) {
        if (i < intervals.length) {
          const interval = intervals[i] ?? fallbackInterval;
          const d = new Date(firstDueDate);
          d.setDate(d.getDate() + interval);
          dueDate = localDateStr(d);
        } else {
          const prev = parts[i - 1];
          const prevDate = prev ? new Date(prev.dueDate + 'T00:00:00') : new Date(firstDueDate);
          prevDate.setDate(prevDate.getDate() + fallbackInterval);
          dueDate = localDateStr(prevDate);
        }
      } else {
        const interval = intervals[0] ?? 30;
        const d = new Date(firstDueDate);
        d.setDate(d.getDate() + i * interval);
        dueDate = localDateStr(d);
      }
      parts.push({ dueDate, amount });
    }
    return parts;
  }

  function isWeekend(dateStr: string) {
    const day = new Date(dateStr + 'T00:00:00').getDay();
    return day === 0 || day === 6;
  }

  const aPrazoInstallments = aPrazoTotal > 0 && firstDueValid ? genInstallments() : undefined;
  // Aplica overrides manuais de data antes de enviar ao pai e exibir ao usuário.
  const resolvedInstallments = aPrazoInstallments?.map((p, i) => ({
    ...p,
    dueDate: customDates[i] ?? p.dueDate,
  }));
  const weekendParcelas = resolvedInstallments?.filter((p) => isWeekend(p.dueDate)) ?? [];
  const balanced = Math.abs(remainingLines) < 0.01;
  const isValid =
    balanced && lines.every((l) => l.amount > 0) && (aPrazoTotal === 0 || (parcels >= 1 && firstDueValid));

  // Array final: linhas à vista viram uma parcela única vencendo hoje; a
  // linha A_PRAZO (se houver) já vem parcelada via resolvedInstallments.
  const todayStr = new Date().toISOString().slice(0, 10);
  const finalInstallments: PurchaseInstallment[] = [
    ...lines.filter((l) => l.method !== 'A_PRAZO' && l.amount > 0).map((l) => ({ dueDate: todayStr, amount: l.amount })),
    ...(resolvedInstallments ?? []),
  ];

  // Reporta ao pai só quando o conteúdo (não a referência) realmente muda —
  // evita loop de re-render (onChange do pai costuma ser recriado a cada render).
  useEffect(() => {
    onChange(finalInstallments, isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(finalInstallments), isValid]);

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="mb-1 flex items-center justify-between rounded-xl bg-white px-3 py-2">
        <span className="text-sm text-slate-500">Total da compra</span>
        <span className="text-lg font-bold">{brl(totalAmount)}</span>
      </div>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-brand-400"
              value={l.method}
              onChange={(e) =>
                setLines((prev) => prev.map((x, j) => (j === i ? { ...x, method: e.target.value } : x)))
              }
            >
              {paymentTypes.map((t) => (
                <option
                  key={t.code}
                  value={t.code}
                  disabled={t.code !== l.method && lines.some((x, j) => j !== i && x.method === t.code)}
                >
                  {t.label}
                </option>
              ))}
            </select>
            <NumInput
              value={l.amount}
              onChange={(v) => {
                setLines((prev) => {
                  const next = prev.map((x, j) => (j === i ? { ...x, amount: v } : x));
                  if (i > 0 && next[0]) {
                    const othersSum = round2(next.slice(1).reduce((a, x) => a + x.amount, 0));
                    next[0] = { ...next[0], amount: Math.max(0, round2(totalAmount - othersSum)) };
                  }
                  return next;
                });
              }}
              placeholder="0,00"
            />
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
              disabled={lines.length === 1}
              onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-sm font-medium text-brand-700 hover:underline"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              { method: paymentTypes[0]?.code ?? 'CASH', amount: remainingLines > 0 ? remainingLines : 0 },
            ])
          }
        >
          + Adicionar forma
        </button>
        <span className={`text-sm font-semibold ${balanced ? 'text-emerald-600' : 'text-rose-600'}`}>
          {balanced
            ? 'Pago integralmente'
            : remainingLines > 0
              ? `Falta ${brl(remainingLines)}`
              : `Excede ${brl(-remainingLines)}`}
        </span>
      </div>

      {/* Parcelamento da parte a prazo */}
      {aPrazoTotal > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="mb-2 text-sm font-semibold text-amber-700">A prazo: {brl(aPrazoTotal)}</div>
          <div className="grid grid-cols-2 gap-2 overflow-hidden text-sm sm:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs text-slate-500">Parcelas</span>
              <IntegerInput
                value={parcels}
                onChange={(val) => {
                  setParcels(val);
                  setCustomDates({});
                  const parsedInt = conditionStr
                    .split(/[\/\-,.]/)
                    .map((n) => parseInt(n.trim(), 10))
                    .filter((n) => !isNaN(n));
                  if (parsedInt.length > 1) {
                    setConditionStr(String(parsedInt[0] ?? 30));
                  }
                }}
                min={1}
                className="input h-9"
              />
            </label>
            <label className="col-span-2 min-w-0 sm:col-span-1">
              <span className="mb-1 block text-xs text-slate-500">1º vencimento *</span>
              <input
                type="date"
                value={firstDue}
                onChange={(e) => { setFirstDue(e.target.value); setCustomDates({}); }}
                className={`input h-9 w-full min-w-0 ${!firstDueValid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400/20' : ''}`}
              />
              {!firstDueValid && (
                <span className="mt-0.5 block text-xs font-medium text-rose-600">Informe a data</span>
              )}
            </label>
            <label>
              <span className="mb-1 block text-xs text-slate-500">Condição (dias)</span>
              <input
                type="text"
                inputMode="numeric"
                value={conditionStr}
                onChange={(e) => {
                  const val = e.target.value;
                  setConditionStr(val);
                  setCustomDates({});
                  const parsedInt = val
                    .split(/[\/\-,.]/)
                    .map((n) => parseInt(n.trim(), 10))
                    .filter((n) => !isNaN(n));
                  if (parsedInt.length > 1) setParcels(parsedInt.length);
                }}
                placeholder="Ex: 30 ou 30/60/90"
                className="input h-9"
              />
            </label>
          </div>
          {resolvedInstallments && (
            <>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {resolvedInstallments.map((p, i) => {
                  const wknd = isWeekend(p.dueDate);
                  return (
                    <li key={i} className={`flex items-center justify-between gap-1 rounded px-1 ${wknd ? 'bg-amber-50 text-amber-700' : ''}`}>
                      <div className="flex items-center gap-1">
                        <span className="shrink-0">{i + 1}ª ·</span>
                        <input
                          type="date"
                          value={p.dueDate}
                          onChange={(e) => setCustomDates((prev) => ({ ...prev, [i]: e.target.value }))}
                          className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-brand-400"
                        />
                        {wknd && <span>⚠️ fim de semana</span>}
                      </div>
                      <span className="font-medium">{brl(p.amount)}</span>
                    </li>
                  );
                })}
              </ul>
              {weekendParcelas.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <strong>⚠️ {weekendParcelas.length} parcela(s) caem no fim de semana.</strong>
                  <br />Você pode prosseguir assim mesmo ou alterar a data do 1º vencimento.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Input numérico blindado (padrão antifraude do projeto). */
function NumInput({
  value,
  onChange,
  max,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  placeholder?: string;
}) {
  const toRaw = (n: number) => (n !== 0 ? String(n).replace('.', ',') : '');
  const [raw, setRaw] = useState(() => toRaw(value));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(toRaw(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className="h-10 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-brand-400"
      value={raw}
      placeholder={placeholder}
      onKeyDown={(e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); }}
      onChange={(e) => {
        const cleaned = sanitizeBr(e.target.value);
        let num = parseFloat(cleaned.replace(',', '.')) || 0;
        if (max !== undefined && num > max) {
          num = max;
          skipSync.current = true;
          setRaw(String(max).replace('.', ','));
          onChange(max);
          return;
        }
        setRaw(cleaned);
        skipSync.current = true;
        onChange(num);
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}

/** Input inteiro blindado (nº de parcelas). */
function IntegerInput({
  value,
  onChange,
  min = 1,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  className?: string;
}) {
  const [raw, setRaw] = useState(() => String(value));
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) { skipSync.current = false; return; }
    setRaw(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      className={className}
      onKeyDown={(e) => { if (['-', '+', 'e', 'E', '.', ','].includes(e.key)) e.preventDefault(); }}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/\D/g, '');
        setRaw(cleaned);
        skipSync.current = true;
        onChange(parseInt(cleaned, 10) || min);
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}
