import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { Driver, User } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import {
  diasParaVencer,
  situacaoDaCnh,
  SituacaoCnh,
} from '../../../../shared/dados/utils/formatacao';
import { MotoristasService } from '../../services/motoristas.service';

// Detalhes de um motorista (DRIVER_VIEW); excluir só com DRIVER_DELETE.
@Component({
  selector: 'app-motorista-detalhe',
  standalone: false,
  templateUrl: './motorista-detalhe.component.html',
})
export class MotoristaDetalheComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroDeAcao = '';
  motorista: Driver | null = null;
  usuario: User | null = null;
  podeExcluir = false;
  podeVerViagens = false;

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private motoristas: MotoristasService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.podeExcluir = this.estadoAutenticacao.temPermissao('DRIVER_DELETE');
    this.podeVerViagens = this.estadoAutenticacao.temPermissao('TRIP_VIEW_ALL');
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  get id(): string {
    return this.rota.snapshot.paramMap.get('id') ?? '';
  }

  get situacao(): SituacaoCnh {
    if (!this.motorista) {
      return 'VALIDA';
    }
    return situacaoDaCnh(this.motorista.licenseExpiry);
  }

  get diasRestantes(): number {
    if (!this.motorista) {
      return 0;
    }
    return diasParaVencer(this.motorista.licenseExpiry);
  }

  get nome(): string {
    return this.usuario?.fullName ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    this.assinatura = this.motoristas.buscar(this.id).subscribe({
      next: (motorista) => {
        this.motorista = motorista;
        this.carregarUsuario(motorista);
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
  }

  // Nome e e-mail vêm do usuário ligado ao motorista; se não der para buscar, a tela abre sem eles.
  private carregarUsuario(motorista: Driver): void {
    this.assinatura = this.referencias.usuario(motorista.userId).subscribe((usuario) => {
      this.usuario = usuario;
      this.estado = 'ok';
      this.detector.markForCheck();
    });
  }

  async excluir(): Promise<void> {
    if (!this.motorista) {
      return;
    }
    const confirmou = await this.confirmacao.confirmar({
      titulo: this.traducao.instant('MOTORISTAS.EXCLUIR_TITULO'),
      mensagem: this.traducao.instant('MOTORISTAS.EXCLUIR_TEXTO', { nome: this.nome }),
      textoConfirmar: this.traducao.instant('COMUM.EXCLUIR'),
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: true,
    });
    if (!confirmou) {
      return;
    }
    this.motoristas.excluir(this.motorista.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MOTORISTAS.EXCLUIDO_OK'));
        this.roteador.navigate(['/fleet/drivers']);
      },
      error: (erro) => {
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }
}
