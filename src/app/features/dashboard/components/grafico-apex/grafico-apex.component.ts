import { Component, ElementRef, Input } from '@angular/core';
import type { ApexOptions } from 'apexcharts';
import { ChartComponent } from 'ng-apexcharts';

// Liga as opções montadas em utils/graficos-apex.ts ao componente do ApexCharts.
@Component({
  selector: 'app-grafico-apex',
  standalone: true,
  imports: [ChartComponent],
  template: `
    <apx-chart
      [chart]="$any(opcoes.chart)"
      [series]="$any(opcoes.series)"
      [colors]="opcoes.colors"
      [labels]="opcoes.labels"
      [stroke]="opcoes.stroke"
      [fill]="opcoes.fill"
      [markers]="opcoes.markers"
      [dataLabels]="opcoes.dataLabels"
      [legend]="opcoes.legend"
      [grid]="opcoes.grid"
      [xaxis]="opcoes.xaxis"
      [yaxis]="opcoes.yaxis"
      [plotOptions]="opcoes.plotOptions"
      [states]="opcoes.states"
      [tooltip]="opcoes.tooltip"
      (chartReady)="tirarDaOrdemDeTab()"
    />
  `,
})
export class GraficoApexComponent {
  @Input({ required: true }) opcoes: ApexOptions = {};

  constructor(private elemento: ElementRef<HTMLElement>) {}

  // O Apex põe tabindex=0 no svg (parada de Tab sem nome). O gráfico é lido pelo resumo e pela tabela.
  tirarDaOrdemDeTab(): void {
    const desenhos = this.elemento.nativeElement.querySelectorAll('svg');
    desenhos.forEach((desenho) => desenho.setAttribute('tabindex', '-1'));
  }
}
