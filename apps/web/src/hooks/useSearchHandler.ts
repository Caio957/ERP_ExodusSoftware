import type { KeyboardEvent } from 'react';

/**
 * Padroniza o atalho "Enter para buscar". Em campos que só devem consultar
 * o servidor a partir de uma ação explícita (ou que têm um gate de tamanho
 * mínimo bloqueando a busca com campo vazio), o Enter dispara `onSearch` com
 * o valor atual do input (já com trim) — inclusive vazio, o que deve resetar
 * o filtro e listar tudo.
 */
export function useSearchHandler(onSearch: (term: string) => void) {
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    onSearch(e.currentTarget.value.trim());
  }

  return { onKeyDown };
}
