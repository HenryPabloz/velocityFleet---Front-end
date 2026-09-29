import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PermissaoGuard } from '../../core/guards/permissao.guard';
import { ManutencaoDetalheComponent } from './pages/manutencao-detalhe/manutencao-detalhe.component';
import { ManutencaoFormComponent } from './pages/manutencao-form/manutencao-form.component';
import { ManutencoesListaComponent } from './pages/manutencoes-lista/manutencoes-lista.component';

// O módulo todo exige MAINTENANCE_VIEW_ALL (no app-routing): motorista não tem acesso.
const rotas: Routes = [
  { path: '', component: ManutencoesListaComponent, data: { titulo: 'PAGINAS.MANUTENCOES' } },
  {
    path: 'new',
    component: ManutencaoFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.MANUTENCOES_NOVA', algumaPermissao: ['MAINTENANCE_CREATE'] },
  },
  {
    path: ':id',
    component: ManutencaoDetalheComponent,
    data: { titulo: 'PAGINAS.MANUTENCOES_DETALHE' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class MaintenanceRoutingModule {}
