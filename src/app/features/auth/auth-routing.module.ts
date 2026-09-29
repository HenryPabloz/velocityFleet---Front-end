import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthLayoutComponent } from '../../layouts/auth-layout/auth-layout.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { LoginComponent } from './pages/login/login.component';

// Login e recuperação de senha dentro do layout de tela cheia.
const rotas: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent, data: { titulo: 'AUTH.LOGIN.SUBMIT' } },
      {
        path: 'forgot-password',
        component: ForgotPasswordComponent,
        data: { titulo: 'AUTH.RECUPERAR.TITLE' },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(rotas)],
  exports: [RouterModule],
})
export class AuthRoutingModule {}
