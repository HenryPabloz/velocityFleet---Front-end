import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { montarRespostaLogin } from '../../../testing/apoio';
import { PESSOAS, VEICULOS } from '../../../testing/dados-reais';
import { AuthService } from '../../core/services/auth.service';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AnalyticsService } from '../analytics/services/analytics.service';
import { EstadoBloco } from './dashboard.model';
import { DashboardService } from './services/dashboard.service';
import { DashboardStateService } from './services/dashboard-state.service';

const API = environment.apiUrl;

function pagina<T>(dados: T[], totalPages = 1, total = dados.length): unknown {
  return { data: dados, pagination: { page: 1, pageSize: 100, total, totalPages } };
}

describe('DashboardService', () => {
  let servico: DashboardService;
  let controle: HttpTestingController;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 25, 12, 0));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servico = TestBed.inject(DashboardService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    jest.useRealTimers();
  });

  it('viagens do mês: conta as de setembro e soma km só das finalizadas do mês', () => {
    let resumo = { total: 0, km: 0, parcial: true };
    servico.buscarViagensDoMes().subscribe((valor) => (resumo = valor));
    controle.expectOne((candidata) => candidata.url === API + '/trips').flush(
      pagina([
        { status: 'COMPLETED', startKm: 61830, endKm: 62416, startTime: new Date(2026, 8, 22, 8).toISOString(), endTime: new Date(2026, 8, 22, 18).toISOString() },
        { status: 'IN_PROGRESS', startKm: 62416, endKm: null, startTime: new Date(2026, 8, 24, 8).toISOString(), endTime: null },
        { status: 'COMPLETED', startKm: 61000, endKm: 61830, startTime: new Date(2026, 7, 28, 8).toISOString(), endTime: new Date(2026, 7, 28, 20).toISOString() },
      ]),
    );
    expect(resumo).toEqual({ total: 2, km: 586, parcial: false });
  });

  it('viagens do mês: marca "parcial" se há mais páginas e a última viagem ainda é do mês', () => {
    let parcial = false;
    servico.buscarViagensDoMes().subscribe((valor) => (parcial = valor.parcial));
    controle
      .expectOne((candidata) => candidata.url === API + '/trips')
      .flush(pagina([{ status: 'PLANNED', startKm: 0, endKm: null, startTime: new Date(2026, 8, 1).toISOString(), endTime: null, createdAt: new Date(2026, 8, 1).toISOString() }], 3, 250));
    expect(parcial).toBe(true);
  });

  it('incidentes do mês: conta só os criados neste mês', () => {
    let total = -1;
    servico.buscarIncidentesDoMes().subscribe((valor) => (total = valor.total));
    controle.expectOne((candidata) => candidata.url === API + '/incidents').flush(
      pagina([
        { createdAt: new Date(2026, 8, 10).toISOString() },
        { createdAt: new Date(2026, 7, 10).toISOString() },
      ]),
    );
    expect(total).toBe(1);
  });

  it('próxima manutenção sem viagem em andamento avisa "sem viagem ativa" e não chama /maintenances', () => {
    let semViagem = false;
    servico.buscarProximaManutencao().subscribe((valor) => (semViagem = valor.semViagemAtiva));
    controle.expectOne((candidata) => candidata.url === API + '/trips').flush(pagina([]));
    expect(semViagem).toBe(true);
  });

  it('próxima manutenção do veículo da viagem: pega a agendada com a data mais próxima', () => {
    let resultado: unknown = null;
    servico.buscarProximaManutencao().subscribe((valor) => (resultado = valor));
    controle.expectOne((candidata) => candidata.url === API + '/trips').flush(pagina([{ vehicleId: VEICULOS.master.id }]));
    const manutencoes = controle.expectOne((candidata) => candidata.url === API + '/maintenances');
    expect(manutencoes.request.params.get('vehicleId')).toBe(VEICULOS.master.id);
    expect(manutencoes.request.params.get('status')).toBe('SCHEDULED');
    manutencoes.flush(
      pagina([
        { scheduledDate: '2026-12-01', description: 'Revisão dos freios' },
        { scheduledDate: '2026-10-15', description: 'Troca de óleo e filtros aos 20.000 km' },
      ]),
    );
    expect(resultado).toEqual({ semViagemAtiva: false, dataAgendada: '2026-10-15', descricao: 'Troca de óleo e filtros aos 20.000 km' });
  });

  it('próxima manutenção: veículo sem manutenção agendada devolve datas vazias', () => {
    let resultado: unknown = null;
    servico.buscarProximaManutencao().subscribe((valor) => (resultado = valor));
    controle.expectOne((candidata) => candidata.url === API + '/trips').flush(pagina([{ vehicleId: VEICULOS.strada.id }]));
    controle.expectOne((candidata) => candidata.url === API + '/maintenances').flush(pagina([]));
    expect(resultado).toEqual({ semViagemAtiva: false, dataAgendada: null, descricao: null });
  });

  it('frota por status: 4 chamadas com pageSize=1 e guarda em cache por 60 s', () => {
    const totais: Record<string, number> = { AVAILABLE: 6, IN_USE: 4, IN_MAINTENANCE: 1, OUT_OF_SERVICE: 0 };
    let resposta: unknown = null;
    servico.buscarFrotaPorStatus().subscribe((valor) => (resposta = valor));
    const chamadas = controle.match((candidata) => candidata.url === API + '/vehicles');
    expect(chamadas).toHaveLength(4);
    for (const chamada of chamadas) {
      expect(chamada.request.params.get('pageSize')).toBe('1');
      chamada.flush(pagina([], 1, totais[chamada.request.params.get('status') as string]));
    }
    expect(resposta).toEqual([
      { status: 'AVAILABLE', total: 6 },
      { status: 'IN_USE', total: 4 },
      { status: 'IN_MAINTENANCE', total: 1 },
      { status: 'OUT_OF_SERVICE', total: 0 },
    ]);

    // Segunda chamada em menos de 60 s: não vai à rede.
    servico.buscarFrotaPorStatus().subscribe();
    controle.expectNone((candidata) => candidata.url === API + '/vehicles');

    // Depois de 60 s, chama de novo.
    jest.advanceTimersByTime(61000);
    servico.buscarFrotaPorStatus().subscribe();
    const novas = controle.match((candidata) => candidata.url === API + '/vehicles');
    expect(novas).toHaveLength(4);
    novas.forEach((nova) => nova.flush(pagina([])));
  });

  it('viagens ativas devolve o total da paginação (status IN_PROGRESS)', () => {
    let total = 0;
    servico.buscarViagensAtivas().subscribe((valor) => (total = valor));
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/trips');
    expect(requisicao.request.params.get('status')).toBe('IN_PROGRESS');
    requisicao.flush(pagina([], 1, 4));
    expect(total).toBe(4);
  });

  it('usuários ativos: conta isActive e marca parcial se há mais de uma página', () => {
    let resumo: unknown = null;
    servico.buscarUsuariosAtivos().subscribe((valor) => (resumo = valor));
    controle
      .expectOne((candidata) => candidata.url === API + '/users')
      .flush(
        pagina(
          [
            { isActive: true },
            { isActive: true },
            { isActive: false },
          ],
          2,
          130,
        ),
      );
    expect(resumo).toEqual({ ativos: 2, total: 130, parcial: true });
  });

  it('saúde do sistema: status ok é operacional e traz o tempo do banco', () => {
    let saude: unknown = null;
    servico.buscarSaudeDoSistema().subscribe((valor) => (saude = valor));
    controle.expectOne(API + '/health').flush({ status: 'ok', details: { database: { responseTime: 12 } } });
    expect(saude).toEqual({ operacional: true, tempoBancoMs: 12 });
  });

  it('saúde do sistema: resposta sem detalhes não quebra e "error" não é operacional', () => {
    let saude: unknown = null;
    servico.buscarSaudeDoSistema().subscribe((valor) => (saude = valor));
    controle.expectOne(API + '/health').flush({ status: 'error' });
    expect(saude).toEqual({ operacional: false, tempoBancoMs: null });
  });

  it('km por dia pede 90 dias; severidade e consumo usam /analytics; últimas viagens pede 5', () => {
    servico.buscarKmPorDia().subscribe();
    servico.buscarIncidentesPorSeveridade().subscribe();
    servico.buscarConsumoTotal().subscribe();
    servico.buscarUltimasViagens().subscribe();
    const km = controle.expectOne((candidata) => candidata.url === API + '/analytics/fleet/daily-distance');
    expect(km.request.params.get('days')).toBe('90');
    controle.expectOne(API + '/analytics/incidents/severity');
    controle.expectOne(API + '/analytics/fleet/fuel-consumption');
    const viagens = controle.expectOne((candidata) => candidata.url === API + '/trips');
    expect(viagens.request.params.get('pageSize')).toBe('5');
    controle.match(() => true).forEach((pendente) => pendente.flush(pagina([])));
  });
});

describe('DashboardStateService (blocos por permission)', () => {
  let authService: { login: jest.Mock };
  let estadoAuth: AuthStateService;
  let servicoDashboard: Record<string, jest.Mock>;

  function montarEstado(): DashboardStateService {
    return new DashboardStateService(servicoDashboard as unknown as DashboardService, estadoAuth);
  }

  function entrarComo(pessoa: typeof PESSOAS.marcos | typeof PESSOAS.patricia | typeof PESSOAS.roberto): void {
    authService.login.mockReturnValue(of(montarRespostaLogin(pessoa)));
    estadoAuth.login(pessoa.email, 'Frota@2026', 'vf_live_chave').subscribe();
  }

  function ultimoValor<T>(fluxo: Observable<EstadoBloco<T>>): EstadoBloco<T> {
    let valor: EstadoBloco<T> = { situacao: 'carregando', dados: null };
    fluxo.subscribe((atual) => (valor = atual)).unsubscribe();
    return valor;
  }

  beforeEach(() => {
    localStorage.clear();
    authService = { login: jest.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: authService }] });
    estadoAuth = TestBed.inject(AuthStateService);
    servicoDashboard = {
      buscarViagensDoMes: jest.fn().mockReturnValue(of({ total: 3, km: 1200, parcial: false })),
      buscarIncidentesDoMes: jest.fn().mockReturnValue(of({ total: 1, parcial: false })),
      buscarProximaManutencao: jest.fn().mockReturnValue(of({ semViagemAtiva: true, dataAgendada: null, descricao: null })),
      buscarFrotaPorStatus: jest.fn().mockReturnValue(of([])),
      buscarConsumoTotal: jest.fn().mockReturnValue(of({ averageLitersPerKm: 0.12, totalLiters: 840, totalKm: 7000 })),
      buscarViagensAtivas: jest.fn().mockReturnValue(of(4)),
      buscarUsuariosAtivos: jest.fn().mockReturnValue(of({ ativos: 12, total: 14, parcial: false })),
      buscarSaudeDoSistema: jest.fn().mockReturnValue(of({ operacional: true, tempoBancoMs: 8 })),
      buscarKmPorDia: jest.fn().mockReturnValue(of([])),
      buscarIncidentesPorSeveridade: jest.fn().mockReturnValue(of([])),
      buscarUltimasViagens: jest.fn().mockReturnValue(of([])),
    };
  });

  afterEach(() => {
    estadoAuth.limparSessao();
    localStorage.clear();
  });

  it('motorista carrega só o que é dele: viagens, mês, manutenção e incidentes (sem analytics, usuários e saúde)', () => {
    entrarComo(PESSOAS.marcos);
    const estado = montarEstado();
    expect(estado.ehMotorista).toBe(true);
    estado.carregarTudo();
    expect(servicoDashboard['buscarUltimasViagens']).toHaveBeenCalled();
    expect(servicoDashboard['buscarViagensDoMes']).toHaveBeenCalled();
    expect(servicoDashboard['buscarProximaManutencao']).toHaveBeenCalled();
    expect(servicoDashboard['buscarIncidentesDoMes']).toHaveBeenCalled();
    expect(servicoDashboard['buscarConsumoTotal']).not.toHaveBeenCalled();
    expect(servicoDashboard['buscarUsuariosAtivos']).not.toHaveBeenCalled();
    expect(servicoDashboard['buscarSaudeDoSistema']).not.toHaveBeenCalled();
  });

  it('gerente carrega os blocos de gestão, mas não usuários nem saúde', () => {
    entrarComo(PESSOAS.patricia);
    const estado = montarEstado();
    expect(estado.ehMotorista).toBe(false);
    expect(estado.ehGestao).toBe(true);
    estado.carregarTudo();
    expect(servicoDashboard['buscarConsumoTotal']).toHaveBeenCalled();
    expect(servicoDashboard['buscarViagensAtivas']).toHaveBeenCalled();
    expect(servicoDashboard['buscarViagensDoMes']).not.toHaveBeenCalled();
    expect(servicoDashboard['buscarUsuariosAtivos']).not.toHaveBeenCalled();
    expect(servicoDashboard['buscarSaudeDoSistema']).not.toHaveBeenCalled();
  });

  it('administrador carrega tudo, inclusive usuários ativos e saúde do sistema', () => {
    entrarComo(PESSOAS.roberto);
    const estado = montarEstado();
    estado.carregarTudo();
    expect(servicoDashboard['buscarUsuariosAtivos']).toHaveBeenCalled();
    expect(servicoDashboard['buscarSaudeDoSistema']).toHaveBeenCalled();
    expect(ultimoValor(estado.usuariosAtivos$)).toEqual({ situacao: 'pronto', dados: { ativos: 12, total: 14, parcial: false } });
    expect(ultimoValor(estado.viagensAtivas$).dados).toBe(4);
  });

  it('erro 403 vira "sem-acesso", 429 vira "limite" e o resto "erro"', () => {
    entrarComo(PESSOAS.roberto);
    servicoDashboard['buscarConsumoTotal'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    servicoDashboard['buscarViagensAtivas'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    servicoDashboard['buscarKmPorDia'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const estado = montarEstado();
    estado.carregarTudo();
    expect(ultimoValor(estado.consumoTotal$).situacao).toBe('sem-acesso');
    expect(ultimoValor(estado.viagensAtivas$).situacao).toBe('limite');
    expect(ultimoValor(estado.kmPorDia$).situacao).toBe('erro');
  });

  it('o bloco começa "carregando" e recarregar cancela a chamada anterior (ninguém sobrescreve o dado novo)', () => {
    entrarComo(PESSOAS.roberto);
    const primeira = new Subject<number>();
    const segunda = new Subject<number>();
    servicoDashboard['buscarViagensAtivas'].mockReturnValueOnce(primeira).mockReturnValueOnce(segunda);
    const estado = montarEstado();
    expect(ultimoValor(estado.viagensAtivas$).situacao).toBe('carregando');

    estado.carregar('viagensAtivas');
    estado.carregar('viagensAtivas');
    primeira.next(99);
    expect(ultimoValor(estado.viagensAtivas$).situacao).toBe('carregando');
    segunda.next(4);
    expect(ultimoValor(estado.viagensAtivas$)).toEqual({ situacao: 'pronto', dados: 4 });
  });

  it('ao destruir o componente, as chamadas em andamento são canceladas', () => {
    entrarComo(PESSOAS.roberto);
    const pendente = new Subject<number>();
    servicoDashboard['buscarViagensAtivas'].mockReturnValue(pendente);
    const estado = montarEstado();
    estado.carregar('viagensAtivas');
    estado.ngOnDestroy();
    pendente.next(7);
    expect(ultimoValor(estado.viagensAtivas$).situacao).toBe('carregando');
  });
});

describe('AnalyticsService (cache de 60 segundos)', () => {
  let servico: AnalyticsService;
  let controle: HttpTestingController;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 25, 12, 0));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servico = TestBed.inject(AnalyticsService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    jest.useRealTimers();
  });

  it('a segunda leitura em 60 s vem do cache e não chama a API', () => {
    servico.consumoDaFrota().subscribe();
    controle.expectOne(API + '/analytics/fleet/fuel-consumption').flush({ averageLitersPerKm: 0.12, totalLiters: 840, totalKm: 7000 });

    let consumo: unknown = null;
    servico.consumoDaFrota().subscribe((valor) => (consumo = valor));
    controle.expectNone(API + '/analytics/fleet/fuel-consumption');
    expect(consumo).toEqual({ averageLitersPerKm: 0.12, totalLiters: 840, totalKm: 7000 });
  });

  it('"forçar" (botão Atualizar) ignora o cache', () => {
    servico.consumoDaFrota().subscribe();
    controle.expectOne(API + '/analytics/fleet/fuel-consumption').flush({});
    servico.consumoDaFrota(true).subscribe();
    controle.expectOne(API + '/analytics/fleet/fuel-consumption').flush({});
  });

  it('depois de 60 s o cache vence e a API é chamada de novo', () => {
    servico.kmPorDia().subscribe();
    controle.expectOne((candidata) => candidata.url === API + '/analytics/fleet/daily-distance').flush([]);
    jest.advanceTimersByTime(60001);
    servico.kmPorDia().subscribe();
    controle.expectOne((candidata) => candidata.url === API + '/analytics/fleet/daily-distance').flush([]);
  });

  it('o cache separa por parâmetro: filtros de status diferentes são chamadas diferentes', () => {
    servico.incidentesPorSeveridade('RESOLVED').subscribe();
    servico.incidentesPorSeveridade('REPORTED').subscribe();
    const chamadas = controle.match((candidata) => candidata.url === API + '/analytics/incidents/severity');
    expect(chamadas).toHaveLength(2);
    chamadas.forEach((chamada) => chamada.flush([]));
  });

  it('sem filtro, não manda o parâmetro status', () => {
    servico.incidentesPorSeveridade('').subscribe();
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/analytics/incidents/severity');
    expect(requisicao.request.params.has('status')).toBe(false);
    requisicao.flush([]);
  });

  it('eficiência do veículo, viagens do motorista e cabeçalho do veículo usam as rotas certas', () => {
    servico.eficienciaDoVeiculo(VEICULOS.strada.id).subscribe();
    servico.viagensDoMotorista(PESSOAS.marcos.driverId as string).subscribe();
    servico.buscarVeiculo(VEICULOS.strada.id).subscribe();
    controle.expectOne(API + '/analytics/vehicle/' + VEICULOS.strada.id + '/efficiency');
    controle.expectOne(API + '/analytics/driver/' + PESSOAS.marcos.driverId + '/trips');
    controle.expectOne(API + '/vehicles/' + VEICULOS.strada.id);
    controle.match(() => true).forEach((pendente) => pendente.flush({}));
  });

  it('erro da API não entra no cache', () => {
    servico.consumoDaFrota().subscribe({ error: () => {} });
    controle.expectOne(API + '/analytics/fleet/fuel-consumption').flush({}, { status: 500, statusText: 'Erro' });
    servico.consumoDaFrota().subscribe();
    controle.expectOne(API + '/analytics/fleet/fuel-consumption').flush({});
  });
});
