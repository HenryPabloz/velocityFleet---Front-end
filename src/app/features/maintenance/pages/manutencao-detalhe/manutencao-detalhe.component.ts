import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of, Subscription } from 'rxjs';

import { Maintenance, MaintenanceStatus, Vehicle } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { statusDoErro, textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { VeiculosService } from '../../../fleet/services/veiculos.service';
import { ManutencoesService } from '../../services/manutencoes.service';

// Detalhes da manutenção: "Concluir" (MAINTENANCE_UPDATE) e "Excluir" (MAINTENANCE_DELETE).
@Component({
  selector: 'app-manutencao-detalhe',
  standalone: false,
  templateUrl: './manutencao-detalhe.component.html',
})
export class ManutencaoDetalheComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroNegocio = '';
  processando = false;

  manutencao: Maintenance | null = null;
  veiculo: Vehicle | null = null;
  podeConcluir = false;
  podeExcluir = false;

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private elemento: ElementRef<HTMLElement>,
    private manutencoes: ManutencoesService,
    private veiculos: VeiculosService,
    private remocao: RemocaoService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeConcluir = this.estadoAutenticacao.temPermissao('MAINTENANCE_UPDATE');
    this.podeExcluir = this.remocao.podeExcluir('MAINTENANCE');
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  get id(): string {
    return this.rota.snapshot.paramMap.get('id') ?? '';
  }

  get placa(): string {
    if (!this.veiculo) {
      return '';
    }
    return this.veiculo.plate;
  }

  // "Concluir" só existe enquanto a manutenção está agendada ou em andamento.
  get podeMostrarConcluir(): boolean {
    if (!this.manutencao || !this.podeConcluir) {
      return false;
    }
    return this.manutencao.status !== MaintenanceStatus.COMPLETED;
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    this.assinatura = this.manutencoes.buscar(this.id).subscribe({
      next: (manutencao) => {
        this.manutencao = manutencao;
        this.carregarVeiculo(manutencao);
      },
      error: (erro) => {
        if (statusDoErro(erro) === 404) {
          this.voltarNaoEncontrada();
          return;
        }
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  private voltarNaoEncontrada(): void {
    this.notificacao.erro(this.traducao.instant('MANUTENCOES.NAO_ENCONTRADA'));
    this.roteador.navigate(['/maintenance']);
  }

  // O veículo ajuda a leitura, mas a tela abre mesmo se ele falhar.
  private carregarVeiculo(manutencao: Maintenance): void {
    this.assinatura = this.veiculos
      .buscar(manutencao.vehicleId)
      .pipe(catchError(() => of(null)))
      .subscribe((veiculo) => {
        this.veiculo = veiculo;
        this.estado = 'ok';
        this.detector.markForCheck();
      });
  }

  private parametros(): { tipo: string; placa: string } {
    let placa = '—';
    if (this.veiculo) {
      placa = formatarPlaca(this.veiculo.plate);
    }
    let tipo = '';
    if (this.manutencao) {
      tipo = this.traducao.instant('TIPO_MANUTENCAO.' + this.manutencao.type).toLowerCase();
    }
    return { tipo: tipo, placa: placa };
  }

  async concluir(): Promise<void> {
    if (!this.manutencao || this.processando) {
      return;
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('MANUTENCOES.CONCLUIR_TITULO'),
      this.traducao.instant('MANUTENCOES.CONCLUIR_TEXTO', this.parametros()),
      this.traducao.instant('MANUTENCOES.CONCLUIR'),
    );
    if (!confirmou) {
      return;
    }
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    this.manutencoes.concluir(this.manutencao.id).subscribe({
      next: (atualizada) => {
        this.processando = false;
        this.manutencao = atualizada;
        this.notificacao.sucesso(this.traducao.instant('MANUTENCOES.CONCLUIDA_OK'));
        // O veículo mudou de status (a API o liberou): busca de novo para mostrar o estado real.
        this.carregarVeiculo(atualizada);
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  async excluir(): Promise<void> {
    if (!this.manutencao || this.processando) {
      return;
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('MANUTENCOES.EXCLUIR_TITULO'),
      this.traducao.instant('MANUTENCOES.EXCLUIR_TEXTO', this.parametros()),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    this.manutencoes.excluir(this.manutencao.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MANUTENCOES.EXCLUIDA_OK'));
        this.roteador.navigate(['/maintenance']);
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  // Erro de regra de negócio (400, 409) aparece no aviso da própria tela e leva o foco até ele.
  private mostrarErroDeNegocio(erro: unknown): void {
    this.processando = false;
    if (statusDoErro(erro) === 404) {
      this.voltarNaoEncontrada();
      return;
    }
    this.erroNegocio = textoDoErro(erro, this.traducao);
    this.detector.detectChanges();
    const alerta = this.elemento.nativeElement.querySelector<HTMLElement>('#alerta-erro-negocio');
    alerta?.focus();
  }
}
