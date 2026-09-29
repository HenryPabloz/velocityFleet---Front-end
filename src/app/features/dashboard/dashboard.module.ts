import { NgModule } from '@angular/core';

import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { GraficosModule } from './graficos.module';

// O ApexCharts só é baixado junto com este módulo (lazy), não no início do app.
@NgModule({
  declarations: [DashboardComponent],
  imports: [GraficosModule, DashboardRoutingModule],
})
export class DashboardModule {}
