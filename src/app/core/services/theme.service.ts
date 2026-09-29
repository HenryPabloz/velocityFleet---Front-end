import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type TemaVisual = 'light' | 'dark';
// "auto" = sem escolha salva: o app segue o tema do sistema.
export type ModoTema = 'light' | 'dark' | 'auto';

const CHAVE_TEMA = 'vf_tema';

// Controla o tema claro/escuro: usa a escolha salva ou a preferência do sistema.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private temaSubject = new BehaviorSubject<TemaVisual>('light');
  tema$ = this.temaSubject.asObservable();

  private modoSubject = new BehaviorSubject<ModoTema>('auto');
  modo$ = this.modoSubject.asObservable();

  constructor() {
    this.iniciar();
  }

  get temaAtual(): TemaVisual {
    return this.temaSubject.value;
  }

  get modoAtual(): ModoTema {
    return this.modoSubject.value;
  }

  alternar(): void {
    if (this.temaSubject.value === 'dark') {
      this.definir('light');
    } else {
      this.definir('dark');
    }
  }

  // Muda o modo: claro, escuro ou automático (apaga a escolha salva).
  definirModo(modo: ModoTema): void {
    if (modo === 'auto') {
      try {
        localStorage.removeItem(CHAVE_TEMA);
      } catch {
        // Sem localStorage (modo privado): vale só nesta sessão.
      }
      this.modoSubject.next('auto');
      this.aplicar(this.temaDoSistema());
    } else {
      this.definir(modo);
    }
  }

  // Aplica o tema no <html> e salva a escolha manual do usuário.
  definir(tema: TemaVisual): void {
    this.aplicar(tema);
    this.modoSubject.next(tema);
    try {
      localStorage.setItem(CHAVE_TEMA, tema);
    } catch {
      // Sem localStorage (modo privado): o tema vale só nesta sessão.
    }
  }

  private iniciar(): void {
    let tema: TemaVisual = 'light';

    const salvo = this.lerTemaSalvo();
    if (salvo === 'light' || salvo === 'dark') {
      tema = salvo;
      this.modoSubject.next(salvo);
    } else {
      tema = this.temaDoSistema();
    }
    this.aplicar(tema);
    this.acompanharPreferenciaDoSistema();
  }

  // Se o usuário nunca escolheu, segue o sistema quando ele mudar.
  private acompanharPreferenciaDoSistema(): void {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    consulta.addEventListener('change', (evento) => {
      if (this.modoSubject.value === 'auto') {
        if (evento.matches) {
          this.aplicar('dark');
        } else {
          this.aplicar('light');
        }
      }
    });
  }

  private temaDoSistema(): TemaVisual {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  private lerTemaSalvo(): string | null {
    try {
      return localStorage.getItem(CHAVE_TEMA);
    } catch {
      return null;
    }
  }

  private aplicar(tema: TemaVisual): void {
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.setAttribute('data-bs-theme', tema);
    this.temaSubject.next(tema);
  }
}
