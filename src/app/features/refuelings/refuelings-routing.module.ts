import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PermissaoGuard } from '../../core/guards/permissao.guard';
import { AbastecimentoDetalheComponent } from './pages/abastecimento-detalhe/abastecimento-detalhe.component';
import { AbastecimentoFormComponent } from './pages/abastecimento-form/abastecimento-form.component';
import { AbastecimentosListaComponent } from './pages/abastecimentos-lista/abastecimentos-lista.component';

// Quem só vê os próprios abastecimentos (regra OWN) é decidido pela API.
const rotas: Routes = [
  { path: '', component: AbastecimentosListaComponent, data: { titulo: 'PAGINAS.ABASTECIMENTOS' } },
  {
    path: 'new',
    component: AbastecimentoFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.ABASTECIMENTOS_NOVO', algumaPermissao: ['REFUELING_CREATE'] },
  },
  {
    path: ':id',
    component: AbastecimentoDetalheComponent,
    data: { titulo: 'PAGINAS.ABASTECIMENTOS_DETALHE' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class RefuelingsRoutingModule {}
