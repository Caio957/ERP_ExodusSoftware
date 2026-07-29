import { onlyDigits } from '../schemas/common.js';

/**
 * Validação matemática de CPF/CNPJ (algoritmo oficial de dígito
 * verificador — Módulo 11). Reforça `document` (`schemas/common.ts`), que
 * só checa o TAMANHO após limpar a máscara — essas funções checam se os
 * dígitos verificadores realmente batem, rejeitando números falsos que
 * coincidentemente têm 11/14 dígitos (ex.: "12345678900").
 */

/** Sequências com todos os dígitos iguais (ex.: '00000000000') passam no
 * cálculo do módulo 11 mas nunca são documentos reais — rejeitadas à parte. */
function isAllSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

/** Soma ponderada dos dígitos, convertida no dígito verificador esperado. */
function calcCheckDigit(digits: string, weights: number[]): number {
  const sum = digits.split('').reduce((acc, digit, i) => acc + Number(digit) * weights[i]!, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** CPF (11 dígitos) — valida os dois dígitos verificadores pelo Módulo 11. */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || isAllSameDigit(cpf)) return false;

  const digit1 = calcCheckDigit(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (digit1 !== Number(cpf[9])) return false;

  const digit2 = calcCheckDigit(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (digit2 !== Number(cpf[10])) return false;

  return true;
}

/** CNPJ (14 dígitos) — valida os dois dígitos verificadores pelo Módulo 11. */
export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || isAllSameDigit(cnpj)) return false;

  const digit1 = calcCheckDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (digit1 !== Number(cnpj[12])) return false;

  const digit2 = calcCheckDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (digit2 !== Number(cnpj[13])) return false;

  return true;
}

/** Despacha para `isValidCPF`/`isValidCNPJ` conforme o tamanho limpo (11 ou 14); qualquer outro tamanho é inválido. */
export function isValidCpfOrCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}
