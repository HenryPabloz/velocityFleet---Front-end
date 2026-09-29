import { HttpErrorResponse } from '@angular/common/http';

import { Severity, TripStatus, VehicleStatus } from '../core/models';
import { KmPorDia } from './dashboard/dashboard.model';
import { agregarPorMes, estaNoMesAtual, inicioDoMesAtual, preencherLacunas } from './dashboard/utils/datas-dashboard';
import { formatarNumeroNoIdioma, rotuloDoMes, situacaoDoErro } from './analytics/utils/analytics-util';
import {
  montarOpcoesBarras,
  montarOpcoesDonut,
  montarOpcoesKm,
  ORDEM_SEVERIDADE,
  ORDEM_STATUS_DONUT,
  ORDEM_STATUS_VIAGEM,
  PALETAS,
} from './dashboard/utils/graficos-apex';

describe('agregarPorMes (km por dia viram km por mês, sem fuso)', () => {
  const dias: KmPorDia[] = [
    { date: '2026-07-31', totalKm: 320 },
    { date: '2026-08-01', totalKm: 586 },
    { date: '2026-08-15', totalKm: 412 },
    { date: '2026-08-31', totalKm: 198 },
    { date: '2026-09-01', totalKm: 240 },
  ];

  it('a soma dos meses é igual à soma dos dias', () => {
    const meses = agregarPorMes(dias);
    const somaDosDias = dias.reduce((soma, dia) => soma + dia.totalKm, 0);
    const somaDosMeses = meses.reduce((soma, mes) => soma + mes.totalKm, 0);
    expect(somaDosMeses).toBe(somaDosDias);
    expect(somaDosMeses).toBe(1756);
  });

  it('virada de mês: 31/07 fica em julho e 01/08 em agosto (nada desliza por fuso)', () => {
    expect(agregarPorMes(dias)).toEqual([
      { mes: '2026-07', totalKm: 320 },
      { mes: '2026-08', totalKm: 1196 },
      { mes: '2026-09', totalKm: 240 },
    ]);
  });

  it('virada de ano: 31/12 fica no ano antigo', () => {
    const resultado = agregarPorMes([
      { date: '2025-12-31', totalKm: 100 },
      { date: '2026-01-01', totalKm: 50 },
    ]);
    expect(resultado.map((mes) => mes.mes)).toEqual(['2025-12', '2026-01']);
  });

  it('a data com hora também vai para o mês certo', () => {
    expect(agregarPorMes([{ date: '2026-08-31T23:30:00.000Z', totalKm: 10 }])[0].mes).toBe('2026-08');
  });

  it('lista vazia não gera meses', () => {
    expect(agregarPorMes([])).toEqual([]);
  });
});

describe('preencherLacunas', () => {
  it('completa com zero os meses sem km entre o primeiro e o último', () => {
    const resultado = preencherLacunas([
      { mes: '2026-11', totalKm: 900 },
      { mes: '2026-08', totalKm: 500 },
    ]);
    expect(resultado).toEqual([
      { mes: '2026-08', totalKm: 500 },
      { mes: '2026-09', totalKm: 0 },
      { mes: '2026-10', totalKm: 0 },
      { mes: '2026-11', totalKm: 900 },
    ]);
  });

  it('atravessa a virada de ano (nov/2025 a fev/2026)', () => {
    const resultado = preencherLacunas([
      { mes: '2025-11', totalKm: 1 },
      { mes: '2026-02', totalKm: 2 },
    ]);
    expect(resultado.map((mes) => mes.mes)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('a soma não muda e lista vazia continua vazia', () => {
    const original = [
      { mes: '2026-01', totalKm: 10 },
      { mes: '2026-04', totalKm: 30 },
    ];
    const soma = preencherLacunas(original).reduce((total, mes) => total + mes.totalKm, 0);
    expect(soma).toBe(40);
    expect(preencherLacunas([])).toEqual([]);
  });
});

describe('mês atual', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 25, 12, 0));
  });

  afterEach(() => jest.useRealTimers());

  it('inicioDoMesAtual é o dia 1 do mês corrente', () => {
    const inicio = inicioDoMesAtual();
    expect(inicio.getFullYear()).toBe(2026);
    expect(inicio.getMonth()).toBe(8);
    expect(inicio.getDate()).toBe(1);
  });

  it('estaNoMesAtual: viagem de setembro/2026 entra; agosto e setembro/2025 não', () => {
    expect(estaNoMesAtual(new Date(2026, 8, 3, 10).toISOString())).toBe(true);
    expect(estaNoMesAtual(new Date(2026, 7, 31, 10).toISOString())).toBe(false);
    expect(estaNoMesAtual(new Date(2025, 8, 3, 10).toISOString())).toBe(false);
  });

  it('estaNoMesAtual sem data devolve falso', () => {
    expect(estaNoMesAtual(null)).toBe(false);
  });
});

describe('funções de analytics', () => {
  function erro(status: number): HttpErrorResponse {
    return new HttpErrorResponse({ status: status });
  }

  it('situacaoDoErro: 429 é limite, 403 é sem acesso e o resto é erro', () => {
    expect(situacaoDoErro(erro(429))).toBe('limite');
    expect(situacaoDoErro(erro(403))).toBe('sem-acesso');
    expect(situacaoDoErro(erro(500))).toBe('erro');
    expect(situacaoDoErro(new Error('rede'))).toBe('erro');
  });

  it('formatarNumeroNoIdioma respeita o idioma e as casas (consumo 0,12 L/km)', () => {
    expect(formatarNumeroNoIdioma(1234.5, 1, 'pt-BR')).toBe('1.234,5');
    expect(formatarNumeroNoIdioma(1234.5, 1, 'en-US')).toBe('1,234.5');
    expect(formatarNumeroNoIdioma(0.1234, 2, 'pt-BR')).toBe('0,12');
  });

  it('rotuloDoMes usa só o texto da chave: 2026-09 vira set/26, 2026-01 vira jan/26', () => {
    expect(rotuloDoMes('2026-09', 'pt-BR')).toBe('set/26');
    expect(rotuloDoMes('2026-01', 'pt-BR')).toBe('jan/26');
    expect(rotuloDoMes('2025-12', 'pt-BR')).toBe('dez/25');
  });
});

describe('opções dos gráficos (ApexCharts)', () => {
  const formatar = (valor: number): string => String(valor);

  it('gráfico de km usa a cor da série do tema e o tema no tooltip', () => {
    const claro = montarOpcoesKm('light', { rotulos: ['ago/26', 'set/26'], valores: [1196, 240], nomeSerie: 'Km', unidade: 'km', formatar });
    const escuro = montarOpcoesKm('dark', { rotulos: ['ago/26', 'set/26'], valores: [1196, 240], nomeSerie: 'Km', unidade: 'km', formatar });
    expect(claro.colors).toEqual([PALETAS.light.serieKm]);
    expect(escuro.colors).toEqual([PALETAS.dark.serieKm]);
    expect(claro.series).toEqual([{ name: 'Km', data: [1196, 240] }]);
    expect(claro.xaxis?.categories).toEqual(['ago/26', 'set/26']);
    expect(escuro.tooltip?.theme).toBe('dark');
  });

  it('gráfico de km liga a animação, exceto para quem pediu menos movimento', () => {
    const dados = { rotulos: [], valores: [], nomeSerie: 'Km', unidade: 'km', formatar };
    expect(montarOpcoesKm('light', dados).chart?.animations?.enabled).toBe(true);
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    expect(montarOpcoesKm('light', dados).chart?.animations?.enabled).toBe(false);
    window.matchMedia = original;
  });

  it('donut de veículos por status: uma fatia por status, com a cor fixa de cada um', () => {
    const cores = ORDEM_STATUS_DONUT.map((status) => PALETAS.dark.statusVeiculo[status]);
    const opcoes = montarOpcoesDonut('dark', {
      rotulos: ['Em uso', 'Em manutenção', 'Disponível', 'Fora de serviço'],
      valores: [4, 1, 6, 0],
      cores: cores,
      rotuloTotal: 'Veículos',
      unidadeTooltip: 'veículos',
    });
    expect(opcoes.series).toEqual([4, 1, 6, 0]);
    expect(opcoes.colors).toEqual(cores);
    expect(opcoes.chart?.type).toBe('donut');
  });

  it('barras de incidentes por severidade usam a paleta do tema', () => {
    const cores = ORDEM_SEVERIDADE.map((severidade) => PALETAS.light.severidade[severidade]);
    const opcoes = montarOpcoesBarras('light', {
      rotulos: ['Baixa', 'Média', 'Alta'],
      valores: [7, 3, 1],
      cores: cores,
      nomeSerie: 'Incidentes',
      unidadeTooltip: 'incidentes',
    } as never);
    expect(opcoes.chart?.type).toBe('bar');
  });

  it('todo status, severidade e status de viagem tem cor nos dois temas', () => {
    for (const tema of ['light', 'dark'] as const) {
      for (const status of Object.values(VehicleStatus)) {
        expect(PALETAS[tema].statusVeiculo[status]).toMatch(/^#[0-9a-f]{6}$/i);
      }
      for (const severidade of Object.values(Severity)) {
        expect(PALETAS[tema].severidade[severidade]).toMatch(/^#[0-9a-f]{6}$/i);
      }
      for (const status of Object.values(TripStatus)) {
        expect(PALETAS[tema].statusViagem[status]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
    expect(ORDEM_STATUS_VIAGEM).toHaveLength(4);
  });

  it('a severidade se inverte no tema escuro: a mais grave fica mais clara', () => {
    expect(PALETAS.light.severidade[Severity.HIGH]).toBe('#184f95');
    expect(PALETAS.dark.severidade[Severity.HIGH]).toBe('#86b6ef');
  });
});
