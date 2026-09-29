import { Component, EventEmitter, Input, Output } from '@angular/core';

// Mostra o erro de um bloco (com "Tentar de novo") ou o aviso de "Sem acesso".
@Component({
  selector: 'app-estado-bloco',
  standalone: false,
  templateUrl: './estado-bloco.component.html',
})
export class EstadoBlocoComponent {
  @Input() tipo: 'erro' | 'sem-acesso' | 'limite' = 'erro';
  // Texto que explica o caso "sem-acesso" (cada card pode ter o seu).
  @Input() mensagemSemAcesso = '';
  @Output() tentarNovamente = new EventEmitter<void>();
}
