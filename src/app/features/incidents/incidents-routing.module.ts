import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PermissaoGuard } from '../../core/guards/permissao.guard';
import { IncidenteDetalheComponent } from './pages/incidente-detalhe/incidente-detalhe.component';
import { IncidenteFormComponent } from './pages/incidente-form/incidente-form.component';
import { IncidentesListaComponent } from './pages/incidentes-lista/incidentes-lista.component';

// Quem só vê os próprios incidentes (regra OWN) é decidido pela API.
const rotas: Routes = [
  { path: '', component: IncidentesListaComponent, data: { titulo: 'PAGINAS.INCIDENTES' } },
  {
    path: 'new',
    component: IncidenteFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.INCIDENTES_NOVO', algumaPermissao: ['INCIDENT_CREATE'] },
  },
  {
    path: ':id',
    component: IncidenteDetalheComponent,
    data: { titulo: 'PAGINAS.INCIDENTES_DETALHE' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class IncidentsRoutingModule {}
