import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import type { ApexOptions } from 'apexcharts';
import { Subscription } from 'rxjs';

import { Driver, TripStatus } from '../../../../core/models';
import { TemaVisual, ThemeService } from '../../../../core/services/theme.service';
import {
  montarNomesDosMotoristas,
  ReferenciasService,
} from '../../../../shared/dados/services/referencias.service';
import { SituacaoBloco } from '../../../dashboard/dashboard.model';
import { montarOpcoesBarras, ORDEM_STATUS_VIAGEM, PALETAS } from '../../../dashboard/utils/graficos-apex';
import { EstatisticasMotorista, ItemGrafico } from '../../analytics.model';
import { AnalyticsService } from '../../services/analytics.service';
import { formatarNumeroNoIdioma, situacaoDoErro } from '../../utils/analytics-util';

const ICONE_STATUS_VIAGEM: Record<TripStatus, string> = {
  [TripStatus.PLANNED]: 'calendario',
  [TripStatus.IN_PROGRESS]: 'viagens',
  [TripStatus.COMPLETED]: 'ok',
  [TripStatus.CANCELLED]: 'proibido',
};

// Estatísticas de um motorista: viagens por status, km das concluídas e incidentes. Id na rota.
@Component({
  selector: 'app-analytics-motorista',
  standalone: false,
  templateUrl: './analytics-motorista.component.html',
  styleUrl: './analytics-motorista.component.scss',
})
export class AnalyticsMotoristaComponent implements OnInit, OnDestroy {
  situacao: SituacaoBloco = 'carregando';
  temEscolha = false;
  estatisticas: EstatisticasMotorista | null = null;

  motoristas: Driver[] = [];
  nomesMotoristas: Record<string, string> = {};
  motoristaEscolhido = '';

  itens: ItemGrafico[] = [];
  opcoes: ApexOptions = {};
  resumo = '';
  totalDeViagens = 0;
  vazio = false;
  verTabela = false;

  private tema: TemaVisual = 'light';
  private assinaturas: Subscription[] = [];
  private assinaturaDados: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private analytics: AnalyticsService,
    private referencias: ReferenciasService,
    private temaService: ThemeService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.carregarMotoristas();
    this.assinaturas.push(
      this.temaService.tema$.subscribe((tema) => {
        this.tema = tema;
        this.montarGrafico();
        this.detector.markForCheck();
      }),
    );
    this.assinaturas.push(this.traducao.onLangChange.subscribe(() => this.montarGrafico()));
    // O id vem da rota: trocar o motorista no seletor muda a rota e recarrega os números.
    this.assinaturas.push(
      this.rota.paramMap.subscribe((parametros) => {
        this.motoristaEscolhido = parametros.get('id') ?? '';
        this.carregar(false);
      }),
    );
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
    this.assinaturaDados?.unsubscribe();
  }

  // GET /drivers já traz o nome completo de cada motorista.
  private carregarMotoristas(): void {
    const assinatura = this.referencias.motoristas().subscribe((motoristas) => {
      this.motoristas = motoristas;
      this.nomesMotoristas = montarNomesDosMotoristas(motoristas);
      this.detector.markForCheck();
    });
    this.assinaturas.push(assinatura);
  }

  rotuloDoMotorista(motorista: Driver): string {
    const nome = this.nomesMotoristas[motorista.id];
    if (nome) {
      return nome + ' — CNH ' + motorista.licenseNumber;
    }
    return 'CNH ' + motorista.licenseNumber;
  }

  aoEscolherMotorista(id: string): void {
    if (id) {
      this.roteador.navigate(['/analytics/drivers', id]);
    } else {
      this.roteador.navigate(['/analytics/drivers']);
    }
  }

  carregar(forcar: boolean): void {
    this.assinaturaDados?.unsubscribe();
    this.estatisticas = null;
    this.temEscolha = this.motoristaEscolhido !== '';
    if (!this.temEscolha) {
      this.situacao = 'pronto';
      this.montarGrafico();
      this.detector.markForCheck();
      return;
    }
    this.situacao = 'carregando';
    this.assinaturaDados = this.analytics.viagensDoMotorista(this.motoristaEscolhido, forcar).subscribe({
      next: (dados) => {
        this.estatisticas = dados;
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

  atualizar(): void {
    this.carregar(true);
  }

  alternarTabela(): void {
    this.verTabela = !this.verTabela;
  }

  // Uma barra por status de viagem, sempre com a mesma cor e o mesmo ícone.
  private montarGrafico(): void {
    this.itens = [];
    this.vazio = false;
    this.totalDeViagens = 0;
    this.resumo = '';
    if (this.situacao !== 'pronto' || !this.estatisticas) {
      return;
    }
    const cores = PALETAS[this.tema].statusViagem;
    const partes: string[] = [];
    for (const status of ORDEM_STATUS_VIAGEM) {
      const total = this.estatisticas.tripsByStatus[status] ?? 0;
      const rotulo = this.traducao.instant('STATUS_VIAGEM.' + status);
      this.itens.push({
        chave: status,
        rotulo: rotulo,
        total: total,
        cor: cores[status],
        icone: ICONE_STATUS_VIAGEM[status],
      });
      this.totalDeViagens = this.totalDeViagens + total;
      partes.push(rotulo + ': ' + total);
    }
    if (this.totalDeViagens === 0) {
      this.vazio = true;
      return;
    }
    this.opcoes = montarOpcoesBarras(this.tema, {
      rotulos: this.itens.map((item) => item.rotulo),
      valores: this.itens.map((item) => item.total),
      cores: this.itens.map((item) => item.cor),
      nomeSerie: this.traducao.instant('ANALYTICS.MOTORISTA.SERIE'),
    });
    this.resumo = this.traducao.instant('ANALYTICS.MOTORISTA.RESUMO', { lista: partes.join('; ') });
  }

  // Enquanto os dados não chegam, os cards recebem null (mostram o esqueleto).
  get valorViagens(): number | null {
    if (!this.estatisticas) {
      return null;
    }
    return this.totalDeViagens;
  }

  get valorKm(): number | null {
    if (!this.estatisticas) {
      return null;
    }
    return this.estatisticas.totalKmCompleted;
  }

  get valorIncidentes(): number | null {
    if (!this.estatisticas) {
      return null;
    }
    return this.estatisticas.incidentsCount;
  }

  get nomeDoEscolhido(): string {
    for (const motorista of this.motoristas) {
      if (motorista.id === this.motoristaEscolhido) {
        return this.rotuloDoMotorista(motorista);
      }
    }
    return '';
  }

  formatar(valor: number, casas: number): string {
    return formatarNumeroNoIdioma(valor, casas, this.traducao.getCurrentLang() || 'pt-BR');
  }
}
