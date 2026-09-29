import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PermissaoGuard } from '../../core/guards/permissao.guard';
import { MotoristaDetalheComponent } from './pages/motorista-detalhe/motorista-detalhe.component';
import { MotoristasListaComponent } from './pages/motoristas-lista/motoristas-lista.component';
import { VeiculoDetalheComponent } from './pages/veiculo-detalhe/veiculo-detalhe.component';
import { VeiculoFormComponent } from './pages/veiculo-form/veiculo-form.component';
import { VeiculosListaComponent } from './pages/veiculos-lista/veiculos-lista.component';

// Leitura de veículos é liberada aos 3 papéis. Escrita e motoristas pedem a permission da rota.
// Não existe /drivers/new: o motorista nasce junto com o usuário (POST /users).
const rotas: Routes = [
  { path: '', redirectTo: 'vehicles', pathMatch: 'full' },
  {
    path: 'vehicles',
    component: VeiculosListaComponent,
    data: { titulo: 'PAGINAS.VEICULOS' },
  },
  {
    path: 'vehicles/new',
    component: VeiculoFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.VEICULOS_NOVO', algumaPermissao: ['VEHICLE_CREATE'] },
  },
  {
    path: 'vehicles/:id/edit',
    component: VeiculoFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.VEICULOS_EDITAR', algumaPermissao: ['VEHICLE_UPDATE'] },
  },
  {
    path: 'vehicles/:id',
    component: VeiculoDetalheComponent,
    data: { titulo: 'PAGINAS.VEICULOS_DETALHE' },
  },
  {
    path: 'drivers',
    component: MotoristasListaComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.MOTORISTAS', algumaPermissao: ['DRIVER_VIEW'] },
  },
  {
    path: 'drivers/:id',
    component: MotoristaDetalheComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.MOTORISTAS_DETALHE', algumaPermissao: ['DRIVER_VIEW'] },
  },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class FleetRoutingModule {}
