import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Injectable,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';

import { Trip } from '../../../../core/models';
import {
  aplicarErrosNosCampos,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { validarInteiro } from '../../../../shared/dados/validadores/validadores';
import { ViagensService } from '../../services/viagens.service';

const CAMPOS_DA_API: Record<string, string> = {
  endKm: 'kmRodados',
  endLocation: 'localFinal',
};

// O que o modal devolve: a viagem finalizada, ou o erro que a tela da viagem deve mostrar.
export interface ResultadoFinalizar {
  viagem?: Trip;
  erro?: unknown;
}

// Modal "Finalizar viagem": km RODADOS (não é leitura de hodômetro) e local de chegada.
@Component({
  selector: 'app-modal-finalizar-viagem',
  standalone: false,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './modal-finalizar-viagem.component.html',
  styleUrl: './modal-finalizar-viagem.component.scss',
})
export class ModalFinalizarViagemComponent implements AfterViewInit {
  // Preenchidos por quem abre o modal.
  idViagem = '';
  destinoPrevisto = '';

  enviando = false;
  erroGeral = '';

  formulario = new FormGroup({
    kmRodados: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(100000),
      validarInteiro,
    ]),
    localFinal: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  constructor(
    public modalAtivo: NgbActiveModal,
    private viagens: ViagensService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    // O local já vem com o destino previsto; o motorista ajusta se chegou em outro lugar.
    this.formulario.controls.localFinal.setValue(this.destinoPrevisto);
    document.getElementById('campo-km-rodados')?.focus();
    this.detector.detectChanges();
    // Deixa o texto pré-preenchido selecionado: digitar direto SUBSTITUI o
    // destino previsto, em vez de colar o texto novo depois do antigo.
    const campoLocalFinal = document.getElementById('campo-local-final');
    if (campoLocalFinal instanceof HTMLInputElement) {
      campoLocalFinal.select();
    }
  }

  get chaveBotao(): string {
    if (this.enviando) {
      return 'VIAGENS.FINALIZANDO';
    }
    return 'VIAGENS.FINALIZAR';
  }

  enviar(): void {
    this.erroGeral = '';
    if (this.enviando) {
      return;
    }
    if (!validarTudo(this.formulario)) {
      this.detector.detectChanges();
      focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
      return;
    }
    this.enviando = true;
    const dados = {
      endKm: Number(this.formulario.controls.kmRodados.value),
      endLocation: this.formulario.controls.localFinal.value.trim(),
    };
    this.viagens.finalizar(this.idViagem, dados).subscribe({
      next: (viagem) => {
        const resultado: ResultadoFinalizar = { viagem };
        this.modalAtivo.close(resultado);
      },
      error: (erro) => this.aoFalhar(erro),
    });
  }

  // 400 fica no próprio modal (campos); os demais erros (409, 404...) a tela da viagem mostra.
  private aoFalhar(erro: unknown): void {
    this.enviando = false;
    if (statusDoErro(erro) !== 400) {
      const resultado: ResultadoFinalizar = { erro };
      this.modalAtivo.dismiss(resultado);
      return;
    }
    const sobras = aplicarErrosNosCampos(erro, this.formulario, CAMPOS_DA_API, this.traducao);
    if (sobras.length > 0) {
      this.erroGeral = sobras.join(' ');
    } else if (this.formulario.valid) {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
  }
}

// Abre o modal e devolve o resultado (ou null se o usuário desistiu).
@Injectable({ providedIn: 'root' })
export class FinalizarViagemService {
  constructor(private modais: NgbModal) {}

  abrir(idViagem: string, destinoPrevisto: string): Promise<ResultadoFinalizar | null> {
    const referencia = this.modais.open(ModalFinalizarViagemComponent, {
      windowClass: 'vf-modal-confirmar',
      ariaLabelledBy: 'titulo-modal-finalizar',
      centered: true,
    });
    referencia.componentInstance.idViagem = idViagem;
    referencia.componentInstance.destinoPrevisto = destinoPrevisto;
    return referencia.result.then(
      (resultado: ResultadoFinalizar) => resultado,
      (motivo: unknown) => {
        // Erro de negócio vem como objeto; Esc, X ou clique fora vêm como texto ou número.
        if (motivo && typeof motivo === 'object') {
          return motivo as ResultadoFinalizar;
        }
        return null;
      },
    );
  }
}
