import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { IncidentsRoutingModule } from './incidents-routing.module';
import { IncidenteDetalheComponent } from './pages/incidente-detalhe/incidente-detalhe.component';
import { IncidenteFormComponent } from './pages/incidente-form/incidente-form.component';
import { IncidentesListaComponent } from './pages/incidentes-lista/incidentes-lista.component';

// Incidentes: lista, registrar (com foto) e detalhes (com mudança de status).
@NgModule({
  declarations: [IncidentesListaComponent, IncidenteFormComponent, IncidenteDetalheComponent],
  imports: [DadosModule, IncidentsRoutingModule],
})
export class IncidentsModule {}
