import { Component, Input, ViewEncapsulation } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

export interface OpcaoDoGrupo {
  valor: string;
  // Texto já traduzido.
  rotulo: string;
  // Nome do ícone (app-icone). Vazio = sem ícone.
  icone?: string;
  // Cor de reforço do ícone: neutro, ok, aviso ou perigo.
  tom?: string;
}

// Escolha de uma opção entre poucas, em cartões (botões de rádio de verdade, com setas do teclado).
@Component({
  selector: 'app-grupo-opcoes',
  standalone: false,
  templateUrl: './grupo-opcoes.component.html',
  styleUrl: './grupo-opcoes.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class GrupoOpcoesComponent {
  // Vira o id do fieldset (ex: campo-manutencao-tipo) e o "name" dos rádios.
  @Input({ required: true }) idCampo = '';
  @Input() legenda = '';
  @Input() ajuda = '';
  @Input() obrigatorio = false;
  @Input() opcoes: OpcaoDoGrupo[] = [];
  @Input() controle: AbstractControl | null = null;
  // Chave i18n de cada erro, igual ao app-campo-formulario.
  @Input() mensagens: Record<string, string> = {};

  constructor(private traducao: TranslateService) {}

  get idErro(): string {
    return 'erro-' + this.idCampo;
  }

  get idAjuda(): string {
    return 'ajuda-' + this.idCampo;
  }

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
    if (typeof erros['servidor'] === 'string') {
      return erros['servidor'];
    }
    for (const chave of Object.keys(erros)) {
      if (this.mensagens[chave]) {
        return this.traducao.instant(this.mensagens[chave]);
      }
    }
    return this.traducao.instant('ERROS_CAMPO.OBRIGATORIO');
  }

  get atributoObrigatorio(): string | null {
    if (this.obrigatorio) {
      return 'true';
    }
    return null;
  }

  get atributoInvalido(): string | null {
    if (this.mostrarErro) {
      return 'true';
    }
    return null;
  }

  marcada(opcao: OpcaoDoGrupo): boolean {
    return this.controle?.value === opcao.valor;
  }

  escolher(opcao: OpcaoDoGrupo): void {
    if (!this.controle) {
      return;
    }
    this.controle.setValue(opcao.valor);
    this.controle.markAsDirty();
    this.controle.markAsTouched();
  }

  idDaOpcao(opcao: OpcaoDoGrupo): string {
    return this.idCampo + '-' + opcao.valor;
  }

  aoSairDoGrupo(): void {
    this.controle?.markAsTouched();
  }
}
