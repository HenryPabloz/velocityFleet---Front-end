import { AbstractControl, ValidationErrors } from '@angular/forms';

import { normalizarPlaca } from '../utils/formatacao';

// Mercosul (ABC1D23) ou antiga (ABC1234 / ABC-1234), como o back-end aceita.
const REGEX_PLACA = /^([A-Z]{3}[0-9][A-Z][0-9]{2}|[A-Z]{3}[0-9]{4})$/;

export function validarPlaca(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '');
  if (!valor) {
    return null;
  }
  if (REGEX_PLACA.test(normalizarPlaca(valor))) {
    return null;
  }
  return { placa: true };
}

// CNH: exatamente 11 números, sem máscara.
export function validarCnh(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '');
  if (!valor) {
    return null;
  }
  if (/^[0-9]{11}$/.test(valor)) {
    return null;
  }
  return { cnh: true };
}

// Data no formato AAAA-MM-DD, existente e que não esteja no passado.
export function validarDataFutura(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '');
  if (!valor) {
    return null;
  }
  const partes = valor.split('-');
  if (partes.length !== 3) {
    return { dataInvalida: true };
  }
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return { dataInvalida: true };
  }
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (data.getTime() < hoje.getTime()) {
    return { dataPassada: true };
  }
  return null;
}

// CEP com 8 números (a máscara é ignorada).
export function validarCep(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '');
  if (!valor) {
    return null;
  }
  if (valor.replace(/\D/g, '').length === 8) {
    return null;
  }
  return { cep: true };
}

// Número inteiro (sem casas decimais).
export function validarInteiro(controle: AbstractControl): ValidationErrors | null {
  const valor = controle.value;
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  if (Number.isInteger(Number(valor))) {
    return null;
  }
  return { inteiro: true };
}

// Valor em reais com no máximo 2 casas decimais (centavos).
export function validarCentavos(controle: AbstractControl): ValidationErrors | null {
  const valor = controle.value;
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  const centavos = Number(valor) * 100;
  if (Math.abs(centavos - Math.round(centavos)) < 0.000001) {
    return null;
  }
  return { centavos: true };
}
