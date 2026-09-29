import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { Vehicle } from '../../../../core/models';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarMoeda, formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { EficienciaVeiculo } from '../../analytics.model';
import { AnalyticsService } from '../../services/analytics.service';
import { formatarNumeroNoIdioma } from '../../utils/analytics-util';

// Eficiência de um veículo: o veículo é escolhido num seletor e o id vai na rota (/analytics/vehicles/:id).
@Component({
  selector: 'app-analytics-veiculo',
  standalone: false,
  templateUrl: './analytics-veiculo.component.html',
  styleUrl: './analytics-veiculo.component.scss',
})
export class AnalyticsVeiculoComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'vazio';
  mensagemErro = '';
  eficiencia: EficienciaVeiculo | null = null;

  veiculos: Vehicle[] = [];
  veiculoEscolhido = '';
  veiculoAtual: Vehicle | null = null;

  private assinaturas: Subscription[] = [];
  private assinaturaDados: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private analytics: AnalyticsService,
    private referencias: ReferenciasService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.assinaturas.push(
      this.referencias.veiculos().subscribe((lista) => {
        this.veiculos = lista;
        this.procurarVeiculoAtual();
        this.detector.markForCheck();
      }),
    );
    // O id vem da rota: trocar o veículo no seletor muda a rota e recarrega os números.
    this.assinaturas.push(
      this.rota.paramMap.subscribe((parametros) => {
        this.veiculoEscolhido = parametros.get('id') ?? '';
        this.veiculoAtual = null;
        this.procurarVeiculoAtual();
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

  // Cabeçalho do veículo: acha na lista; se não estiver (mais de 100), busca só ele.
  private procurarVeiculoAtual(): void {
    if (!this.veiculoEscolhido) {
      return;
    }
    for (const veiculo of this.veiculos) {
      if (veiculo.id === this.veiculoEscolhido) {
        this.veiculoAtual = veiculo;
        return;
      }
    }
    if (this.veiculos.length === 0) {
      return;
    }
    this.analytics.buscarVeiculo(this.veiculoEscolhido).subscribe({
      next: (veiculo) => {
        this.veiculoAtual = veiculo;
        this.detector.markForCheck();
      },
      error: () => {
        this.veiculoAtual = null;
      },
    });
  }

  aoEscolherVeiculo(id: string): void {
    if (id) {
      this.roteador.navigate(['/analytics/vehicles', id]);
    } else {
      this.roteador.navigate(['/analytics/vehicles']);
    }
  }

  carregar(forcar: boolean): void {
    this.assinaturaDados?.unsubscribe();
    this.eficiencia = null;
    if (!this.veiculoEscolhido) {
      this.estado = 'vazio';
      this.detector.markForCheck();
      return;
    }
    this.estado = 'carregando';
    this.assinaturaDados = this.analytics.eficienciaDoVeiculo(this.veiculoEscolhido, forcar).subscribe({
      next: (dados) => {
        this.eficiencia = dados;
        this.estado = 'ok';
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  atualizar(): void {
    this.carregar(true);
  }

  rotuloDoVeiculo(veiculo: Vehicle): string {
    return formatarPlaca(veiculo.plate) + ' · ' + veiculo.model;
  }

  // ---------- Números derivados (só contas simples sobre os totais da API) ----------

  get semViagens(): boolean {
    return !!this.eficiencia && this.eficiencia.tripsCount === 0;
  }

  get kmPorLitro(): string {
    if (!this.eficiencia || this.eficiencia.totalLiters === 0) {
      return '—';
    }
    return this.formatar(this.eficiencia.totalKm / this.eficiencia.totalLiters, 2);
  }

  get custoPorKm(): string {
    if (!this.eficiencia || this.eficiencia.totalKm === 0) {
      return '—';
    }
    return formatarMoeda(this.eficiencia.totalFuelCost / this.eficiencia.totalKm);
  }

  get custoTotal(): string {
    if (!this.eficiencia) {
      return '';
    }
    return formatarMoeda(this.eficiencia.totalFuelCost);
  }

  formatar(valor: number, casas: number): string {
    return formatarNumeroNoIdioma(valor, casas, this.traducao.getCurrentLang() || 'pt-BR');
  }
}
