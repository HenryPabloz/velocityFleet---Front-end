import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, Observable, of, Subscription } from 'rxjs';

import { Driver, Trip, TripStatus, User, Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { statusDoErro, textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { MotoristasService } from '../../../fleet/services/motoristas.service';
import { VeiculosService } from '../../../fleet/services/veiculos.service';
import { FinalizarViagemService } from '../../components/modal-finalizar-viagem/modal-finalizar-viagem.component';
import { ViagensService } from '../../services/viagens.service';

// Passos do andamento normal de uma viagem (cancelada é mostrada à parte).
const ETAPAS: TripStatus[] = [TripStatus.PLANNED, TripStatus.IN_PROGRESS, TripStatus.COMPLETED];

// Detalhes da viagem e as ações de cada status: iniciar (sem modal), finalizar (modal de km rodados),
// cancelar e excluir (TRIP_DELETE).
@Component({
  selector: 'app-viagem-detalhe',
  standalone: false,
  templateUrl: './viagem-detalhe.component.html',
  styleUrl: './viagem-detalhe.component.scss',
})
export class ViagemDetalheComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroNegocio = '';
  processando = false;

  viagem: Trip | null = null;
  veiculo: Vehicle | null = null;
  nomeMotorista = '';
  podeExcluir = false;
  podeVerMotorista = false;

  etapas = ETAPAS;

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private elemento: ElementRef<HTMLElement>,
    private viagens: ViagensService,
    private veiculos: VeiculosService,
    private motoristas: MotoristasService,
    private referencias: ReferenciasService,
    private finalizacao: FinalizarViagemService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeExcluir = this.estadoAutenticacao.temPermissao('TRIP_DELETE');
    this.podeVerMotorista = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  get id(): string {
    return this.rota.snapshot.paramMap.get('id') ?? '';
  }

  get status(): TripStatus | '' {
    return this.viagem?.status ?? '';
  }

  get planejada(): boolean {
    return this.status === TripStatus.PLANNED;
  }

  get emAndamento(): boolean {
    return this.status === TripStatus.IN_PROGRESS;
  }

  get encerrada(): boolean {
    return this.status === TripStatus.COMPLETED || this.status === TripStatus.CANCELLED;
  }

  get cancelada(): boolean {
    return this.status === TripStatus.CANCELLED;
  }

  // Posição do status no andamento (0, 1 ou 2); cancelada não entra na régua.
  get posicaoEtapa(): number {
    return ETAPAS.indexOf(this.viagem?.status ?? TripStatus.PLANNED);
  }

  // Distância da viagem: distanceKm (vem no PATCH /end) ou endKm - startKm quando a viagem foi recarregada.
  get distanciaKm(): number | null {
    if (!this.viagem) {
      return null;
    }
    if (this.viagem.distanceKm !== undefined && this.viagem.distanceKm !== null) {
      return this.viagem.distanceKm;
    }
    if (this.viagem.endKm === null) {
      return null;
    }
    return this.viagem.endKm - this.viagem.startKm;
  }

  get placa(): string {
    if (!this.veiculo) {
      return '';
    }
    return this.veiculo.plate;
  }

  // Régua de andamento: etapa já vencida, etapa em curso e ícone de cada etapa.
  etapaFeita(indice: number): boolean {
    if (this.cancelada) {
      return false;
    }
    if (indice < this.posicaoEtapa) {
      return true;
    }
    return indice === this.posicaoEtapa && this.status === TripStatus.COMPLETED;
  }

  etapaAtual(indice: number): boolean {
    return !this.cancelada && indice === this.posicaoEtapa && this.status !== TripStatus.COMPLETED;
  }

  ariaEtapa(indice: number): string | null {
    if (this.etapaAtual(indice)) {
      return 'step';
    }
    return null;
  }

  iconeDaEtapa(etapa: TripStatus): string {
    if (etapa === TripStatus.PLANNED) {
      return 'calendario';
    }
    if (etapa === TripStatus.IN_PROGRESS) {
      return 'viagens';
    }
    return 'bandeira';
  }

  // ---------- Carregamento ----------

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    this.assinatura = this.viagens.buscar(this.id).subscribe({
      next: (viagem) => {
        this.viagem = viagem;
        this.carregarComplementos(viagem);
      },
      error: (erro) => {
        if (statusDoErro(erro) === 404) {
          this.voltarViagemNaoEncontrada();
          return;
        }
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  // 404 vale para viagem inexistente ou de outro motorista: avisa e volta para a lista.
  private voltarViagemNaoEncontrada(): void {
    this.notificacao.erro(this.traducao.instant('VIAGENS.NAO_ENCONTRADA'));
    this.roteador.navigate(['/trips']);
  }

  // Veículo e nome do motorista ajudam, mas a tela abre mesmo se eles falharem.
  private carregarComplementos(viagem: Trip): void {
    let motorista$: Observable<Driver | null> = of(null);
    if (this.podeVerMotorista) {
      motorista$ = this.motoristas.buscar(viagem.driverId).pipe(catchError(() => of(null)));
    }
    this.assinatura = forkJoin({
      veiculo: this.veiculos.buscar(viagem.vehicleId).pipe(catchError(() => of(null))),
      motorista: motorista$,
    }).subscribe((resultado) => {
      this.veiculo = resultado.veiculo;
      if (resultado.motorista) {
        this.assinatura = this.referencias
          .usuario(resultado.motorista.userId)
          .subscribe((usuario) => this.aplicarNome(usuario));
      } else {
        this.nomeMotorista = '';
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

  // ---------- Ações ----------

  // Iniciar não tem modal nem corpo: o servidor pega o hodômetro do veículo sozinho.
  iniciar(): void {
    if (!this.viagem || this.processando) {
      return;
    }
    this.executar(this.viagens.iniciar(this.viagem.id), 'VIAGENS.INICIADA_OK');
  }

  // Abre o modal de km rodados. O envio acontece dentro do modal.
  async finalizar(): Promise<void> {
    if (!this.viagem || this.processando) {
      return;
    }
    const resultado = await this.finalizacao.abrir(this.viagem.id, this.viagem.endLocation);
    if (!resultado) {
      return;
    }
    if (resultado.viagem) {
      this.viagem = resultado.viagem;
      this.notificacao.sucesso(this.traducao.instant('VIAGENS.FINALIZADA_OK'));
      this.carregarComplementos(resultado.viagem);
      return;
    }
    if (resultado.erro) {
      this.mostrarErroDeNegocio(resultado.erro);
    }
  }

  async cancelar(): Promise<void> {
    if (!this.viagem || this.processando) {
      return;
    }
    const confirmou = await this.confirmacao.confirmar({
      titulo: this.traducao.instant('VIAGENS.CANCELAR_TITULO'),
      mensagem: this.traducao.instant('VIAGENS.CANCELAR_TEXTO'),
      textoConfirmar: this.traducao.instant('VIAGENS.CANCELAR_CONFIRMAR'),
      textoCancelar: this.traducao.instant('COMUM.VOLTAR'),
      perigo: true,
    });
    if (!confirmou) {
      return;
    }
    this.executar(this.viagens.cancelar(this.viagem.id), 'VIAGENS.CANCELADA_OK');
  }

  async excluir(): Promise<void> {
    if (!this.viagem || this.processando) {
      return;
    }
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
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    this.viagens.excluir(this.viagem.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('VIAGENS.EXCLUIDA_OK'));
        this.roteador.navigate(['/trips']);
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  // Roda uma transição (iniciar, finalizar, cancelar) e atualiza a tela com a viagem devolvida.
  private executar(chamada: Observable<Trip>, chaveSucesso: string): void {
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    chamada.subscribe({
      next: (viagemAtualizada) => {
        this.processando = false;
        this.viagem = viagemAtualizada;
        this.notificacao.sucesso(this.traducao.instant(chaveSucesso));
        this.carregarComplementos(viagemAtualizada);
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  // Erro de regra de negócio (ex: 409) aparece no card da própria tela; a tela é atualizada em seguida.
  private mostrarErroDeNegocio(erro: unknown): void {
    this.processando = false;
    const status = statusDoErro(erro);
    if (status === 404) {
      this.voltarViagemNaoEncontrada();
      return;
    }
    this.erroNegocio = textoDoErro(erro, this.traducao);
    this.detector.detectChanges();
    const alerta = this.elemento.nativeElement.querySelector<HTMLElement>('#alerta-erro-negocio');
    alerta?.focus();
    // Conflito: o estado real pode ser outro, então buscamos de novo.
    if (status === 409) {
      this.recarregarEmSilencio();
    }
  }

  private recarregarEmSilencio(): void {
    if (!this.viagem) {
      return;
    }
    this.viagens.buscar(this.viagem.id).subscribe({
      next: (viagem) => {
        this.viagem = viagem;
        this.carregarComplementos(viagem);
      },
      error: () => {
        this.detector.markForCheck();
      },
    });
  }

  // Título da tela: "origem → destino".
  get tituloRota(): string {
    if (!this.viagem) {
      return this.traducao.instant('PAGINAS.VIAGENS_DETALHE');
    }
    return this.viagem.startLocation + ' → ' + this.viagem.endLocation;
  }
}
