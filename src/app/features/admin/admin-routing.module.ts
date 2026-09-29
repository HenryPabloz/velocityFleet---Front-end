import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PapelGuard } from '../../core/guards/papel.guard';
import { PermissaoGuard } from '../../core/guards/permissao.guard';
import { ConfiguracoesComponent } from './pages/configuracoes/configuracoes.component';
import { UsuarioEditarComponent } from './pages/usuario-editar/usuario-editar.component';
import { UsuarioFormComponent } from './pages/usuario-form/usuario-form.component';
import { UsuarioPromoverComponent } from './pages/usuario-promover/usuario-promover.component';
import { UsuariosListaComponent } from './pages/usuarios-lista/usuarios-lista.component';

// Cada rota pede a permission exata. Troca de role e settings são só do ADMIN (papel).
// Promover papel exige o papel ADMIN e também a permission USER_ROLE_PROMOTE.
const rotas: Routes = [
  { path: '', redirectTo: 'users', pathMatch: 'full' },
  {
    path: 'users',
    component: UsuariosListaComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.USUARIOS', algumaPermissao: ['USER_VIEW'] },
  },
  {
    path: 'users/new',
    component: UsuarioFormComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.USUARIOS_NOVO', algumaPermissao: ['USER_CREATE'] },
  },
  {
    path: 'users/:id/role',
    component: UsuarioPromoverComponent,
    canActivate: [PapelGuard, PermissaoGuard],
    data: { titulo: 'PAGINAS.USUARIOS_PROMOVER', papel: 'ADMIN', algumaPermissao: ['USER_ROLE_PROMOTE'] },
  },
  {
    path: 'users/:id/edit',
    component: UsuarioEditarComponent,
    canActivate: [PermissaoGuard],
    data: { titulo: 'PAGINAS.USUARIOS_EDITAR', algumaPermissao: ['USER_UPDATE'] },
  },
  {
    path: 'settings',
    component: ConfiguracoesComponent,
    canActivate: [PapelGuard],
    data: { titulo: 'PAGINAS.CONFIGURACOES', papel: 'ADMIN' },
  },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
