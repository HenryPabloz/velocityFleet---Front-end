import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent } from './dashboard.component';

const rotas: Routes = [
  { path: '', component: DashboardComponent, data: { titulo: 'PAGINAS.DASHBOARD' } },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
