import { Component, ViewEncapsulation } from '@angular/core';

// Minha conta: dois blocos independentes (perfil e senha). Vale para os 3 papéis.
@Component({
  selector: 'app-minha-conta',
  standalone: false,
  templateUrl: './minha-conta.component.html',
  styleUrl: './minha-conta.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class MinhaContaComponent {}
