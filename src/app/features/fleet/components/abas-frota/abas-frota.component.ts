import { Component, ViewEncapsulation } from '@angular/core';

import { AuthStateService } from '../../../../core/services/auth-state.service';

// Abas da área Frota: Veículos para todos; Motoristas só com a permission DRIVER_VIEW.
@Component({
  selector: 'app-abas-frota',
  standalone: false,
  encapsulation: ViewEncapsulation.None,
  template: `
    <nav class="vf-abas" [attr.aria-label]="'FROTA.ABAS' | translate">
      <a
        class="vf-abas__item"
        routerLink="/fleet/vehicles"
        routerLinkActive="vf-abas__item--ativa"
        ariaCurrentWhenActive="page"
      >
        <app-icone nome="frota" [tamanho]="18"></app-icone>
        {{ 'FROTA.ABA_VEICULOS' | translate }}
      </a>
      @if (podeVerMotoristas) {
        <a
          class="vf-abas__item"
          routerLink="/fleet/drivers"
          routerLinkActive="vf-abas__item--ativa"
          ariaCurrentWhenActive="page"
        >
          <app-icone nome="usuario" [tamanho]="18"></app-icone>
          {{ 'FROTA.ABA_MOTORISTAS' | translate }}
        </a>
      }
    </nav>
  `,
  styles: [
    `
      .vf-abas {
        display: flex;
        gap: var(--vf-espaco-2);
        border-bottom: 1px solid var(--vf-cor-borda);
      }
      .vf-abas__item {
        display: inline-flex;
        align-items: center;
        gap: var(--vf-espaco-2);
        min-height: 44px;
        margin-bottom: -1px;
        padding: 0 var(--vf-espaco-4);
        border-bottom: 3px solid transparent;
        color: var(--vf-cor-texto-suave);
        font-weight: 600;
        text-decoration: none;
        transition: color var(--vf-transicao-rapida), border-color var(--vf-transicao-rapida);
      }
      .vf-abas__item:hover {
        color: var(--vf-cor-texto);
      }
      .vf-abas__item--ativa {
        border-bottom-color: var(--vf-cor-destaque);
        color: var(--vf-cor-texto);
      }
    `,
  ],
})
export class AbasFrotaComponent {
  podeVerMotoristas = false;

  constructor(estadoAutenticacao: AuthStateService) {
    this.podeVerMotoristas = estadoAutenticacao.temPermissao('DRIVER_VIEW');
  }
}
