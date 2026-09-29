import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { BottomTabComponent } from './components/bottom-tab/bottom-tab.component';
import { CabecalhoComponent } from './components/cabecalho/cabecalho.component';
import { IconeComponent } from './components/icone/icone.component';
import { PaginaEmConstrucaoComponent } from './components/pagina-em-construcao/pagina-em-construcao.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle.component';

// Tudo que as features usam com frequência fica aqui: importe este módulo nelas.
@NgModule({
  declarations: [
    PaginaEmConstrucaoComponent,
    SidebarComponent,
    BottomTabComponent,
    CabecalhoComponent,
    ThemeToggleComponent,
    IconeComponent,
  ],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TranslatePipe,
    PaginaEmConstrucaoComponent,
    SidebarComponent,
    BottomTabComponent,
    CabecalhoComponent,
    ThemeToggleComponent,
    IconeComponent,
  ],
})
export class SharedModule {}
