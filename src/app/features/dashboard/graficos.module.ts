import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared/shared.module';
import { CartaoGraficoComponent } from './components/cartao-grafico/cartao-grafico.component';
import { EstadoBlocoComponent } from './components/estado-bloco/estado-bloco.component';
import { GraficoApexComponent } from './components/grafico-apex/grafico-apex.component';
import { KpiCardComponent } from './components/kpi-card/kpi-card.component';
import { ContadorDirective } from './directives/contador.directive';

// Peças de gráfico e KPI usadas pelo Dashboard e pelo Analytics. O ApexCharts só entra
// nos módulos lazy que importam este módulo (nunca no bundle inicial).
@NgModule({
  declarations: [CartaoGraficoComponent, EstadoBlocoComponent, KpiCardComponent, ContadorDirective],
  imports: [SharedModule, GraficoApexComponent],
  exports: [
    SharedModule,
    CartaoGraficoComponent,
    EstadoBlocoComponent,
    KpiCardComponent,
    ContadorDirective,
    GraficoApexComponent,
  ],
})
export class GraficosModule {}
