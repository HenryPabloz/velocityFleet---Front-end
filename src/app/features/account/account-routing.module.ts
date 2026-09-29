import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MinhaContaComponent } from './pages/minha-conta/minha-conta.component';

// Página "Minha conta": liberada a qualquer pessoa logada.
const rotas: Routes = [
  { path: '', component: MinhaContaComponent, data: { titulo: 'PAGINAS.MINHA_CONTA' } },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class AccountRoutingModule {}
