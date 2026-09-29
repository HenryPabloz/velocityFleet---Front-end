import { Component, ViewEncapsulation } from '@angular/core';

// Abas da área Analytics: frota, veículo, motorista e incidentes.
@Component({
  selector: 'app-abas-analytics',
  standalone: false,
  encapsulation: ViewEncapsulation.None,
  template: `
    <nav class="vf-abas-analytics" id="abas-analytics" [attr.aria-label]="'ANALYTICS.ABAS' | translate">
      <a
        class="vf-abas-analytics__item"
        routerLink="/analytics/fleet"
        routerLinkActive="vf-abas-analytics__item--ativa"
        ariaCurrentWhenActive="page"
      >
        <app-icone nome="analytics" [tamanho]="18"></app-icone>
        {{ 'ANALYTICS.ABA_FROTA' | translate }}
      </a>
      <a
        class="vf-abas-analytics__item"
        routerLink="/analytics/vehicles"
        routerLinkActive="vf-abas-analytics__item--ativa"
        ariaCurrentWhenActive="page"
      >
        <app-icone nome="frota" [tamanho]="18"></app-icone>
        {{ 'ANALYTICS.ABA_VEICULO' | translate }}
      </a>
      <a
        class="vf-abas-analytics__item"
        routerLink="/analytics/drivers"
        routerLinkActive="vf-abas-analytics__item--ativa"
        ariaCurrentWhenActive="page"
      >
        <app-icone nome="usuario" [tamanho]="18"></app-icone>
        {{ 'ANALYTICS.ABA_MOTORISTA' | translate }}
      </a>
      <a
        class="vf-abas-analytics__item"
        routerLink="/analytics/incidents"
        routerLinkActive="vf-abas-analytics__item--ativa"
        ariaCurrentWhenActive="page"
      >
        <app-icone nome="incidentes" [tamanho]="18"></app-icone>
        {{ 'ANALYTICS.ABA_INCIDENTES' | translate }}
      </a>
    </nav>
  `,
  styles: [
    `
      .vf-abas-analytics {
        display: flex;
        gap: var(--vf-espaco-2);
        overflow-x: auto;
        border-bottom: 1px solid var(--vf-cor-borda);
        scrollbar-width: thin;
      }
      .vf-abas-analytics__item {
        display: inline-flex;
        flex: none;
        align-items: center;
        gap: var(--vf-espaco-2);
        min-height: 44px;
        margin-bottom: -1px;
        padding: 0 var(--vf-espaco-4);
        border-bottom: 3px solid transparent;
        color: var(--vf-cor-texto-suave);
        font-weight: 600;
        text-decoration: none;
        white-space: nowrap;
        transition: color var(--vf-transicao-rapida), border-color var(--vf-transicao-rapida);
      }
      .vf-abas-analytics__item:hover {
        color: var(--vf-cor-texto);
      }
      .vf-abas-analytics__item--ativa {
        border-bottom-color: var(--vf-cor-destaque);
        color: var(--vf-cor-texto);
      }
    `,
  ],
})
export class AbasAnalyticsComponent {}
