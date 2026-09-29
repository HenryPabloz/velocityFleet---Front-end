import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { VeiculosService } from '../../services/veiculos.service';

// Detalhes de um veículo, com as ações de gestão (editar, agendar manutenção, excluir).
@Component({
  selector: 'app-veiculo-detalhe',
  standalone: false,
  templateUrl: './veiculo-detalhe.component.html',
  styleUrl: './veiculo-detalhe.component.scss',
})
export class VeiculoDetalheComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroDeAcao = '';
  veiculo: Vehicle | null = null;
  // Cada botão segue a sua permission (esconder é só conforto: a API decide com 403).
  podeEditar = false;
  podeAgendarManutencao = false;
  podeExcluir = false;
  podeVerViagens = false;

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private veiculos: VeiculosService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeEditar = this.estadoAutenticacao.temPermissao('VEHICLE_UPDATE');
    this.podeAgendarManutencao = this.estadoAutenticacao.temPermissao('MAINTENANCE_CREATE');
    this.podeExcluir = this.estadoAutenticacao.temPermissao('VEHICLE_DELETE');
    this.podeVerViagens = this.estadoAutenticacao.temPermissao('TRIP_VIEW_ALL');
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  get id(): string {
    return this.rota.snapshot.paramMap.get('id') ?? '';
  }

  // Km rodados desde a última manutenção.
  get kmDesdeManutencao(): number {
    if (!this.veiculo) {
      return 0;
    }
    return this.veiculo.currentMileage - this.veiculo.lastMaintenanceKm;
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    this.assinatura = this.veiculos.buscar(this.id).subscribe({
      next: (veiculo) => {
        this.veiculo = veiculo;
        this.estado = 'ok';
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  async excluir(): Promise<void> {
    if (!this.veiculo) {
      return;
    }
    const confirmou = await this.confirmacao.confirmar({
      titulo: this.traducao.instant('VEICULOS.EXCLUIR_TITULO'),
      mensagem: this.traducao.instant('VEICULOS.EXCLUIR_TEXTO', {
        placa: formatarPlaca(this.veiculo.plate),
        modelo: this.veiculo.model,
      }),
      textoConfirmar: this.traducao.instant('COMUM.EXCLUIR'),
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: true,
    });
    if (!confirmou) {
      return;
    }
    this.veiculos.excluir(this.veiculo.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('VEICULOS.EXCLUIDO_OK'));
        this.roteador.navigate(['/fleet/vehicles']);
      },
      error: (erro) => {
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }
}
