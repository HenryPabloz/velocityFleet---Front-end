import { PESSOAS, VEICULOS } from '../../../../testing/dados-reais';
import {
  dataCurta,
  dataHoraCurta,
  diasParaVencer,
  formatarMoeda,
  formatarNumero,
  formatarPlaca,
  formatarPrecoLitro,
  formatarTamanhoArquivo,
  mascararCep,
  normalizarPlaca,
  situacaoDaCnh,
} from './formatacao';

// O NumberFormat do Node usa espaço sem quebra entre "R$" e o valor: normalizamos para comparar.
function semEspacoEspecial(texto: string): string {
  return texto.replace(/ /g, ' ');
}

describe('formatação de placa', () => {
  it('placa antiga ganha hífen (Saveiro 2018: GHK-4821)', () => {
    expect(formatarPlaca(VEICULOS.saveiro.placa)).toBe('GHK-4821');
  });

  it('placa antiga já com hífen e em minúscula continua correta', () => {
    expect(formatarPlaca('ghk-4821')).toBe('GHK-4821');
  });

  it('placa Mercosul fica sem hífen (Strada 2023: RIO4E56)', () => {
    expect(formatarPlaca('rio4e56')).toBe('RIO4E56');
  });

  it('vazio, nulo e indefinido viram texto vazio', () => {
    expect(formatarPlaca('')).toBe('');
    expect(formatarPlaca(null)).toBe('');
    expect(formatarPlaca(undefined)).toBe('');
  });

  it('normalizarPlaca tira espaço e hífen e deixa maiúscula', () => {
    expect(normalizarPlaca(' ghk-4821 ')).toBe('GHK4821');
    expect(normalizarPlaca('bra 2e19')).toBe('BRA2E19');
  });
});

describe('formatação de datas', () => {
  it('dataCurta não muda o dia por causa do fuso (meia-noite UTC continua dia 22)', () => {
    expect(dataCurta('2026-09-22T00:00:00.000Z')).toBe('22/09/2026');
  });

  it('dataCurta aceita só a data (validade da CNH)', () => {
    expect(dataCurta(PESSOAS.marcos.validadeCnh)).toBe('18/03/2031');
  });

  it('dataCurta sem valor mostra travessão', () => {
    expect(dataCurta(null)).toBe('—');
    expect(dataCurta('')).toBe('—');
  });

  it('dataCurta devolve o texto original quando não parece uma data', () => {
    expect(dataCurta('sem-data')).toBe('sem-data');
  });

  it('dataHoraCurta mostra dia, mês, ano e hora no padrão brasileiro', () => {
    // Meio-dia em UTC cai no mesmo dia em qualquer fuso brasileiro.
    const texto = dataHoraCurta('2026-09-22T15:00:00.000Z');
    expect(texto).toMatch(/^22\/09\/26,? \d{2}:\d{2}$/);
  });

  it('dataHoraCurta sem valor ou inválida se comporta', () => {
    expect(dataHoraCurta(null)).toBe('—');
    expect(dataHoraCurta('ontem à tarde')).toBe('ontem à tarde');
  });
});

describe('validade da CNH', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 25, 15, 30));
  });

  afterEach(() => jest.useRealTimers());

  it('diasParaVencer conta os dias inteiros até a validade', () => {
    expect(diasParaVencer('2026-10-25')).toBe(30);
    expect(diasParaVencer('2026-09-25')).toBe(0);
    expect(diasParaVencer('2026-09-20')).toBe(-5);
  });

  it('CNH vencida ontem é VENCIDA', () => {
    expect(situacaoDaCnh('2026-09-24')).toBe('VENCIDA');
  });

  it('CNH que vence hoje ainda vale, mas está VENCENDO', () => {
    expect(situacaoDaCnh('2026-09-25')).toBe('VENCENDO');
  });

  it('CNH que vence em exatos 30 dias está VENCENDO; em 31 dias está VALIDA', () => {
    expect(situacaoDaCnh('2026-10-25')).toBe('VENCENDO');
    expect(situacaoDaCnh('2026-10-26')).toBe('VALIDA');
  });

  it('CNH do Marcos (validade 2031) está VALIDA', () => {
    expect(situacaoDaCnh(PESSOAS.marcos.validadeCnh)).toBe('VALIDA');
  });
});

describe('formatação de números e dinheiro', () => {
  it('formatarNumero usa ponto de milhar (odômetro da Master: 61.830 km)', () => {
    expect(formatarNumero(61830)).toBe('61.830');
  });

  it('formatarNumero sem valor mostra travessão, mas zero é um número', () => {
    expect(formatarNumero(null)).toBe('—');
    expect(formatarNumero(undefined)).toBe('—');
    expect(formatarNumero(0)).toBe('0');
  });

  it('formatarMoeda mostra reais com vírgula (manutenção de R$ 480,00)', () => {
    expect(semEspacoEspecial(formatarMoeda(480))).toBe('R$ 480,00');
    expect(semEspacoEspecial(formatarMoeda('1234.5'))).toBe('R$ 1.234,50');
  });

  it('formatarMoeda com valor vazio ou inválido mostra travessão', () => {
    expect(formatarMoeda(null)).toBe('—');
    expect(formatarMoeda('')).toBe('—');
    expect(formatarMoeda('abc')).toBe('—');
  });

  it('formatarPrecoLitro mostra até 4 casas (gasolina R$ 6,29 e etanol R$ 4,3990)', () => {
    expect(semEspacoEspecial(formatarPrecoLitro(6.29))).toBe('R$ 6,29');
    expect(semEspacoEspecial(formatarPrecoLitro(4.399))).toBe('R$ 4,399');
    expect(semEspacoEspecial(formatarPrecoLitro('5.8975'))).toBe('R$ 5,8975');
  });

  it('formatarPrecoLitro com valor vazio ou inválido mostra travessão', () => {
    expect(formatarPrecoLitro(undefined)).toBe('—');
    expect(formatarPrecoLitro('')).toBe('—');
    expect(formatarPrecoLitro('x')).toBe('—');
  });

  it('formatarTamanhoArquivo escolhe B, KB ou MB (limite de foto do incidente)', () => {
    expect(formatarTamanhoArquivo(900)).toBe('900 B');
    expect(formatarTamanhoArquivo(2048)).toBe('2 KB');
    expect(semEspacoEspecial(formatarTamanhoArquivo(2.5 * 1024 * 1024))).toBe('2,5 MB');
  });
});

describe('mascararCep', () => {
  it('coloca o hífen depois do quinto número (Av. Paulista)', () => {
    expect(mascararCep('01310100')).toBe('01310-100');
  });

  it('ignora letras e corta em 8 números', () => {
    expect(mascararCep('30130-010999')).toBe('30130-010');
    expect(mascararCep('30a13')).toBe('3013');
  });

  it('com até 5 números não põe hífen', () => {
    expect(mascararCep('01310')).toBe('01310');
  });
});
