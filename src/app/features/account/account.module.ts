import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { AccountRoutingModule } from './account-routing.module';
import { ContaPerfilComponent } from './components/conta-perfil/conta-perfil.component';
import { ContaSenhaComponent } from './components/conta-senha/conta-senha.component';
import { MinhaContaComponent } from './pages/minha-conta/minha-conta.component';

// Minha conta (todos os papéis): perfil e senha.
@NgModule({
  declarations: [MinhaContaComponent, ContaPerfilComponent, ContaSenhaComponent],
  imports: [DadosModule, AccountRoutingModule],
})
export class AccountModule {}
