import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import {
  aplicarErrosNosCampos,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { ContaService } from '../../services/conta.service';

// A confirmação precisa ser igual à senha nova.
function validarConfirmacao(controle: AbstractControl): ValidationErrors | null {
  const pai = controle.parent;
  if (!pai) {
    return null;
  }
  if (controle.value !== pai.get('nova')?.value) {
    return { diferente: true };
  }
  return null;
}

// Trocar a senha: senha atual + senha nova (8 a 15) + confirmação. Nada é guardado no navegador.
@Component({
  selector: 'app-conta-senha',
  standalone: false,
  templateUrl: './conta-senha.component.html',
})
export class ContaSenhaComponent implements OnInit, OnDestroy {
  erroGeral = '';
  salvando = false;
  mostrarSenhas = false;

  formulario = new FormGroup({
    atual: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    nova: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(15)],
    }),
    confirmacao: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, validarConfirmacao],
    }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private assinatura: Subscription | null = null;

  constructor(
    private conta: ContaService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Mudou a senha nova: a confirmação é conferida de novo.
    this.assinatura = this.formulario.controls.nova.valueChanges.subscribe(() => {
      this.formulario.controls.confirmacao.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  get tipoDosCampos(): string {
    if (this.mostrarSenhas) {
      return 'text';
    }
    return 'password';
  }

  get chaveMostrar(): string {
    if (this.mostrarSenhas) {
      return 'USUARIO_FORM.OCULTAR_SENHA';
    }
    return 'USUARIO_FORM.MOSTRAR_SENHA';
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'COMUM.SALVANDO';
    }
    return 'CONTA.SENHA.TROCAR';
  }

  alternarSenhas(): void {
    this.mostrarSenhas = !this.mostrarSenhas;
  }

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.salvando) {
      return;
    }
    if (!validarTudo(this.formulario)) {
      this.detector.detectChanges();
      focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
      return;
    }
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('CONTA.SENHA.CONFIRMAR_TITULO'),
      this.traducao.instant('CONTA.SENHA.CONFIRMAR_TEXTO'),
      this.traducao.instant('CONTA.SENHA.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    const valores = this.formulario.getRawValue();
    this.salvando = true;
    this.detector.markForCheck();
    this.conta.trocarSenha({ currentPassword: valores.atual, newPassword: valores.nova }).subscribe({
      next: () => {
        this.salvando = false;
        this.formulario.reset();
        this.mostrarSenhas = false;
        this.notificacao.sucesso(this.traducao.instant('CONTA.SENHA.TROCADA_OK'));
        this.detector.markForCheck();
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  // 401 = senha atual errada (fica no campo); 400 = senha nova fora do tamanho; o resto vai no aviso.
  private tratarErro(erro: unknown): void {
    this.salvando = false;
    const status = statusDoErro(erro);
    if (status === 401) {
      const atual = this.formulario.controls.atual;
      atual.setErrors({ servidor: this.traducao.instant('CONTA.SENHA.ERRO_ATUAL') });
      atual.markAsTouched();
    } else if (status === 400) {
      const sobras = aplicarErrosNosCampos(
        erro,
        this.formulario,
        { currentPassword: 'atual', newPassword: 'nova' },
        this.traducao,
      );
      this.erroGeral = sobras.join(' ');
    } else {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
    if (this.erroGeral) {
      document.getElementById('alerta-erro-senha')?.focus();
    }
  }
}
