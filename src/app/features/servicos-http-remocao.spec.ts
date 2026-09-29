import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { VEICULOS } from '../../testing/dados-reais';
import { AbastecimentosService } from './refuelings/services/abastecimentos.service';
import { UsuariosService } from './admin/services/usuarios.service';
import { IncidentesService } from './incidents/services/incidentes.service';
import { ManutencoesService } from './maintenance/services/manutencoes.service';
import { ViagensService } from './trips/services/viagens.service';

const API = environment.apiUrl;
const ID = '9e4b7c15-6a2d-4e39-8f10-5c3a1b8d0009';

// Todo recurso com soft delete tem as mesmas 4 rotas: buscar, excluir, removidos e restaurar.
interface Recurso {
  nome: string;
  caminho: string;
  buscar: () => void;
  excluir: () => void;
  listarRemovidos: () => void;
  restaurar: () => void;
}

function montarRecursos(): Recurso[] {
  const viagens = TestBed.inject(ViagensService);
  const abastecimentos = TestBed.inject(AbastecimentosService);
  const manutencoes = TestBed.inject(ManutencoesService);
  const incidentes = TestBed.inject(IncidentesService);
  const usuarios = TestBed.inject(UsuariosService);
  return [
    {
      nome: 'viagens',
      caminho: '/trips',
      buscar: () => viagens.buscar(ID).subscribe(),
      excluir: () => viagens.excluir(ID).subscribe(),
      listarRemovidos: () => viagens.listarExcluidas(1, 10).subscribe(),
      restaurar: () => viagens.restaurar(ID).subscribe(),
    },
    {
      nome: 'abastecimentos',
      caminho: '/refuelings',
      buscar: () => abastecimentos.buscar(ID).subscribe(),
      excluir: () => abastecimentos.excluir(ID).subscribe(),
      listarRemovidos: () => abastecimentos.listarExcluidos(1, 10).subscribe(),
      restaurar: () => abastecimentos.restaurar(ID).subscribe(),
    },
    {
      nome: 'manutenções',
      caminho: '/maintenances',
      buscar: () => manutencoes.buscar(ID).subscribe(),
      excluir: () => manutencoes.excluir(ID).subscribe(),
      listarRemovidos: () => manutencoes.listarExcluidas(1, 10).subscribe(),
      restaurar: () => manutencoes.restaurar(ID).subscribe(),
    },
    {
      nome: 'incidentes',
      caminho: '/incidents',
      buscar: () => incidentes.buscar(ID).subscribe(),
      excluir: () => incidentes.excluir(ID).subscribe(),
      listarRemovidos: () => incidentes.listarExcluidos(1, 10).subscribe(),
      restaurar: () => incidentes.restaurar(ID).subscribe(),
    },
    {
      nome: 'usuários',
      caminho: '/users',
      buscar: () => usuarios.buscar(ID).subscribe(),
      excluir: () => usuarios.excluir(ID).subscribe(),
      listarRemovidos: () => usuarios.listarExcluidos(1, 10).subscribe(),
      restaurar: () => usuarios.restaurar(ID).subscribe(),
    },
  ];
}

describe('Rotas de soft delete e restauração de cada recurso', () => {
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  it.each(['viagens', 'abastecimentos', 'manutenções', 'incidentes', 'usuários'])(
    '%s: buscar, excluir (DELETE), lista de removidos e restaurar (PATCH) usam as URLs da API',
    (nome) => {
      const recurso = montarRecursos().find((item) => item.nome === nome) as Recurso;
      recurso.buscar();
      recurso.excluir();
      recurso.listarRemovidos();
      recurso.restaurar();
      controle.expectOne({ method: 'GET', url: API + recurso.caminho + '/' + ID });
      controle.expectOne({ method: 'DELETE', url: API + recurso.caminho + '/' + ID });
      const removidos = controle.expectOne((candidata) => candidata.url === API + recurso.caminho + '/deleted/all');
      expect(removidos.request.params.get('page')).toBe('1');
      expect(removidos.request.params.get('pageSize')).toBe('10');
      controle.expectOne({ method: 'PATCH', url: API + recurso.caminho + '/' + ID + '/restore' });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    },
  );

  it('usuários: buscar e listar enviam página e tamanho', () => {
    TestBed.inject(UsuariosService).listar(3, 25).subscribe();
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/users');
    expect(requisicao.request.params.get('page')).toBe('3');
    expect(requisicao.request.params.get('pageSize')).toBe('25');
    requisicao.flush({});
  });

  it('manutenções: listar filtra por status e veículo', () => {
    TestBed.inject(ManutencoesService)
      .listar(1, 10, { status: 'SCHEDULED' as never, vehicleId: VEICULOS.master.id })
      .subscribe();
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/maintenances');
    expect(requisicao.request.params.get('status')).toBe('SCHEDULED');
    expect(requisicao.request.params.get('vehicleId')).toBe(VEICULOS.master.id);
    requisicao.flush({});
  });

  it('abastecimentos: listar filtra por motorista', () => {
    TestBed.inject(AbastecimentosService).listar(1, 10, { driverId: 'd-1' }).subscribe();
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/refuelings');
    expect(requisicao.request.params.get('driverId')).toBe('d-1');
    expect(requisicao.request.params.has('vehicleId')).toBe(false);
    requisicao.flush({});
  });

  it('incidentes: listar filtra por status e motorista', () => {
    TestBed.inject(IncidentesService).listar(1, 10, { status: 'RESOLVED' as never, driverId: 'd-1' }).subscribe();
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/incidents');
    expect(requisicao.request.params.get('status')).toBe('RESOLVED');
    expect(requisicao.request.params.get('driverId')).toBe('d-1');
    requisicao.flush({});
  });

  it('viagens: listar filtra por status e veículo', () => {
    TestBed.inject(ViagensService).listar(1, 10, { status: 'IN_PROGRESS' as never, vehicleId: VEICULOS.strada.id }).subscribe();
    const requisicao = controle.expectOne((candidata) => candidata.url === API + '/trips');
    expect(requisicao.request.params.get('status')).toBe('IN_PROGRESS');
    expect(requisicao.request.params.get('vehicleId')).toBe(VEICULOS.strada.id);
    requisicao.flush({});
  });
});
