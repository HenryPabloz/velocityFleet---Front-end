import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { CriarManutencaoDto, MaintenanceType, Vehicle } from '../../../../core/models';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { OpcaoDoGrupo } from '../../../../shared/dados/components/grupo-opcoes/grupo-opcoes.component';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import {
  aplicarErrosNosCampos,
  statusDoErro,
  textoDoErro,
} from '../../../../shared/dados/utils/erros-api';
import { focarPrimeiroInvalido, validarTudo } from '../../../../shared/dados/utils/formularios';
import { dataCurta, formatarMoeda, formatarPlaca } from '../../../../shared/dados/utils/formatacao';
import { validarCentavos, validarDataFutura } from '../../../../shared/dados/validadores/validadores';
import { ManutencoesService } from '../../services/manutencoes.service';

const LIMITE_DESCRICAO = 1000;

// Campos da API e o controle do formulário que recebe o erro de cada um.
const CAMPOS_DA_API: Record<string, string> = {
  vehicleId: 'veiculo',
  type: 'tipo',
  scheduledDate: 'data',
  description: 'descricao',
  cost: 'custo',
};

// Agendar manutenção. A API nasce com status SCHEDULED e pode colocar o veículo em manutenção sozinha.
@Component({
  selector: 'app-manutencao-form',
  standalone: false,
  templateUrl: './manutencao-form.component.html',
})
export class ManutencaoFormComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;

  veiculos: Vehicle[] = [];
  opcoesTipo: OpcaoDoGrupo[] = [];
  limiteDescricao = LIMITE_DESCRICAO;

  formulario = new FormGroup({
    veiculo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    tipo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    data: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, validarDataFutura],
    }),
    descricao: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITE_DESCRICAO)],
    }),
    custo: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(100000000),
      validarCentavos,
    ]),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;

  private assinaturas: Subscription[] = [];

  constructor(
    private roteador: Router,
    private rota: ActivatedRoute,
    private manutencoes: ManutencoesService,
    private referencias: ReferenciasService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.montarOpcoesTipo();
    // Vindo da tela do veículo ("Agendar manutenção"), o veículo já chega escolhido.
    const veiculoDaUrl = this.rota.snapshot.queryParamMap.get('vehicleId');
    if (veiculoDaUrl) {
      this.formulario.controls.veiculo.setValue(veiculoDaUrl);
    }
    this.carregarVeiculos();
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
  }

  private montarOpcoesTipo(): void {
    this.opcoesTipo = [
      {
        valor: MaintenanceType.PREVENTIVE,
        rotulo: this.traducao.instant('TIPO_MANUTENCAO.PREVENTIVE'),
        icone: 'calendario',
        tom: 'ok',
      },
      {
        valor: MaintenanceType.CORRECTIVE,
        rotulo: this.traducao.instant('TIPO_MANUTENCAO.CORRECTIVE'),
        icone: 'manutencao',
        tom: 'aviso',
      },
      {
        valor: MaintenanceType.INSPECTION,
        rotulo: this.traducao.instant('TIPO_MANUTENCAO.INSPECTION'),
        icone: 'busca',
        tom: 'neutro',
      },
    ];
  }

  // Data mínima do campo (hoje) no formato AAAA-MM-DD, no horário local.
  get hoje(): string {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return agora.getFullYear() + '-' + mes + '-' + dia;
  }

  get caracteresUsados(): number {
    return this.formulario.controls.descricao.value.length;
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'MANUTENCOES.AGENDANDO';
    }
    return 'MANUTENCOES.AGENDAR';
  }

  carregarVeiculos(): void {
    this.estado = 'carregando';
    const assinatura = this.referencias.veiculos().subscribe({
      next: (lista) => {
        this.veiculos = lista;
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

  private placaDoVeiculo(id: string): string {
    for (const veiculo of this.veiculos) {
      if (veiculo.id === id) {
        return formatarPlaca(veiculo.plate);
      }
    }
    return '—';
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
    const valores = this.formulario.getRawValue();
    const dados: CriarManutencaoDto = {
      vehicleId: valores.veiculo,
      type: valores.tipo as MaintenanceType,
      scheduledDate: valores.data,
      description: valores.descricao.trim(),
      cost: Number(valores.custo),
    };
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('MANUTENCOES.CONFIRMAR_TITULO'),
      this.traducao.instant('MANUTENCOES.CONFIRMAR_TEXTO', {
        tipo: this.traducao.instant('TIPO_MANUTENCAO.' + dados.type).toLowerCase(),
        placa: this.placaDoVeiculo(dados.vehicleId),
        data: dataCurta(dados.scheduledDate),
        custo: formatarMoeda(dados.cost),
      }),
      this.traducao.instant('MANUTENCOES.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.manutencoes.criar(dados).subscribe({
      next: (manutencao) => {
        this.notificacao.sucesso(this.traducao.instant('MANUTENCOES.AGENDADA_OK'));
        this.roteador.navigate(['/maintenance', manutencao.id]);
      },
      error: (erro) => this.tratarErro(erro),
    });
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
