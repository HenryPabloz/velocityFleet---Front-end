import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { AbastecimentoDetalheComponent } from './pages/abastecimento-detalhe/abastecimento-detalhe.component';
import { AbastecimentoFormComponent } from './pages/abastecimento-form/abastecimento-form.component';
import { AbastecimentosListaComponent } from './pages/abastecimentos-lista/abastecimentos-lista.component';
import { RefuelingsRoutingModule } from './refuelings-routing.module';

// Abastecimentos: lista, registrar e detalhes.
@NgModule({
  declarations: [
    AbastecimentosListaComponent,
    AbastecimentoFormComponent,
    AbastecimentoDetalheComponent,
  ],
  imports: [DadosModule, RefuelingsRoutingModule],
})
export class RefuelingsModule {}
