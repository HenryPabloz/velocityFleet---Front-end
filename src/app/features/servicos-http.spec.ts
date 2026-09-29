import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { IncidentStatus, MaintenanceType, FuelType, VehicleStatus } from '../core/models';
import {
  ABASTECIMENTO,
  ENDERECOS,
  INCIDENTE,
  MANUTENCAO,
  PAPEIS,
  PESSOAS,
  SENHA_VALIDA,
  VEICULOS,
  VIAGEM,
} from '../../testing/dados-reais';
import { montarNomesDosMotoristas, ReferenciasService } from '../shared/dados/services/referencias.service';
import { montarRespostaLogin } from '../../testing/apoio';
import { ContaService } from './account/services/conta.service';
import { UsuariosService } from './admin/services/usuarios.service';
import { AbastecimentosService } from './refuelings/services/abastecimentos.service';
import { IncidentesService } from './incidents/services/incidentes.service';
import { ManutencoesService } from './maintenance/services/manutencoes.service';
import { MotoristasService } from './fleet/services/motoristas.service';
import { VeiculosService } from './fleet/services/veiculos.service';
import { ViagensService } from './trips/services/viagens.service';

const API = environment.apiUrl;

describe('services HTTP das features (verbo, URL e corpo exatos)', () => {
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  describe('ViagensService', () => {
    it('POST /trips leva só motorista, veículo e os dois CEPs (sem startKm)', () => {
      const dados = {
        driverId: PESSOAS.marcos.driverId as string,
        vehicleId: VEICULOS.strada.id,
        startLocation: ENDERECOS.avenidaPaulista.cep,
        endLocation: ENDERECOS.pracaSete.cep,
      };
      TestBed.inject(ViagensService).criar(dados).subscribe();
      const requisicao = controle.expectOne({ method: 'POST', url: API + '/trips' });
      expect(requisicao.request.body).toEqual(dados);
      expect('startKm' in requisicao.request.body).toBe(false);
      requisicao.flush({});
    });

    it('PATCH /trips/:id/start NÃO envia corpo (a API dá 400 se vier qualquer campo)', () => {
      TestBed.inject(ViagensService).iniciar(VIAGEM.id).subscribe();
      const requisicao = controle.expectOne({ method: 'PATCH', url: API + '/trips/' + VIAGEM.id + '/start' });
      expect(requisicao.request.body).toBeNull();
      requisicao.flush({});
    });

    it('PATCH /trips/:id/end leva os km rodados e o local final', () => {
      TestBed.inject(ViagensService)
        .finalizar(VIAGEM.id, { endKm: VIAGEM.kmRodados, endLocation: ENDERECOS.pracaSete.texto })
        .subscribe();
      const requisicao = controle.expectOne({ method: 'PATCH', url: API + '/trips/' + VIAGEM.id + '/end' });
      expect(requisicao.request.body).toEqual({ endKm: 586, endLocation: 'Praça Sete de Setembro, Centro, Belo Horizonte - MG' });
      requisicao.flush({});
    });

    it('cancelar, excluir, listar removidas e restaurar usam as rotas certas', () => {
      const servico = TestBed.inject(ViagensService);
      servico.cancelar(VIAGEM.id).subscribe();
      servico.excluir(VIAGEM.id).subscribe();
      servico.listarExcluidas(1, 10).subscribe();
      servico.restaurar(VIAGEM.id).subscribe();
      controle.expectOne({ method: 'PATCH', url: API + '/trips/' + VIAGEM.id + '/cancel' });
      controle.expectOne({ method: 'DELETE', url: API + '/trips/' + VIAGEM.id });
      controle.expectOne((requisicao) => requisicao.url === API + '/trips/deleted/all' && requisicao.params.get('page') === '1');
      controle.expectOne({ method: 'PATCH', url: API + '/trips/' + VIAGEM.id + '/restore' });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });

    it('listar envia página, tamanho e só os filtros preenchidos', () => {
      TestBed.inject(ViagensService)
        .listar(2, 20, { status: undefined, driverId: PESSOAS.marcos.driverId as string, vehicleId: '' })
        .subscribe();
      const requisicao = controle.expectOne((candidata) => candidata.url === API + '/trips');
      expect(requisicao.request.params.get('page')).toBe('2');
      expect(requisicao.request.params.get('pageSize')).toBe('20');
      expect(requisicao.request.params.get('driverId')).toBe(PESSOAS.marcos.driverId);
      expect(requisicao.request.params.has('status')).toBe(false);
      expect(requisicao.request.params.has('vehicleId')).toBe(false);
      requisicao.flush({});
    });
  });

  describe('UsuariosService', () => {
    it('criar motorista envia o bloco driver com CNH de 11 dígitos e validade', () => {
      const dados = {
        email: PESSOAS.juliana.email,
        password: SENHA_VALIDA,
        fullName: PESSOAS.juliana.nomeCompleto,
        roleId: PAPEIS.driver.id,
        driver: { licenseNumber: PESSOAS.juliana.cnh, licenseExpiry: PESSOAS.juliana.validadeCnh },
      };
      TestBed.inject(UsuariosService).criar(dados).subscribe();
      const requisicao = controle.expectOne({ method: 'POST', url: API + '/users' });
      expect(requisicao.request.body.driver.licenseNumber).toHaveLength(11);
      expect(requisicao.request.body).toEqual(dados);
      requisicao.flush({});
    });

    it('criar gerente vai SEM o bloco driver', () => {
      const dados = {
        email: PESSOAS.patricia.email,
        password: SENHA_VALIDA,
        fullName: PESSOAS.patricia.nomeCompleto,
        roleId: PAPEIS.gerente.id,
      };
      TestBed.inject(UsuariosService).criar(dados).subscribe();
      const requisicao = controle.expectOne({ method: 'POST', url: API + '/users' });
      expect('driver' in requisicao.request.body).toBe(false);
      requisicao.flush({});
    });

    it('atualizar usa PATCH só com nome e situação (não existe PUT)', () => {
      TestBed.inject(UsuariosService).atualizar(PESSOAS.juliana.id, { fullName: 'Juliana Souza Barbosa Lima' }).subscribe();
      const requisicao = controle.expectOne({ method: 'PATCH', url: API + '/users/' + PESSOAS.juliana.id });
      expect(requisicao.request.body).toEqual({ fullName: 'Juliana Souza Barbosa Lima' });
      requisicao.flush({});
    });

    it('promover envia o roleId', () => {
      const servico = TestBed.inject(UsuariosService);
      servico.promover(PESSOAS.marcos.id, PAPEIS.gerente.id).subscribe();
      const promocao = controle.expectOne({ method: 'PATCH', url: API + '/users/' + PESSOAS.marcos.id + '/role' });
      expect(promocao.request.body).toEqual({ roleId: PAPEIS.gerente.id });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });

    it('listar papéis, excluir, restaurar e listar removidos', () => {
      const servico = TestBed.inject(UsuariosService);
      servico.listarPapeis().subscribe();
      servico.excluir(PESSOAS.juliana.id).subscribe();
      servico.restaurar(PESSOAS.juliana.id).subscribe();
      servico.listarExcluidos(1, 10).subscribe();
      controle.expectOne({ method: 'GET', url: API + '/roles' });
      controle.expectOne({ method: 'DELETE', url: API + '/users/' + PESSOAS.juliana.id });
      controle.expectOne({ method: 'PATCH', url: API + '/users/' + PESSOAS.juliana.id + '/restore' });
      controle.expectOne((candidata) => candidata.url === API + '/users/deleted/all');
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });
  });

  describe('IncidentesService', () => {
    it('POST /incidents vai em multipart e a foto no campo "photo"', () => {
      const foto = new File(['imagem'], 'pneu-estourado.jpg', { type: 'image/jpeg' });
      const formulario = new FormData();
      formulario.append('vehicleId', VEICULOS.saveiro.id);
      formulario.append('description', INCIDENTE.descricao);
      formulario.append('photo', foto, foto.name);

      TestBed.inject(IncidentesService).criar(formulario).subscribe();

      const requisicao = controle.expectOne({ method: 'POST', url: API + '/incidents' });
      expect(requisicao.request.body).toBeInstanceOf(FormData);
      const enviado = requisicao.request.body as FormData;
      expect((enviado.get('photo') as File).name).toBe('pneu-estourado.jpg');
      expect(enviado.get('description')).toBe('Pneu dianteiro direito estourado na BR-116, km 214, sem feridos');
      requisicao.flush({});
    });

    it('atualizar status envia PATCH /incidents/:id/status', () => {
      TestBed.inject(IncidentesService).atualizarStatus('inc-1', IncidentStatus.UNDER_INVESTIGATION).subscribe();
      const requisicao = controle.expectOne({ method: 'PATCH', url: API + '/incidents/inc-1/status' });
      expect(requisicao.request.body).toEqual({ status: 'UNDER_INVESTIGATION' });
      requisicao.flush({});
    });

    it('listar aplica filtros de severidade, status, veículo e motorista', () => {
      TestBed.inject(IncidentesService)
        .listar(1, 10, { severity: INCIDENTE.severidade as never, vehicleId: VEICULOS.saveiro.id })
        .subscribe();
      const requisicao = controle.expectOne((candidata) => candidata.url === API + '/incidents');
      expect(requisicao.request.params.get('severity')).toBe('MEDIUM');
      expect(requisicao.request.params.get('vehicleId')).toBe(VEICULOS.saveiro.id);
      expect(requisicao.request.params.has('driverId')).toBe(false);
      requisicao.flush({});
    });
  });

  describe('AbastecimentosService', () => {
    it('POST /refuelings NÃO envia totalCost nem mileage (a API calcula)', () => {
      TestBed.inject(AbastecimentosService)
        .criar({
          vehicleId: VEICULOS.strada.id,
          driverId: PESSOAS.marcos.driverId as string,
          litersAdded: ABASTECIMENTO.litros,
          costPerLiter: ABASTECIMENTO.precoLitro,
          fuelType: FuelType.GASOLINE,
        })
        .subscribe();
      const requisicao = controle.expectOne({ method: 'POST', url: API + '/refuelings' });
      expect(Object.keys(requisicao.request.body).sort()).toEqual(['costPerLiter', 'driverId', 'fuelType', 'litersAdded', 'vehicleId']);
      requisicao.flush({});
    });

    it('listar filtra por veículo', () => {
      TestBed.inject(AbastecimentosService).listar(1, 10, { vehicleId: VEICULOS.master.id }).subscribe();
      const requisicao = controle.expectOne((candidata) => candidata.url === API + '/refuelings');
      expect(requisicao.request.params.get('vehicleId')).toBe(VEICULOS.master.id);
      requisicao.flush({});
    });
  });

  describe('ManutencoesService', () => {
    it('POST /maintenances não envia status (nasce SCHEDULED)', () => {
      TestBed.inject(ManutencoesService)
        .criar({
          vehicleId: VEICULOS.strada.id,
          type: MaintenanceType.PREVENTIVE,
          scheduledDate: MANUTENCAO.agendadaPara,
          description: MANUTENCAO.descricao,
          cost: MANUTENCAO.custo,
        })
        .subscribe();
      const requisicao = controle.expectOne({ method: 'POST', url: API + '/maintenances' });
      expect('status' in requisicao.request.body).toBe(false);
      expect(requisicao.request.body.cost).toBe(480);
      requisicao.flush({});
    });

    it('concluir envia PATCH com status COMPLETED e nada de /vehicles', () => {
      TestBed.inject(ManutencoesService).concluir('man-1').subscribe();
      const requisicao = controle.expectOne({ method: 'PATCH', url: API + '/maintenances/man-1' });
      expect(requisicao.request.body).toEqual({ status: 'COMPLETED' });
      requisicao.flush({});
    });

    it('listarExcluidas e restaurar usam as rotas de removidos', () => {
      const servico = TestBed.inject(ManutencoesService);
      servico.listarExcluidas(1, 10).subscribe();
      servico.restaurar('man-1').subscribe();
      controle.expectOne((candidata) => candidata.url === API + '/maintenances/deleted/all');
      controle.expectOne({ method: 'PATCH', url: API + '/maintenances/man-1/restore' });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });
  });

  describe('VeiculosService', () => {
    it('criar envia a placa exatamente como o formulário mandou', () => {
      TestBed.inject(VeiculosService)
        .criar({ plate: VEICULOS.master.placa, model: VEICULOS.master.modelo, year: VEICULOS.master.ano, currentMileage: VEICULOS.master.kmAtual })
        .subscribe();
      const requisicao = controle.expectOne({ method: 'POST', url: API + '/vehicles' });
      expect(requisicao.request.body.plate).toBe('BRA2E19');
      requisicao.flush({});
    });

    it('atualizar usa PATCH (a placa não muda depois de criada)', () => {
      TestBed.inject(VeiculosService).atualizar(VEICULOS.saveiro.id, { status: VehicleStatus.IN_MAINTENANCE }).subscribe();
      const requisicao = controle.expectOne({ method: 'PATCH', url: API + '/vehicles/' + VEICULOS.saveiro.id });
      expect(requisicao.request.body).toEqual({ status: 'IN_MAINTENANCE' });
      requisicao.flush({});
    });

    it('listar filtra por status, excluir e restaurar usam as rotas certas', () => {
      const servico = TestBed.inject(VeiculosService);
      servico.listar(1, 10, VehicleStatus.AVAILABLE).subscribe();
      servico.excluir(VEICULOS.saveiro.id).subscribe();
      servico.restaurar(VEICULOS.saveiro.id).subscribe();
      servico.listarExcluidos(1, 10).subscribe();
      servico.buscar(VEICULOS.saveiro.id).subscribe();
      const lista = controle.expectOne((candidata) => candidata.url === API + '/vehicles' && candidata.params.has('status'));
      expect(lista.request.params.get('status')).toBe('AVAILABLE');
      controle.expectOne({ method: 'DELETE', url: API + '/vehicles/' + VEICULOS.saveiro.id });
      controle.expectOne({ method: 'PATCH', url: API + '/vehicles/' + VEICULOS.saveiro.id + '/restore' });
      controle.expectOne((candidata) => candidata.url === API + '/vehicles/deleted/all');
      controle.expectOne({ method: 'GET', url: API + '/vehicles/' + VEICULOS.saveiro.id });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });
  });

  describe('MotoristasService', () => {
    it('rotas de motoristas (listar, removidos, buscar, excluir, restaurar)', () => {
      const servico = TestBed.inject(MotoristasService);
      const id = PESSOAS.marcos.driverId as string;
      servico.listar(1, 10).subscribe();
      servico.listarExcluidos(1, 10).subscribe();
      servico.buscar(id).subscribe();
      servico.excluir(id).subscribe();
      servico.restaurar(id).subscribe();
      controle.expectOne((candidata) => candidata.url === API + '/drivers');
      controle.expectOne((candidata) => candidata.url === API + '/drivers/deleted/all');
      controle.expectOne({ method: 'GET', url: API + '/drivers/' + id });
      controle.expectOne({ method: 'DELETE', url: API + '/drivers/' + id });
      controle.expectOne({ method: 'PATCH', url: API + '/drivers/' + id + '/restore' });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });
  });

  describe('ContaService', () => {
    it('perfil, nome e senha usam as rotas de /users/me', () => {
      const servico = TestBed.inject(ContaService);
      servico.perfil().subscribe();
      servico.atualizarPerfil('Patrícia Lemos Figueiredo Alves').subscribe();
      servico.trocarSenha({ currentPassword: SENHA_VALIDA, newPassword: 'Gestao@2027' }).subscribe();
      controle.expectOne({ method: 'GET', url: API + '/users/me' });
      const nome = controle.expectOne({ method: 'PATCH', url: API + '/users/me' });
      expect(nome.request.body).toEqual({ fullName: 'Patrícia Lemos Figueiredo Alves' });
      const senha = controle.expectOne({ method: 'PATCH', url: API + '/users/me/password' });
      expect(senha.request.body).toEqual({ currentPassword: 'Frota@2026', newPassword: 'Gestao@2027' });
      controle.match(() => true).forEach((pendente) => pendente.flush({}));
    });
  });

  describe('ReferenciasService', () => {
    const paginacao = { page: 1, pageSize: 100, total: 1, totalPages: 1 };

    it('veículos disponíveis vem de /vehicles/not-in-use com status AVAILABLE', () => {
      let placas: string[] = [];
      TestBed.inject(ReferenciasService)
        .veiculosDisponiveis()
        .subscribe((veiculos) => (placas = veiculos.map((veiculo) => veiculo.plate)));
      const requisicao = controle.expectOne((candidata) => candidata.url === API + '/vehicles/not-in-use');
      expect(requisicao.request.params.get('status')).toBe('AVAILABLE');
      requisicao.flush({ data: [{ plate: 'RIO4E56' }], pagination: paginacao });
      expect(placas).toEqual(['RIO4E56']);
    });

    it('sem permissão (403), a lista de apoio vem vazia em silêncio', () => {
      let motoristas: unknown[] = [{ id: 'sentinela' }];
      TestBed.inject(ReferenciasService)
        .motoristas()
        .subscribe((lista) => (motoristas = lista));
      controle
        .expectOne((candidata) => candidata.url === API + '/drivers')
        .flush({ detail: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
      expect(motoristas).toEqual([]);
    });

    it('usuário que não existe ou sem USER_VIEW vira null', () => {
      let resultado: unknown = 'sentinela';
      TestBed.inject(ReferenciasService)
        .usuario(PESSOAS.marcos.id)
        .subscribe((usuario) => (resultado = usuario));
      controle.expectOne(API + '/users/' + PESSOAS.marcos.id).flush({}, { status: 403, statusText: 'Forbidden' });
      expect(resultado).toBeNull();
    });

    it('veículos com filtro de status e lista de usuários', () => {
      // usuarios() só chama GET /users com USER_VIEW: precisa de um ADMIN logado.
      const resposta = montarRespostaLogin(PESSOAS.roberto);
      localStorage.setItem('access_token', resposta.accessToken);
      localStorage.setItem('user', JSON.stringify(resposta.user));
      const servico = TestBed.inject(ReferenciasService);
      servico.veiculos(VehicleStatus.IN_MAINTENANCE).subscribe();
      servico.usuarios().subscribe();
      const veiculos = controle.expectOne((candidata) => candidata.url === API + '/vehicles');
      expect(veiculos.request.params.get('status')).toBe('IN_MAINTENANCE');
      controle.expectOne((candidata) => candidata.url === API + '/users');
      controle.match(() => true).forEach((pendente) => pendente.flush({ data: [], pagination: paginacao }));
      localStorage.clear();
    });

    it('montarNomesDosMotoristas usa o fullName que já vem de GET /drivers', () => {
      const nomes = montarNomesDosMotoristas([
        { id: PESSOAS.marcos.driverId as string, fullName: PESSOAS.marcos.nomeCompleto } as never,
        { id: PESSOAS.juliana.driverId as string, fullName: '' } as never,
      ]);
      expect(nomes).toEqual({ [PESSOAS.marcos.driverId as string]: 'Marcos Vinícius Andrade' });
    });
  });
});
