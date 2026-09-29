import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

import { PaginatedResponse } from '../../../../core/models';

// Barra "Anterior / Página X de Y / Próxima" para qualquer listagem { data, pagination }.
@Component({
  selector: 'app-paginacao',
  standalone: false,
  templateUrl: './paginacao.component.html',
  styleUrl: './paginacao.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class PaginacaoComponent {
  @Input() paginacao: PaginatedResponse<unknown>['pagination'] | null = null;
  @Output() paginaMudou = new EventEmitter<number>();

  get temAnterior(): boolean {
    return !!this.paginacao && this.paginacao.page > 1;
  }

  get temProxima(): boolean {
    return !!this.paginacao && this.paginacao.page < this.paginacao.totalPages;
  }

  irParaAnterior(): void {
    if (this.paginacao && this.temAnterior) {
      this.paginaMudou.emit(this.paginacao.page - 1);
    }
  }

  irParaProxima(): void {
    if (this.paginacao && this.temProxima) {
      this.paginaMudou.emit(this.paginacao.page + 1);
    }
  }
}
