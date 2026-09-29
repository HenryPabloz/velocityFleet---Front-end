import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PermissaoGuard } from '../../core/guards/permissao.guard';
import { ViagemDetalheComponent } from './pages/viagem-detalhe/viagem-detalhe.component';
import { ViagemFormComponent } from './pages/viagem-form/viagem-form.component';
import { ViagensListaComponent } from './pages/viagens-lista/viagens-lista.component';

// Viagens são liberadas aos 3 papéis; quem só vê as próprias viagens é decidido pela API (regra OWN).
const rotas: Routes = [
  { path: '', component: ViagensListaComponent, data: { titulo: 'PAGINAS.VIAGENS' } },
  {
    path: 'new',
    component: ViagemFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.VIAGENS_NOVA', algumaPermissao: ['TRIP_CREATE'] },
  },
  { path: ':id', component: ViagemDetalheComponent, data: { titulo: 'PAGINAS.VIAGENS_DETALHE' } },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class TripsRoutingModule {}
