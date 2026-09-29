import {
  AfterViewInit,
  Component,
  ElementRef,
  Injectable,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';

export interface OpcoesConfirmacao {
  titulo: string;
  mensagem: string;
  textoConfirmar: string;
  textoCancelar: string;
  // Ação que não dá para desfazer: botão vermelho e foco começa em "Cancelar".
  perigo?: boolean;
}

// Conteúdo do modal de confirmação. Foco preso e Esc já vêm do NgbModal.
@Component({
  selector: 'app-modal-confirmar',
  standalone: false,
  templateUrl: './modal-confirmar.component.html',
  styleUrl: './modal-confirmar.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class ModalConfirmarComponent implements AfterViewInit {
  opcoes: OpcoesConfirmacao = { titulo: '', mensagem: '', textoConfirmar: '', textoCancelar: '' };

  @ViewChild('botaoCancelar') botaoCancelar?: ElementRef<HTMLButtonElement>;
  @ViewChild('botaoConfirmar') botaoConfirmar?: ElementRef<HTMLButtonElement>;

  constructor(public modalAtivo: NgbActiveModal) {}

  ngAfterViewInit(): void {
    if (this.opcoes.perigo) {
      this.botaoCancelar?.nativeElement.focus();
    } else {
      this.botaoConfirmar?.nativeElement.focus();
    }
  }
}

// Abre o modal e devolve true (confirmou) ou false (cancelou, Esc ou clique fora).
@Injectable({ providedIn: 'root' })
export class ConfirmacaoService {
  constructor(
    private modais: NgbModal,
    private traducao: TranslateService,
  ) {}

  // Atalho para confirmar criar, salvar, excluir ou restaurar: só precisa do título, do texto e do verbo
  // do botão (ex: "Criar"). "perigo" deixa o botão vermelho e o foco começa em "Cancelar".
  confirmarAcao(titulo: string, mensagem: string, verbo: string, perigo = false): Promise<boolean> {
    return this.confirmar({
      titulo: titulo,
      mensagem: mensagem,
      textoConfirmar: verbo,
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: perigo,
    });
  }

  confirmar(opcoes: OpcoesConfirmacao): Promise<boolean> {
    const referencia = this.modais.open(ModalConfirmarComponent, {
      windowClass: 'vf-modal-confirmar',
      ariaLabelledBy: 'titulo-modal-confirmar',
      ariaDescribedBy: 'texto-modal-confirmar',
      centered: true,
    });
    referencia.componentInstance.opcoes = opcoes;
    return referencia.result.then(
      () => true,
      () => false,
    );
  }
}
