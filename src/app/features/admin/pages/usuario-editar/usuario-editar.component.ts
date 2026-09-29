import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of, Subscription } from 'rxjs';

import { AtualizarUsuarioDto, Role, User } from '../../../../core/models';
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
import { UsuariosService } from '../../services/usuarios.service';

const CAMPOS_DA_API: Record<string, string> = {
  fullName: 'nome',
  isActive: 'ativo',
};

// Editar usuário: só nome e situação (ativo). O papel muda pela tela "Promover papel".
@Component({
  selector: 'app-usuario-editar',
  standalone: false,
  templateUrl: './usuario-editar.component.html',
  styles: [
    `
      .vf-usuario-resumo {
        margin-bottom: var(--vf-espaco-5);
        padding-bottom: var(--vf-espaco-4);
        border-bottom: 1px solid var(--vf-cor-borda);
      }
      .vf-usuario-ativo {
        min-height: 44px;
        padding-top: var(--vf-espaco-2);
      }
    `,
  ],
})
export class UsuarioEditarComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;

  usuario: User | null = null;
  nomeDoPapel = '';
  // Quem não é ADMIN não altera uma conta ADMIN: o formulário fica só para leitura.
  bloqueadoPorSerAdmin = false;
  // Não dá para desativar outro ADMIN nem a própria conta.
  bloquearDesativar = false;

  formulario = new FormGroup({
    nome: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    ativo: new FormControl<boolean>(true, { nonNullable: true }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private idDoUsuario = '';
  private assinaturas: Subscription[] = [];

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private usuarios: UsuariosService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.idDoUsuario = this.rota.snapshot.paramMap.get('id') ?? '';
    this.carregar();
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  carregar(): void {
    this.estado = 'carregando';
    const assinatura = forkJoin({
      usuario: this.usuarios.buscar(this.idDoUsuario),
      papeis: this.usuarios.listarPapeis().pipe(catchError(() => of([] as Role[]))),
    }).subscribe({
      next: (resultado) => {
        this.aplicarUsuario(resultado.usuario, resultado.papeis);
        this.estado = 'ok';
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
    this.assinaturas.push(assinatura);
  }

  private aplicarUsuario(usuario: User, papeis: Role[]): void {
    this.usuario = usuario;
    this.nomeDoPapel = '';
    for (const papel of papeis) {
      if (papel.id === usuario.roleId) {
        this.nomeDoPapel = papel.name;
      }
    }
    const ehAdmin = this.estadoAutenticacao.hasRole('ADMIN');
    const alvoEhAdmin = this.nomeDoPapel === 'ADMIN';
    const ehMinhaConta = usuario.id === this.estadoAutenticacao.usuarioAtual?.id;
    this.bloqueadoPorSerAdmin = !ehAdmin && alvoEhAdmin;
    this.bloquearDesativar = (alvoEhAdmin || ehMinhaConta) && usuario.isActive;

    this.formulario.reset({ nome: usuario.fullName, ativo: usuario.isActive });
    if (this.bloqueadoPorSerAdmin) {
      this.formulario.disable();
    } else {
      this.formulario.enable();
      if (this.bloquearDesativar) {
        this.formulario.controls.ativo.disable();
      }
    }
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'COMUM.SALVANDO';
    }
    return 'USUARIO_EDITAR.SALVAR';
  }

  // ---------- Envio ----------

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.salvando || !this.usuario || this.bloqueadoPorSerAdmin) {
      return;
    }
    if (!validarTudo(this.formulario)) {
      this.detector.detectChanges();
      focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
      return;
    }
    const dados = this.montarAlteracoes(this.usuario);
    if (dados.fullName === undefined && dados.isActive === undefined) {
      this.notificacao.info(this.traducao.instant('USUARIO_EDITAR.SEM_ALTERACAO'));
      return;
    }
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('USUARIO_EDITAR.CONFIRMAR_TITULO'),
      this.traducao.instant('USUARIO_EDITAR.CONFIRMAR_TEXTO', {
        nome: this.usuario.fullName,
        email: this.usuario.email,
      }),
      this.traducao.instant('USUARIO_EDITAR.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.usuarios.atualizar(this.usuario.id, dados).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('USUARIO_EDITAR.SALVO_OK'));
        this.roteador.navigate(['/admin/users']);
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  // Só vão para a API os campos que mudaram.
  private montarAlteracoes(original: User): AtualizarUsuarioDto {
    const valores = this.formulario.getRawValue();
    const dados: AtualizarUsuarioDto = {};
    const nome = valores.nome.trim();
    if (nome !== original.fullName) {
      dados.fullName = nome;
    }
    if (valores.ativo !== original.isActive) {
      dados.isActive = valores.ativo;
    }
    return dados;
  }

  // 400 vai para os campos; 403, 404 e 409 mostram o detail no aviso.
  private tratarErro(erro: unknown): void {
    this.salvando = false;
    if (statusDoErro(erro) === 400) {
      const sobras = aplicarErrosNosCampos(erro, this.formulario, CAMPOS_DA_API, this.traducao);
      this.erroGeral = sobras.join(' ');
    } else {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
    if (this.erroGeral) {
      document.getElementById('alerta-erro-usuario-editar')?.focus();
    }
  }
}
