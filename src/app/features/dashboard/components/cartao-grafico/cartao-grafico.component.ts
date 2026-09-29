import { Component, EventEmitter, Input, Output } from '@angular/core';

import { SituacaoBloco } from '../../dashboard.model';

// Moldura de um gráfico ou tabela: título, esqueleto, erro, vazio e o conteúdo (ng-content).
@Component({
  selector: 'app-cartao-grafico',
  standalone: false,
  templateUrl: './cartao-grafico.component.html',
})
export class CartaoGraficoComponent {
  // Vai para o id do cartão (ex: grafico-km-mensal).
  @Input({ required: true }) idCartao = '';
  @Input({ required: true }) titulo = '';
  @Input() subtitulo = '';
  @Input() situacao: SituacaoBloco = 'carregando';
  @Input() vazio = false;
  @Input() mensagemVazio = '';
  @Output() tentarNovamente = new EventEmitter<void>();
}
