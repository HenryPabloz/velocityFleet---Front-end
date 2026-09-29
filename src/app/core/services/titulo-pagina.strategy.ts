import { Injectable, Injector } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

const NOME_DO_SISTEMA = 'VelocityFleet';

// Troca o título da aba a cada rota: usa a chave data.titulo (i18n) da rota mais interna.
@Injectable({ providedIn: 'root' })
export class TituloPaginaStrategy extends TitleStrategy {
  constructor(
    private titulo: Title,
    private injetor: Injector,
  ) {
    super();
  }

  override updateTitle(estado: RouterStateSnapshot): void {
    const chave = this.acharChave(estado.root);
    if (!chave) {
      this.titulo.setTitle(NOME_DO_SISTEMA);
      return;
    }
    // Pega o TranslateService só agora: no construtor cria ciclo com o Router (via HttpClient).
    const traducao = this.injetor.get(TranslateService);
    traducao.get(chave).subscribe((texto: string) => {
      this.titulo.setTitle(texto + ' · ' + NOME_DO_SISTEMA);
    });
  }

  // Desce até a rota mais interna que tenha título.
  private acharChave(rota: ActivatedRouteSnapshot): string | null {
    let chave: string | null = null;
    let atual: ActivatedRouteSnapshot | null = rota;
    while (atual) {
      const valor = atual.data['titulo'];
      if (typeof valor === 'string') {
        chave = valor;
      }
      atual = atual.firstChild;
    }
    return chave;
  }
}
