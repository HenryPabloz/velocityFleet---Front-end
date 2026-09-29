import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { montarRespostaLogin } from '../../../testing/apoio';
import { PESSOAS, SENHA_VALIDA } from '../../../testing/dados-reais';
import { ERRO_TRATADO_NA_TELA } from '../interceptors/error.interceptor';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NotificacoesService } from './notificacoes.service';
import { NotificationService } from './notification.service';
import { TituloPaginaStrategy } from './titulo-pagina.strategy';

const API = environment.apiUrl;

describe('AuthService', () => {
  let servico: AuthService;
  let controle: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servico = TestBed.inject(AuthService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    localStorage.clear();
  });

  it('login envia só e-mail e senha no corpo (a x-api-key fixa é anexada pelo interceptor, não pelo service)', () => {
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();
    const requisicao = controle.expectOne(API + '/auth/login');
    expect(requisicao.request.method).toBe('POST');
    expect(requisicao.request.body).toEqual({ email: 'marcos.andrade@velocityfleet.com.br', password: 'Frota@2026' });
    expect(requisicao.request.headers.has('x-api-key')).toBe(false);
    requisicao.flush(montarRespostaLogin());
  });

  it('refreshToken usa POST com corpo vazio', () => {
    servico.refreshToken().subscribe();
    const requisicao = controle.expectOne(API + '/auth/refresh-token');
    expect(requisicao.request.method).toBe('POST');
    expect(requisicao.request.body).toEqual({});
    requisicao.flush(montarRespostaLogin());
  });
});

describe('ApiService', () => {
  let servico: ApiService;
  let controle: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servico = TestBed.inject(ApiService);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  it('monta a URL com a base da API e marca se a tela trata o erro', () => {
    servico.get('/vehicles', undefined, true).subscribe();
    const requisicao = controle.expectOne(API + '/vehicles');
    expect(requisicao.request.context.get(ERRO_TRATADO_NA_TELA)).toBe(true);
    requisicao.flush([]);
  });

  it('por padrão o erro vai para o toast global', () => {
    servico.get('/vehicles').subscribe();
    const requisicao = controle.expectOne(API + '/vehicles');
    expect(requisicao.request.context.get(ERRO_TRATADO_NA_TELA)).toBe(false);
    requisicao.flush([]);
  });

  it('post, patch e delete usam o verbo certo e levam o corpo', () => {
    servico.post('/trips', { vehicleId: '1' }).subscribe();
    servico.patch('/trips/9/cancel', {}).subscribe();
    servico.delete('/trips/9').subscribe();
    const postagem = controle.expectOne({ method: 'POST', url: API + '/trips' });
    expect(postagem.request.body).toEqual({ vehicleId: '1' });
    controle.expectOne({ method: 'PATCH', url: API + '/trips/9/cancel' });
    controle.expectOne({ method: 'DELETE', url: API + '/trips/9' });
    controle.match(() => true).forEach((pendente) => pendente.flush({}));
  });
});

describe('NotificationService', () => {
  it('repassa cada tipo de aviso ao ngx-toastr', () => {
    const toastr = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: ToastrService, useValue: toastr }] });
    const servico = TestBed.inject(NotificationService);

    servico.sucesso('Veículo RIO4E56 criado', 'Frota');
    servico.erro('Placa já cadastrada');
    servico.aviso('CNH vence em 12 dias');
    servico.info('Renovando sessão');

    expect(toastr.success).toHaveBeenCalledWith('Veículo RIO4E56 criado', 'Frota');
    expect(toastr.error).toHaveBeenCalledWith('Placa já cadastrada', undefined);
    expect(toastr.warning).toHaveBeenCalledWith('CNH vence em 12 dias', undefined);
    expect(toastr.info).toHaveBeenCalledWith('Renovando sessão', undefined);
  });
});

describe('NotificacoesService', () => {
  it('conta só os avisos não lidos e zera ao marcar todos como lidos', () => {
    const servico = TestBed.inject(NotificacoesService);
    servico.definirLista([
      { id: '1', titulo: 'CNH a vencer', mensagem: 'A CNH de Juliana Souza Barbosa vence em 12 dias', criadaEm: '2026-09-24T10:00:00Z', lida: false },
      { id: '2', titulo: 'Manutenção', mensagem: 'Troca de óleo da Strada RIO4E56 amanhã', criadaEm: '2026-09-23T09:00:00Z', lida: true },
    ]);
    expect(servico.quantidadeNaoLidas).toBe(1);

    servico.adicionar({ id: '3', titulo: 'Incidente', mensagem: 'Pneu estourado na BR-116', criadaEm: '2026-09-25T08:00:00Z', lida: false });
    expect(servico.quantidadeNaoLidas).toBe(2);

    servico.marcarTodasComoLidas();
    expect(servico.quantidadeNaoLidas).toBe(0);
  });

  it('o aviso novo entra no topo da lista', () => {
    const servico = TestBed.inject(NotificacoesService);
    let ids: string[] = [];
    servico.lista$.subscribe((lista) => {
      ids = lista.map((item) => item.id);
    });
    servico.adicionar({ id: 'a', titulo: 'Um', mensagem: 'm', criadaEm: '2026-09-25T08:00:00Z', lida: false });
    servico.adicionar({ id: 'b', titulo: 'Dois', mensagem: 'm', criadaEm: '2026-09-25T09:00:00Z', lida: false });
    expect(ids).toEqual(['b', 'a']);
  });
});

describe('TituloPaginaStrategy', () => {
  // Árvore de rotas simples: cada item tem data e a filha (o Angular real usa getters internos).
  function montarEstado(titulosDaArvore: Array<string | undefined>): RouterStateSnapshot {
    let filha: unknown = null;
    for (let posicao = titulosDaArvore.length - 1; posicao >= 0; posicao--) {
      const titulo = titulosDaArvore[posicao];
      let dados = {};
      if (titulo) {
        dados = { titulo: titulo };
      }
      filha = { data: dados, firstChild: filha };
    }
    return { root: { data: {}, firstChild: filha } } as unknown as RouterStateSnapshot;
  }

  it('usa o título da rota mais interna e acrescenta o nome do sistema', () => {
    const titulo = { setTitle: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: Title, useValue: titulo },
        { provide: TranslateService, useValue: { get: (chave: string) => of('Título de ' + chave) } },
      ],
    });
    TestBed.inject(TituloPaginaStrategy).updateTitle(montarEstado(['MENU.VIAGENS', undefined, 'MENU.FROTA']));
    expect(titulo.setTitle).toHaveBeenCalledWith('Título de MENU.FROTA · VelocityFleet');
  });

  it('rota sem título deixa só o nome do sistema', () => {
    const titulo = { setTitle: jest.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: Title, useValue: titulo }] });
    TestBed.inject(TituloPaginaStrategy).updateTitle(montarEstado([undefined]));
    expect(titulo.setTitle).toHaveBeenCalledWith('VelocityFleet');
  });
});
