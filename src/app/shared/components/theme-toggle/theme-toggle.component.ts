import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { TemaVisual, ThemeService } from '../../../core/services/theme.service';

// Botão que alterna entre claro e escuro. Mostra o ícone do tema PARA ONDE o
// clique leva (lua = fica escuro; sol = fica claro), não o tema atual.
@Component({
  selector: 'app-theme-toggle',
  standalone: false,
  templateUrl: './theme-toggle.component.html',
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  tema: TemaVisual = 'light';
  anunciou = false;

  private assinatura?: Subscription;

  constructor(
    private temaService: ThemeService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.assinatura = this.temaService.tema$.subscribe((tema) => {
      this.tema = tema;
      this.detector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  chaveNome(tema: TemaVisual): string {
    if (tema === 'dark') {
      return 'TEMA.ESCURO';
    }
    return 'TEMA.CLARO';
  }

  proximoTema(): TemaVisual {
    if (this.tema === 'dark') {
      return 'light';
    }
    return 'dark';
  }

  alternar(): void {
    this.temaService.alternar();
    this.anunciou = true;
  }
}
