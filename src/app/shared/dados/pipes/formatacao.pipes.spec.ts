import { VEICULOS } from '../../../../testing/dados-reais';
import {
  DataCurtaPipe,
  DataHoraCurtaPipe,
  MoedaPipe,
  NumeroPipe,
  PlacaPipe,
  PrecoLitroPipe,
} from './formatacao.pipes';

function semEspacoEspecial(texto: string): string {
  return texto.replace(/ /g, ' ');
}

describe('pipes de formatação', () => {
  it('placa: Saveiro 2018 aparece como GHK-4821 e Strada 2023 como RIO4E56', () => {
    const pipe = new PlacaPipe();
    expect(pipe.transform(VEICULOS.saveiro.placa)).toBe('GHK-4821');
    expect(pipe.transform(VEICULOS.strada.placa)).toBe('RIO4E56');
    expect(pipe.transform(null)).toBe('');
  });

  it('numero: separador de milhar brasileiro', () => {
    expect(new NumeroPipe().transform(96210)).toBe('96.210');
    expect(new NumeroPipe().transform(undefined)).toBe('—');
  });

  it('moeda: custo da troca de óleo aparece como R$ 480,00', () => {
    const pipe = new MoedaPipe();
    expect(semEspacoEspecial(pipe.transform(480))).toBe('R$ 480,00');
    expect(semEspacoEspecial(pipe.transform(264.18))).toBe('R$ 264,18');
    expect(pipe.transform(null)).toBe('—');
  });

  it('precoLitro: gasolina a R$ 6,29', () => {
    expect(semEspacoEspecial(new PrecoLitroPipe().transform(6.29))).toBe('R$ 6,29');
  });

  it('dataCurta: dia/mês/ano sem deslocar por fuso', () => {
    expect(new DataCurtaPipe().transform('2026-10-15')).toBe('15/10/2026');
    expect(new DataCurtaPipe().transform(null)).toBe('—');
  });

  it('dataHoraCurta: mostra hora e minuto', () => {
    expect(new DataHoraCurtaPipe().transform('2026-09-22T15:00:00.000Z')).toMatch(/^22\/09\/26,? \d{2}:\d{2}$/);
    expect(new DataHoraCurtaPipe().transform(undefined)).toBe('—');
  });
});
