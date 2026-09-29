import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AnalyticsFrotaComponent } from './pages/analytics-frota/analytics-frota.component';
import { AnalyticsIncidentesComponent } from './pages/analytics-incidentes/analytics-incidentes.component';
import { AnalyticsMotoristaComponent } from './pages/analytics-motorista/analytics-motorista.component';
import { AnalyticsVeiculoComponent } from './pages/analytics-veiculo/analytics-veiculo.component';

// A permission ANALYTICS_VIEW já é exigida na rota /analytics (app-routing). Não existe /analytics/costs.
// "vehicles" e "drivers" sem id mostram só o seletor; com id mostram os números.
const rotas: Routes = [
  { path: '', redirectTo: 'fleet', pathMatch: 'full' },
  { path: 'fleet', component: AnalyticsFrotaComponent, data: { titulo: 'PAGINAS.ANALISE_FROTA' } },
  { path: 'vehicles', component: AnalyticsVeiculoComponent, data: { titulo: 'PAGINAS.ANALISE_VEICULO' } },
  { path: 'vehicles/:id', component: AnalyticsVeiculoComponent, data: { titulo: 'PAGINAS.ANALISE_VEICULO' } },
  { path: 'drivers', component: AnalyticsMotoristaComponent, data: { titulo: 'PAGINAS.ANALISE_MOTORISTA' } },
  { path: 'drivers/:id', component: AnalyticsMotoristaComponent, data: { titulo: 'PAGINAS.ANALISE_MOTORISTA' } },
  { path: 'incidents', component: AnalyticsIncidentesComponent, data: { titulo: 'PAGINAS.ANALISE_INCIDENTES' } },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class AnalyticsRoutingModule {}
