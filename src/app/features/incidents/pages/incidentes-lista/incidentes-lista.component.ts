import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';

import {
  Driver,
  Incident,
  IncidentStatus,
  PaginatedResponse,
  Severity,
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
import { formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { IncidentesService } from '../../services/incidentes.service';

const TAMANHO_PAGINA = 10;

// Lista de incidentes. Motorista: a API já devolve só os dele (regra OWN), nada é filtrado aqui.
@Component({
  selector: 'app-incidentes-lista',
  standalone: false,
  templateUrl: './incidentes-lista.component.html',
})
export class IncidentesListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  resposta: PaginatedResponse<Incident> | null = null;
  paginaAtual = 1;
  filtrosAbertos = true;

  filtroSeveridade: Severity | '' = '';
  filtroStatus: IncidentStatus | '' = '';
  filtroVeiculo = '';
  filtroMotorista = '';

  podeVerTodos = false;
  podeCriar = false;
  podeVerMotoristas = false;
  verRemovidos = false;
  erroDeAcao = '';
  severidades = Object.values(Severity);
  statusDisponiveis = Object.values(IncidentStatus);

  veiculosPorId: Record<string, Vehicle> = {};
  listaVeiculos: Vehicle[] = [];
  listaMotoristas: Driver[] = [];
  nomesMotoristas: Record<string, string> = {};

  colunas: ColunaTabela[] = [];

  private assinatura: Subscription | null = null;

  constructor(
    private incidentes: IncidentesService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeVerTodos = this.estadoAutenticacao.temPermissao('INCIDENT_VIEW_ALL');
    this.podeCriar = this.estadoAutenticacao.temPermissao('INCIDENT_CREATE');
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
    this.colunas = [{ chave: 'createdAt', rotulo: 'INCIDENTES.COL_DATA' }];
    this.colunas.push({ chave: 'vehicle', rotulo: 'INCIDENTES.COL_VEICULO', somenteTabela: true });
    if (this.podeVerTodos) {
      this.colunas.push({ chave: 'driver', rotulo: 'INCIDENTES.COL_MOTORISTA' });
    }
    this.colunas.push({ chave: 'type', rotulo: 'INCIDENTES.COL_TIPO' });
    this.colunas.push({ chave: 'severity', rotulo: 'INCIDENTES.COL_SEVERIDADE', somenteTabela: true });
    this.colunas.push({ chave: 'status', rotulo: 'INCIDENTES.COL_STATUS', somenteTabela: true });
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
    let chamada = this.incidentes.listar(this.paginaAtual, TAMANHO_PAGINA, {
      severity: this.filtroSeveridade,
      status: this.filtroStatus,
      vehicleId: this.filtroVeiculo,
      driverId: this.filtroMotorista,
    });
    if (this.verRemovidos) {
      chamada = this.incidentes.listarExcluidos(this.paginaAtual, TAMANHO_PAGINA);
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
    this.filtroSeveridade = '';
    this.filtroStatus = '';
    this.filtroVeiculo = '';
    this.filtroMotorista = '';
    this.mudarFiltro();
  }

  get temFiltro(): boolean {
    return this.quantidadeFiltrosAtivos > 0;
  }

  get quantidadeFiltrosAtivos(): number {
    let total = 0;
    if (this.filtroSeveridade) {
      total = total + 1;
    }
    if (this.filtroStatus) {
      total = total + 1;
    }
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

  placaDe(incidente: Incident): string {
    const veiculo = this.veiculosPorId[incidente.vehicleId];
    if (veiculo) {
      return veiculo.plate;
    }
    return '';
  }

  nomeDe(incidente: Incident): string {
    return this.nomesMotoristas[incidente.driverId] ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
  }

  rotuloMotorista(motorista: Driver): string {
    return this.nomesMotoristas[motorista.id] ?? motorista.licenseNumber;
  }

  get chaveTituloVazio(): string {
    if (this.verRemovidos) {
      return 'INCIDENTES.VAZIO_REMOVIDOS';
    }
    return 'INCIDENTES.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verRemovidos) {
      return 'COMUM.VAZIO';
    }
    return 'INCIDENTES.VAZIO_TEXTO';
  }

  mudarAba(mostrarRemovidos: boolean): void {
    this.verRemovidos = mostrarRemovidos;
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  // Texto do alvo nos pop-ups: "incidente de acidente do veículo ABC1D23".
  private parametrosDe(incidente: Incident): { tipo: string; placa: string } {
    let placa = '—';
    if (this.placaDe(incidente)) {
      placa = formatarPlaca(this.placaDe(incidente));
    }
    const tipo = this.traducao.instant('TIPO_INCIDENTE.' + incidente.type).toLowerCase();
    return { tipo: tipo, placa: placa };
  }

  async excluir(incidente: Incident): Promise<void> {
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('INCIDENTES.EXCLUIR_TITULO'),
      this.traducao.instant('INCIDENTES.EXCLUIR_TEXTO', this.parametrosDe(incidente)),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.incidentes.excluir(incidente.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('INCIDENTES.EXCLUIDO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  async restaurar(incidente: Incident): Promise<void> {
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('INCIDENTES.RESTAURAR_TITULO'),
      this.traducao.instant('INCIDENTES.RESTAURAR_TEXTO', this.parametrosDe(incidente)),
      this.traducao.instant('COMUM.RESTAURAR'),
    );
    if (!confirmou) {
      return;
    }
    this.incidentes.restaurar(incidente.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('INCIDENTES.RESTAURADO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  // Modal irreversível (só ADMIN vê o botão). A API também apaga a foto do disco.
  async excluirDefinitivamente(incidente: Incident): Promise<void> {
    const nome = this.traducao.instant('INCIDENTES.NOME_REGISTRO', this.parametrosDe(incidente));
    const aviso = this.traducao.instant('INCIDENTES.DEFINITIVA_AVISO');
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(nome, aviso);
    if (!confirmou) {
      return;
    }
    this.remocao.excluirDefinitivamente('incidents', incidente.id).subscribe({
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
