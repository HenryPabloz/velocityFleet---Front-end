import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';

import { CriarViagemDto, Driver, Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import {
  montarNomesDosMotoristas,
  ReferenciasService,
} from '../../../../shared/dados/services/referencias.service';
import {
  aplicarErrosNosCampos,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { formatarPlaca, mascararCep, situacaoDaCnh } from '../../../../shared/dados/utils/formatacao';
import { validarCep } from '../../../../shared/dados/validadores/validadores';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ViagensService } from '../../services/viagens.service';

interface OpcaoMotorista {
  id: string;
  rotulo: string;
}

interface OpcaoVeiculo {
  veiculo: Vehicle;
  rotulo: string;
}

// Campos da API e o controle do formulário que recebe o erro de cada um.
const CAMPOS_DA_API: Record<string, string> = {
  driverId: 'motorista',
  vehicleId: 'veiculo',
  startLocation: 'cepOrigem',
  endLocation: 'cepDestino',
};

// Nova viagem, sem km. A API valida os CEPs no ViaCEP e grava o endereço resolvido: só enviamos os CEPs.
@Component({
  selector: 'app-viagem-form',
  standalone: false,
  templateUrl: './viagem-form.component.html',
  styleUrl: './viagem-form.component.scss',
})
export class ViagemFormComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;
  // Quem tem DRIVER_VIEW escolhe o motorista; os outros usam o próprio (user.driverId).
  escolheMotorista = false;

  opcoesMotoristas: OpcaoMotorista[] = [];
  opcoesVeiculos: OpcaoVeiculo[] = [];
  veiculoEscolhido: Vehicle | null = null;
  // Id do perfil de motorista de quem está logado (vem do login, user.driverId).
  meuMotoristaId: string | null = null;
  motoristasSemCnhValida = 0;

  // Campos são <select> reais (nunca texto livre): o valor guardado já é o id da opção.
  formulario = new FormGroup({
    motorista: new FormControl<string>('', {
      nonNullable: true,
      validators: [(controle) => this.validarMotorista(controle)],
    }),
    veiculo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    cepOrigem: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, validarCep],
    }),
    cepDestino: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, validarCep],
    }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private assinaturas: Subscription[] = [];

  constructor(
    private roteador: Router,
    private viagens: ViagensService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
    private confirmacao: ConfirmacaoService,
  ) {}

  ngOnInit(): void {
    this.escolheMotorista = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.meuMotoristaId = this.estadoAutenticacao.obterDriverId();
    // Ao escolher um veículo, mostramos a placa e o status dele (o km é só informativo).
    this.assinaturas.push(
      this.formulario.controls.veiculo.valueChanges.subscribe((valor) => this.aoMudarVeiculo(valor)),
    );
    this.carregarOpcoes();
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'VIAGENS.CRIANDO';
    }
    return 'VIAGENS.CRIAR';
  }

  get chaveAjudaVeiculo(): string {
    if (this.opcoesVeiculos.length === 0) {
      return 'VIAGENS.AJUDA_SEM_VEICULO';
    }
    return 'VIAGENS.AJUDA_VEICULO';
  }

  get chaveAjudaMotorista(): string {
    if (!this.escolheMotorista) {
      return 'VIAGENS.AJUDA_MOTORISTA_PROPRIO';
    }
    if (this.opcoesMotoristas.length === 0) {
      return 'VIAGENS.AJUDA_SEM_MOTORISTA';
    }
    return 'VIAGENS.AJUDA_MOTORISTA';
  }

  // Usuário que não escolhe motorista e não tem perfil de motorista ativo (driverId nulo): formulário bloqueado.
  get semMotoristaVinculado(): boolean {
    return !this.escolheMotorista && this.meuMotoristaId === null;
  }

  // Nome de quem está logado, mostrado no lugar do campo quando o motorista é sempre "você".
  get meuNomeMotorista(): string {
    return this.estadoAutenticacao.usuarioAtual?.fullName ?? this.traducao.instant('VIAGENS.VOCE');
  }

  // silencioso = true: atualiza as listas sem trocar a tela por "carregando" (usado após um erro).
  carregarOpcoes(silencioso = false): void {
    if (!silencioso) {
      this.estado = 'carregando';
    }
    let motoristas$: Observable<Driver[]> = of([]);
    if (this.escolheMotorista) {
      motoristas$ = this.referencias.motoristas();
    }
    const assinatura = forkJoin({
      veiculos: this.referencias.veiculosDisponiveis(),
      motoristas: motoristas$,
    }).subscribe({
      next: (resultado) => {
        this.opcoesVeiculos = this.montarOpcoesVeiculos(resultado.veiculos);
        const nomes = montarNomesDosMotoristas(resultado.motoristas);
        this.opcoesMotoristas = this.montarOpcoesMotoristas(resultado.motoristas, nomes);
        // As listas mudaram: confere de novo o que já estava escolhido.
        this.aoMudarVeiculo(this.formulario.controls.veiculo.value);
        this.formulario.controls.veiculo.updateValueAndValidity();
        this.formulario.controls.motorista.updateValueAndValidity();
        this.estado = 'ok';
        this.detector.markForCheck();
      },
      error: (erro) => {
        if (silencioso) {
          return;
        }
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
    this.assinaturas.push(assinatura);
  }

  private montarOpcoesVeiculos(veiculos: Vehicle[]): OpcaoVeiculo[] {
    const opcoes: OpcaoVeiculo[] = [];
    for (const veiculo of veiculos) {
      opcoes.push({ veiculo, rotulo: formatarPlaca(veiculo.plate) + ' — ' + veiculo.model });
    }
    return opcoes;
  }

  // Só motoristas ativos e com CNH em dia (a API recusa os outros com 409).
  private montarOpcoesMotoristas(motoristas: Driver[], nomes: Record<string, string>): OpcaoMotorista[] {
    const opcoes: OpcaoMotorista[] = [];
    let semCnh = 0;
    for (const motorista of motoristas) {
      if (!motorista.isActive) {
        continue;
      }
      if (situacaoDaCnh(motorista.licenseExpiry) === 'VENCIDA') {
        semCnh = semCnh + 1;
        continue;
      }
      const nome = nomes[motorista.id] ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
      opcoes.push({ id: motorista.id, rotulo: nome + ' — CNH ' + motorista.licenseNumber });
    }
    this.motoristasSemCnhValida = semCnh;
    return opcoes;
  }

  // ---------- Validações que dependem da lista de opções ----------

  private acharMotoristaPorId(id: string): OpcaoMotorista | null {
    for (const opcao of this.opcoesMotoristas) {
      if (opcao.id === id) {
        return opcao;
      }
    }
    return null;
  }

  private acharVeiculoPorId(id: string): OpcaoVeiculo | null {
    for (const opcao of this.opcoesVeiculos) {
      if (opcao.veiculo.id === id) {
        return opcao;
      }
    }
    return null;
  }

  private validarMotorista(controle: AbstractControl): ValidationErrors | null {
    // Motorista comum não escolhe: usa o próprio cadastro.
    if (!this.escolheMotorista) {
      return null;
    }
    const id = String(controle.value ?? '');
    if (!id) {
      return { required: true };
    }
    return null;
  }

  // Muda quando o <select> de veículo muda: guarda o veículo inteiro para mostrar placa e km.
  aoMudarVeiculo(id: string): void {
    this.veiculoEscolhido = this.acharVeiculoPorId(id)?.veiculo ?? null;
    this.detector.markForCheck();
  }

  // CEP com máscara enquanto digita.
  mascararCampoCep(nome: 'cepOrigem' | 'cepDestino'): void {
    const controle = this.formulario.controls[nome];
    const formatado = mascararCep(controle.value);
    if (formatado !== controle.value) {
      controle.setValue(formatado);
    }
  }

  // ---------- Envio ----------

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.salvando || this.semMotoristaVinculado) {
      return;
    }
    if (!validarTudo(this.formulario)) {
      this.detector.detectChanges();
      focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
      return;
    }
    const valores = this.formulario.getRawValue();
    let motoristaId = this.meuMotoristaId ?? '';
    if (this.escolheMotorista) {
      motoristaId = valores.motorista;
    }
    const dados: CriarViagemDto = {
      driverId: motoristaId,
      vehicleId: valores.veiculo,
      startLocation: valores.cepOrigem.replace(/\D/g, ''),
      endLocation: valores.cepDestino.replace(/\D/g, ''),
    };
    // Nome do motorista escolhido (ou "você") e placa do veículo para o texto.
    let nomeMotorista = this.traducao.instant('VIAGENS.VOCE_CURTO');
    if (this.escolheMotorista) {
      nomeMotorista = this.acharMotoristaPorId(valores.motorista)?.rotulo.split(' — CNH')[0] ?? '';
    }
    const placa = formatarPlaca(this.veiculoEscolhido?.plate ?? '');
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('VIAGENS.CONFIRMAR_TITULO'),
      this.traducao.instant('VIAGENS.CONFIRMAR_TEXTO', { motorista: nomeMotorista, placa: placa }),
      this.traducao.instant('VIAGENS.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.viagens.criar(dados).subscribe({
      next: (viagem) => {
        this.notificacao.sucesso(this.traducao.instant('VIAGENS.CRIADA_OK'));
        this.roteador.navigate(['/trips', viagem.id]);
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  private tratarErro(erro: unknown): void {
    this.salvando = false;
    const status = statusDoErro(erro);
    if (status === 400) {
      const sobras = aplicarErrosNosCampos(
        erro,
        this.formulario,
        CAMPOS_DA_API,
        this.traducao,
        (mensagem) => this.tratarMensagemDeCep(mensagem),
      );
      this.erroGeral = sobras.join(' ');
    } else {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    // Veículo ou motorista mudou de situação (409/404): atualiza as listas de escolha.
    if (status === 409 || status === 404) {
      this.carregarOpcoes(true);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
    if (this.erroGeral) {
      this.focarAlerta();
    }
  }

  // A API responde: CEP "01310100" inválido ou não encontrado. Achamos o campo pelo número.
  private tratarMensagemDeCep(mensagem: string): boolean {
    if (!mensagem.startsWith('CEP')) {
      return false;
    }
    const numeros = mensagem.replace(/\D/g, '');
    const texto = this.traducao.instant('VIAGENS.ERRO_CEP_API');
    const nomes: ('cepOrigem' | 'cepDestino')[] = ['cepOrigem', 'cepDestino'];
    for (const nome of nomes) {
      const controle = this.formulario.controls[nome];
      if (controle.value.replace(/\D/g, '') === numeros) {
        controle.setErrors({ servidor: texto });
        controle.markAsTouched();
      }
    }
    return true;
  }

  private focarAlerta(): void {
    const alerta = document.getElementById('alerta-erro-negocio');
    if (alerta) {
      alerta.focus();
    }
  }
}
