import { Component, ContentChild, Input, TemplateRef, ViewEncapsulation } from '@angular/core';

export interface ColunaTabela {
  chave: string;
  // Chave i18n do título da coluna.
  rotulo: string;
  // Números ficam alinhados à direita.
  alinharDireita?: boolean;
  // Não aparece na lista do card (ex: já está no título do card).
  somenteTabela?: boolean;
}

// Tabela no desktop e cards no celular/tablet. A tela dá o conteúdo das células por <ng-template>:
// #celula (linha, coluna), #titulo (título do card, opcional) e #acoes (botões da linha, opcional).
@Component({
  selector: 'app-tabela-dados',
  standalone: false,
  templateUrl: './tabela-dados.component.html',
  styleUrl: './tabela-dados.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class TabelaDadosComponent {
  @Input() idTabela = '';
  // Descrição da tabela para leitores de tela.
  @Input() legenda = '';
  @Input() rotuloAcoes = '';
  @Input() colunas: ColunaTabela[] = [];
  @Input() linhas: { id: string }[] = [];
  // Classe extra dos cards (ex: vf-veiculo-card).
  @Input() classeCartao = '';

  @ContentChild('celula') celula: TemplateRef<unknown> | null = null;
  @ContentChild('titulo') titulo: TemplateRef<unknown> | null = null;
  @ContentChild('acoes') acoes: TemplateRef<unknown> | null = null;
}
