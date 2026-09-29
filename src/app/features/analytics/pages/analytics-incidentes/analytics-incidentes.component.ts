import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ApexOptions } from 'apexcharts';
import { Subscription } from 'rxjs';

import { IncidentStatus, Severity } from '../../../../core/models';
import { TemaVisual, ThemeService } from '../../../../core/services/theme.service';
import { IncidentesPorSeveridade, SituacaoBloco } from '../../../dashboard/dashboard.model';
import { montarOpcoesBarras, ORDEM_SEVERIDADE, PALETAS } from '../../../dashboard/utils/graficos-apex';
import { ItemGrafico } from '../../analytics.model';
import { AnalyticsService } from '../../services/analytics.service';
import { situacaoDoErro } from '../../utils/analytics-util';

const ICONE_SEVERIDADE: Record<Severity, string> = {
  [Severity.LOW]: 'info',
  [Severity.MEDIUM]: 'incidentes',
  [Severity.HIGH]: 'octogono',
};

// Incidentes por severidade, com filtro opcional de status. Cada severidade tem sempre a mesma cor e o mesmo ícone.
@Component({
  selector: 'app-analytics-incidentes',
  standalone: false,
  templateUrl: './analytics-incidentes.component.html',
  styleUrl: './analytics-incidentes.component.scss',
})
export class AnalyticsIncidentesComponent implements OnInit, OnDestroy {
  situacao: SituacaoBloco = 'carregando';
  filtroStatus: IncidentStatus | '' = '';
  statusDisponiveis = Object.values(IncidentStatus);

  dados: IncidentesPorSeveridade[] = [];
  itens: ItemGrafico[] = [];
  opcoes: ApexOptions = {};
  resumo = '';
  total = 0;
  vazio = false;
  verTabela = false;

  private tema: TemaVisual = 'light';
  private assinaturas: Subscription[] = [];
  private assinaturaDados: Subscription | null = null;

  constructor(
    private analytics: AnalyticsService,
    private temaService: ThemeService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.assinaturas.push(
      this.temaService.tema$.subscribe((tema) => {
        this.tema = tema;
        this.montarGrafico();
        this.detector.markForCheck();
      }),
    );
    this.assinaturas.push(this.traducao.onLangChange.subscribe(() => this.montarGrafico()));
    this.carregar(false);
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
    this.assinaturaDados?.unsubscribe();
  }

  carregar(forcar: boolean): void {
    this.assinaturaDados?.unsubscribe();
    this.situacao = 'carregando';
    this.assinaturaDados = this.analytics.incidentesPorSeveridade(this.filtroStatus, forcar).subscribe({
      next: (dados) => {
        this.dados = dados;
        this.situacao = 'pronto';
        this.montarGrafico();
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.situacao = situacaoDoErro(erro);
        this.detector.markForCheck();
      },
    });
  }

  mudarFiltro(): void {
    this.carregar(false);
  }

  alternarTabela(): void {
    this.verTabela = !this.verTabela;
  }

  private montarGrafico(): void {
    this.itens = [];
    this.total = 0;
    this.vazio = false;
    this.resumo = '';
    if (this.situacao !== 'pronto') {
      return;
    }
    const cores = PALETAS[this.tema].severidade;
    const partes: string[] = [];
    for (const severidade of ORDEM_SEVERIDADE) {
      let quantidade = 0;
      for (const grupo of this.dados) {
        if (grupo.severity === severidade) {
          quantidade = grupo.count;
        }
      }
      const rotulo = this.traducao.instant('SEVERIDADE.' + severidade);
      this.itens.push({
        chave: severidade,
        rotulo: rotulo,
        total: quantidade,
        cor: cores[severidade],
        icone: ICONE_SEVERIDADE[severidade],
      });
      this.total = this.total + quantidade;
      partes.push(rotulo + ': ' + quantidade);
    }
    if (this.total === 0) {
      this.vazio = true;
      return;
    }
    this.opcoes = montarOpcoesBarras(this.tema, {
      rotulos: this.itens.map((item) => item.rotulo),
      valores: this.itens.map((item) => item.total),
      cores: this.itens.map((item) => item.cor),
      nomeSerie: this.traducao.instant('DASHBOARD.GRAFICOS.SEVERIDADE.SERIE'),
    });
    this.resumo = this.traducao.instant('DASHBOARD.GRAFICOS.SEVERIDADE.RESUMO', { lista: partes.join('; ') });
  }

  get subtituloDoGrafico(): string {
    if (this.filtroStatus) {
      return this.traducao.instant('ANALYTICS.INCIDENTES.SUBTITULO_FILTRADO', {
        status: this.traducao.instant('STATUS_INCIDENTE.' + this.filtroStatus).toLowerCase(),
      });
    }
    return this.traducao.instant('ANALYTICS.INCIDENTES.SUBTITULO_TODOS');
  }
}
