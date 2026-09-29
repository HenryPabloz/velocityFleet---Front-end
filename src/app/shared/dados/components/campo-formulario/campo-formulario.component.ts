import { Component, Directive, HostBinding, Input, ViewEncapsulation } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

// Rótulo + campo + ajuda + erro acessível. O campo (input/select) vai dentro, com vfCampoEntrada.
@Component({
  selector: 'app-campo-formulario',
  standalone: false,
  templateUrl: './campo-formulario.component.html',
  styleUrl: './campo-formulario.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class CampoFormularioComponent {
  // Vira o id do input (ex: campo-veiculo-placa).
  @Input({ required: true }) idCampo = '';
  @Input() rotulo = '';
  @Input() ajuda = '';
  @Input() obrigatorio = false;
  @Input() controle: AbstractControl | null = null;
  // Chave i18n de cada erro: { required: 'ERROS_CAMPO.OBRIGATORIO', min: '...' }.
  @Input() mensagens: Record<string, string> = {};

  constructor(private traducao: TranslateService) {}

  get idAjuda(): string {
    return 'ajuda-' + this.idCampo;
  }

  get idErro(): string {
    return 'erro-' + this.idCampo;
  }

  // Só os ids que existem na página: a ajuda (se houver) e a área de erro (sempre existe).
  get idsDescricao(): string {
    if (this.ajuda) {
      return this.idAjuda + ' ' + this.idErro;
    }
    return this.idErro;
  }

  get mostrarErro(): boolean {
    if (!this.controle || !this.controle.invalid) {
      return false;
    }
    return this.controle.touched || this.controle.dirty;
  }

  get textoErro(): string {
    if (!this.controle || !this.controle.errors) {
      return '';
    }
    const erros = this.controle.errors;
    // Erro que veio da API (errors[]) já vem pronto.
    if (typeof erros['servidor'] === 'string') {
      return erros['servidor'];
    }
    for (const chave of Object.keys(erros)) {
      if (this.mensagens[chave]) {
        return this.traduzir(this.mensagens[chave], erros[chave]);
      }
    }
    return this.traduzir(this.mensagens['padrao'] ?? 'ERROS_CAMPO.INVALIDO', {});
  }

  // Os dados do erro (ex: min, max, requiredLength) entram no texto como {{min}}.
  private traduzir(chave: string, dadosDoErro: unknown): string {
    let parametros: object = {};
    if (dadosDoErro && typeof dadosDoErro === 'object') {
      parametros = dadosDoErro;
    }
    return this.traducao.instant(chave, parametros);
  }
}

// Liga o input ao campo: id, aria-describedby, aria-invalid e classe de erro do Bootstrap.
@Directive({ selector: '[vfCampoEntrada]', standalone: false })
export class CampoEntradaDirective {
  constructor(private campo: CampoFormularioComponent) {}

  @HostBinding('attr.id') get id(): string {
    return this.campo.idCampo;
  }

  @HostBinding('attr.aria-describedby') get descricao(): string {
    return this.campo.idsDescricao;
  }

  @HostBinding('attr.aria-invalid') get invalido(): string | null {
    if (this.campo.mostrarErro) {
      return 'true';
    }
    return null;
  }

  @HostBinding('attr.aria-required') get obrigatorio(): string | null {
    if (this.campo.obrigatorio) {
      return 'true';
    }
    return null;
  }

  @HostBinding('class.is-invalid') get comErro(): boolean {
    return this.campo.mostrarErro;
  }
}
