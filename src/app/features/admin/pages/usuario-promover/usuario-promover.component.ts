import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Subscription } from 'rxjs';

import { Role, User } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { OpcaoDoGrupo } from '../../../../shared/dados/components/grupo-opcoes/grupo-opcoes.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { NIVEL_DO_PAPEL, UsuariosService } from '../../services/usuarios.service';

// Promover papel (só ADMIN): oferece só os papéis acima do atual. Não existe rebaixar.
@Component({
  selector: 'app-usuario-promover',
  standalone: false,
  templateUrl: './usuario-promover.component.html',
  styles: [
    `
      .vf-promover-resumo {
        margin-bottom: var(--vf-espaco-5);
        padding-bottom: var(--vf-espaco-4);
        border-bottom: 1px solid var(--vf-cor-borda);
      }
    `,
  ],
})
export class UsuarioPromoverComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;

  usuario: User | null = null;
  nomeDoPapelAtual = '';
  opcoes: OpcaoDoGrupo[] = [];
  // Motivo pelo qual não dá para promover (conta ADMIN ou a própria conta). Vazio = pode.
  chaveMotivoBloqueio = '';

  formulario = new FormGroup({
    papel: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  private idDoUsuario = '';
  private papeis: Role[] = [];
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
      papeis: this.usuarios.listarPapeis(),
    }).subscribe({
      next: (resultado) => {
        this.papeis = resultado.papeis;
        this.aplicarUsuario(resultado.usuario);
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

  private aplicarUsuario(usuario: User): void {
    this.usuario = usuario;
    this.nomeDoPapelAtual = this.nomeDoPapel(usuario.roleId);
    this.chaveMotivoBloqueio = '';
    if (this.nomeDoPapelAtual === 'ADMIN') {
      this.chaveMotivoBloqueio = 'ERROS_NEGOCIO.ADMIN_NAO_REBAIXA_NEM_PROMOVE';
    }
    if (usuario.id === this.estadoAutenticacao.usuarioAtual?.id) {
      this.chaveMotivoBloqueio = 'ERROS_NEGOCIO.NAO_MUDAR_PROPRIO_PAPEL';
    }
    this.opcoes = this.montarOpcoes();
    this.formulario.reset({ papel: '' });
  }

  private nomeDoPapel(id: string): string {
    for (const papel of this.papeis) {
      if (papel.id === id) {
        return papel.name;
      }
    }
    return '';
  }

  // Só entram os papéis com nível maior que o atual (DRIVER < FLEET_MANAGER < ADMIN).
  private montarOpcoes(): OpcaoDoGrupo[] {
    const nivelAtual = NIVEL_DO_PAPEL[this.nomeDoPapelAtual] ?? 0;
    const lista: OpcaoDoGrupo[] = [];
    for (const papel of this.papeis) {
      const nivel = NIVEL_DO_PAPEL[papel.name] ?? 0;
      if (nivel > nivelAtual) {
        let icone = 'usuario';
        if (papel.name === 'ADMIN') {
          icone = 'admin';
        }
        lista.push({
          valor: papel.id,
          rotulo: this.traducao.instant('PAPEIS.' + papel.name),
          icone: icone,
        });
      }
    }
    // Do menor para o maior nível.
    lista.sort((a, b) => this.nivelDoValor(a.valor) - this.nivelDoValor(b.valor));
    return lista;
  }

  private nivelDoValor(roleId: string): number {
    return NIVEL_DO_PAPEL[this.nomeDoPapel(roleId)] ?? 0;
  }

  get podePromover(): boolean {
    return this.chaveMotivoBloqueio === '' && this.opcoes.length > 0;
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'COMUM.SALVANDO';
    }
    return 'USUARIO_PROMOVER.PROMOVER';
  }

  // ---------- Envio ----------

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.salvando || !this.usuario || !this.podePromover) {
      return;
    }
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.detector.detectChanges();
      document.getElementById('campo-promover-papel')?.querySelector('input')?.focus();
      return;
    }
    const novoId = this.formulario.controls.papel.value;
    const novoNome = this.nomeDoPapel(novoId);
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('USUARIO_PROMOVER.CONFIRMAR_TITULO'),
      this.traducao.instant('USUARIO_PROMOVER.CONFIRMAR_TEXTO', {
        nome: this.usuario.fullName,
        atual: this.traducao.instant('PAPEIS.' + this.nomeDoPapelAtual),
        novo: this.traducao.instant('PAPEIS.' + novoNome),
      }),
      this.traducao.instant('USUARIO_PROMOVER.CONFIRMAR_VERBO'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.usuarios.promover(this.usuario.id, novoId).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('USUARIO_PROMOVER.PROMOVIDO_OK'));
        this.roteador.navigate(['/admin/users']);
      },
      error: (erro) => {
        this.salvando = false;
        this.erroGeral = textoDoErro(erro, this.traducao);
        this.detector.detectChanges();
        document.getElementById('alerta-erro-promover')?.focus();
      },
    });
  }
}
