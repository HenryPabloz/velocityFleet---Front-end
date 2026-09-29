import { Component, EventEmitter, Input, Output } from '@angular/core';

import { RemocaoService } from '../../services/remocao.service';

// Botões de excluir, restaurar e excluir definitivamente de uma linha da lista.
// Sem permissão o botão nem aparece (não fica desabilitado). DRIVER nunca vê nenhum.
@Component({
  selector: 'app-acoes-remocao',
  standalone: false,
  templateUrl: './acoes-remocao.component.html',
  styles: [':host { display: contents; }'],
})
export class AcoesRemocaoComponent {
  // Prefixo da permission: VEHICLE, DRIVER, TRIP...
  @Input() recurso = '';
  // true quando a linha está na aba "Removidos".
  @Input() removido = false;
  // false esconde o "Excluir" da linha (ex: viagem ainda ativa, que a API recusa com 409).
  @Input() permitirExcluir = true;
  // Regras de proteção (ex: conta ADMIN): o botão aparece, mas desabilitado, com o motivo.
  @Input() bloquearExcluir = false;
  @Input() bloquearRestaurar = false;
  @Input() bloquearDefinitivo = false;
  @Input() motivoBloqueio = '';
  @Output() excluir = new EventEmitter<void>();
  @Output() restaurar = new EventEmitter<void>();
  @Output() excluirDefinitivo = new EventEmitter<void>();

  constructor(private remocao: RemocaoService) {}

  get mostrarExcluir(): boolean {
    return !this.removido && this.permitirExcluir && this.remocao.podeExcluir(this.recurso);
  }

  get mostrarRestaurar(): boolean {
    return this.removido && this.remocao.podeRestaurar(this.recurso);
  }

  get mostrarDefinitivo(): boolean {
    // Só faz sentido excluir de vez um registro que já está na aba "Removidos".
    return this.removido && this.remocao.podeExcluirDefinitivo();
  }

  // Botão bloqueado não dispara nada; usa aria-disabled para continuar alcançável pelo teclado.
  aoClicarExcluir(): void {
    if (!this.bloquearExcluir) {
      this.excluir.emit();
    }
  }

  aoClicarRestaurar(): void {
    if (!this.bloquearRestaurar) {
      this.restaurar.emit();
    }
  }

  aoClicarDefinitivo(): void {
    if (!this.bloquearDefinitivo) {
      this.excluirDefinitivo.emit();
    }
  }

  // O motivo só aparece como dica quando o botão está bloqueado.
  dica(bloqueado: boolean): string | null {
    if (bloqueado && this.motivoBloqueio) {
      return this.motivoBloqueio;
    }
    return null;
  }

  atributoBloqueado(bloqueado: boolean): string | null {
    if (bloqueado) {
      return 'true';
    }
    return null;
  }
}
