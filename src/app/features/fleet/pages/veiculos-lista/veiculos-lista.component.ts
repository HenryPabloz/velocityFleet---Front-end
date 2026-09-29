import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { PaginatedResponse, Vehicle, VehicleStatus } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ColunaTabela } from '../../../../shared/dados/components/tabela-dados/tabela-dados.component';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarPlaca, normalizarPlaca } from '../../../../shared/dados/utils/formatacao';
import { VeiculosService } from '../../services/veiculos.service';

const TAMANHO_PAGINA = 12;

// Lista de veículos: status filtra no servidor; busca, modelo e ano filtram só a página carregada.
@Component({
  selector: 'app-veiculos-lista',
  standalone: false,
  templateUrl: './veiculos-lista.component.html',
})
export class VeiculosListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroDeAcao = '';
  resposta: PaginatedResponse<Vehicle> | null = null;
  veiculosVisiveis: Vehicle[] = [];
  modelosDaPagina: string[] = [];

  paginaAtual = 1;
  filtroStatus: VehicleStatus | '' = '';
  verExcluidos = false;
  filtrosAbertos = true;

  // Filtros só do navegador (não vão para a API).
  busca = '';
  filtroModelo = '';
  anoDe: number | null = null;
  anoAte: number | null = null;

  // Cada botão segue a sua permission (esconder é só conforto: a API decide com 403).
  podeCriar = false;
  podeEditar = false;
  podeAgendarManutencao = false;
  statusDisponiveis = Object.values(VehicleStatus);

  colunas: ColunaTabela[] = [
    { chave: 'plate', rotulo: 'VEICULOS.COL_PLACA', somenteTabela: true },
    { chave: 'model', rotulo: 'VEICULOS.COL_MODELO' },
    { chave: 'year', rotulo: 'VEICULOS.COL_ANO' },
    { chave: 'status', rotulo: 'VEICULOS.COL_STATUS', somenteTabela: true },
    { chave: 'currentMileage', rotulo: 'VEICULOS.COL_KM', alinharDireita: true },
  ];

  private assinatura: Subscription | null = null;

  constructor(
    private veiculos: VeiculosService,
    private estadoAutenticacao: AuthStateService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeCriar = this.estadoAutenticacao.temPermissao('VEHICLE_CREATE');
    this.podeEditar = this.estadoAutenticacao.temPermissao('VEHICLE_UPDATE');
    this.podeAgendarManutencao = this.estadoAutenticacao.temPermissao('MAINTENANCE_CREATE');
    // No celular os filtros começam fechados para a lista aparecer logo.
    this.filtrosAbertos = window.matchMedia('(min-width: 768px)').matches;
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    // Atualiza a tela agora, antes de pedir os dados de novo: evita o estado ficar
    // "preso" de um ciclo de detecção de mudanças anterior (erro NG0100).
    this.detector.detectChanges();
    let chamada = this.veiculos.listar(this.paginaAtual, TAMANHO_PAGINA, this.filtroStatus);
    if (this.verExcluidos) {
      chamada = this.veiculos.listarExcluidos(this.paginaAtual, TAMANHO_PAGINA);
    }
    this.assinatura = chamada.subscribe({
      next: (resposta) => {
        this.resposta = resposta;
        this.modelosDaPagina = this.listarModelos(resposta.data);
        this.aplicarFiltrosDoCliente();
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

  private listarModelos(lista: Vehicle[]): string[] {
    const modelos: string[] = [];
    for (const veiculo of lista) {
      if (!modelos.includes(veiculo.model)) {
        modelos.push(veiculo.model);
      }
    }
    return modelos.sort();
  }

  aplicarFiltrosDoCliente(): void {
    const lista = this.resposta?.data ?? [];
    const textoBusca = normalizarPlaca(this.busca);
    const visiveis: Vehicle[] = [];
    for (const veiculo of lista) {
      const placa = normalizarPlaca(veiculo.plate);
      if (textoBusca && !placa.includes(textoBusca)) {
        continue;
      }
      if (this.filtroModelo && veiculo.model !== this.filtroModelo) {
        continue;
      }
      if (this.anoDe !== null && veiculo.year < this.anoDe) {
        continue;
      }
      if (this.anoAte !== null && veiculo.year > this.anoAte) {
        continue;
      }
      visiveis.push(veiculo);
    }
    this.veiculosVisiveis = visiveis;
  }

  // Chaves de texto que mudam quando estamos vendo os veículos excluídos.
  get chaveTitulo(): string {
    if (this.verExcluidos) {
      return 'VEICULOS.TITULO_EXCLUIDOS';
    }
    return 'VEICULOS.TITULO';
  }

  get chaveSubtitulo(): string {
    if (this.verExcluidos) {
      return 'VEICULOS.SUBTITULO_EXCLUIDOS';
    }
    return 'VEICULOS.SUBTITULO';
  }

  get chaveTituloVazio(): string {
    if (this.verExcluidos) {
      return 'VEICULOS.VAZIO_EXCLUIDOS';
    }
    return 'VEICULOS.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verExcluidos) {
      return 'COMUM.VAZIO';
    }
    return 'VEICULOS.VAZIO_TEXTO';
  }

  // Quantos filtros estão ligados (aparece no título do bloco de filtros).
  get quantidadeFiltrosAtivos(): number {
    let total = 0;
    if (this.filtroStatus) {
      total = total + 1;
    }
    if (this.busca) {
      total = total + 1;
    }
    if (this.filtroModelo) {
      total = total + 1;
    }
    if (this.anoDe !== null) {
      total = total + 1;
    }
    if (this.anoAte !== null) {
      total = total + 1;
    }
    return total;
  }

  aoAlternarFiltros(evento: Event): void {
    this.filtrosAbertos = (evento.target as HTMLDetailsElement).open;
  }

  get temFiltroDoCliente(): boolean {
    return !!this.busca || !!this.filtroModelo || this.anoDe !== null || this.anoAte !== null;
  }

  limparFiltrosDoCliente(): void {
    this.busca = '';
    this.filtroModelo = '';
    this.anoDe = null;
    this.anoAte = null;
    this.aplicarFiltrosDoCliente();
  }

  mudarStatus(): void {
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  mudarPagina(pagina: number): void {
    this.paginaAtual = pagina;
    this.erroDeAcao = '';
    this.carregar();
  }

  // Aba "Removidos" (só com VEHICLE_RESTORE): true abre os removidos, false volta aos ativos.
  mudarAba(mostrarRemovidos: boolean): void {
    this.verExcluidos = mostrarRemovidos;
    this.paginaAtual = 1;
    this.filtroStatus = '';
    this.limparFiltrosDoCliente();
    this.erroDeAcao = '';
    this.carregar();
  }

  async excluir(veiculo: Vehicle): Promise<void> {
    const confirmou = await this.confirmacao.confirmar({
      titulo: this.traducao.instant('VEICULOS.EXCLUIR_TITULO'),
      mensagem: this.traducao.instant('VEICULOS.EXCLUIR_TEXTO', {
        placa: formatarPlaca(veiculo.plate),
        modelo: veiculo.model,
      }),
      textoConfirmar: this.traducao.instant('COMUM.EXCLUIR'),
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: true,
    });
    if (!confirmou) {
      return;
    }
    this.veiculos.excluir(veiculo.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('VEICULOS.EXCLUIDO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => {
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }

  async excluirDefinitivamente(veiculo: Vehicle): Promise<void> {
    const nome = formatarPlaca(veiculo.plate) + ' · ' + veiculo.model;
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(nome);
    if (!confirmou) {
      return;
    }
    this.remocao.excluirDefinitivamente('vehicles', veiculo.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('REMOCAO.DEFINITIVA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => {
        // 409 mostra o detail da API (veículo com viagens, manutenções ou incidentes).
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }

  // Veículo removido aparece como inativo (a API devolve isActive false nele).
  estaInativo(veiculo: Vehicle): boolean {
    return this.verExcluidos || veiculo.isActive === false;
  }

  restaurar(veiculo: Vehicle): void {
    this.veiculos.restaurar(veiculo.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('VEICULOS.RESTAURADO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => {
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }

  // Se a página ficou vazia depois de excluir/restaurar, volta uma página.
  private recarregarDepoisDeMudar(): void {
    this.erroDeAcao = '';
    const quantidadeNaPagina = this.resposta?.data.length ?? 0;
    if (quantidadeNaPagina <= 1 && this.paginaAtual > 1) {
      this.paginaAtual = this.paginaAtual - 1;
    }
    this.carregar();
  }
}
