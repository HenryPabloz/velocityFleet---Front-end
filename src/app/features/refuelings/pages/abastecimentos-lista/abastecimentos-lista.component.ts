import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';

import { Driver, PaginatedResponse, Refueling, Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ColunaTabela } from '../../../../shared/dados/components/tabela-dados/tabela-dados.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import {
  montarNomesDosMotoristas,
  ReferenciasService,
} from '../../../../shared/dados/services/referencias.service';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarNumero, formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { AbastecimentosService } from '../../services/abastecimentos.service';

const TAMANHO_PAGINA = 10;

// Lista de abastecimentos. Motorista: a API já devolve só os dele (regra OWN), nada é filtrado aqui.
@Component({
  selector: 'app-abastecimentos-lista',
  standalone: false,
  templateUrl: './abastecimentos-lista.component.html',
})
export class AbastecimentosListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  resposta: PaginatedResponse<Refueling> | null = null;
  paginaAtual = 1;
  filtrosAbertos = true;

  filtroVeiculo = '';
  filtroMotorista = '';

  podeVerTodos = false;
  podeCriar = false;
  podeVerMotoristas = false;
  verRemovidos = false;
  erroDeAcao = '';

  veiculosPorId: Record<string, Vehicle> = {};
  listaVeiculos: Vehicle[] = [];
  listaMotoristas: Driver[] = [];
  nomesMotoristas: Record<string, string> = {};

  colunas: ColunaTabela[] = [];

  private assinatura: Subscription | null = null;

  constructor(
    private abastecimentos: AbastecimentosService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeVerTodos = this.estadoAutenticacao.temPermissao('REFUELING_VIEW_ALL');
    this.podeCriar = this.estadoAutenticacao.temPermissao('REFUELING_CREATE');
    this.podeVerMotoristas = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.montarColunas();
    // No celular os filtros começam fechados.
    this.filtrosAbertos = window.matchMedia('(min-width: 768px)').matches;
    this.carregarReferencias();
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  private montarColunas(): void {
    this.colunas = [{ chave: 'createdAt', rotulo: 'ABASTECIMENTOS.COL_DATA' }];
    this.colunas.push({ chave: 'vehicle', rotulo: 'ABASTECIMENTOS.COL_VEICULO', somenteTabela: true });
    if (this.podeVerTodos) {
      this.colunas.push({ chave: 'driver', rotulo: 'ABASTECIMENTOS.COL_MOTORISTA' });
    }
    this.colunas.push({ chave: 'fuelType', rotulo: 'ABASTECIMENTOS.COL_COMBUSTIVEL' });
    this.colunas.push({ chave: 'liters', rotulo: 'ABASTECIMENTOS.COL_LITROS', alinharDireita: true });
    this.colunas.push({ chave: 'total', rotulo: 'ABASTECIMENTOS.COL_TOTAL', alinharDireita: true });
  }

  // Placas e nomes: se falhar (ex: sem permissão), a tela só mostra o que tem.
  private carregarReferencias(): void {
    let motoristas$: Observable<Driver[]> = of([]);
    if (this.podeVerMotoristas) {
      motoristas$ = this.referencias.motoristas();
    }
    forkJoin({
      veiculos: this.referencias.veiculos(),
      motoristas: motoristas$,
    }).subscribe((resultado) => {
      const porId: Record<string, Vehicle> = {};
      for (const veiculo of resultado.veiculos) {
        porId[veiculo.id] = veiculo;
      }
      this.veiculosPorId = porId;
      this.listaVeiculos = resultado.veiculos;
      this.listaMotoristas = resultado.motoristas;
      this.nomesMotoristas = montarNomesDosMotoristas(resultado.motoristas);
      this.detector.markForCheck();
    });
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    // Atualiza a tela agora, antes de pedir os dados de novo: evita o estado ficar
    // "preso" de um ciclo de detecção de mudanças anterior (erro NG0100).
    this.detector.detectChanges();
    let chamada = this.abastecimentos.listar(this.paginaAtual, TAMANHO_PAGINA, {
      vehicleId: this.filtroVeiculo,
      driverId: this.filtroMotorista,
    });
    if (this.verRemovidos) {
      chamada = this.abastecimentos.listarExcluidos(this.paginaAtual, TAMANHO_PAGINA);
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

  mudarFiltro(): void {
    this.paginaAtual = 1;
    this.carregar();
  }

  mudarPagina(pagina: number): void {
    this.paginaAtual = pagina;
    this.carregar();
  }

  limparFiltros(): void {
    this.filtroVeiculo = '';
    this.filtroMotorista = '';
    this.mudarFiltro();
  }

  get temFiltro(): boolean {
    return !!this.filtroVeiculo || !!this.filtroMotorista;
  }

  get quantidadeFiltrosAtivos(): number {
    let total = 0;
    if (this.filtroVeiculo) {
      total = total + 1;
    }
    if (this.filtroMotorista) {
      total = total + 1;
    }
    return total;
  }

  aoAlternarFiltros(evento: Event): void {
    this.filtrosAbertos = (evento.target as HTMLDetailsElement).open;
  }

  placaDe(abastecimento: Refueling): string {
    const veiculo = this.veiculosPorId[abastecimento.vehicleId];
    if (veiculo) {
      return veiculo.plate;
    }
    return '';
  }

  nomeDe(abastecimento: Refueling): string {
    return this.nomesMotoristas[abastecimento.driverId] ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
  }

  rotuloMotorista(motorista: Driver): string {
    return this.nomesMotoristas[motorista.id] ?? motorista.licenseNumber;
  }

  get chaveTituloVazio(): string {
    if (this.verRemovidos) {
      return 'ABASTECIMENTOS.VAZIO_REMOVIDOS';
    }
    return 'ABASTECIMENTOS.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verRemovidos) {
      return 'COMUM.VAZIO';
    }
    return 'ABASTECIMENTOS.VAZIO_TEXTO';
  }

  mudarAba(mostrarRemovidos: boolean): void {
    this.verRemovidos = mostrarRemovidos;
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  // Dados do abastecimento para os textos dos pop-ups de confirmação.
  private parametrosDe(abastecimento: Refueling): { litros: string; placa: string } {
    let placa = this.placaDe(abastecimento);
    if (!placa) {
      placa = '—';
    }
    return { litros: formatarNumero(abastecimento.litersAdded), placa: formatarPlaca(placa) };
  }

  async excluir(abastecimento: Refueling): Promise<void> {
    const parametros = this.parametrosDe(abastecimento);
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('ABASTECIMENTOS.EXCLUIR_TITULO'),
      this.traducao.instant('ABASTECIMENTOS.EXCLUIR_TEXTO', parametros),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.abastecimentos.excluir(abastecimento.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('ABASTECIMENTOS.EXCLUIDO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  async restaurar(abastecimento: Refueling): Promise<void> {
    const parametros = this.parametrosDe(abastecimento);
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('ABASTECIMENTOS.RESTAURAR_TITULO'),
      this.traducao.instant('ABASTECIMENTOS.RESTAURAR_TEXTO', parametros),
      this.traducao.instant('COMUM.RESTAURAR'),
    );
    if (!confirmou) {
      return;
    }
    this.abastecimentos.restaurar(abastecimento.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('ABASTECIMENTOS.RESTAURADO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  // Modal irreversível (só ADMIN vê o botão).
  async excluirDefinitivamente(abastecimento: Refueling): Promise<void> {
    const nome = this.traducao.instant('ABASTECIMENTOS.NOME_REGISTRO', this.parametrosDe(abastecimento));
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(nome);
    if (!confirmou) {
      return;
    }
    this.remocao.excluirDefinitivamente('refuelings', abastecimento.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('REMOCAO.DEFINITIVA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  private mostrarErroDeAcao(erro: unknown): void {
    this.erroDeAcao = textoDoErro(erro, this.traducao);
    this.detector.markForCheck();
  }

  // Se a página ficou vazia depois de mudar algo, volta uma página.
  private recarregarDepoisDeMudar(): void {
    this.erroDeAcao = '';
    const quantidadeNaPagina = this.resposta?.data.length ?? 0;
    if (quantidadeNaPagina <= 1 && this.paginaAtual > 1) {
      this.paginaAtual = this.paginaAtual - 1;
    }
    this.carregar();
  }
}
