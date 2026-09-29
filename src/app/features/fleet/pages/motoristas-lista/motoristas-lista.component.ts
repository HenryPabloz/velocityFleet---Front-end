import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { Driver, PaginatedResponse } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { RemocaoService } from '../../../../shared/dados/services/remocao.service';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ColunaTabela } from '../../../../shared/dados/components/tabela-dados/tabela-dados.component';
import { textoDoErro } from '../../../../shared/dados/utils/erros-api';
import { situacaoDaCnh, SituacaoCnh } from '../../../../shared/dados/utils/formatacao';
import {
  montarNomesDosMotoristas,
  ReferenciasService,
} from '../../../../shared/dados/services/referencias.service';
import { MotoristasService } from '../../services/motoristas.service';

const TAMANHO_PAGINA = 12;

// Lista de motoristas (permission DRIVER_VIEW). O nome vem do usuário ligado ao motorista.
@Component({
  selector: 'app-motoristas-lista',
  standalone: false,
  templateUrl: './motoristas-lista.component.html',
})
export class MotoristasListaComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroDeAcao = '';
  resposta: PaginatedResponse<Driver> | null = null;
  nomes: Record<string, string> = {};
  paginaAtual = 1;
  verExcluidos = false;

  colunas: ColunaTabela[] = [
    { chave: 'nome', rotulo: 'MOTORISTAS.COL_NOME', somenteTabela: true },
    { chave: 'licenseNumber', rotulo: 'MOTORISTAS.COL_CNH' },
    { chave: 'licenseExpiry', rotulo: 'MOTORISTAS.COL_VALIDADE' },
    { chave: 'situacao', rotulo: 'MOTORISTAS.COL_SITUACAO' },
    { chave: 'isActive', rotulo: 'MOTORISTAS.COL_ATIVO' },
  ];

  private assinatura: Subscription | null = null;

  constructor(
    private motoristas: MotoristasService,
    private referencias: ReferenciasService,
    private remocao: RemocaoService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  situacao(motorista: Driver): SituacaoCnh {
    return situacaoDaCnh(motorista.licenseExpiry);
  }

  nomeDe(motorista: Driver): string {
    return this.nomes[motorista.id] ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
  }

  // Resumo de CNH da página: quantas vencidas e quantas vencendo.
  get quantidadeVencidas(): number {
    return this.contarSituacao('VENCIDA');
  }

  get quantidadeVencendo(): number {
    return this.contarSituacao('VENCENDO');
  }

  private contarSituacao(situacao: SituacaoCnh): number {
    let total = 0;
    for (const motorista of this.resposta?.data ?? []) {
      if (motorista.isActive && situacaoDaCnh(motorista.licenseExpiry) === situacao) {
        total = total + 1;
      }
    }
    return total;
  }

  carregar(): void {
    this.assinatura?.unsubscribe();
    this.estado = 'carregando';
    // Atualiza a tela agora, antes de pedir os dados de novo: evita o estado ficar
    // "preso" de um ciclo de detecção de mudanças anterior (erro NG0100).
    this.detector.detectChanges();
    let lista = this.motoristas.listar(this.paginaAtual, TAMANHO_PAGINA);
    if (this.verExcluidos) {
      lista = this.motoristas.listarExcluidos(this.paginaAtual, TAMANHO_PAGINA);
    }
    this.assinatura = lista.subscribe({
      next: (resposta) => {
        this.resposta = resposta;
        this.nomes = montarNomesDosMotoristas(resposta.data);
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

  get chaveTitulo(): string {
    if (this.verExcluidos) {
      return 'MOTORISTAS.TITULO_EXCLUIDOS';
    }
    return 'MOTORISTAS.TITULO';
  }

  get chaveTituloVazio(): string {
    if (this.verExcluidos) {
      return 'MOTORISTAS.VAZIO_EXCLUIDOS';
    }
    return 'MOTORISTAS.VAZIO_TITULO';
  }

  get chaveTextoVazio(): string {
    if (this.verExcluidos) {
      return 'COMUM.VAZIO';
    }
    return 'MOTORISTAS.VAZIO_TEXTO';
  }

  mudarPagina(pagina: number): void {
    this.paginaAtual = pagina;
    this.erroDeAcao = '';
    this.carregar();
  }

  // Aba "Removidos" (só com DRIVER_RESTORE): true abre os removidos, false volta aos ativos.
  mudarAba(mostrarRemovidos: boolean): void {
    this.verExcluidos = mostrarRemovidos;
    this.paginaAtual = 1;
    this.erroDeAcao = '';
    this.carregar();
  }

  async excluir(motorista: Driver): Promise<void> {
    const confirmou = await this.confirmacao.confirmar({
      titulo: this.traducao.instant('MOTORISTAS.EXCLUIR_TITULO'),
      mensagem: this.traducao.instant('MOTORISTAS.EXCLUIR_TEXTO', { nome: this.nomeDe(motorista) }),
      textoConfirmar: this.traducao.instant('COMUM.EXCLUIR'),
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: true,
    });
    if (!confirmou) {
      return;
    }
    this.motoristas.excluir(motorista.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MOTORISTAS.EXCLUIDO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => {
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }

  async excluirDefinitivamente(motorista: Driver): Promise<void> {
    const confirmou = await this.remocao.confirmarExclusaoDefinitiva(this.nomeDe(motorista));
    if (!confirmou) {
      return;
    }
    this.remocao.excluirDefinitivamente('drivers', motorista.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('REMOCAO.DEFINITIVA_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => {
        // 409 mostra o detail da API (ex: motorista com viagens).
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }

  restaurar(motorista: Driver): void {
    this.motoristas.restaurar(motorista.id).subscribe({
      next: () => {
        this.notificacao.sucesso(this.traducao.instant('MOTORISTAS.RESTAURADO_OK'));
        this.recarregarDepoisDeMudar();
      },
      error: (erro) => {
        this.erroDeAcao = textoDoErro(erro, this.traducao);
        this.detector.markForCheck();
      },
    });
  }

  private recarregarDepoisDeMudar(): void {
    this.erroDeAcao = '';
    const quantidadeNaPagina = this.resposta?.data.length ?? 0;
    if (quantidadeNaPagina <= 1 && this.paginaAtual > 1) {
      this.paginaAtual = this.paginaAtual - 1;
    }
    this.carregar();
  }
}
