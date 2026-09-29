import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, Observable, of, Subscription } from 'rxjs';

import { Driver, Refueling, User, Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { statusDoErro, textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarNumero, formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { MotoristasService } from '../../../fleet/services/motoristas.service';
import { VeiculosService } from '../../../fleet/services/veiculos.service';
import { AbastecimentosService } from '../../services/abastecimentos.service';

// Detalhes do abastecimento. A única ação é excluir (REFUELING_DELETE).
@Component({
  selector: 'app-abastecimento-detalhe',
  standalone: false,
  templateUrl: './abastecimento-detalhe.component.html',
})
export class AbastecimentoDetalheComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroNegocio = '';
  processando = false;

  abastecimento: Refueling | null = null;
  veiculo: Vehicle | null = null;
  nomeMotorista = '';
  podeExcluir = false;
  podeVerMotorista = false;

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private elemento: ElementRef<HTMLElement>,
    private abastecimentos: AbastecimentosService,
    private veiculos: VeiculosService,
    private motoristas: MotoristasService,
    private referencias: ReferenciasService,
    private remocao: RemocaoService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeExcluir = this.remocao.podeExcluir('REFUELING');
    this.podeVerMotorista = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
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

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    this.assinatura = this.abastecimentos.buscar(this.id).subscribe({
      next: (abastecimento) => {
        this.abastecimento = abastecimento;
        this.carregarComplementos(abastecimento);
      },
      error: (erro) => {
        // 404 vale para registro inexistente ou de outro motorista.
        if (statusDoErro(erro) === 404) {
          this.voltarNaoEncontrado();
          return;
        }
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  private voltarNaoEncontrado(): void {
    this.notificacao.erro(this.traducao.instant('ABASTECIMENTOS.NAO_ENCONTRADO'));
    this.roteador.navigate(['/refuelings']);
  }

  // Veículo e nome do motorista ajudam, mas a tela abre mesmo se eles falharem.
  private carregarComplementos(abastecimento: Refueling): void {
    let motorista$: Observable<Driver | null> = of(null);
    if (this.podeVerMotorista) {
      motorista$ = this.motoristas.buscar(abastecimento.driverId).pipe(catchError(() => of(null)));
    }
    this.assinatura = forkJoin({
      veiculo: this.veiculos.buscar(abastecimento.vehicleId).pipe(catchError(() => of(null))),
      motorista: motorista$,
    }).subscribe((resultado) => {
      this.veiculo = resultado.veiculo;
      if (resultado.motorista) {
        this.assinatura = this.referencias
          .usuario(resultado.motorista.userId)
          .subscribe((usuario) => this.aplicarNome(usuario));
      }
      this.estado = 'ok';
      this.detector.markForCheck();
    });
  }

  private aplicarNome(usuario: User | null): void {
    if (usuario) {
      this.nomeMotorista = usuario.fullName;
    }
    this.detector.markForCheck();
  }

  async excluir(): Promise<void> {
    if (!this.abastecimento || this.processando) {
      return;
    }
    let placa = '—';
    if (this.veiculo) {
      placa = formatarPlaca(this.veiculo.plate);
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('ABASTECIMENTOS.EXCLUIR_TITULO'),
      this.traducao.instant('ABASTECIMENTOS.EXCLUIR_TEXTO', {
        litros: formatarNumero(this.abastecimento.litersAdded),
        placa: placa,
      }),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    this.abastecimentos.excluir(this.abastecimento.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('ABASTECIMENTOS.EXCLUIDO_OK'));
        this.roteador.navigate(['/refuelings']);
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  // Erro de regra de negócio aparece no aviso da própria tela e leva o foco até ele.
  private mostrarErroDeNegocio(erro: unknown): void {
    this.processando = false;
    if (statusDoErro(erro) === 404) {
      this.voltarNaoEncontrado();
      return;
    }
    this.erroNegocio = textoDoErro(erro, this.traducao);
    this.detector.detectChanges();
    const alerta = this.elemento.nativeElement.querySelector<HTMLElement>('#alerta-erro-negocio');
    alerta?.focus();
  }
}
