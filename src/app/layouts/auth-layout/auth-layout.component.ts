import { Component } from '@angular/core';

// Casca das telas públicas (login em tela cheia). O fundo animado entra na Fase 2.
@Component({
  selector: 'app-auth-layout',
  standalone: false,
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  // Com <base href> o link #ancora navegaria para a raiz; aqui só focamos o conteúdo.
  irParaConteudo(evento: Event): void {
    evento.preventDefault();
    const conteudo = document.getElementById('conteudo-auth');
    conteudo?.focus();
    conteudo?.scrollIntoView();
  }
}
