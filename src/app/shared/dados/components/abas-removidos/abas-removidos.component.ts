import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

import { RemocaoService } from '../../services/remocao.service';

// Abas "Ativos | Removidos" de uma lista. A aba "Removidos" só aparece com <R>_RESTORE.
@Component({
  selector: 'app-abas-removidos',
  standalone: false,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './abas-removidos.component.html',
  styleUrl: './abas-removidos.component.scss',
})
export class AbasRemovidosComponent {
  // Prefixo da permission: VEHICLE, DRIVER, TRIP...
  @Input() recurso = '';
  // true quando a aba "Removidos" está aberta.
  @Input() removidos = false;
  @Input() rotuloAtivos = '';
  @Input() rotuloRemovidos = '';
  // Ids das abas (o padrão serve; a tela de usuários usa ids próprios).
  @Input() idAbaAtivos = 'aba-ativos';
  @Input() idAbaRemovidos = 'aba-removidos';
  @Output() mudou = new EventEmitter<boolean>();

  constructor(private remocao: RemocaoService) {}

  get visivel(): boolean {
    return this.remocao.podeRestaurar(this.recurso);
  }

  escolher(mostrarRemovidos: boolean): void {
    if (mostrarRemovidos === this.removidos) {
      return;
    }
    this.mudou.emit(mostrarRemovidos);
  }
}
