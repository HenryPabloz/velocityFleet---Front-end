import { FormControl } from '@angular/forms';

import { PESSOAS, VEICULOS } from '../../../../testing/dados-reais';
import {
  validarCentavos,
  validarCep,
  validarCnh,
  validarDataFutura,
  validarInteiro,
  validarPlaca,
} from './validadores';

describe('validarPlaca', () => {
  it('aceita Mercosul (Strada RIO4E56 e Master BRA2E19)', () => {
    expect(validarPlaca(new FormControl(VEICULOS.strada.placa))).toBeNull();
    expect(validarPlaca(new FormControl(VEICULOS.master.placa))).toBeNull();
  });

  it('aceita placa antiga com e sem hífen (Saveiro GHK-4821)', () => {
    expect(validarPlaca(new FormControl('GHK4821'))).toBeNull();
    expect(validarPlaca(new FormControl('GHK-4821'))).toBeNull();
  });

  it('aceita minúscula e espaços nas pontas do texto digitado', () => {
    expect(validarPlaca(new FormControl('rio4e56'))).toBeNull();
    expect(validarPlaca(new FormControl(' ghk-4821 '))).toBeNull();
  });

  it('recusa formatos que não existem', () => {
    expect(validarPlaca(new FormControl('AB1C234'))).toEqual({ placa: true });
    expect(validarPlaca(new FormControl('ABCD123'))).toEqual({ placa: true });
    expect(validarPlaca(new FormControl('RIO4E5'))).toEqual({ placa: true });
    expect(validarPlaca(new FormControl('RIO4E567'))).toEqual({ placa: true });
  });

  it('campo vazio é assunto do "obrigatório", não da placa', () => {
    expect(validarPlaca(new FormControl(''))).toBeNull();
    expect(validarPlaca(new FormControl(null))).toBeNull();
  });
});

describe('validarCnh', () => {
  it('aceita exatamente 11 números (CNH do Marcos)', () => {
    expect(validarCnh(new FormControl(PESSOAS.marcos.cnh))).toBeNull();
  });

  it('recusa 10 e 12 números, letras e máscara', () => {
    expect(validarCnh(new FormControl('0482173659'))).toEqual({ cnh: true });
    expect(validarCnh(new FormControl('048217365901'))).toEqual({ cnh: true });
    expect(validarCnh(new FormControl('0482173659A'))).toEqual({ cnh: true });
    expect(validarCnh(new FormControl('048.217.365-90'))).toEqual({ cnh: true });
  });

  it('vazio passa (o "obrigatório" cuida disso)', () => {
    expect(validarCnh(new FormControl(''))).toBeNull();
  });
});

describe('validarCep', () => {
  it('aceita com e sem máscara', () => {
    expect(validarCep(new FormControl('01310-100'))).toBeNull();
    expect(validarCep(new FormControl('30130010'))).toBeNull();
  });

  it('recusa CEP incompleto ou grande demais', () => {
    expect(validarCep(new FormControl('01310-10'))).toEqual({ cep: true });
    expect(validarCep(new FormControl('013101000'))).toEqual({ cep: true });
  });

  it('vazio passa', () => {
    expect(validarCep(new FormControl(''))).toBeNull();
  });
});

describe('validarDataFutura', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 25, 10, 0));
  });

  afterEach(() => jest.useRealTimers());

  it('aceita hoje e datas futuras (validade da CNH em 2031)', () => {
    expect(validarDataFutura(new FormControl('2026-09-25'))).toBeNull();
    expect(validarDataFutura(new FormControl(PESSOAS.marcos.validadeCnh))).toBeNull();
  });

  it('recusa ontem como data passada', () => {
    expect(validarDataFutura(new FormControl('2026-09-24'))).toEqual({ dataPassada: true });
  });

  it('recusa data que não existe (30 de fevereiro) e formato errado', () => {
    expect(validarDataFutura(new FormControl('2027-02-30'))).toEqual({ dataInvalida: true });
    expect(validarDataFutura(new FormControl('25/09/2027'))).toEqual({ dataInvalida: true });
  });

  it('vazio passa', () => {
    expect(validarDataFutura(new FormControl(''))).toBeNull();
  });
});

describe('validarInteiro e validarCentavos', () => {
  it('quilometragem precisa ser inteira: 18450 passa e 18450,5 não', () => {
    expect(validarInteiro(new FormControl(VEICULOS.strada.kmAtual))).toBeNull();
    expect(validarInteiro(new FormControl(18450.5))).toEqual({ inteiro: true });
    expect(validarInteiro(new FormControl(''))).toBeNull();
    expect(validarInteiro(new FormControl(null))).toBeNull();
  });

  it('preço do litro aceita centavos (6,29) e recusa fração de centavo (6,295)', () => {
    expect(validarCentavos(new FormControl(6.29))).toBeNull();
    expect(validarCentavos(new FormControl(480))).toBeNull();
    expect(validarCentavos(new FormControl(6.295))).toEqual({ centavos: true });
    expect(validarCentavos(new FormControl(''))).toBeNull();
  });
});
