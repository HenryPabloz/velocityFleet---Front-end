import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { ModoTema, ThemeService } from '../../../../core/services/theme.service';
import { OpcaoDoGrupo } from '../../../../shared/dados/components/grupo-opcoes/grupo-opcoes.component';

// Configurações (só ADMIN): informações da aplicação e escolha do tema. Não existe endpoint de configurações.
@Component({
  selector: 'app-configuracoes',
  standalone: false,
  templateUrl: './configuracoes.component.html',
  styles: [
    `
      .vf-config-bloco + .vf-config-bloco {
        margin-top: var(--vf-espaco-5);
      }
      .vf-config-aviso {
        margin-top: var(--vf-espaco-5);
      }
      .vf-config-bloco__titulo {
        margin: 0 0 var(--vf-espaco-4);
        font-size: var(--vf-texto-lg);
      }
    `,
  ],
})
export class ConfiguracoesComponent implements OnInit, OnDestroy {
  nomeDaAplicacao = environment.appName;
  versao = environment.version;
  urlDaApi = environment.apiUrl;
  ambiente = 'development';

  opcoesTema: OpcaoDoGrupo[] = [];
  controleTema = new FormControl<string>('auto', { nonNullable: true });

  private assinaturas: Subscription[] = [];

  constructor(
    private temaService: ThemeService,
    private traducao: TranslateService,
  ) {}

  ngOnInit(): void {
    if (environment.production) {
      this.ambiente = 'production';
    }
    this.controleTema.setValue(this.temaService.modoAtual);
    this.montarOpcoes();
    // Trocar o tema é uma preferência local (fica só neste navegador): vale na hora.
    this.assinaturas.push(
      this.controleTema.valueChanges.subscribe((valor) => this.temaService.definirModo(valor as ModoTema)),
    );
    // Se o idioma mudar, os rótulos das opções acompanham.
    this.assinaturas.push(this.traducao.onLangChange.subscribe(() => this.montarOpcoes()));
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  private montarOpcoes(): void {
    this.opcoesTema = [
      { valor: 'light', rotulo: this.traducao.instant('CONFIGURACOES.TEMA_CLARO'), icone: 'sol' },
      { valor: 'dark', rotulo: this.traducao.instant('CONFIGURACOES.TEMA_ESCURO'), icone: 'lua' },
      { valor: 'auto', rotulo: this.traducao.instant('CONFIGURACOES.TEMA_AUTO'), icone: 'monitor' },
    ];
  }
}
