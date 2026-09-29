import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

const CHAVE_BARRA = 'vf_barra_recolhida';
const CONSULTA_DESKTOP = '(min-width: 1200px)';
const CONSULTA_TABLET = '(min-width: 768px)';

// Casca das telas internas: barra lateral, cabeçalho, conteúdo e navegação do celular.
@Component({
  selector: 'app-main-layout',
  standalone: false,
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  barraRecolhida = false;
  gavetaAberta = false;

  private consultaDesktop = window.matchMedia(CONSULTA_DESKTOP);
  private consultaTablet = window.matchMedia(CONSULTA_TABLET);
  private assinaturaRota?: Subscription;

  constructor(
    private router: Router,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.ajustarBarraPelaLargura();
    this.consultaDesktop.addEventListener('change', this.aoMudarLarguraDesktop);
    this.consultaTablet.addEventListener('change', this.aoMudarLarguraTablet);

    this.assinaturaRota = this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        this.gavetaAberta = false;
        this.detector.detectChanges();
        // Depois de trocar de tela, o foco vai para o conteúdo novo.
        document.getElementById('conteudo-principal')?.focus({ preventScroll: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.consultaDesktop.removeEventListener('change', this.aoMudarLarguraDesktop);
    this.consultaTablet.removeEventListener('change', this.aoMudarLarguraTablet);
    this.assinaturaRota?.unsubscribe();
  }

  // Com <base href> o link #ancora navegaria para a raiz; aqui só focamos o conteúdo.
  irParaConteudo(evento: Event): void {
    evento.preventDefault();
    const conteudo = document.getElementById('conteudo-principal');
    conteudo?.focus();
    conteudo?.scrollIntoView();
  }

  alternarBarra(): void {
    this.barraRecolhida = !this.barraRecolhida;
    try {
      if (this.barraRecolhida) {
        localStorage.setItem(CHAVE_BARRA, 'true');
      } else {
        localStorage.setItem(CHAVE_BARRA, 'false');
      }
    } catch {
      // Sem localStorage (modo privado): a escolha vale só nesta visita.
    }
  }

  // Enquanto a gaveta está aberta, o resto da tela fica inerte (sem foco e sem clique).
  get atributoInerte(): string | null {
    if (this.gavetaAberta) {
      return '';
    }
    return null;
  }

  abrirGaveta(): void {
    this.gavetaAberta = true;
  }

  // Fecha a gaveta do celular e devolve o foco para o botão do menu.
  fecharGaveta(): void {
    this.gavetaAberta = false;
    // Tira o inert antes de devolver o foco ao botão que abriu a gaveta.
    this.detector.detectChanges();
    document.getElementById('botao-menu-mobile')?.focus();
  }

  private aoMudarLarguraDesktop = (): void => {
    this.ajustarBarraPelaLargura();
    this.detector.detectChanges();
  };

  private aoMudarLarguraTablet = (): void => {
    if (this.consultaTablet.matches) {
      this.gavetaAberta = false;
      this.detector.detectChanges();
    }
  };

  // Sem escolha salva: recolhida no tablet, expandida no desktop.
  private ajustarBarraPelaLargura(): void {
    const salvo = this.lerPreferenciaDaBarra();
    if (salvo === 'true') {
      this.barraRecolhida = true;
    } else if (salvo === 'false') {
      this.barraRecolhida = false;
    } else {
      this.barraRecolhida = !this.consultaDesktop.matches;
    }
  }

  private lerPreferenciaDaBarra(): string | null {
    try {
      return localStorage.getItem(CHAVE_BARRA);
    } catch {
      return null;
    }
  }
}
