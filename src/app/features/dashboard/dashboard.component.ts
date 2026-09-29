import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ApexOptions } from 'apexcharts';
import { combineLatest, Observable, Subject, takeUntil } from 'rxjs';

import { Severity, Trip, TripStatus, VehicleStatus } from '../../core/models';
import { TemaVisual, ThemeService } from '../../core/services/theme.service';
import {
  ConsumoFrota,
  ContagemStatusVeiculo,
  EstadoBloco,
  IncidentesPorSeveridade,
  KmPorDia,
  SituacaoBloco,
} from './dashboard.model';
import { DashboardStateService } from './services/dashboard-state.service';
import { agregarPorMes, preencherLacunas } from './utils/datas-dashboard';
import {
  montarOpcoesBarras,
  montarOpcoesDonut,
  montarOpcoesKm,
  ORDEM_SEVERIDADE,
  ORDEM_STATUS_DONUT,
  PALETAS,
} from './utils/graficos-apex';

// Uma linha de legenda/tabela dos gráficos: sempre com ícone e texto, nunca só cor.
export interface ItemLegenda {
  chave: string;
  rotulo: string;
  total: number;
  cor: string;
  icone: string;
}

export interface GraficoKm {
  situacao: SituacaoBloco;
  vazio: boolean;
  opcoes: ApexOptions;
  linhas: { rotulo: string; km: number }[];
  resumo: string;
}

export interface GraficoComItens {
  situacao: SituacaoBloco;
  vazio: boolean;
  opcoes: ApexOptions;
  itens: ItemLegenda[];
  total: number;
  resumo: string;
}

const ICONE_STATUS_VEICULO: Record<VehicleStatus, string> = {
  [VehicleStatus.AVAILABLE]: 'ok',
  [VehicleStatus.IN_USE]: 'viagens',
  [VehicleStatus.IN_MAINTENANCE]: 'manutencao',
  [VehicleStatus.OUT_OF_SERVICE]: 'proibido',
};

const ICONE_SEVERIDADE: Record<Severity, string> = {
  [Severity.LOW]: 'info',
  [Severity.MEDIUM]: 'incidentes',
  [Severity.HIGH]: 'octogono',
};

const ICONE_STATUS_VIAGEM: Record<TripStatus, string> = {
  [TripStatus.PLANNED]: 'calendario',
  [TripStatus.IN_PROGRESS]: 'viagens',
  [TripStatus.COMPLETED]: 'ok',
  [TripStatus.CANCELLED]: 'proibido',
};

function graficoVazio(situacao: SituacaoBloco): GraficoComItens {
  return { situacao, vazio: false, opcoes: {}, itens: [], total: 0, resumo: '' };
}

// Tela do dashboard: KPIs por permission, três gráficos (gestão) e a tabela de últimas viagens.
@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  providers: [DashboardStateService],
})
export class DashboardComponent implements OnInit, OnDestroy {
  ehMotorista = false;
  ehGestao = false;
  verUsuarios = false;
  verSaude = false;
  verTabela = false;
  atualizadoEm: Date | null = null;

  viagensMes: EstadoBloco<{ total: number; km: number; parcial: boolean }> = this.blocoInicial();
  incidentesMes: EstadoBloco<{ total: number; parcial: boolean }> = this.blocoInicial();
  proximaManutencao: EstadoBloco<{
    semViagemAtiva: boolean;
    dataAgendada: string | null;
    descricao: string | null;
  }> = this.blocoInicial();
  frotaStatus: EstadoBloco<ContagemStatusVeiculo[]> = this.blocoInicial();
  consumoTotal: EstadoBloco<ConsumoFrota> = this.blocoInicial();
  viagensAtivas: EstadoBloco<number> = this.blocoInicial();
  usuariosAtivos: EstadoBloco<{ ativos: number; total: number; parcial: boolean }> =
    this.blocoInicial();
  saudeSistema: EstadoBloco<{ operacional: boolean; tempoBancoMs: number | null }> =
    this.blocoInicial();
  ultimasViagens: EstadoBloco<Trip[]> = this.blocoInicial();

  graficoKm: GraficoKm = { situacao: 'carregando', vazio: false, opcoes: {}, linhas: [], resumo: '' };
  graficoStatus: GraficoComItens = graficoVazio('carregando');
  graficoSeveridade: GraficoComItens = graficoVazio('carregando');

  private destruir$ = new Subject<void>();

  constructor(
    public estado: DashboardStateService,
    private temaService: ThemeService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.ehMotorista = this.estado.ehMotorista;
    this.ehGestao = this.estado.ehGestao;
    this.verUsuarios = this.estado.verUsuarios;
    this.verSaude = this.estado.verSaude;

    this.ouvirBlocos();
    this.ouvirGraficos();
    this.estado.carregarTudo();
  }

  ngOnDestroy(): void {
    this.destruir$.next();
    this.destruir$.complete();
  }

  atualizarPainel(): void {
    this.estado.carregarTudo();
  }

  alternarTabela(): void {
    this.verTabela = !this.verTabela;
  }

  tentarNovamente(nome: string): void {
    this.estado.carregar(nome);
  }

  // ---------- Textos formatados usados no HTML ----------

  formatarNumero(valor: number, casas: number): string {
    const formatador = new Intl.NumberFormat(this.idioma(), {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
    return formatador.format(valor);
  }

  formatarData(dataIso: string): string {
    const formatador = new Intl.DateTimeFormat(this.idioma(), { day: '2-digit', month: 'short' });
    return formatador.format(new Date(dataIso));
  }

  formatarDataHora(dataIso: string): string {
    const formatador = new Intl.DateTimeFormat(this.idioma(), {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return formatador.format(new Date(dataIso));
  }

  formatarHora(data: Date): string {
    const formatador = new Intl.DateTimeFormat(this.idioma(), { hour: '2-digit', minute: '2-digit' });
    return formatador.format(data);
  }

  // Km rodados de uma viagem; vazio enquanto ela não terminou.
  kmDaViagem(viagem: Trip): string {
    if (viagem.endKm === null) {
      return '—';
    }
    return this.formatarNumero(viagem.endKm - viagem.startKm, 0);
  }

  iconeDaViagem(status: TripStatus): string {
    return ICONE_STATUS_VIAGEM[status];
  }

  totalDaFrota(): number {
    let soma = 0;
    for (const item of this.graficoStatus.itens) {
      soma = soma + item.total;
    }
    return soma;
  }

  // Mês e ano de hoje, ex: setembro de 2026.
  mesAtualTexto(): string {
    const formatador = new Intl.DateTimeFormat(this.idioma(), { month: 'long', year: 'numeric' });
    return formatador.format(new Date());
  }

  subtituloTabelaViagens(): string {
    if (this.ehMotorista) {
      return this.traducao.instant('DASHBOARD.TABELA.SUBTITULO_MOTORISTA');
    }
    return this.traducao.instant('DASHBOARD.TABELA.SUBTITULO_GESTAO');
  }

  // ---------- Dicas e valores de texto dos KPIs ----------

  dicaViagensMes(): string {
    const dados = this.viagensMes.dados;
    if (dados === null) {
      return '';
    }
    if (dados.total === 0) {
      return this.traducao.instant('DASHBOARD.KPI.VIAGENS_MES.VAZIO');
    }
    if (dados.parcial) {
      return this.traducao.instant('DASHBOARD.KPI.PARCIAL');
    }
    return '';
  }

  dicaKmMes(): string {
    const dados = this.viagensMes.dados;
    if (dados === null) {
      return '';
    }
    if (dados.km === 0) {
      return this.traducao.instant('DASHBOARD.KPI.KM_MES.VAZIO');
    }
    if (dados.parcial) {
      return this.traducao.instant('DASHBOARD.KPI.PARCIAL');
    }
    return this.traducao.instant('DASHBOARD.KPI.KM_MES.DICA');
  }

  dicaIncidentesMes(): string {
    const dados = this.incidentesMes.dados;
    if (dados === null) {
      return '';
    }
    if (dados.total === 0) {
      return this.traducao.instant('DASHBOARD.KPI.INCIDENTES_MES.VAZIO');
    }
    if (dados.parcial) {
      return this.traducao.instant('DASHBOARD.KPI.PARCIAL');
    }
    return '';
  }

  valorProximaManutencao(): string {
    const dados = this.proximaManutencao.dados;
    if (dados === null || dados.dataAgendada === null) {
      return '—';
    }
    return this.formatarData(dados.dataAgendada);
  }

  dicaProximaManutencao(): string {
    const dados = this.proximaManutencao.dados;
    if (dados === null) {
      return '';
    }
    if (dados.semViagemAtiva) {
      return this.traducao.instant('DASHBOARD.KPI.PROXIMA_MANUTENCAO.SEM_VIAGEM');
    }
    if (dados.dataAgendada === null) {
      return this.traducao.instant('DASHBOARD.KPI.PROXIMA_MANUTENCAO.NENHUMA');
    }
    return dados.descricao ?? '';
  }

  dicaConsumo(): string {
    const dados = this.consumoTotal.dados;
    if (dados === null) {
      return '';
    }
    return this.traducao.instant('DASHBOARD.KPI.CONSUMO_TOTAL.DICA', {
      media: this.formatarNumero(dados.averageLitersPerKm, 3),
    });
  }

  dicaViagensAtivas(): string {
    if (this.viagensAtivas.dados === 0) {
      return this.traducao.instant('DASHBOARD.KPI.VIAGENS_ATIVAS.VAZIO');
    }
    return '';
  }

  dicaUsuarios(): string {
    const dados = this.usuariosAtivos.dados;
    if (dados === null) {
      return '';
    }
    return this.traducao.instant('DASHBOARD.KPI.USUARIOS_ATIVOS.DICA', { total: dados.total });
  }

  valorSaude(): string {
    const dados = this.saudeSistema.dados;
    if (dados === null) {
      return '';
    }
    if (dados.operacional) {
      return this.traducao.instant('DASHBOARD.KPI.SAUDE_SISTEMA.OPERACIONAL');
    }
    return this.traducao.instant('DASHBOARD.KPI.SAUDE_SISTEMA.INSTAVEL');
  }

  dicaSaude(): string {
    const dados = this.saudeSistema.dados;
    if (dados === null || dados.tempoBancoMs === null) {
      return '';
    }
    return this.traducao.instant('DASHBOARD.KPI.SAUDE_SISTEMA.DICA', { ms: dados.tempoBancoMs });
  }

  // ---------- Assinaturas ----------

  private ouvirBlocos(): void {
    this.ouvir(this.estado.viagensMes$, (bloco) => (this.viagensMes = bloco));
    this.ouvir(this.estado.incidentesMes$, (bloco) => (this.incidentesMes = bloco));
    this.ouvir(this.estado.proximaManutencao$, (bloco) => (this.proximaManutencao = bloco));
    this.ouvir(this.estado.consumoTotal$, (bloco) => (this.consumoTotal = bloco));
    this.ouvir(this.estado.viagensAtivas$, (bloco) => (this.viagensAtivas = bloco));
    this.ouvir(this.estado.usuariosAtivos$, (bloco) => (this.usuariosAtivos = bloco));
    this.ouvir(this.estado.saudeSistema$, (bloco) => (this.saudeSistema = bloco));
    this.ouvir(this.estado.ultimasViagens$, (bloco) => (this.ultimasViagens = bloco));
    this.ouvir(this.estado.atualizadoEm$, (data) => (this.atualizadoEm = data));
  }

  // O app não usa zone.js: depois de guardar o valor, avisamos o Angular para redesenhar a tela.
  private ouvir<T>(origem: Observable<T>, guardar: (valor: T) => void): void {
    origem.pipe(takeUntil(this.destruir$)).subscribe((valor) => {
      guardar(valor);
      this.detector.markForCheck();
    });
  }

  // Os gráficos são refeitos quando chegam dados, quando o tema muda e quando os textos carregam.
  private ouvirGraficos(): void {
    const textosProntos$ = this.traducao.stream('DASHBOARD.ESTADO.CARREGANDO');

    combineLatest([this.estado.kmPorDia$, this.temaService.tema$, textosProntos$])
      .pipe(takeUntil(this.destruir$))
      .subscribe(([bloco, tema]) => {
        this.montarGraficoKm(bloco, tema);
        this.detector.markForCheck();
      });

    combineLatest([this.estado.frotaStatus$, this.temaService.tema$, textosProntos$])
      .pipe(takeUntil(this.destruir$))
      .subscribe(([bloco, tema]) => {
        this.montarGraficoStatus(bloco, tema);
        this.detector.markForCheck();
      });

    combineLatest([this.estado.severidade$, this.temaService.tema$, textosProntos$])
      .pipe(takeUntil(this.destruir$))
      .subscribe(([bloco, tema]) => {
        this.montarGraficoSeveridade(bloco, tema);
        this.detector.markForCheck();
      });
  }

  private montarGraficoKm(bloco: EstadoBloco<KmPorDia[]>, tema: TemaVisual): void {
    const resultado: GraficoKm = {
      situacao: bloco.situacao,
      vazio: false,
      opcoes: {},
      linhas: [],
      resumo: '',
    };
    if (bloco.situacao === 'pronto' && bloco.dados) {
      if (bloco.dados.length === 0) {
        resultado.vazio = true;
      } else {
        const porMes = preencherLacunas(agregarPorMes(bloco.dados));
        const partesDoResumo: string[] = [];
        for (const mes of porMes) {
          const rotulo = this.rotuloDoMes(mes.mes);
          resultado.linhas.push({ rotulo, km: mes.totalKm });
          partesDoResumo.push(rotulo + ': ' + this.formatarNumero(mes.totalKm, 0) + ' km');
        }
        const rotulos: string[] = [];
        const valores: number[] = [];
        for (const linha of resultado.linhas) {
          rotulos.push(linha.rotulo);
          valores.push(linha.km);
        }
        resultado.opcoes = montarOpcoesKm(tema, {
          rotulos,
          valores,
          nomeSerie: this.traducao.instant('DASHBOARD.GRAFICOS.KM_MENSAL.SERIE'),
          unidade: 'km',
          formatar: (valor: number) => this.formatarNumero(valor, 0),
        });
        resultado.resumo = this.traducao.instant('DASHBOARD.GRAFICOS.KM_MENSAL.RESUMO', {
          lista: partesDoResumo.join('; '),
        });
      }
    }
    this.graficoKm = resultado;
  }

  private montarGraficoStatus(bloco: EstadoBloco<ContagemStatusVeiculo[]>, tema: TemaVisual): void {
    const resultado = graficoVazio(bloco.situacao);
    if (bloco.situacao === 'pronto' && bloco.dados) {
      const cores = PALETAS[tema].statusVeiculo;
      for (const status of ORDEM_STATUS_DONUT) {
        let total = 0;
        for (const contagem of bloco.dados) {
          if (contagem.status === status) {
            total = contagem.total;
          }
        }
        resultado.itens.push({
          chave: status,
          rotulo: this.traducao.instant('STATUS_VEICULO.' + status),
          total,
          cor: cores[status],
          icone: ICONE_STATUS_VEICULO[status],
        });
        resultado.total = resultado.total + total;
      }
      if (resultado.total === 0) {
        resultado.vazio = true;
      } else {
        resultado.opcoes = montarOpcoesDonut(tema, {
          rotulos: resultado.itens.map((item) => item.rotulo),
          valores: resultado.itens.map((item) => item.total),
          cores: resultado.itens.map((item) => item.cor),
          rotuloTotal: this.traducao.instant('DASHBOARD.GRAFICOS.STATUS.TOTAL'),
          unidadeTooltip: this.traducao.instant('DASHBOARD.GRAFICOS.STATUS.UNIDADE'),
        });
        resultado.resumo = this.traducao.instant('DASHBOARD.GRAFICOS.STATUS.RESUMO', {
          lista: this.listarItens(resultado.itens),
        });
      }
    }
    this.graficoStatus = resultado;
  }

  private montarGraficoSeveridade(
    bloco: EstadoBloco<IncidentesPorSeveridade[]>,
    tema: TemaVisual,
  ): void {
    const resultado = graficoVazio(bloco.situacao);
    if (bloco.situacao === 'pronto' && bloco.dados) {
      const cores = PALETAS[tema].severidade;
      for (const severidade of ORDEM_SEVERIDADE) {
        let total = 0;
        for (const grupo of bloco.dados) {
          if (grupo.severity === severidade) {
            total = grupo.count;
          }
        }
        resultado.itens.push({
          chave: severidade,
          rotulo: this.traducao.instant('SEVERIDADE.' + severidade),
          total,
          cor: cores[severidade],
          icone: ICONE_SEVERIDADE[severidade],
        });
        resultado.total = resultado.total + total;
      }
      if (resultado.total === 0) {
        resultado.vazio = true;
      } else {
        resultado.opcoes = montarOpcoesBarras(tema, {
          rotulos: resultado.itens.map((item) => item.rotulo),
          valores: resultado.itens.map((item) => item.total),
          cores: resultado.itens.map((item) => item.cor),
          nomeSerie: this.traducao.instant('DASHBOARD.GRAFICOS.SEVERIDADE.SERIE'),
        });
        resultado.resumo = this.traducao.instant('DASHBOARD.GRAFICOS.SEVERIDADE.RESUMO', {
          lista: this.listarItens(resultado.itens),
        });
      }
    }
    this.graficoSeveridade = resultado;
  }

  // "Em uso: 3; Disponível: 5" — vira o texto lido por leitor de tela.
  private listarItens(itens: ItemLegenda[]): string {
    const partes: string[] = [];
    for (const item of itens) {
      partes.push(item.rotulo + ': ' + item.total);
    }
    return partes.join('; ');
  }

  // Ex: "2026-09" -> "set/26".
  private rotuloDoMes(chave: string): string {
    const ano = Number(chave.slice(0, 4));
    const mes = Number(chave.slice(5, 7));
    const data = new Date(ano, mes - 1, 1);
    const nomeDoMes = new Intl.DateTimeFormat(this.idioma(), { month: 'short' })
      .format(data)
      .replace('.', '');
    return nomeDoMes + '/' + String(ano).slice(2);
  }

  private idioma(): string {
    return this.traducao.getCurrentLang() || 'pt-BR';
  }

  private blocoInicial<T>(): EstadoBloco<T> {
    return { situacao: 'carregando', dados: null };
  }
}
