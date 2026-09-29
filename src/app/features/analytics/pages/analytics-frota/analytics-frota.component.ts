import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ApexOptions } from 'apexcharts';
import { Subscription } from 'rxjs';

import { TemaVisual, ThemeService } from '../../../../core/services/theme.service';
import { ConsumoFrota, KmPorDia, SituacaoBloco } from '../../../dashboard/dashboard.model';
import { agregarPorMes, preencherLacunas } from '../../../dashboard/utils/datas-dashboard';
import { montarOpcoesKm } from '../../../dashboard/utils/graficos-apex';
import { LinhaKmMensal } from '../../analytics.model';
import { AnalyticsService } from '../../services/analytics.service';
import { formatarNumeroNoIdioma, rotuloDoMes, situacaoDoErro } from '../../utils/analytics-util';

// Análise da frota: consumo agregado (litros por km) e km percorridos por mês (últimos 90 dias).
@Component({
  selector: 'app-analytics-frota',
  standalone: false,
  templateUrl: './analytics-frota.component.html',
  styleUrl: './analytics-frota.component.scss',
})
export class AnalyticsFrotaComponent implements OnInit, OnDestroy {
  situacaoConsumo: SituacaoBloco = 'carregando';
  consumo: ConsumoFrota | null = null;

  situacaoKm: SituacaoBloco = 'carregando';
  kmPorDia: KmPorDia[] = [];
  linhasKm: LinhaKmMensal[] = [];
  opcoesKm: ApexOptions = {};
  resumoKm = '';
  consumoVazio = false;
  kmVazio = false;

  verTabela = false;
  atualizadoEm: Date | null = null;

  private tema: TemaVisual = 'light';
  private assinaturas: Subscription[] = [];

  constructor(
    private analytics: AnalyticsService,
    private temaService: ThemeService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // O gráfico é refeito quando o tema muda (as cores dos dois temas foram validadas).
    this.assinaturas.push(
      this.temaService.tema$.subscribe((tema) => {
        this.tema = tema;
        this.montarGraficoKm();
        this.detector.markForCheck();
      }),
    );
    this.assinaturas.push(this.traducao.onLangChange.subscribe(() => this.montarGraficoKm()));
    this.carregarTudo(false);
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  // "Atualizar" ignora o cache; o back-end aceita 20 chamadas por minuto em cada rota.
  atualizar(): void {
    this.carregarTudo(true);
  }

  carregarConsumo(forcar: boolean): void {
    this.situacaoConsumo = 'carregando';
    this.analytics.consumoDaFrota(forcar).subscribe({
      next: (dados) => {
        this.consumo = dados;
        this.consumoVazio = dados.totalKm === 0 && dados.totalLiters === 0;
        this.situacaoConsumo = 'pronto';
        this.marcarHora();
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.situacaoConsumo = situacaoDoErro(erro);
        this.detector.markForCheck();
      },
    });
  }

  carregarKm(forcar: boolean): void {
    this.situacaoKm = 'carregando';
    this.analytics.kmPorDia(forcar).subscribe({
      next: (dados) => {
        this.kmPorDia = dados;
        this.situacaoKm = 'pronto';
        this.montarGraficoKm();
        this.marcarHora();
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.situacaoKm = situacaoDoErro(erro);
        this.detector.markForCheck();
      },
    });
  }

  private carregarTudo(forcar: boolean): void {
    this.carregarConsumo(forcar);
    this.carregarKm(forcar);
  }

  private marcarHora(): void {
    this.atualizadoEm = new Date();
  }

  alternarTabela(): void {
    this.verTabela = !this.verTabela;
  }

  // Soma os dias em meses pela chave AAAA-MM do texto (sem fuso), como manda a spec.
  private montarGraficoKm(): void {
    this.linhasKm = [];
    this.kmVazio = false;
    this.resumoKm = '';
    if (this.situacaoKm !== 'pronto') {
      return;
    }
    if (this.kmPorDia.length === 0) {
      this.kmVazio = true;
      return;
    }
    const porMes = preencherLacunas(agregarPorMes(this.kmPorDia));
    const partes: string[] = [];
    const rotulos: string[] = [];
    const valores: number[] = [];
    for (const mes of porMes) {
      const rotulo = rotuloDoMes(mes.mes, this.idioma());
      this.linhasKm.push({ rotulo: rotulo, km: mes.totalKm });
      rotulos.push(rotulo);
      valores.push(mes.totalKm);
      partes.push(rotulo + ': ' + this.formatar(mes.totalKm, 0) + ' km');
    }
    this.opcoesKm = montarOpcoesKm(this.tema, {
      rotulos: rotulos,
      valores: valores,
      nomeSerie: this.traducao.instant('DASHBOARD.GRAFICOS.KM_MENSAL.SERIE'),
      unidade: 'km',
      formatar: (valor: number) => this.formatar(valor, 0),
    });
    this.resumoKm = this.traducao.instant('DASHBOARD.GRAFICOS.KM_MENSAL.RESUMO', {
      lista: partes.join('; '),
    });
  }

  // ---------- Textos usados no HTML ----------

  formatar(valor: number, casas: number): string {
    return formatarNumeroNoIdioma(valor, casas, this.idioma());
  }

  formatarHora(data: Date): string {
    const formatador = new Intl.DateTimeFormat(this.idioma(), { hour: '2-digit', minute: '2-digit' });
    return formatador.format(data);
  }

  private idioma(): string {
    return this.traducao.getCurrentLang() || 'pt-BR';
  }
}
