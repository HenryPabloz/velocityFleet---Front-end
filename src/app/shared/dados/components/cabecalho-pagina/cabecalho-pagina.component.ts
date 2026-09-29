import { Component, Input, ViewEncapsulation } from '@angular/core';

// Topo de toda tela de dados: voltar, etiqueta, título e as ações (botões) dentro do componente.
// O SCSS também guarda o "kit de página" (painel, filtros, avisos) usado pelas telas de dados.
@Component({
  selector: 'app-cabecalho-pagina',
  standalone: false,
  templateUrl: './cabecalho-pagina.component.html',
  styleUrl: './cabecalho-pagina.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class CabecalhoPaginaComponent {
  @Input() titulo = '';
  @Input() etiqueta = '';
  @Input() subtitulo = '';
  // Link "voltar": rota e texto já traduzido.
  @Input() rotaVoltar: string | null = null;
  @Input() rotuloVoltar = '';
}
