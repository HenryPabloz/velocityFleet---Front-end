import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, skip } from 'rxjs';

import { AuthStateService } from '../../../core/services/auth-state.service';
import { ligarAnimacaoDoIndicador, posicionarIndicador } from '../../menu/indicador-menu';
import { ItemMenu, itemEstaAtivo, itensDasPermissoes } from '../../menu/itens-menu';

// Menu lateral: só ícones no tablet, com rótulos no desktop e vira gaveta no celular.
@Component({
  selector: 'app-sidebar',
  standalone: false,
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() recolhida = false;
  @Input() gavetaAberta = false;
  @Output() alternarRecolhimento = new EventEmitter<void>();
  @Output() fecharGaveta = new EventEmitter<void>();

  @ViewChild('menu') menu?: ElementRef<HTMLElement>;

  itens: ItemMenu[] = [];
  urlAtual = '';

  private assinaturaRota?: Subscription;
  private assinaturaUsuario?: Subscription;

  constructor(
    private router: Router,
    private estadoAutenticacao: AuthStateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.montarItens();
    // Se a renovação da sessão trouxer permissions novas, o menu se ajusta.
    this.assinaturaUsuario = this.estadoAutenticacao.user$.pipe(skip(1)).subscribe(() => {
      this.montarItens();
      this.detector.detectChanges();
      posicionarIndicador(this.menu?.nativeElement);
    });
    this.urlAtual = this.router.url;

    this.assinaturaRota = this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        this.urlAtual = evento.urlAfterRedirects;
        this.detector.detectChanges();
        posicionarIndicador(this.menu?.nativeElement);
      }
    });
  }

  ngAfterViewInit(): void {
    posicionarIndicador(this.menu?.nativeElement);
    ligarAnimacaoDoIndicador(this.menu?.nativeElement);
  }

  // Ao abrir a gaveta no celular, o foco vai para o botão de fechar.
  ngOnChanges(mudancas: SimpleChanges): void {
    if (mudancas['gavetaAberta'] && this.gavetaAberta) {
      setTimeout(() => {
        document.getElementById('botao-fechar-gaveta')?.focus();
      }, 0);
    }
  }

  ngOnDestroy(): void {
    this.assinaturaRota?.unsubscribe();
    this.assinaturaUsuario?.unsubscribe();
  }

  private montarItens(): void {
    const permissoes = this.estadoAutenticacao.usuarioAtual?.permissions ?? [];
    this.itens = itensDasPermissoes(permissoes);
  }

  // Só é "dialog" enquanto a gaveta do celular está aberta.
  get papelDaGaveta(): string | null {
    if (this.gavetaAberta) {
      return 'dialog';
    }
    return null;
  }

  get modalDaGaveta(): string | null {
    if (this.gavetaAberta) {
      return 'true';
    }
    return null;
  }

  get rotuloDaGaveta(): string {
    return 'MENU.GAVETA';
  }

  estaAtivo(item: ItemMenu): boolean {
    return itemEstaAtivo(item, this.urlAtual);
  }

  valorAriaCurrent(item: ItemMenu): string | null {
    if (this.estaAtivo(item)) {
      return 'page';
    }
    return null;
  }

  sair(): void {
    this.estadoAutenticacao.logout();
  }

  // Com a gaveta aberta, Tab e Shift+Tab giram só entre os itens dela.
  @HostListener('keydown', ['$event'])
  aoApertarTab(evento: KeyboardEvent): void {
    if (!this.gavetaAberta || evento.key !== 'Tab') {
      return;
    }
    const raiz = document.getElementById('barra-lateral');
    if (!raiz) {
      return;
    }
    const candidatos = raiz.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const focaveis: HTMLElement[] = [];
    candidatos.forEach((elemento) => {
      if (elemento.offsetParent !== null) {
        focaveis.push(elemento);
      }
    });
    if (focaveis.length === 0) {
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  @HostListener('document:keydown.escape')
  aoApertarEsc(): void {
    if (this.gavetaAberta) {
      this.fecharGaveta.emit();
    }
  }
}
