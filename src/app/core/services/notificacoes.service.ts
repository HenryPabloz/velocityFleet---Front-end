import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Um aviso do painel. Ainda não existe endpoint no back-end para alimentar isso.
export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  criadaEm: string;
  lida: boolean;
}

// Guarda a lista de avisos. Começa vazia e fica pronta para ser preenchida depois.
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private listaSubject = new BehaviorSubject<Notificacao[]>([]);
  lista$ = this.listaSubject.asObservable();

  get quantidadeNaoLidas(): number {
    let total = 0;
    for (const notificacao of this.listaSubject.value) {
      if (!notificacao.lida) {
        total = total + 1;
      }
    }
    return total;
  }

  definirLista(lista: Notificacao[]): void {
    this.listaSubject.next(lista);
  }

  adicionar(notificacao: Notificacao): void {
    this.listaSubject.next([notificacao, ...this.listaSubject.value]);
  }

  marcarTodasComoLidas(): void {
    const atualizada = this.listaSubject.value.map((notificacao) => {
      return { ...notificacao, lida: true };
    });
    this.listaSubject.next(atualizada);
  }
}
