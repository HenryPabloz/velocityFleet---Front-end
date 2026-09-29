import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';

import {
  Driver,
  PaginatedResponse,
  Trip,
  TripStatus,
  Vehicle,
} from '../../../../core/models';
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
import { ViagensService } from '../../services/viagens.service';

const TAMANHO_PAGINA = 10;

// Lista de viagens. Motorista: a API já devolve só as dele (regra OWN), então nada é filtrado aqui.
@Component({
  selector: 'app-viagens-lista',
  standalone: false,
  templateUrl: './viagens-lista.component.html',
  styleUrl: './viagens-lista.component.scss',
})
export class ViagensListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  resposta: PaginatedResponse<Trip> | null = null;
  paginaAtual = 1;
  filtrosAbertos = true;

  // Filtros enviados à API.
  filtroStatus: TripStatus | '' = '';
  filtroMotorista = '';
  filtroVeiculo = '';

  // Quem tem TRIP_VIEW_ALL vê todas as viagens e pode filtrar por motorista e veículo.
  podeVerTodas = false;
  podeCriar = false;
  podeVerMotoristas = false;
  verRemovidas = false;
  erroDeAcao = '';
  statusDisponiveis = Object.values(TripStatus);

  // Dados de apoio para mostrar placa e nome no lugar de ids.
  veiculosPorId: Record<string, Vehicle> = {};
  listaVeiculos: Vehicle[] = [];
  listaMotoristas: Driver[] = [];
  nomesMotoristas: Record<string, string> = {};

  colunas: ColunaTabela[] = [];

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private viagens: ViagensService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeVerTodas = this.estadoAutenticacao.temPermissao('TRIP_VIEW_ALL');
    this.podeCriar = this.estadoAutenticacao.temPermissao('TRIP_CREATE');
    this.podeVerMotoristas = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.montarColunas();
    // No celular os filtros começam fechados (a menos que a URL já traga um filtro).
    this.filtrosAbertos = window.matchMedia('(min-width: 768px)').matches;
    // Links de outras telas (ex: "Ver viagens deste veículo") chegam com filtros na URL.
    const parametros = this.rota.snapshot.queryParamMap;
    if (this.podeVerTodas) {
      this.filtroMotorista = parametros.get('driverId') ?? '';
      this.filtroVeiculo = parametros.get('vehicleId') ?? '';
    }
    if (this.temFiltro) {
      this.filtrosAbertos = true;
    }
    this.carregarReferencias();
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  private montarColunas(): void {
    this.colunas = [{ chave: 'startTime', rotulo: 'VIAGENS.COL_INICIO' }];
    this.colunas.push({ chave: 'vehicle', rotulo: 'VIAGENS.COL_VEICULO', somenteTabela: true });
    if (this.podeVerTodas) {
      this.colunas.push({ chave: 'driver', rotulo: 'VIAGENS.COL_MOTORISTA' });
    }
    this.colunas.push({ chave: 'route', rotulo: 'VIAGENS.COL_ROTA' });
    this.colunas.push({ chave: 'status', rotulo: 'VIAGENS.COL_STATUS', somenteTabela: true });
    this.colunas.push({ chave: 'km', rotulo: 'VIAGENS.COL_KM', alinharDireita: true });
  }

  // Placas e nomes: se falhar (ex: sem permissão), a tela só mostra o que tem.
  private carregarReferencias(): void {
    // Só tentamos listar motoristas quando a permission existe.
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
    let chamada = this.viagens.listar(this.paginaAtual, TAMANHO_PAGINA, {
      status: this.filtroStatus,
      driverId: this.filtroMotorista,
      vehicleId: this.filtroVeiculo,
    });
    if (this.verRemovidas) {
      chamada = this.viagens.listarExcluidas(this.paginaAtual, TAMANHO_PAGINA);
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
    this.filtroStatus = '';
    this.filtroMotorista = '';
    this.filtroVeiculo = '';
    this.mudarFiltro();
  }

  get temFiltro(): boolean {
    return !!this.filtroStatus || !!this.filtroMotorista || !!this.filtroVeiculo;
  }

  // Quantos filtros estão ligados (aparece no título do bloco de filtros).
  get quantidadeFiltrosAtivos(): number {
    let total = 0;
    if (this.filtroStatus) {
      total = total + 1;
    }
    if (this.filtroMotorista) {
      total = total + 1;
    }
    if (this.filtroVeiculo) {
      total = total + 1;
    }
    return total;
  }

  aoAlternarFiltros(evento: Event): void {
    this.filtrosAbertos = (evento.target as HTMLDetailsElement).open;
  }

  placaDe(viagem: Trip): string {
    const veiculo = this.veiculosPorId[viagem.vehicleId];
    if (veiculo) {
      return veiculo.plate;
    }
    return '';
  }

  nomeDe(viagem: Trip): string {
    return this.nomesMotoristas[viagem.driverId] ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
  }

  get chaveTituloVazio(): string {
    if (this.verRemovidas) {
      return 'VIAGENS.VAZIO_REMOVIDAS';
    }
    return 'VIAGENS.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verRemovidas) {
      return 'COMUM.VAZIO';
    }
    return 'VIAGENS.VAZIO_TEXTO';
  }

  // Km rodados; vazio enquanto a viagem não terminou.
  kmRodados(viagem: Trip): number | null {
    if (viagem.endKm === null) {
      return null;
    }
    return viagem.endKm - viagem.startKm;
  }

  rotuloMotorista(motorista: Driver): string {
    return this.nomesMotoristas[motorista.id] ?? motorista.licenseNumber;
  }

  // Aba "Removidas" (só com TRIP_RESTORE): true abre as removidas, false volta às ativas.
  mudarAba(mostrarRemovidas: boolean): void {
    this.verRemovidas = mostrarRemovidas;
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  // A API só exclui viagem concluída ou cancelada (as outras dão 409).
  podeExcluirLinha(viagem: Trip): boolean {
    return viagem.status === TripStatus.COMPLETED || viagem.status === TripStatus.CANCELLED;
  }

  async excluir(viagem: Trip): Promise<void> {
    const confirmou = await this.confirmacao.confirmar({
      titulo: this.traducao.instant('VIAGENS.EXCLUIR_TITULO'),
      mensagem: this.traducao.instant('VIAGENS.EXCLUIR_TEXTO'),
      textoConfirmar: this.traducao.instant('COMUM.EXCLUIR'),
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: true,
    });
    if (!confirmou) {
      return;
    }
    this.viagens.excluir(viagem.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('VIAGENS.EXCLUIDA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  restaurar(viagem: Trip): void {
    this.viagens.restaurar(viagem.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('VIAGENS.RESTAURADA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  // Modal irreversível. Avisa que os incidentes resolvidos da viagem são apagados junto.
  async excluirDefinitivamente(viagem: Trip): Promise<void> {
    const nome = viagem.startLocation + ' → ' + viagem.endLocation;
    const aviso = this.traducao.instant('VIAGENS.DEFINITIVA_AVISO');
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(nome, aviso);
    if (!confirmou) {
      return;
    }
    this.remocao.excluirDefinitivamente('trips', viagem.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('REMOCAO.DEFINITIVA_OK'));
        this.recarregarDepoisDeMudar();
      },
      // 409 mostra o detail da API (ex: viagem com incidentes não resolvidos).
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
