import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, skip } from 'rxjs';

import { AuthStateService } from '../../../core/services/auth-state.service';
import { ligarAnimacaoDoIndicador, posicionarIndicador } from '../../menu/indicador-menu';
import { ItemMenu, itemEstaAtivo, itensDasPermissoes } from '../../menu/itens-menu';

const QUANTIDADE_FIXA = 4;

// Navegação do celular: 4 atalhos fixos e o botão "Mais" com o resto dos itens permitidos.
@Component({
  selector: 'app-bottom-tab',
  standalone: false,
  templateUrl: './bottom-tab.component.html',
})
export class BottomTabComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('menu') menu?: ElementRef<HTMLElement>;
  @ViewChild('botaoMais') botaoMais?: ElementRef<HTMLElement>;

  itensFixos: ItemMenu[] = [];
  itensExtras: ItemMenu[] = [];
  urlAtual = '';
  maisAberto = false;

  private assinaturaRota?: Subscription;
  private assinaturaUsuario?: Subscription;

  constructor(
    private router: Router,
    private estadoAutenticacao: AuthStateService,
    private detector: ChangeDetectorRef,
    private elemento: ElementRef<HTMLElement>,
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
        this.maisAberto = false;
        this.detector.detectChanges();
        posicionarIndicador(this.menu?.nativeElement);
      }
    });
  }

  ngAfterViewInit(): void {
    posicionarIndicador(this.menu?.nativeElement);
    ligarAnimacaoDoIndicador(this.menu?.nativeElement);
  }

  ngOnDestroy(): void {
    this.assinaturaRota?.unsubscribe();
    this.assinaturaUsuario?.unsubscribe();
  }

  private montarItens(): void {
    const permissoes = this.estadoAutenticacao.usuarioAtual?.permissions ?? [];
    const todos = itensDasPermissoes(permissoes);
    this.itensFixos = todos.slice(0, QUANTIDADE_FIXA);
    this.itensExtras = todos.slice(QUANTIDADE_FIXA);
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

  // "Mais" fica ativo quando a tela atual é um dos itens escondidos.
  get maisEstaAtivo(): boolean {
    for (const item of this.itensExtras) {
      if (this.estaAtivo(item)) {
        return true;
      }
    }
    return false;
  }

  alternarMais(): void {
    this.maisAberto = !this.maisAberto;
  }

  fecharMais(): void {
    this.maisAberto = false;
  }

  @HostListener('document:keydown.escape')
  aoApertarEsc(): void {
    if (this.maisAberto) {
      this.maisAberto = false;
      this.botaoMais?.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event.target'])
  aoClicarFora(alvo: EventTarget | null): void {
    if (this.maisAberto && alvo instanceof Node) {
      if (!this.elemento.nativeElement.contains(alvo)) {
        this.maisAberto = false;
      }
    }
  }

  // O tamanho dos itens muda com a largura da tela, então recalcula.
  @HostListener('window:resize')
  aoRedimensionar(): void {
    posicionarIndicador(this.menu?.nativeElement);
  }

  aoSairDoGrupo(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    const grupo = evento.currentTarget as HTMLElement;
    if (destino) {
      if (!grupo.contains(destino)) {
        this.maisAberto = false;
      }
      return;
    }
    setTimeout(() => {
      if (!grupo.contains(document.activeElement)) {
        this.maisAberto = false;
        this.detector.detectChanges();
      }
    }, 0);
  }
}
