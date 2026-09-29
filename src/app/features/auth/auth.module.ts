import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared/shared.module';
import { AuthRoutingModule } from './auth-routing.module';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { LoginComponent } from './pages/login/login.component';

@NgModule({
  declarations: [LoginComponent, ForgotPasswordComponent],
  imports: [SharedModule, AuthRoutingModule],
})
export class AuthModule {}
