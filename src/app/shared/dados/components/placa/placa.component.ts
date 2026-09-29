import { Component, Input, ViewEncapsulation } from '@angular/core';

import { formatarPlaca } from '../../utils/formatacao';

// Assinatura visual da frota: a placa desenhada como uma placa Mercosul (fundo branco, faixa azul).
@Component({
  selector: 'app-placa',
  standalone: false,
  templateUrl: './placa.component.html',
  styleUrl: './placa.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class PlacaComponent {
  @Input() placa = '';
  @Input() tamanho: 'p' | 'm' | 'g' = 'm';

  get placaFormatada(): string {
    return formatarPlaca(this.placa);
  }
}
