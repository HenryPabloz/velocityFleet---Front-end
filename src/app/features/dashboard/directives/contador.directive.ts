import { Directive, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { gsap } from 'gsap';

// Escreve um número no elemento contando de 0 até o valor (GSAP). Sem animação se o usuário pediu menos movimento.
@Directive({
  selector: '[appContador]',
  standalone: false,
})
export class ContadorDirective implements OnChanges, OnDestroy {
  @Input() appContador = 0;
  @Input() casasDecimais = 0;

  private movimento = gsap.matchMedia();
  private valorAtual = { numero: 0 };

  constructor(
    private elemento: ElementRef<HTMLElement>,
    private traducao: TranslateService,
  ) {}

  ngOnChanges(): void {
    const destino = this.appContador;
    // Volta ao estado limpo e já deixa o valor final escrito (vale para reduced-motion).
    this.movimento.revert();
    this.escrever(destino);
    this.elemento.nativeElement.setAttribute('data-valor-final', String(destino));

    this.movimento.add('(prefers-reduced-motion: no-preference)', () => {
      this.valorAtual.numero = 0;
      this.escrever(0);
      gsap.to(this.valorAtual, {
        numero: destino,
        duration: 1.1,
        ease: 'power3.out',
        onUpdate: () => this.escrever(this.valorAtual.numero),
        onComplete: () => this.escrever(destino),
      });
    });
  }

  ngOnDestroy(): void {
    this.movimento.revert();
  }

  private escrever(valor: number): void {
    const idioma = this.traducao.getCurrentLang() || 'pt-BR';
    const formatador = new Intl.NumberFormat(idioma, {
      minimumFractionDigits: this.casasDecimais,
      maximumFractionDigits: this.casasDecimais,
    });
    this.elemento.nativeElement.textContent = formatador.format(valor);
  }
}
