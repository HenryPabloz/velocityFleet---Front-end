import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import {
  AtualizarVeiculoDto,
  CriarVeiculoDto,
  Vehicle,
  VehicleStatus,
} from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import {
  aplicarErrosNosCampos,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { formatarPlaca, normalizarPlaca } from '../../../../shared/dados/utils/formatacao';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import {
  validarInteiro,
  validarPlaca,
} from '../../../../shared/dados/validadores/validadores';
import { VeiculosService } from '../../services/veiculos.service';

// Campos da API e o controle do formulário que recebe o erro de cada um.
const CAMPOS_DA_API: Record<string, string> = {
  plate: 'placa',
  model: 'modelo',
  year: 'ano',
  currentMileage: 'kmAtual',
  lastMaintenanceKm: 'kmManutencao',
  status: 'status',
};

// Criar (/fleet/vehicles/new) e editar (/fleet/vehicles/:id/edit) usam esta mesma tela.
@Component({
  selector: 'app-veiculo-form',
  standalone: false,
  templateUrl: './veiculo-form.component.html',
})
export class VeiculoFormComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'ok';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;
  editando = false;
  idEditando = '';
  veiculoOriginal: Vehicle | null = null;

  // A API não aceita IN_USE na escrita: só as viagens colocam o veículo em uso.
  statusPermitidos = [
    VehicleStatus.AVAILABLE,
    VehicleStatus.IN_MAINTENANCE,
    VehicleStatus.OUT_OF_SERVICE,
  ];

  formulario = new FormGroup({
    placa: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, validarPlaca],
    }),
    modelo: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    ano: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1900),
      Validators.max(2100),
      validarInteiro,
    ]),
    kmAtual: new FormControl<number | null>(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(10000000),
      validarInteiro,
    ]),
    kmManutencao: new FormControl<number | null>(0, [
      Validators.min(0),
      Validators.max(10000000),
      validarInteiro,
    ]),
    status: new FormControl<string>(VehicleStatus.AVAILABLE, { nonNullable: true }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private assinatura: Subscription | null = null;

  constructor(
    private rota: ActivatedRoute,
    private roteador: Router,
    private veiculos: VeiculosService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
    private confirmacao: ConfirmacaoService,
  ) {}

  ngOnInit(): void {
    const id = this.rota.snapshot.paramMap.get('id');
    if (id) {
      this.editando = true;
      this.idEditando = id;
      this.carregarVeiculo(id);
    }
  }

  ngOnDestroy(): void {
    this.assinatura?.unsubscribe();
  }

  get rotaVoltar(): string {
    if (this.veiculoOriginal) {
      return '/fleet/vehicles/' + this.veiculoOriginal.id;
    }
    return '/fleet/vehicles';
  }

  get chaveTitulo(): string {
    if (this.editando) {
      return 'PAGINAS.VEICULOS_EDITAR';
    }
    return 'PAGINAS.VEICULOS_NOVO';
  }

  carregarVeiculo(id: string): void {
    this.estado = 'carregando';
    this.assinatura = this.veiculos.buscar(id).subscribe({
      next: (veiculo) => {
        this.veiculoOriginal = veiculo;
        this.preencher(veiculo);
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

  private preencher(veiculo: Vehicle): void {
    this.formulario.patchValue({
      placa: veiculo.plate,
      modelo: veiculo.model,
      ano: veiculo.year,
      kmAtual: veiculo.currentMileage,
      kmManutencao: veiculo.lastMaintenanceKm,
      status: veiculo.status,
    });
    // A placa não muda depois de criada; o KM atual não pode diminuir.
    this.formulario.controls.placa.disable();
    this.formulario.controls.kmAtual.addValidators(Validators.min(veiculo.currentMileage));
    this.formulario.controls.kmAtual.updateValueAndValidity();
    // Em uso: o status só muda pelas viagens.
    if (veiculo.status === VehicleStatus.IN_USE) {
      this.formulario.controls.status.disable();
    }
  }

  get chaveAjudaPlaca(): string {
    if (this.editando) {
      return 'VEICULOS.AJUDA_PLACA_FIXA';
    }
    return 'VEICULOS.AJUDA_PLACA';
  }

  get chaveAjudaKm(): string {
    if (this.editando) {
      return 'VEICULOS.AJUDA_KM_ATUAL_EDITAR';
    }
    return '';
  }

  get chaveAjudaStatus(): string {
    if (this.statusEmUso) {
      return 'VEICULOS.AJUDA_STATUS_EM_USO';
    }
    return '';
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'COMUM.SALVANDO';
    }
    return 'COMUM.SALVAR';
  }

  get statusEmUso(): boolean {
    return this.veiculoOriginal?.status === VehicleStatus.IN_USE;
  }

  async salvar(): Promise<void> {
    this.erroGeral = '';
    if (this.salvando) {
      return;
    }
    if (!validarTudo(this.formulario)) {
      this.detector.detectChanges();
      focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
      return;
    }
    if (this.editando && this.veiculoOriginal) {
      await this.atualizar(this.veiculoOriginal);
    } else {
      await this.criar();
    }
  }

  private async criar(): Promise<void> {
    const valores = this.formulario.getRawValue();
    const dados: CriarVeiculoDto = {
      plate: normalizarPlaca(valores.placa ?? ''),
      model: (valores.modelo ?? '').trim(),
      year: Number(valores.ano),
      status: valores.status as VehicleStatus,
      currentMileage: Number(valores.kmAtual ?? 0),
      lastMaintenanceKm: Number(valores.kmManutencao ?? 0),
    };
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('VEICULOS.CONFIRMAR_CRIAR_TITULO'),
      this.traducao.instant('VEICULOS.CONFIRMAR_CRIAR_TEXTO', {
        placa: formatarPlaca(dados.plate),
        modelo: dados.model,
        ano: dados.year,
      }),
      this.traducao.instant('VEICULOS.CONFIRMAR_CRIAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.veiculos.criar(dados).subscribe({
      next: (veiculo) => {
        this.notificacao.sucesso(this.traducao.instant('VEICULOS.CRIADO_OK'));
        this.roteador.navigate(['/fleet/vehicles', veiculo.id]);
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  // PATCH parcial: manda só o que o usuário mudou.
  private async atualizar(original: Vehicle): Promise<void> {
    const valores = this.formulario.getRawValue();
    const dados: AtualizarVeiculoDto = {};
    const modelo = (valores.modelo ?? '').trim();
    if (modelo !== original.model) {
      dados.model = modelo;
    }
    if (Number(valores.ano) !== original.year) {
      dados.year = Number(valores.ano);
    }
    if (Number(valores.kmAtual) !== original.currentMileage) {
      dados.currentMileage = Number(valores.kmAtual);
    }
    if (Number(valores.kmManutencao ?? 0) !== original.lastMaintenanceKm) {
      dados.lastMaintenanceKm = Number(valores.kmManutencao ?? 0);
    }
    if (!this.statusEmUso && valores.status !== original.status) {
      dados.status = valores.status as VehicleStatus;
    }
    if (Object.keys(dados).length === 0) {
      this.roteador.navigate(['/fleet/vehicles', original.id]);
      return;
    }
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('VEICULOS.CONFIRMAR_EDITAR_TITULO'),
      this.traducao.instant('VEICULOS.CONFIRMAR_EDITAR_TEXTO', {
        placa: formatarPlaca(original.plate),
        modelo: original.model,
      }),
      this.traducao.instant('VEICULOS.CONFIRMAR_EDITAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.veiculos.atualizar(original.id, dados).subscribe({
      next: (veiculo) => {
        this.notificacao.sucesso(this.traducao.instant('VEICULOS.ATUALIZADO_OK'));
        this.roteador.navigate(['/fleet/vehicles', veiculo.id]);
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  private tratarErro(erro: unknown): void {
    this.salvando = false;
    const status = statusDoErro(erro);
    let sobras: string[] = [];
    if (status === 400) {
      sobras = aplicarErrosNosCampos(erro, this.formulario, CAMPOS_DA_API, this.traducao);
    }
    if (status === 409 && !this.editando) {
      // Placa repetida é o 409 do cadastro: mostra no próprio campo.
      this.formulario.controls.placa.setErrors({ servidor: textoDoErro(erro, this.traducao) });
      this.formulario.controls.placa.markAsTouched();
    } else if (sobras.length > 0) {
      this.erroGeral = sobras.join(' ');
    } else if (status !== 400) {
      this.erroGeral = textoDoErro(erro, this.traducao);
    }
    this.detector.detectChanges();
    focarPrimeiroInvalido(this.formularioRef?.nativeElement ?? null);
  }
}
