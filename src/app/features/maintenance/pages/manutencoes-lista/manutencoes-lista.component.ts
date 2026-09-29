import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import {
  Maintenance,
  MaintenanceStatus,
  PaginatedResponse,
  Vehicle,
} from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ColunaTabela } from '../../../../shared/dados/components/tabela-dados/tabela-dados.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { ManutencoesService } from '../../services/manutencoes.service';

const TAMANHO_PAGINA = 10;

// Lista de manutenções, com filtros, aba de removidas e o atalho "Concluir" na linha.
@Component({
  selector: 'app-manutencoes-lista',
  standalone: false,
  templateUrl: './manutencoes-lista.component.html',
})
export class ManutencoesListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  resposta: PaginatedResponse<Maintenance> | null = null;
  paginaAtual = 1;
  filtrosAbertos = true;

  filtroStatus: MaintenanceStatus | '' = '';
  filtroVeiculo = '';

  podeCriar = false;
  podeAtualizar = false;
  verRemovidas = false;
  erroDeAcao = '';
  statusDisponiveis = Object.values(MaintenanceStatus);

  veiculosPorId: Record<string, Vehicle> = {};
  listaVeiculos: Vehicle[] = [];

  colunas: ColunaTabela[] = [
    { chave: 'vehicle', rotulo: 'MANUTENCOES.COL_VEICULO', somenteTabela: true },
    { chave: 'type', rotulo: 'MANUTENCOES.COL_TIPO' },
    { chave: 'status', rotulo: 'MANUTENCOES.COL_STATUS', somenteTabela: true },
    { chave: 'scheduledDate', rotulo: 'MANUTENCOES.COL_DATA' },
    { chave: 'cost', rotulo: 'MANUTENCOES.COL_CUSTO', alinharDireita: true },
  ];

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private manutencoes: ManutencoesService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeCriar = this.estadoAutenticacao.temPermissao('MAINTENANCE_CREATE');
    this.podeAtualizar = this.estadoAutenticacao.temPermissao('MAINTENANCE_UPDATE');
    // No celular os filtros começam fechados (a menos que a URL já traga um filtro).
    this.filtrosAbertos = window.matchMedia('(min-width: 768px)').matches;
    this.filtroVeiculo = this.rota.snapshot.queryParamMap.get('vehicleId') ?? '';
    if (this.temFiltro) {
      this.filtrosAbertos = true;
    }
    this.carregarVeiculos();
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  // Placas ajudam a ler a lista; se falhar, a tela só mostra o que tem.
  private carregarVeiculos(): void {
    this.referencias.veiculos().subscribe((lista) => {
      const porId: Record<string, Vehicle> = {};
      for (const veiculo of lista) {
        porId[veiculo.id] = veiculo;
      }
      this.veiculosPorId = porId;
      this.listaVeiculos = lista;
      this.detector.markForCheck();
    });
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    // Atualiza a tela agora, antes de pedir os dados de novo: evita o estado ficar
    // "preso" de um ciclo de detecção de mudanças anterior (erro NG0100).
    this.detector.detectChanges();
    let chamada = this.manutencoes.listar(this.paginaAtual, TAMANHO_PAGINA, {
      status: this.filtroStatus,
      vehicleId: this.filtroVeiculo,
    });
    if (this.verRemovidas) {
      chamada = this.manutencoes.listarExcluidas(this.paginaAtual, TAMANHO_PAGINA);
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
    this.filtroVeiculo = '';
    this.mudarFiltro();
  }

  get temFiltro(): boolean {
    return !!this.filtroStatus || !!this.filtroVeiculo;
  }

  get quantidadeFiltrosAtivos(): number {
    let total = 0;
    if (this.filtroStatus) {
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

  placaDe(manutencao: Maintenance): string {
    const veiculo = this.veiculosPorId[manutencao.vehicleId];
    if (veiculo) {
      return veiculo.plate;
    }
    return '';
  }

  get chaveTituloVazio(): string {
    if (this.verRemovidas) {
      return 'MANUTENCOES.VAZIO_REMOVIDAS';
    }
    return 'MANUTENCOES.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verRemovidas) {
      return 'COMUM.VAZIO';
    }
    return 'MANUTENCOES.VAZIO_TEXTO';
  }

  // Só dá para concluir o que ainda não foi concluído, e só com MAINTENANCE_UPDATE.
  podeConcluirLinha(manutencao: Maintenance): boolean {
    if (!this.podeAtualizar) {
      return false;
    }
    return manutencao.status !== MaintenanceStatus.COMPLETED;
  }

  mudarAba(mostrarRemovidas: boolean): void {
    this.verRemovidas = mostrarRemovidas;
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  // Texto do alvo nos pop-ups: "manutenção preventiva do veículo ABC1D23".
  private parametrosDe(manutencao: Maintenance): { tipo: string; placa: string } {
    let placa = '—';
    if (this.placaDe(manutencao)) {
      placa = formatarPlaca(this.placaDe(manutencao));
    }
    const tipo = this.traducao.instant('TIPO_MANUTENCAO.' + manutencao.type).toLowerCase();
    return { tipo: tipo, placa: placa };
  }

  async concluir(manutencao: Maintenance): Promise<void> {
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('MANUTENCOES.CONCLUIR_TITULO'),
      this.traducao.instant('MANUTENCOES.CONCLUIR_TEXTO', this.parametrosDe(manutencao)),
      this.traducao.instant('MANUTENCOES.CONCLUIR'),
    );
    if (!confirmou) {
      return;
    }
    this.manutencoes.concluir(manutencao.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MANUTENCOES.CONCLUIDA_OK'));
        this.erroDeAcao = '';
        this.carregar();
      },
      // 400 (data de conclusão antes da agendada) e 409 mostram o detail da API.
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  async excluir(manutencao: Maintenance): Promise<void> {
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('MANUTENCOES.EXCLUIR_TITULO'),
      this.traducao.instant('MANUTENCOES.EXCLUIR_TEXTO', this.parametrosDe(manutencao)),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.manutencoes.excluir(manutencao.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MANUTENCOES.EXCLUIDA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  async restaurar(manutencao: Maintenance): Promise<void> {
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('MANUTENCOES.RESTAURAR_TITULO'),
      this.traducao.instant('MANUTENCOES.RESTAURAR_TEXTO', this.parametrosDe(manutencao)),
      this.traducao.instant('COMUM.RESTAURAR'),
    );
    if (!confirmou) {
      return;
    }
    this.manutencoes.restaurar(manutencao.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MANUTENCOES.RESTAURADA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => this.mostrarErroDeAcao(erro),
    });
  }

  // Modal irreversível (só ADMIN vê o botão).
  async excluirDefinitivamente(manutencao: Maintenance): Promise<void> {
    const nome = this.traducao.instant('MANUTENCOES.NOME_REGISTRO', this.parametrosDe(manutencao));
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(nome);
    if (!confirmou) {
      return;
    }
    this.remocao.excluirDefinitivamente('maintenances', manutencao.id).subscribe({
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
