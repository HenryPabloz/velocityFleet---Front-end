import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

// Placeholder das telas que ainda não foram feitas. Pega o título em data.titulo da rota.
@Component({
  selector: 'app-pagina-em-construcao',
  standalone: false,
  templateUrl: './pagina-em-construcao.component.html',
  styleUrl: './pagina-em-construcao.component.scss',
})
export class PaginaEmConstrucaoComponent {
  tituloChave: string;

  constructor(private rota: ActivatedRoute) {
    this.tituloChave = this.rota.snapshot.data['titulo'] ?? 'PAGINAS.EM_CONSTRUCAO';
  }
}
