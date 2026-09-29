import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { MaintenanceRoutingModule } from './maintenance-routing.module';
import { ManutencaoDetalheComponent } from './pages/manutencao-detalhe/manutencao-detalhe.component';
import { ManutencaoFormComponent } from './pages/manutencao-form/manutencao-form.component';
import { ManutencoesListaComponent } from './pages/manutencoes-lista/manutencoes-lista.component';

// Manutenção: lista, agendar e detalhes (com "Concluir").
@NgModule({
  declarations: [ManutencoesListaComponent, ManutencaoFormComponent, ManutencaoDetalheComponent],
  imports: [DadosModule, MaintenanceRoutingModule],
})
export class MaintenanceModule {}
