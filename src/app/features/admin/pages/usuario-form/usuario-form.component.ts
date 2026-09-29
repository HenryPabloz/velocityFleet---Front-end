import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { CriarUsuarioDto, Role } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import {
  aplicarErrosNosCampos,
  lerProblema,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { validarCnh, validarDataFutura } from '../../../../shared/dados/validadores/validadores';
import { UsuariosService } from '../../services/usuarios.service';

// Campos da API (com o bloco "driver") e o controle do formulário que recebe o erro de cada um.
const CAMPOS_DA_API: Record<string, string> = {
  email: 'email',
  password: 'senha',
  fullName: 'nome',
  roleId: 'papel',
  'driver.licenseNumber': 'cnh',
  'driver.licenseExpiry': 'validadeCnh',
  licenseNumber: 'cnh',
  licenseExpiry: 'validadeCnh',
};

// Ordem em que os papéis aparecem no select.
const ORDEM_DOS_PAPEIS = ['DRIVER', 'FLEET_MANAGER', 'ADMIN'];

// Criar usuário: a conta (e o perfil de motorista, se for DRIVER) nascem juntos.
@Component({
  selector: 'app-usuario-form',
  standalone: false,
  templateUrl: './usuario-form.component.html',
  styleUrl: './usuario-form.component.scss',
})
export class UsuarioFormComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;
  mostrarSenha = false;
  papeisDisponiveis: Role[] = [];
  dataMinimaCnh = '';

  formulario = new FormGroup({
    nome: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    senha: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(15)],
    }),
    papel: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    cnh: new FormControl<string>('', { nonNullable: true }),
    validadeCnh: new FormControl<string>('', { nonNullable: true }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private assinaturas: Subscription[] = [];
  private todosOsPapeis: Role[] = [];

  constructor(
    private roteador: Router,
    private usuarios: UsuariosService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.dataMinimaCnh = this.hojeEmTexto();
    // O bloco de CNH só existe (e só é exigido) quando o papel escolhido é DRIVER.
    this.assinaturas.push(
      this.formulario.controls.papel.valueChanges.subscribe(() => this.ajustarBlocoDaCnh()),
    );
    this.carregarPapeis();
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  // Data de hoje no formato AAAA-MM-DD (hora local), usada como mínimo do campo de validade.
  private hojeEmTexto(): string {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return hoje.getFullYear() + '-' + mes + '-' + dia;
  }

  // Gerente (ou qualquer não ADMIN com USER_CREATE) só oferece DRIVER: a API recusa os outros com 403.
  carregarPapeis(): void {
    this.estado = 'carregando';
    this.usuarios.listarPapeis().subscribe({
      next: (papeis) => {
        this.todosOsPapeis = papeis;
        this.papeisDisponiveis = this.filtrarPapeis(papeis);
        // Com uma única opção, ela já vem escolhida.
        if (this.papeisDisponiveis.length === 1) {
          this.formulario.controls.papel.setValue(this.papeisDisponiveis[0].id);
        }
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

  private filtrarPapeis(papeis: Role[]): Role[] {
    const permitidos: Role[] = [];
    const ehAdmin = this.estadoAutenticacao.hasRole('ADMIN');
    for (const nome of ORDEM_DOS_PAPEIS) {
      for (const papel of papeis) {
        if (papel.name !== nome) {
          continue;
        }
        if (ehAdmin || nome === 'DRIVER') {
          permitidos.push(papel);
        }
      }
    }
    return permitidos;
  }

  nomeDoPapelEscolhido(): string {
    const id = this.formulario.controls.papel.value;
    for (const papel of this.todosOsPapeis) {
      if (papel.id === id) {
        return papel.name;
      }
    }
    return '';
  }

  get ehMotorista(): boolean {
    return this.nomeDoPapelEscolhido() === 'DRIVER';
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'USUARIO_FORM.CRIANDO';
    }
    return 'USUARIO_FORM.CRIAR';
  }

  get tipoDoCampoSenha(): string {
    if (this.mostrarSenha) {
      return 'text';
    }
    return 'password';
  }

  get chaveMostrarSenha(): string {
    if (this.mostrarSenha) {
      return 'USUARIO_FORM.OCULTAR_SENHA';
    }
    return 'USUARIO_FORM.MOSTRAR_SENHA';
  }

  alternarSenha(): void {
    this.mostrarSenha = !this.mostrarSenha;
  }

  private ajustarBlocoDaCnh(): void {
    const cnh = this.formulario.controls.cnh;
    const validade = this.formulario.controls.validadeCnh;
    if (this.ehMotorista) {
      cnh.setValidators([Validators.required, validarCnh]);
      validade.setValidators([Validators.required, validarDataFutura]);
    } else {
      cnh.clearValidators();
      validade.clearValidators();
    }
    cnh.updateValueAndValidity();
    validade.updateValueAndValidity();
    this.detector.markForCheck();
  }

  // A CNH aceita só números: tira tudo que não for dígito enquanto a pessoa digita.
  aoDigitarCnh(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const somenteNumeros = entrada.value.replace(/\D/g, '');
    if (somenteNumeros !== entrada.value) {
      entrada.value = somenteNumeros;
    }
    this.formulario.controls.cnh.setValue(somenteNumeros);
  }

  // ---------- Envio ----------

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
    const valores = this.formulario.getRawValue();
    const dados: CriarUsuarioDto = {
      email: valores.email.trim().toLowerCase(),
      password: valores.senha,
      fullName: valores.nome.trim(),
      roleId: valores.papel,
    };
    if (this.ehMotorista) {
      dados.driver = { licenseNumber: valores.cnh, licenseExpiry: valores.validadeCnh };
    }
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('USUARIO_FORM.CONFIRMAR_TITULO'),
      this.traducao.instant('USUARIO_FORM.CONFIRMAR_TEXTO', {
        nome: dados.fullName,
        email: dados.email,
        papel: this.traducao.instant('PAPEIS.' + this.nomeDoPapelEscolhido()),
      }),
      this.traducao.instant('USUARIO_FORM.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.usuarios.criar(dados).subscribe({
      next: () => this.aoCriar(),
      error: (erro) => this.tratarErro(erro),
    });
  }

  private aoCriar(): void {
    this.notificacao.sucesso(this.traducao.instant('USUARIO_FORM.CRIADO_OK'));
    this.salvando = false;
    if (this.estadoAutenticacao.temPermissao('USER_VIEW')) {
      this.roteador.navigate(['/admin/users']);
    } else {
      this.limparFormulario();
    }
    this.detector.markForCheck();
  }

  // Quem não pode ver a lista fica na tela, com o formulário limpo para o próximo cadastro.
  private limparFormulario(): void {
    this.formulario.reset();
    if (this.papeisDisponiveis.length === 1) {
      this.formulario.controls.papel.setValue(this.papeisDisponiveis[0].id);
    }
  }

  // 400 vai para os campos; 403 e 409 mostram o detail (o 409 no campo de e-mail ou de CNH).
  private tratarErro(erro: unknown): void {
    this.salvando = false;
    const status = statusDoErro(erro);
    if (status === 400) {
      const sobras = aplicarErrosNosCampos(erro, this.formulario, CAMPOS_DA_API, this.traducao);
      this.erroGeral = sobras.join(' ');
      if (!this.erroGeral && !this.algumCampoComErroDoServidor()) {
        this.erroGeral = textoDoErro(erro, this.traducao);
      }
    } else if (status === 409) {
      this.tratarConflito(erro);
    } else {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
    if (this.erroGeral) {
      document.getElementById('alerta-erro-usuario')?.focus();
    }
  }

  // E-mail ou CNH repetidos: o texto aparece no campo certo (ou no aviso, se não der para saber).
  private tratarConflito(erro: unknown): void {
    const texto = textoDoErro(erro, this.traducao);
    const detalhe = (lerProblema(erro)?.detail ?? '').toLowerCase();
    const falaDeEmail = detalhe.includes('email');
    const falaDeCnh = detalhe.includes('license');
    if (falaDeEmail && !falaDeCnh) {
      this.marcarErroNoCampo('email', texto);
    } else if (falaDeCnh && !falaDeEmail) {
      this.marcarErroNoCampo('cnh', texto);
    } else {
      this.erroGeral = texto;
    }
  }

  private marcarErroNoCampo(nome: 'email' | 'cnh', texto: string): void {
    const controle = this.formulario.controls[nome];
    controle.setErrors({ ...(controle.errors ?? {}), servidor: texto });
    controle.markAsTouched();
  }

  private algumCampoComErroDoServidor(): boolean {
    for (const controle of Object.values(this.formulario.controls)) {
      if (controle.errors && controle.errors['servidor']) {
        return true;
      }
    }
    return false;
  }
}
