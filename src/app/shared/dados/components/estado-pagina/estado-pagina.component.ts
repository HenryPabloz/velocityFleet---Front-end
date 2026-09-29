import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

export type EstadoPagina = 'carregando' | 'erro' | 'vazio' | 'ok';

// Mostra carregando, erro, vazio ou o conteúdo da tela (o que estiver dentro do componente).
// Para o botão do estado vazio, ponha um elemento com o atributo vazioAcao dentro.
@Component({
  selector: 'app-estado-pagina',
  standalone: false,
  templateUrl: './estado-pagina.component.html',
  styleUrl: './estado-pagina.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class EstadoPaginaComponent {
  @Input() estado: EstadoPagina = 'carregando';
  @Input() mensagemErro = '';
  @Input() tituloVazio = '';
  @Input() textoVazio = '';
  @Input() linhasEsqueleto = 4;
  @Output() tentarNovamente = new EventEmitter<void>();

  get linhas(): number[] {
    const lista: number[] = [];
    for (let i = 0; i < this.linhasEsqueleto; i++) {
      lista.push(i);
    }
    return lista;
  }
}
