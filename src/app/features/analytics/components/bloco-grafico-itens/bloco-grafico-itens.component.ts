import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ApexOptions } from 'apexcharts';

import { SituacaoBloco } from '../../../dashboard/dashboard.model';
import { ItemGrafico } from '../../analytics.model';

// Cartão com um gráfico de barras, a legenda (ícone + texto + total) e a tabela como alternativa.
// A moldura (carregando, erro, vazio) vem do app-cartao-grafico do dashboard.
@Component({
  selector: 'app-bloco-grafico-itens',
  standalone: false,
  templateUrl: './bloco-grafico-itens.component.html',
})
export class BlocoGraficoItensComponent {
  @Input({ required: true }) idCartao = '';
  @Input({ required: true }) titulo = '';
  @Input() subtitulo = '';
  @Input() situacao: SituacaoBloco = 'carregando';
  @Input() vazio = false;
  @Input() mensagemVazio = '';
  @Input() opcoes: ApexOptions = {};
  @Input() itens: ItemGrafico[] = [];
  // Texto lido por leitor de tela no lugar do desenho do gráfico.
  @Input() resumo = '';
  // true mostra a tabela no lugar do gráfico.
  @Input() verTabela = false;
  @Input() rotuloColunaItem = '';
  @Input() rotuloColunaTotal = '';
  @Output() tentarNovamente = new EventEmitter<void>();
}
