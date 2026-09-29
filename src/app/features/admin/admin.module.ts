import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { AdminRoutingModule } from './admin-routing.module';
import { ConfiguracoesComponent } from './pages/configuracoes/configuracoes.component';
import { UsuarioEditarComponent } from './pages/usuario-editar/usuario-editar.component';
import { UsuarioFormComponent } from './pages/usuario-form/usuario-form.component';
import { UsuarioPromoverComponent } from './pages/usuario-promover/usuario-promover.component';
import { UsuariosListaComponent } from './pages/usuarios-lista/usuarios-lista.component';

// Administração: usuários (lista, criar, editar, promover papel) e configurações.
@NgModule({
  declarations: [
    UsuariosListaComponent,
    UsuarioFormComponent,
    UsuarioEditarComponent,
    UsuarioPromoverComponent,
    ConfiguracoesComponent,
  ],
  imports: [DadosModule, AdminRoutingModule],
})
export class AdminModule {}
