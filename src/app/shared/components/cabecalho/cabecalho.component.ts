import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { Notificacao, NotificacoesService } from '../../../core/services/notificacoes.service';
import { AuthStateService } from '../../../core/services/auth-state.service';

type MenuDoCabecalho = 'notificacoes' | 'usuario';

// Topo do conteúdo: saudação, notificações, tema e menu do usuário.
@Component({
  selector: 'app-cabecalho',
  standalone: false,
  templateUrl: './cabecalho.component.html',
})
export class CabecalhoComponent implements OnInit, OnDestroy {
  @Input() menuMobileAberto = false;
  @Output() abrirMenuMobile = new EventEmitter<void>();

  @ViewChild('botaoNotificacoes') botaoNotificacoes?: ElementRef<HTMLElement>;
  @ViewChild('botaoUsuario') botaoUsuario?: ElementRef<HTMLElement>;

  menuAberto: MenuDoCabecalho | null = null;
  chaveSaudacao = 'CABECALHO.SAUDACAO_MANHA';
  primeiroNome = '';
  nomeCompleto = '';
  email = '';
  papel = '';
  iniciais = '';
  notificacoes: Notificacao[] = [];
  naoLidas = 0;

  private assinaturaNotificacoes?: Subscription;
  private assinaturaUsuario?: Subscription;
  private relogio?: ReturnType<typeof setInterval>;

  constructor(
    private estadoAutenticacao: AuthStateService,
    private notificacoesService: NotificacoesService,
    private detector: ChangeDetectorRef,
    private elemento: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    // Se o nome mudar (Minha conta), o cabeçalho acompanha.
    this.assinaturaUsuario = this.estadoAutenticacao.user$.subscribe(() => {
      this.carregarUsuario();
      this.atualizarSaudacao();
      this.detector.markForCheck();
    });
    this.atualizarSaudacao();
    // A saudação muda sozinha quando vira a hora (checa a cada minuto).
    this.relogio = setInterval(() => {
      this.atualizarSaudacao();
      this.detector.detectChanges();
    }, 60000);

    this.assinaturaNotificacoes = this.notificacoesService.lista$.subscribe((lista) => {
      this.notificacoes = lista;
      this.naoLidas = this.notificacoesService.quantidadeNaoLidas;
      this.detector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.relogio);
    this.assinaturaNotificacoes?.unsubscribe();
    this.assinaturaUsuario?.unsubscribe();
  }

  alternarMenu(nome: MenuDoCabecalho): void {
    if (this.menuAberto === nome) {
      this.menuAberto = null;
    } else {
      this.menuAberto = nome;
    }
  }

  fecharMenus(): void {
    this.menuAberto = null;
  }

  get papelConhecido(): boolean {
    return this.papel === 'DRIVER' || this.papel === 'FLEET_MANAGER' || this.papel === 'ADMIN';
  }

  sair(): void {
    this.menuAberto = null;
    this.estadoAutenticacao.logout();
  }

  // Esc fecha o painel aberto e devolve o foco para o botão que o abriu.
  @HostListener('document:keydown.escape')
  aoApertarEsc(): void {
    if (this.menuAberto === 'notificacoes') {
      this.botaoNotificacoes?.nativeElement.focus();
    }
    if (this.menuAberto === 'usuario') {
      this.botaoUsuario?.nativeElement.focus();
    }
    this.menuAberto = null;
  }

  @HostListener('document:click', ['$event.target'])
  aoClicarFora(alvo: EventTarget | null): void {
    if (this.menuAberto && alvo instanceof Node) {
      const grupo = (alvo as HTMLElement).closest?.('.vf-cabecalho__grupo');
      if (!grupo || !this.elemento.nativeElement.contains(grupo)) {
        this.menuAberto = null;
      }
    }
  }

  // Se o foco sair do grupo (Tab), o painel fecha.
  aoSairDoGrupo(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    const grupo = evento.currentTarget as HTMLElement;
    if (destino) {
      if (!grupo.contains(destino)) {
        this.menuAberto = null;
      }
      return;
    }
    // Sem destino (foco foi para fora da página): confere logo depois.
    setTimeout(() => {
      if (!grupo.contains(document.activeElement)) {
        this.menuAberto = null;
        this.detector.detectChanges();
      }
    }, 0);
  }

  private carregarUsuario(): void {
    const usuario = this.estadoAutenticacao.usuarioAtual;
    if (!usuario) {
      return;
    }
    this.nomeCompleto = usuario.fullName;
    this.email = usuario.email;
    this.papel = usuario.role;

    const nomeLimpo = (usuario.fullName ?? '').trim();
    if (nomeLimpo === '') {
      return;
    }
    const partes = nomeLimpo.split(/\s+/);
    this.primeiroNome = partes[0];
    this.iniciais = partes[0].charAt(0).toUpperCase();
    if (partes.length > 1) {
      this.iniciais = this.iniciais + partes[partes.length - 1].charAt(0).toUpperCase();
    }
  }

  private atualizarSaudacao(): void {
    const hora = new Date().getHours();
    let chave = 'CABECALHO.SAUDACAO_NOITE';
    if (hora < 12) {
      chave = 'CABECALHO.SAUDACAO_MANHA';
    } else if (hora < 18) {
      chave = 'CABECALHO.SAUDACAO_TARDE';
    }
    // Sem nome na sessão, usa o cumprimento sem o nome.
    if (this.primeiroNome === '') {
      chave = chave + '_SEM_NOME';
    }
    this.chaveSaudacao = chave;
  }
}
