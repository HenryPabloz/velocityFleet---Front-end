import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, Observable, of, Subscription } from 'rxjs';

import { Driver, Incident, IncidentStatus, User, Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { statusDoErro, textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { MotoristasService } from '../../../fleet/services/motoristas.service';
import { VeiculosService } from '../../../fleet/services/veiculos.service';
import { IncidentesService } from '../../services/incidentes.service';

// Ordem do andamento de um incidente: o status só avança nesta ordem.
const ORDEM_DE_STATUS: IncidentStatus[] = [
  IncidentStatus.REPORTED,
  IncidentStatus.UNDER_INVESTIGATION,
  IncidentStatus.RESOLVED,
];

// Detalhes do incidente: foto, mudança de status (ADMIN e FLEET_MANAGER) e exclusão (INCIDENT_DELETE).
@Component({
  selector: 'app-incidente-detalhe',
  standalone: false,
  templateUrl: './incidente-detalhe.component.html',
  styleUrl: './incidente-detalhe.component.scss',
})
export class IncidenteDetalheComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroNegocio = '';
  processando = false;

  incidente: Incident | null = null;
  veiculo: Vehicle | null = null;
  nomeMotorista = '';
  podeVerMotorista = false;
  podeExcluir = false;
  // A API libera a mudança de status por papel (ADMIN e FLEET_MANAGER), não por permission.
  podeMudarStatus = false;
  fotoFalhou = false;

  etapas = ORDEM_DE_STATUS;
  novoStatus = '';
  erroNovoStatus = '';

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private elemento: ElementRef<HTMLElement>,
    private incidentes: IncidentesService,
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
    this.podeVerMotorista = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.podeExcluir = this.remocao.podeExcluir('INCIDENT');
    this.podeMudarStatus =
      this.estadoAutenticacao.hasRole('ADMIN') || this.estadoAutenticacao.hasRole('FLEET_MANAGER');
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

  get posicaoEtapa(): number {
    if (!this.incidente) {
      return 0;
    }
    return ORDEM_DE_STATUS.indexOf(this.incidente.status);
  }

  // Só os status à frente do atual (a API recusa voltar ou repetir).
  get proximosStatus(): IncidentStatus[] {
    return ORDEM_DE_STATUS.slice(this.posicaoEtapa + 1);
  }

  get resolvido(): boolean {
    return this.incidente?.status === IncidentStatus.RESOLVED;
  }

  get fotoEhPdf(): boolean {
    const chave = this.incidente?.photoKey ?? this.incidente?.photoUrl ?? '';
    return chave.toLowerCase().endsWith('.pdf');
  }

  etapaFeita(indice: number): boolean {
    return indice < this.posicaoEtapa || (indice === this.posicaoEtapa && this.resolvido);
  }

  etapaAtual(indice: number): boolean {
    return indice === this.posicaoEtapa && !this.resolvido;
  }

  ariaEtapa(indice: number): string | null {
    if (this.etapaAtual(indice)) {
      return 'step';
    }
    return null;
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    this.assinatura = this.incidentes.buscar(this.id).subscribe({
      next: (incidente) => {
        this.incidente = incidente;
        this.fotoFalhou = false;
        this.novoStatus = '';
        this.carregarComplementos(incidente);
      },
      error: (erro) => {
        // 404 vale para incidente inexistente ou de outro motorista.
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
    this.notificacao.erro(this.traducao.instant('INCIDENTES.NAO_ENCONTRADO'));
    this.roteador.navigate(['/incidents']);
  }

  // Veículo e nome do motorista ajudam, mas a tela abre mesmo se eles falharem.
  private carregarComplementos(incidente: Incident): void {
    let motorista$: Observable<Driver | null> = of(null);
    if (this.podeVerMotorista) {
      motorista$ = this.motoristas.buscar(incidente.driverId).pipe(catchError(() => of(null)));
    }
    this.assinatura = forkJoin({
      veiculo: this.veiculos.buscar(incidente.vehicleId).pipe(catchError(() => of(null))),
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

  private placaTexto(): string {
    if (this.veiculo) {
      return formatarPlaca(this.veiculo.plate);
    }
    return '—';
  }

  private parametros(): { tipo: string; placa: string } {
    let tipo = '';
    if (this.incidente) {
      tipo = this.traducao.instant('TIPO_INCIDENTE.' + this.incidente.type).toLowerCase();
    }
    return { tipo: tipo, placa: this.placaTexto() };
  }

  aoErrarFoto(): void {
    this.fotoFalhou = true;
    this.detector.markForCheck();
  }

  // ---------- Ações ----------

  async mudarStatus(): Promise<void> {
    if (!this.incidente || this.processando) {
      return;
    }
    this.erroNovoStatus = '';
    if (!this.novoStatus) {
      this.erroNovoStatus = this.traducao.instant('ERROS_CAMPO.OBRIGATORIO');
      this.detector.markForCheck();
      const campo = this.elemento.nativeElement.querySelector<HTMLElement>('#campo-incidente-status');
      campo?.focus();
      return;
    }
    const alvo = this.novoStatus as IncidentStatus;
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('INCIDENTES.STATUS_CONFIRMAR_TITULO'),
      this.traducao.instant('INCIDENTES.STATUS_CONFIRMAR_TEXTO', {
        tipo: this.parametros().tipo,
        placa: this.parametros().placa,
        status: this.traducao.instant('STATUS_INCIDENTE.' + alvo),
      }),
      this.traducao.instant('INCIDENTES.STATUS_CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    this.incidentes.atualizarStatus(this.incidente.id, alvo).subscribe({
      next: (atualizado) => {
        this.processando = false;
        this.incidente = atualizado;
        this.novoStatus = '';
        this.notificacao.sucesso(this.traducao.instant('INCIDENTES.STATUS_OK'));
        this.detector.markForCheck();
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  async excluir(): Promise<void> {
    if (!this.incidente || this.processando) {
      return;
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('INCIDENTES.EXCLUIR_TITULO'),
      this.traducao.instant('INCIDENTES.EXCLUIR_TEXTO', this.parametros()),
      this.traducao.instant('COMUM.EXCLUIR'),
      true,
    );
    if (!confirmou) {
      return;
    }
    this.processando = true;
    this.erroNegocio = '';
    this.detector.markForCheck();
    this.incidentes.excluir(this.incidente.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('INCIDENTES.EXCLUIDO_OK'));
        this.roteador.navigate(['/incidents']);
      },
      error: (erro) => this.mostrarErroDeNegocio(erro),
    });
  }

  // Erro de regra (400 de transição, 403, 409) aparece no aviso da própria tela e leva o foco até ele.
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
