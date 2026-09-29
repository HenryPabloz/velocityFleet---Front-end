import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of, Subscription } from 'rxjs';

import { CriarAbastecimentoDto, Driver, FuelType, Vehicle } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
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
import { formatarMoeda, formatarNumero, formatarPlaca, situacaoDaCnh } from '../../../../shared/dados/utils/formatacao';
import { AbastecimentosService } from '../../services/abastecimentos.service';

interface OpcaoMotorista {
  id: string;
  rotulo: string;
}

// Campos da API e o controle do formulário que recebe o erro de cada um.
const CAMPOS_DA_API: Record<string, string> = {
  vehicleId: 'veiculo',
  driverId: 'motorista',
  litersAdded: 'litros',
  costPerLiter: 'precoLitro',
  fuelType: 'combustivel',
};

// Registrar abastecimento. O total é calculado pela API (litros x preço): aqui ele é só uma prévia.
@Component({
  selector: 'app-abastecimento-form',
  standalone: false,
  templateUrl: './abastecimento-form.component.html',
  styleUrl: './abastecimento-form.component.scss',
})
export class AbastecimentoFormComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;
  // Só quem vê todos os abastecimentos e pode listar motoristas escolhe o motorista.
  escolheMotorista = false;
  meuMotoristaId: string | null = null;

  veiculos: Vehicle[] = [];
  opcoesMotoristas: OpcaoMotorista[] = [];
  tiposCombustivel = Object.values(FuelType);

  formulario = new FormGroup({
    veiculo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    motorista: new FormControl<string>('', { nonNullable: true }),
    combustivel: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    litros: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    precoLitro: new FormControl<number | null>(null, [Validators.required, Validators.min(0.0001)]),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private assinaturas: Subscription[] = [];

  constructor(
    private roteador: Router,
    private abastecimentos: AbastecimentosService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const veTodos = this.estadoAutenticacao.temPermissao('REFUELING_VIEW_ALL');
    const listaMotoristas = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.escolheMotorista = veTodos && listaMotoristas;
    this.meuMotoristaId = this.estadoAutenticacao.obterDriverId();
    if (this.escolheMotorista) {
      this.formulario.controls.motorista.addValidators(Validators.required);
    }
    this.carregarOpcoes();
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  // Sem escolher motorista e sem perfil de motorista (driverId nulo): formulário bloqueado.
  get semMotoristaVinculado(): boolean {
    return !this.escolheMotorista && this.meuMotoristaId === null;
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'ABASTECIMENTOS.SALVANDO';
    }
    return 'ABASTECIMENTOS.SALVAR';
  }

  // Prévia do total: a API é quem calcula de verdade.
  get totalEstimado(): string {
    const litros = Number(this.formulario.controls.litros.value);
    const preco = Number(this.formulario.controls.precoLitro.value);
    if (!litros || !preco || litros <= 0 || preco <= 0) {
      return '—';
    }
    return formatarMoeda(Math.round(litros * preco * 100) / 100);
  }

  carregarOpcoes(): void {
    this.estado = 'carregando';
    let motoristas$: Observable<Driver[]> = of([]);
    if (this.escolheMotorista) {
      motoristas$ = this.referencias.motoristas();
    }
    const assinatura = forkJoin({
      veiculos: this.referencias.veiculos(),
      motoristas: motoristas$,
    }).subscribe({
      next: (resultado) => {
        this.veiculos = this.somenteVeiculosUsaveis(resultado.veiculos);
        const nomes = montarNomesDosMotoristas(resultado.motoristas);
        this.opcoesMotoristas = this.montarOpcoesMotoristas(resultado.motoristas, nomes);
        this.estado = 'ok';
        this.detector.markForCheck();
      },
      error: (erro) => {
        this.mensagemErro = textoDoErro(erro, this.traducao);
        this.estado = 'erro';
        this.detector.markForCheck();
      },
    });
    this.assinaturas.push(assinatura);
  }

  // A API recusa veículo fora de serviço e removido.
  private somenteVeiculosUsaveis(lista: Vehicle[]): Vehicle[] {
    const usaveis: Vehicle[] = [];
    for (const veiculo of lista) {
      if (veiculo.status !== 'OUT_OF_SERVICE' && veiculo.isActive) {
        usaveis.push(veiculo);
      }
    }
    return usaveis;
  }

  // Só motoristas ativos (a API recusa os inativos).
  private montarOpcoesMotoristas(motoristas: Driver[], nomes: Record<string, string>): OpcaoMotorista[] {
    const opcoes: OpcaoMotorista[] = [];
    for (const motorista of motoristas) {
      if (!motorista.isActive) {
        continue;
      }
      const nome = nomes[motorista.id] ?? this.traducao.instant('MOTORISTAS.SEM_NOME');
      let rotulo = nome + ' — CNH ' + motorista.licenseNumber;
      if (situacaoDaCnh(motorista.licenseExpiry) === 'VENCIDA') {
        rotulo = rotulo + ' (' + this.traducao.instant('STATUS_CNH.VENCIDA') + ')';
      }
      opcoes.push({ id: motorista.id, rotulo: rotulo });
    }
    return opcoes;
  }

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.semMotoristaVinculado) {
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
    const dados: CriarAbastecimentoDto = {
      vehicleId: valores.veiculo,
      driverId: motoristaId,
      litersAdded: Number(valores.litros),
      costPerLiter: Number(valores.precoLitro),
      fuelType: valores.combustivel as FuelType,
    };
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('ABASTECIMENTOS.CONFIRMAR_TITULO'),
      this.traducao.instant('ABASTECIMENTOS.CONFIRMAR_TEXTO', {
        litros: formatarNumero(dados.litersAdded),
        placa: this.placaDoVeiculo(dados.vehicleId),
        total: this.totalEstimado,
      }),
      this.traducao.instant('ABASTECIMENTOS.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.abastecimentos.criar(dados).subscribe({
      next: (abastecimento) => {
        this.notificacao.sucesso(this.traducao.instant('ABASTECIMENTOS.CRIADO_OK'));
        this.roteador.navigate(['/refuelings', abastecimento.id]);
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  private placaDoVeiculo(id: string): string {
    for (const veiculo of this.veiculos) {
      if (veiculo.id === id) {
        return formatarPlaca(veiculo.plate);
      }
    }
    return '—';
  }

  // 400 vai para os campos; 409, 403 e 404 aparecem no aviso do formulário.
  private tratarErro(erro: unknown): void {
    this.salvando = false;
    if (statusDoErro(erro) === 400) {
      const sobras = aplicarErrosNosCampos(erro, this.formulario, CAMPOS_DA_API, this.traducao);
      this.erroGeral = sobras.join(' ');
    } else {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
    if (this.erroGeral) {
      const alerta = document.getElementById('alerta-erro-negocio');
      alerta?.focus();
    }
  }
}
