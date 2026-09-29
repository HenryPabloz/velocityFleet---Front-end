import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { GraficosModule } from '../dashboard/graficos.module';
import { AnalyticsRoutingModule } from './analytics-routing.module';
import { AbasAnalyticsComponent } from './components/abas-analytics/abas-analytics.component';
import { BlocoGraficoItensComponent } from './components/bloco-grafico-itens/bloco-grafico-itens.component';
import { AnalyticsFrotaComponent } from './pages/analytics-frota/analytics-frota.component';
import { AnalyticsIncidentesComponent } from './pages/analytics-incidentes/analytics-incidentes.component';
import { AnalyticsMotoristaComponent } from './pages/analytics-motorista/analytics-motorista.component';
import { AnalyticsVeiculoComponent } from './pages/analytics-veiculo/analytics-veiculo.component';

// Analytics: frota, veículo, motorista e incidentes. O ApexCharts só vem junto com este módulo (lazy).
@NgModule({
  declarations: [
    AbasAnalyticsComponent,
    BlocoGraficoItensComponent,
    AnalyticsFrotaComponent,
    AnalyticsVeiculoComponent,
    AnalyticsMotoristaComponent,
    AnalyticsIncidentesComponent,
  ],
  imports: [DadosModule, GraficosModule, AnalyticsRoutingModule],
})
export class AnalyticsModule {}
