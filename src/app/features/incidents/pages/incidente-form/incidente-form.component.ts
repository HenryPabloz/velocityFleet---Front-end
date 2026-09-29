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
import { catchError, forkJoin, map, Observable, of, Subscription } from 'rxjs';

import {
  Driver,
  IncidentType,
  Severity,
  Trip,
  TripStatus,
  Vehicle,
} from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EstadoPagina } from '../../../../shared/dados/components/estado-pagina/estado-pagina.component';
import { OpcaoDoGrupo } from '../../../../shared/dados/components/grupo-opcoes/grupo-opcoes.component';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
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
import {
  formatarPlaca,
  formatarTamanhoArquivo,
  situacaoDaCnh,
} from '../../../../shared/dados/utils/formatacao';
import { ViagensService } from '../../../trips/services/viagens.service';
import { IncidentesService } from '../../services/incidentes.service';

const LIMITE_DESCRICAO = 1000;
// A partir daqui o leitor de tela é avisado de que o limite está perto.
const AVISO_DESCRICAO = 900;
const TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024;
// Tipos que o back-end aceita (conferido em upload-incidents.config.ts).
const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'application/pdf'];

interface OpcaoMotorista {
  id: string;
  rotulo: string;
}

interface OpcaoViagem {
  viagem: Trip;
  rotulo: string;
}

// Campos da API e o controle do formulário que recebe o erro de cada um.
const CAMPOS_DA_API: Record<string, string> = {
  tripId: 'viagem',
  vehicleId: 'veiculo',
  driverId: 'motorista',
  type: 'tipo',
  severity: 'severidade',
  description: 'descricao',
};

// Registrar incidente (multipart/form-data): campos de texto + foto opcional no campo "photo".
@Component({
  selector: 'app-incidente-form',
  standalone: false,
  templateUrl: './incidente-form.component.html',
  styleUrl: './incidente-form.component.scss',
})
export class IncidenteFormComponent implements OnInit, OnDestroy {
  estado: EstadoPagina = 'carregando';
  mensagemErro = '';
  erroGeral = '';
  salvando = false;
  // Só quem vê todos os incidentes e pode listar motoristas escolhe o motorista.
  escolheMotorista = false;
  podeVerViagens = false;
  meuMotoristaId: string | null = null;

  veiculos: Vehicle[] = [];
  opcoesMotoristas: OpcaoMotorista[] = [];
  opcoesViagens: OpcaoViagem[] = [];
  opcoesTipo: OpcaoDoGrupo[] = [];
  opcoesSeveridade: OpcaoDoGrupo[] = [];
  limiteDescricao = LIMITE_DESCRICAO;

  // Foto: arquivo escolhido, prévia (só imagem) e mensagens.
  arquivoFoto: File | null = null;
  urlPrevia = '';
  erroFoto = '';
  anuncioFoto = '';
  arrastando = false;

  formulario = new FormGroup({
    viagem: new FormControl<string>('', { nonNullable: true }),
    motorista: new FormControl<string>('', { nonNullable: true }),
    veiculo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    tipo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    severidade: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    descricao: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITE_DESCRICAO)],
    }),
  });

  @ViewChild('formularioRef') formularioRef?: ElementRef<HTMLFormElement>;
  @ViewChild('entradaFoto') entradaFoto?: ElementRef<HTMLInputElement>;

  private assinaturas: Subscription[] = [];

  constructor(
    private roteador: Router,
    private incidentes: IncidentesService,
    private viagens: ViagensService,
    private referencias: ReferenciasService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private notificacao: NotificationService,
    private traducao: TranslateService,
    private detector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const veTodos = this.estadoAutenticacao.temPermissao('INCIDENT_VIEW_ALL');
    const listaMotoristas = this.estadoAutenticacao.temPermissao('DRIVER_VIEW');
    this.escolheMotorista = veTodos && listaMotoristas;
    this.podeVerViagens = this.estadoAutenticacao.temAlgumaPermissao(['TRIP_VIEW_OWN', 'TRIP_VIEW_ALL']);
    this.meuMotoristaId = this.estadoAutenticacao.obterDriverId();
    if (this.escolheMotorista) {
      this.formulario.controls.motorista.addValidators(Validators.required);
    }
    this.montarOpcoes();
    // Ao escolher uma viagem, veículo e motorista dela são preenchidos (continuam editáveis).
    this.assinaturas.push(
      this.formulario.controls.viagem.valueChanges.subscribe((id) => this.aoEscolherViagem(id)),
    );
    this.carregarOpcoes();
  }

  ngOnDestroy(): void {
    for (const assinatura of this.assinaturas) {
      assinatura.unsubscribe();
    }
    this.liberarPrevia();
  }

  private montarOpcoes(): void {
    this.opcoesTipo = [
      {
        valor: IncidentType.ACCIDENT,
        rotulo: this.traducao.instant('TIPO_INCIDENTE.ACCIDENT'),
        icone: 'alerta',
      },
      {
        valor: IncidentType.MECHANICAL_FAILURE,
        rotulo: this.traducao.instant('TIPO_INCIDENTE.MECHANICAL_FAILURE'),
        icone: 'manutencao',
      },
      {
        valor: IncidentType.OTHER,
        rotulo: this.traducao.instant('TIPO_INCIDENTE.OTHER'),
        icone: 'info',
      },
    ];
    this.opcoesSeveridade = [
      {
        valor: Severity.LOW,
        rotulo: this.traducao.instant('SEVERIDADE.LOW'),
        icone: 'info',
        tom: 'ok',
      },
      {
        valor: Severity.MEDIUM,
        rotulo: this.traducao.instant('SEVERIDADE.MEDIUM'),
        icone: 'alerta',
        tom: 'aviso',
      },
      {
        valor: Severity.HIGH,
        rotulo: this.traducao.instant('SEVERIDADE.HIGH'),
        icone: 'octogono',
        tom: 'perigo',
      },
    ];
  }

  // Sem escolher motorista e sem perfil de motorista (driverId nulo): formulário bloqueado.
  get semMotoristaVinculado(): boolean {
    return !this.escolheMotorista && this.meuMotoristaId === null;
  }

  get chaveBotaoSalvar(): string {
    if (this.salvando) {
      return 'INCIDENTES.REGISTRANDO';
    }
    return 'INCIDENTES.REGISTRAR';
  }

  get caracteresUsados(): number {
    return this.formulario.controls.descricao.value.length;
  }

  // Só fala com o leitor de tela quando o limite está chegando (evita anunciar a cada tecla).
  get avisoLimiteDescricao(): string {
    if (this.caracteresUsados < AVISO_DESCRICAO) {
      return '';
    }
    return this.traducao.instant('INCIDENTES.RESTAM_CARACTERES', {
      restantes: LIMITE_DESCRICAO - this.caracteresUsados,
    });
  }

  get chaveAjudaViagem(): string {
    if (this.opcoesViagens.length === 0) {
      return 'INCIDENTES.AJUDA_SEM_VIAGEM';
    }
    return 'INCIDENTES.AJUDA_VIAGEM';
  }

  get arquivoEhImagem(): boolean {
    return this.urlPrevia !== '';
  }

  // Viagem só entra em andamento (a API recusa outras). Sem permissão de ver viagens, o campo some.
  carregarOpcoes(): void {
    this.estado = 'carregando';
    let motoristas$: Observable<Driver[]> = of([]);
    if (this.escolheMotorista) {
      motoristas$ = this.referencias.motoristas();
    }
    let viagens$: Observable<Trip[]> = of([]);
    if (this.podeVerViagens) {
      viagens$ = this.buscarViagensEmAndamento();
    }
    const assinatura = forkJoin({
      veiculos: this.referencias.veiculos(),
      motoristas: motoristas$,
      viagens: viagens$,
    }).subscribe({
      next: (resultado) => {
        this.veiculos = this.somenteVeiculosUsaveis(resultado.veiculos);
        const nomes = montarNomesDosMotoristas(resultado.motoristas);
        this.opcoesMotoristas = this.montarOpcoesMotoristas(resultado.motoristas, nomes);
        this.opcoesViagens = this.montarOpcoesViagens(resultado.viagens);
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

  // Sem a lista de viagens o formulário continua funcionando (a viagem é opcional).
  private buscarViagensEmAndamento(): Observable<Trip[]> {
    return this.viagens.listar(1, 100, { status: TripStatus.IN_PROGRESS }).pipe(
      map((resposta) => resposta.data),
      catchError(() => of([] as Trip[])),
    );
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

  private montarOpcoesViagens(lista: Trip[]): OpcaoViagem[] {
    const opcoes: OpcaoViagem[] = [];
    for (const viagem of lista) {
      const placa = this.placaDoVeiculo(viagem.vehicleId);
      const rotulo = placa + ' · ' + viagem.startLocation + ' → ' + viagem.endLocation;
      opcoes.push({ viagem: viagem, rotulo: rotulo });
    }
    return opcoes;
  }

  private placaDoVeiculo(id: string): string {
    for (const veiculo of this.veiculos) {
      if (veiculo.id === id) {
        return formatarPlaca(veiculo.plate);
      }
    }
    return '—';
  }

  // Pré-preenche veículo (e motorista, se der para escolher) com os da viagem.
  private aoEscolherViagem(id: string): void {
    if (!id) {
      return;
    }
    for (const opcao of this.opcoesViagens) {
      if (opcao.viagem.id !== id) {
        continue;
      }
      this.formulario.controls.veiculo.setValue(opcao.viagem.vehicleId);
      if (this.escolheMotorista) {
        this.formulario.controls.motorista.setValue(opcao.viagem.driverId);
      }
    }
    this.detector.markForCheck();
  }

  // ---------- Foto ----------

  // Devolve o texto do erro ou vazio quando o arquivo serve.
  private conferirArquivo(arquivo: File): string {
    if (!TIPOS_DE_FOTO.includes(arquivo.type)) {
      return this.traducao.instant('INCIDENTES.FOTO_ERRO_TIPO');
    }
    if (arquivo.size > TAMANHO_MAXIMO_FOTO) {
      return this.traducao.instant('INCIDENTES.FOTO_ERRO_TAMANHO', {
        tamanho: formatarTamanhoArquivo(arquivo.size),
      });
    }
    return '';
  }

  private aplicarArquivo(arquivo: File): void {
    const erro = this.conferirArquivo(arquivo);
    if (erro) {
      this.erroFoto = erro;
      this.anuncioFoto = erro;
      this.limparEntradaFoto();
      return;
    }
    this.liberarPrevia();
    this.erroFoto = '';
    this.arquivoFoto = arquivo;
    if (arquivo.type.startsWith('image/')) {
      this.urlPrevia = URL.createObjectURL(arquivo);
    }
    this.anuncioFoto = this.traducao.instant('INCIDENTES.FOTO_ESCOLHIDA', {
      nome: arquivo.name,
      tamanho: formatarTamanhoArquivo(arquivo.size),
    });
  }

  aoEscolherArquivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    if (entrada.files && entrada.files.length > 0) {
      this.aplicarArquivo(entrada.files[0]);
    }
    this.detector.markForCheck();
  }

  aoArrastarSobre(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando = true;
  }

  aoSairDoArraste(): void {
    this.arrastando = false;
  }

  aoSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando = false;
    const arquivos = evento.dataTransfer?.files;
    if (arquivos && arquivos.length > 0) {
      this.aplicarArquivo(arquivos[0]);
    }
    this.detector.markForCheck();
  }

  removerFoto(): void {
    this.liberarPrevia();
    this.arquivoFoto = null;
    this.erroFoto = '';
    this.anuncioFoto = this.traducao.instant('INCIDENTES.FOTO_REMOVIDA');
    this.limparEntradaFoto();
    // Devolve o foco para a área de envio (o botão de remover some da tela).
    this.entradaFoto?.nativeElement.focus();
  }

  private limparEntradaFoto(): void {
    if (this.entradaFoto) {
      this.entradaFoto.nativeElement.value = '';
    }
  }

  private liberarPrevia(): void {
    if (this.urlPrevia) {
      URL.revokeObjectURL(this.urlPrevia);
      this.urlPrevia = '';
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
    const dados = new FormData();
    if (valores.viagem) {
      dados.append('tripId', valores.viagem);
    }
    dados.append('vehicleId', valores.veiculo);
    dados.append('driverId', motoristaId);
    dados.append('type', valores.tipo);
    dados.append('severity', valores.severidade);
    dados.append('description', valores.descricao.trim());
    if (this.arquivoFoto) {
      dados.append('photo', this.arquivoFoto, this.arquivoFoto.name);
    }
    // Só depois da validação: pede a confirmação antes de enviar.
    const confirmou = await this.confirmacao.confirmarAcao(
      this.traducao.instant('INCIDENTES.CONFIRMAR_TITULO'),
      this.traducao.instant('INCIDENTES.CONFIRMAR_TEXTO', {
        severidade: this.traducao.instant('SEVERIDADE.' + valores.severidade).toLowerCase(),
        tipo: this.traducao.instant('TIPO_INCIDENTE.' + valores.tipo).toLowerCase(),
        placa: this.placaDoVeiculo(valores.veiculo),
      }),
      this.traducao.instant('INCIDENTES.CONFIRMAR_VERBO'),
    );
    if (!confirmou) {
      return;
    }
    this.salvando = true;
    this.detector.markForCheck();
    this.incidentes.criar(dados).subscribe({
      next: (incidente) => {
        this.notificacao.sucesso(this.traducao.instant('INCIDENTES.CRIADO_OK'));
        this.roteador.navigate(['/incidents', incidente.id]);
      },
      error: (erro) => this.tratarErro(erro),
    });
  }

  // 400 vai para os campos (ou para o aviso, se for do arquivo); 403, 404 e 409 aparecem no aviso.
  private tratarErro(erro: unknown): void {
    this.salvando = false;
    if (statusDoErro(erro) === 400) {
      const sobras = aplicarErrosNosCampos(erro, this.formulario, CAMPOS_DA_API, this.traducao);
      this.erroGeral = sobras.join(' ');
      if (!this.erroGeral) {
        // 400 sem mensagem de campo (ex: arquivo recusado pela API): mostra o texto geral.
        this.erroGeral = this.textoQuandoNaoHaCampo(erro);
      }
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

  // Se o 400 foi aplicado em algum campo, não repete o erro no aviso geral.
  private textoQuandoNaoHaCampo(erro: unknown): string {
    for (const nome of Object.keys(this.formulario.controls)) {
      const controle = this.formulario.get(nome);
      if (controle && controle.errors && controle.errors['servidor']) {
        return '';
      }
    }
    return textoDoErro(erro, this.traducao);
  }
}
