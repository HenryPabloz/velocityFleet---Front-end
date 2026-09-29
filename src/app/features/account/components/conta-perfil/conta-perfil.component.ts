import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { MeuPerfil } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import {
  aplicarErrosNosCampos,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { ContaService } from '../../services/conta.service';

// Perfil: e-mail e papel só para leitura; o nome pode ser trocado (PATCH /users/me).
@Component({
  selector: 'app-conta-perfil',
  standalone: false,
  templateUrl: './conta-perfil.component.html',
})
export class ContaPerfilComponent implements OnInit {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;
  podeEditar = false;

  perfil: MeuPerfil | null = null;
  papel = '';

  formulario = new FormGroup({
    nome: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  constructor(
    private conta: ContaService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeEditar = this.estadoAutenticacao.temPermissao('PROFILE_UPDATE_OWN');
    this.papel = this.estadoAutenticacao.usuarioAtual?.role ?? '';
    this.carregar();
  }

  carregar(): void {
    this.estado = 'carregando';
    this.conta.perfil().subscribe({
      next: (perfil) => {
        this.perfil = perfil;
        this.formulario.reset({ nome: perfil.fullName });
        this.estado = 'ok';
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  get papelConhecido(): boolean {
    return this.papel === 'DRIVER' || this.papel === 'FLEET_MANAGER' || this.papel === 'ADMIN';
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'COMUM.SALVANDO';
    }
    return 'CONTA.PERFIL.SALVAR';
  }

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.salvando || !this.perfil || !this.podeEditar) {
      return;
    }
    if (!validarTudo(this.formulario)) {
      this.detector.detectChanges();
      focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
      return;
    }
    const nome = this.formulario.controls.nome.value.trim();
    if (nome === this.perfil.fullName) {
      this.notificacao.info(this.traducao.instant('CONTA.PERFIL.SEM_ALTERACAO'));
      return;
    }
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('CONTA.PERFIL.CONFIRMAR_TITULO'),
      this.traducao.instant('CONTA.PERFIL.CONFIRMAR_TEXTO', { nome: nome }),
      this.traducao.instant('CONTA.PERFIL.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.conta.atualizarPerfil(nome).subscribe({
      next: (usuario) => {
        this.salvando = false;
        if (this.perfil) {
          this.perfil = { ...this.perfil, fullName: usuario.fullName };
        }
        this.formulario.reset({ nome: usuario.fullName });
        // O nome novo aparece também no cabeçalho.
        this.estadoAutenticacao.atualizarNomeCompleto(usuario.fullName);
        this.notificacao.sucesso(this.traducao.instant('CONTA.PERFIL.SALVO_OK'));
        this.detector.markForCheck();
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  private tratarErro(erro: unknown): void {
    this.salvando = false;
    if (statusDoErro(erro) === 400) {
      const sobras = aplicarErrosNosCampos(erro, this.formulario, { fullName: 'nome' }, this.traducao);
      this.erroGeral = sobras.join(' ');
    } else {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
    if (this.erroGeral) {
      document.getElementById('alerta-erro-perfil')?.focus();
    }
  }
}
