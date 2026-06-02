import { useEffect, useRef } from 'react';

interface Options {
  /** Intervalo máximo (ms) entre teclas para considerar entrada de scanner. */
  maxInterval?: number;
  /** Tamanho mínimo do código para disparar. */
  minLength?: number;
  enabled?: boolean;
}

/**
 * Escuta eventos de teclado contínuos para leitores de código de barras
 * Bluetooth (Requisito 4.4). O leitor "digita" os dígitos muito rápido e
 * finaliza com Enter; distinguimos da digitação humana pelo intervalo curto.
 * Não interfere quando o foco está em um input de texto.
 */
export function useBarcodeScanner(onScan: (code: string) => void, options: Options = {}) {
  const { maxInterval = 50, minLength = 3, enabled = true } = options;
  const buffer = useRef('');
  const lastTime = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typingInField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const now = Date.now();
      const gap = now - lastTime.current;
      lastTime.current = now;

      if (gap > maxInterval) buffer.current = '';

      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength && !typingInField) {
          e.preventDefault();
          onScanRef.current(buffer.current);
        }
        buffer.current = '';
        return;
      }

      // Apenas caracteres imprimíveis de 1 char (dígitos/letras do EAN/SKU)
      if (e.key.length === 1) buffer.current += e.key;
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, maxInterval, minLength]);
}
