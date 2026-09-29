import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { ModalFinalizarViagemComponent } from './components/modal-finalizar-viagem/modal-finalizar-viagem.component';
import { ViagemDetalheComponent } from './pages/viagem-detalhe/viagem-detalhe.component';
import { ViagemFormComponent } from './pages/viagem-form/viagem-form.component';
import { ViagensListaComponent } from './pages/viagens-lista/viagens-lista.component';
import { TripsRoutingModule } from './trips-routing.module';

// Viagens: lista, nova viagem e detalhes com as ações por status.
@NgModule({
  declarations: [
    ViagensListaComponent,
    ViagemFormComponent,
    ViagemDetalheComponent,
    ModalFinalizarViagemComponent,
  ],
  imports: [DadosModule, TripsRoutingModule],
})
export class TripsModule {}
