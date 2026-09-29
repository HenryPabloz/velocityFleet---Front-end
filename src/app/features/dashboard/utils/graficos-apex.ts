import type { ApexOptions } from 'apexcharts';

import { Severity, TripStatus, VehicleStatus } from '../../../core/models';
import { TemaVisual } from '../../../core/services/theme.service';

// Cores dos gráficos, validadas com validate_palette.js (dataviz) em cada tema.
// Cada entidade tem sempre a mesma cor: veículo em uso = azul, manutenção = amarelo, etc.
export interface PaletaGrafico {
  superficie: string;
  texto: string;
  textoSuave: string;
  mudo: string;
  grade: string;
  linhaBase: string;
  serieKm: string;
  statusVeiculo: Record<VehicleStatus, string>;
  severidade: Record<Severity, string>;
  statusViagem: Record<TripStatus, string>;
}

export const PALETAS: Record<TemaVisual, PaletaGrafico> = {
  light: {
    superficie: '#ffffff',
    texto: '#0e0e11',
    textoSuave: '#55555d',
    mudo: '#74747d',
    grade: '#e8e8ec',
    linhaBase: '#c9c9d0',
    serieKm: '#2a78d6',
    statusVeiculo: {
      [VehicleStatus.IN_USE]: '#2a78d6',
      [VehicleStatus.IN_MAINTENANCE]: '#eda100',
      [VehicleStatus.AVAILABLE]: '#1baf7a',
      [VehicleStatus.OUT_OF_SERVICE]: '#e34948',
    },
    // Escala ordenada: no claro, quanto mais grave, mais escuro.
    severidade: {
      [Severity.LOW]: '#86b6ef',
      [Severity.MEDIUM]: '#3987e5',
      [Severity.HIGH]: '#184f95',
    },
    // Viagens por status: roxo, verde-água, azul e vermelho (validado com validate_palette.js, ordem abaixo).
    statusViagem: {
      [TripStatus.PLANNED]: '#4a3aa7',
      [TripStatus.COMPLETED]: '#1baf7a',
      [TripStatus.IN_PROGRESS]: '#2a78d6',
      [TripStatus.CANCELLED]: '#e34948',
    },
  },
  dark: {
    superficie: '#151519',
    texto: '#f3f3f5',
    textoSuave: '#9a9aa3',
    mudo: '#9a9aa3',
    grade: '#26262d',
    linhaBase: '#3a3a44',
    serieKm: '#3987e5',
    statusVeiculo: {
      [VehicleStatus.IN_USE]: '#3987e5',
      [VehicleStatus.IN_MAINTENANCE]: '#c98500',
      [VehicleStatus.AVAILABLE]: '#199e70',
      [VehicleStatus.OUT_OF_SERVICE]: '#e66767',
    },
    // No escuro a ordem inverte: quanto mais grave, mais claro.
    severidade: {
      [Severity.LOW]: '#184f95',
      [Severity.MEDIUM]: '#3987e5',
      [Severity.HIGH]: '#86b6ef',
    },
    statusViagem: {
      [TripStatus.PLANNED]: '#9085e9',
      [TripStatus.COMPLETED]: '#199e70',
      [TripStatus.IN_PROGRESS]: '#3987e5',
      [TripStatus.CANCELLED]: '#e66767',
    },
  },
};

// A ordem das fatias do donut foi escolhida para passar no teste de cores vizinhas nos dois temas.
export const ORDEM_STATUS_DONUT: VehicleStatus[] = [
  VehicleStatus.IN_USE,
  VehicleStatus.IN_MAINTENANCE,
  VehicleStatus.AVAILABLE,
  VehicleStatus.OUT_OF_SERVICE,
];

// Ordem que passou no teste de cores vizinhas nos dois temas (roxo, verde-água, azul, vermelho).
export const ORDEM_STATUS_VIAGEM: TripStatus[] = [
  TripStatus.PLANNED,
  TripStatus.COMPLETED,
  TripStatus.IN_PROGRESS,
  TripStatus.CANCELLED,
];

export const ORDEM_SEVERIDADE: Severity[] = [Severity.LOW, Severity.MEDIUM, Severity.HIGH];

const FONTE = 'Inter, system-ui, sans-serif';

// Quem pediu menos movimento não vê o gráfico se desenhando.
function animacaoLigada(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface DadosKm {
  rotulos: string[];
  valores: number[];
  nomeSerie: string;
  unidade: string;
  formatar: (valor: number) => string;
}

// Linha com área: km por mês.
export function montarOpcoesKm(tema: TemaVisual, dados: DadosKm): ApexOptions {
  const cores = PALETAS[tema];
  return {
    chart: {
      type: 'area',
      height: 300,
      fontFamily: FONTE,
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: animacaoLigada(), speed: 700 },
    },
    series: [{ name: dados.nomeSerie, data: dados.valores }],
    colors: [cores.serieKm],
    stroke: { width: 2, curve: 'smooth' },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 100] },
    },
    markers: {
      size: 4,
      strokeWidth: 2,
      strokeColors: cores.superficie,
      hover: { size: 6 },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      borderColor: cores.grade,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      padding: { left: 8, right: 16 },
    },
    xaxis: {
      categories: dados.rotulos,
      axisBorder: { color: cores.linhaBase },
      axisTicks: { show: false },
      labels: { style: { colors: cores.mudo, fontSize: '12px' } },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      labels: {
        style: { colors: cores.mudo, fontSize: '12px' },
        formatter: (valor: number) => dados.formatar(valor),
      },
    },
    tooltip: {
      theme: tema,
      y: { formatter: (valor: number) => dados.formatar(valor) + ' ' + dados.unidade },
    },
  };
}

interface DadosDonut {
  rotulos: string[];
  valores: number[];
  cores: string[];
  rotuloTotal: string;
  unidadeTooltip: string;
}

// Donut: veículos por status. O total fica no centro.
export function montarOpcoesDonut(tema: TemaVisual, dados: DadosDonut): ApexOptions {
  const cores = PALETAS[tema];
  return {
    chart: {
      type: 'donut',
      height: 260,
      fontFamily: FONTE,
      background: 'transparent',
      animations: { enabled: animacaoLigada(), speed: 700 },
    },
    series: dados.valores,
    labels: dados.rotulos,
    colors: dados.cores,
    // Contorno da cor do card: vira a folga de 2px entre as fatias.
    stroke: { width: 2, colors: [cores.superficie] },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', color: cores.textoSuave, offsetY: 20 },
            value: {
              show: true,
              fontSize: '34px',
              fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
              color: cores.texto,
              offsetY: -16,
              formatter: (valor: string) => valor,
            },
            total: {
              show: true,
              showAlways: true,
              label: dados.rotuloTotal,
              fontSize: '12px',
              color: cores.textoSuave,
              formatter: () => String(somar(dados.valores)),
            },
          },
        },
      },
    },
    states: { hover: { filter: { type: 'none' } } },
    tooltip: {
      theme: tema,
      y: { formatter: (valor: number) => valor + ' ' + dados.unidadeTooltip },
    },
  };
}

interface DadosBarras {
  rotulos: string[];
  valores: number[];
  cores: string[];
  nomeSerie: string;
}

// Barras horizontais: incidentes por severidade (escala ordenada, uma cor por degrau).
export function montarOpcoesBarras(tema: TemaVisual, dados: DadosBarras): ApexOptions {
  const cores = PALETAS[tema];
  return {
    chart: {
      type: 'bar',
      height: 220,
      fontFamily: FONTE,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: animacaoLigada(), speed: 700 },
    },
    series: [{ name: dados.nomeSerie, data: dados.valores }],
    colors: dados.cores,
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        barHeight: '48%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
      },
    },
    stroke: { width: 0 },
    legend: { show: false },
    dataLabels: {
      enabled: true,
      textAnchor: 'start',
      offsetX: 8,
      style: { colors: dados.cores.map((cor) => corDoTexto(cor)), fontSize: '13px', fontWeight: 600 },
      background: { enabled: false },
    },
    grid: {
      borderColor: cores.grade,
      strokeDashArray: 0,
      yaxis: { lines: { show: false } },
      padding: { right: 24 },
    },
    xaxis: {
      categories: dados.rotulos,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: { labels: { style: { colors: cores.textoSuave, fontSize: '13px' } } },
    tooltip: { theme: tema, y: { formatter: (valor: number) => String(valor) } },
  };
}

function somar(valores: number[]): number {
  let soma = 0;
  for (const valor of valores) {
    soma = soma + valor;
  }
  return soma;
}

// Escolhe texto escuro ou claro conforme o brilho da barra, para manter o contraste.
function corDoTexto(hex: string): string {
  const vermelho = parseInt(hex.slice(1, 3), 16);
  const verde = parseInt(hex.slice(3, 5), 16);
  const azul = parseInt(hex.slice(5, 7), 16);
  const brilho = (vermelho * 299 + verde * 587 + azul * 114) / 1000;
  if (brilho > 140) {
    return '#0e0e11';
  }
  return '#ffffff';
}
