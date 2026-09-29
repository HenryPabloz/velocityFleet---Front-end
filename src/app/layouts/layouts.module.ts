import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from '../shared/shared.module';
import { AuthLayoutComponent } from './auth-layout/auth-layout.component';
import { MainLayoutComponent } from './main-layout/main-layout.component';

@NgModule({
  declarations: [MainLayoutComponent, AuthLayoutComponent],
  imports: [RouterModule, SharedModule],
  exports: [MainLayoutComponent, AuthLayoutComponent],
})
export class LayoutsModule {}
