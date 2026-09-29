import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PaginatedResponse, Role, User } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ColunaTabela } from '../../../../shared/dados/components/tabela-dados/tabela-dados.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { UsuariosService } from '../../services/usuarios.service';

const TAMANHO_PAGINA = 10;

// Lista de usuários: editar, promover, excluir e restaurar, com as regras de proteção das contas ADMIN.
@Component({
  selector: 'app-usuarios-lista',
  standalone: false,
  templateUrl: './usuarios-lista.component.html',
  styleUrl: './usuarios-lista.component.scss',
})
export class UsuariosListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  resposta: PaginatedResponse<User> | null = null;
  paginaAtual = 1;
  verRemovidos = false;
  erroDeAcao = '';
  ocupado = false;

  ehAdmin = false;
  podeCriar = false;
  podeEditar = false;
  podePromover = false;
  meuId = '';

  // Papéis vindos de GET /roles: id -> nome (ADMIN, FLEET_MANAGER, DRIVER).
  nomesDosPapeis: Record<string, string> = {};

  colunas: ColunaTabela[] = [
    { chave: 'fullName', rotulo: 'USUARIOS.COL_NOME' },
    { chave: 'email', rotulo: 'USUARIOS.COL_EMAIL' },
    { chave: 'role', rotulo: 'USUARIOS.COL_PAPEL' },
    { chave: 'isActive', rotulo: 'USUARIOS.COL_ATIVO', somenteTabela: true },
  ];

  private assinatura: Subscription | null = null;

  constructor(
    private usuarios: UsuariosService,
    private estadoAutenticacao: AuthStateService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.ehAdmin = this.estadoAutenticacao.hasRole('ADMIN');
    this.podeCriar = this.estadoAutenticacao.temPermissao('USER_CREATE');
    this.podeEditar = this.estadoAutenticacao.temPermissao('USER_UPDATE');
    this.podePromover = this.ehAdmin && this.estadoAutenticacao.temPermissao('USER_ROLE_PROMOTE');
    this.meuId = this.estadoAutenticacao.usuarioAtual?.id ?? '';
    this.carregarPapeis();
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  // Sem permissão para GET /roles (gerente só com USER_VIEW), a coluna de papel fica vazia.
  private carregarPapeis(): void {
    this.usuarios
      .listarPapeis()
      .pipe(catchError(() => of([] as Role[])))
      .subscribe((papeis) => {
        const mapa: Record<string, string> = {};
        for (const papel of papeis) {
          mapa[papel.id] = papel.name;
        }
        this.nomesDosPapeis = mapa;
        this.detector.markForCheck();
      });
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    // Atualiza a tela agora, antes de pedir os dados de novo: evita o estado ficar
    // "preso" de um ciclo de detecção de mudanças anterior (erro NG0100).
    this.detector.detectChanges();
    let chamada = this.usuarios.listar(this.paginaAtual, TAMANHO_PAGINA);
    if (this.verRemovidos) {
      chamada = this.usuarios.listarExcluidos(this.paginaAtual, TAMANHO_PAGINA);
    }
    this.assinatura = chamada.subscribe({
      next: (resposta) => {
        this.resposta = resposta;
        if (resposta.data.length === 0) {
          this.estado = 'vazio';
        } else {
          this.estado = 'ok';
        }
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  mudarPagina(pagina: number): void {
    this.paginaAtual = pagina;
    this.carregar();
  }

  mudarAba(mostrarRemovidos: boolean): void {
    this.verRemovidos = mostrarRemovidos;
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  get chaveTituloVazio(): string {
    if (this.verRemovidos) {
      return 'USUARIOS.VAZIO_REMOVIDOS';
    }
    return 'USUARIOS.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verRemovidos) {
      return 'COMUM.VAZIO';
    }
    return 'USUARIOS.VAZIO_TEXTO';
  }

  // ---------- Regras de cada linha (a API continua sendo a fonte da verdade) ----------

  nomeDoPapel(usuario: User): string {
    return this.nomesDosPapeis[usuario.roleId] ?? '';
  }

  ehLinhaAdmin(usuario: User): boolean {
    return this.nomeDoPapel(usuario) === 'ADMIN';
  }

  ehMinhaLinha(usuario: User): boolean {
    return usuario.id === this.meuId;
  }

  // Quem não é ADMIN não mexe em conta ADMIN (editar, excluir, restaurar).
  bloqueadoPorSerAdmin(usuario: User): boolean {
    return !this.ehAdmin && this.ehLinhaAdmin(usuario);
  }

  // Desativar ou excluir: nunca em outro ADMIN e nunca a própria conta.
  bloqueadoParaExcluir(usuario: User): boolean {
    return this.ehLinhaAdmin(usuario) || this.ehMinhaLinha(usuario);
  }

  // Na aba "Removidos" só a regra do ADMIN vale para restaurar.
  bloqueadoParaRestaurar(usuario: User): boolean {
    return this.bloqueadoPorSerAdmin(usuario);
  }

  mostrarPromover(usuario: User): boolean {
    if (!this.podePromover || this.verRemovidos) {
      return false;
    }
    return !this.ehLinhaAdmin(usuario) && !this.ehMinhaLinha(usuario);
  }

  // Texto que explica por que a ação está desabilitada.
  motivoDoBloqueio(usuario: User): string {
    if (this.bloqueadoPorSerAdmin(usuario)) {
      return this.traducao.instant('ERROS_NEGOCIO.ADMIN_SO_ADMIN_MODIFICA');
    }
    if (this.ehMinhaLinha(usuario)) {
      return this.traducao.instant('ERROS_NEGOCIO.NAO_DESATIVAR_PROPRIA_CONTA');
    }
    if (this.ehLinhaAdmin(usuario)) {
      return this.traducao.instant('ERROS_NEGOCIO.ADMIN_NAO_DESATIVA');
    }
    return '';
  }

  // ---------- Ações ----------

  private parametrosDe(usuario: User): { nome: string; email: string } {
    return { nome: usuario.fullName, email: usuario.email };
  }

  async excluir(usuario: User): Promise<void> {
    if (this.ocupado) {
      return;
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('USUARIOS.EXCLUIR_TITULO'),
      this.traducao.instant('USUARIOS.EXCLUIR_TEXTO', this.parametrosDe(usuario)),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.ocupado = true;
    this.usuarios.excluir(usuario.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('USUARIOS.EXCLUIDO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  async restaurar(usuario: User): Promise<void> {
    if (this.ocupado) {
      return;
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('USUARIOS.RESTAURAR_TITULO'),
      this.traducao.instant('USUARIOS.RESTAURAR_TEXTO', this.parametrosDe(usuario)),
      this.traducao.instant('COMUM.RESTAURAR'),
    );
    if (!confirmou) {
      return;
    }
    this.ocupado = true;
    this.usuarios.restaurar(usuario.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('USUARIOS.RESTAURADO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  // Modal irreversível (só ADMIN vê o botão). O 409 da API mostra o detail na tela.
  async excluirDefinitivamente(usuario: User): Promise<void> {
    if (this.ocupado) {
      return;
    }
    const nome = this.traducao.instant('USUARIOS.NOME_REGISTRO', this.parametrosDe(usuario));
    const aviso = this.traducao.instant('USUARIOS.DEFINITIVA_AVISO');
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(nome, aviso);
    if (!confirmou) {
      return;
    }
    this.ocupado = true;
    this.remocao.excluirDefinitivamente('users', usuario.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('REMOCAO.DEFINITIVA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  // 403, 404 e 409 mostram o detail da API; depois a lista é recarregada.
  private mostrarErroDeAcao(erro: unknown): void {
    this.ocupado = false;
    this.erroDeAcao = textoDoErro(erro, this.traducao);
    this.detector.markForCheck();
    this.carregar();
  }

  // Se a página ficou vazia depois de mudar algo, volta uma página.
  private recarregarDepoisDeMudar(): void {
    this.ocupado = false;
    this.erroDeAcao = '';
    const quantidadeNaPagina = this.resposta?.data.length ?? 0;
    if (quantidadeNaPagina <= 1 && this.paginaAtual > 1) {
      this.paginaAtual = this.paginaAtual - 1;
    }
    this.carregar();
  }
}
