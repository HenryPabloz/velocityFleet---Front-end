import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { traducaoFalsa } from '../../../testing/apoio';
import { AuthStateService } from '../services/auth-state.service';
import { NotificationService } from '../services/notification.service';
import { AuthInterceptor } from './auth.interceptor';
import { ERRO_TRATADO_NA_TELA, ErrorInterceptor } from './error.interceptor';
import { HttpContext } from '@angular/common/http';

const API = environment.apiUrl;
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjQxMDI0NDQ4MDB9.assinatura';

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let controle: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controle.verify();
    localStorage.clear();
  });

  it('envia o Bearer nas rotas da nossa API quando há token', () => {
    localStorage.setItem('access_token', JWT);
    http.get(API + '/vehicles').subscribe();
    const requisicao = controle.expectOne(API + '/vehicles');
    expect(requisicao.request.headers.get('Authorization')).toBe('Bearer ' + JWT);
    expect(requisicao.request.headers.has('x-api-key')).toBe(false);
    requisicao.flush([]);
  });

  it('sem token, não inventa Authorization', () => {
    http.get(API + '/vehicles').subscribe();
    const requisicao = controle.expectOne(API + '/vehicles');
    expect(requisicao.request.headers.has('Authorization')).toBe(false);
    requisicao.flush([]);
  });

  it('não vaza token nem chave para o ViaCEP', () => {
    localStorage.setItem('access_token', JWT);
    http.get('https://viacep.com.br/ws/01310100/json/').subscribe();
    const requisicao = controle.expectOne('https://viacep.com.br/ws/01310100/json/');
    expect(requisicao.request.headers.has('Authorization')).toBe(false);
    expect(requisicao.request.headers.has('x-api-key')).toBe(false);
    requisicao.flush({});
  });

  it('não vaza credencial para um domínio parecido com o da API', () => {
    localStorage.setItem('access_token', JWT);
    const parecida = API + '.atacante.com/vehicles';
    http.get(parecida).subscribe();
    const requisicao = controle.expectOne(parecida);
    expect(requisicao.request.headers.has('Authorization')).toBe(false);
    requisicao.flush([]);
  });

  it('coloca a x-api-key fixa da aplicação no POST /auth/login', () => {
    http.post(API + '/auth/login', {}).subscribe();
    const requisicao = controle.expectOne(API + '/auth/login');
    expect(requisicao.request.headers.get('x-api-key')).toBe(environment.apiKey);
    requisicao.flush({});
  });

  it('não manda x-api-key em outras rotas (nem POST /auth/refresh-token)', () => {
    http.post(API + '/auth/refresh-token', {}).subscribe();
    http.get(API + '/trips').subscribe();
    http.get(API + '/auth/login').subscribe();
    const requisicoes = controle.match(() => true);
    expect(requisicoes.length).toBe(3);
    for (const requisicao of requisicoes) {
      expect(requisicao.request.headers.has('x-api-key')).toBe(false);
      requisicao.flush({});
    }
  });
});

describe('ErrorInterceptor', () => {
  let http: HttpClient;
  let controle: HttpTestingController;
  let notificacao: { erro: jest.Mock };
  let estado: { limparSessao: jest.Mock };
  let roteador: { navigate: jest.Mock };

  beforeEach(() => {
    notificacao = { erro: jest.fn() };
    estado = { limparSessao: jest.fn() };
    roteador = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        { provide: NotificationService, useValue: notificacao },
        { provide: AuthStateService, useValue: estado },
        { provide: Router, useValue: roteador },
        { provide: TranslateService, useValue: traducaoFalsa },
      ],
    });
    http = TestBed.inject(HttpClient);
    controle = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controle.verify());

  function falhar(
    metodo: 'GET' | 'POST' | 'PATCH',
    url: string,
    status: number,
    corpo: unknown = null,
    contexto?: HttpContext,
  ): void {
    http.request(metodo, url, { body: {}, context: contexto }).subscribe({ error: () => {} });
    controle.expectOne(url).flush(corpo, { status: status, statusText: 'Erro' });
  }

  it('401 comum (sessão vencida) desloga, vai ao login e avisa com o detail da API', () => {
    falhar('GET', API + '/trips', 401, { detail: 'Token expirado', status: 401 });
    expect(estado.limparSessao).toHaveBeenCalledTimes(1);
    expect(roteador.navigate).toHaveBeenCalledWith(['/auth/login']);
    expect(notificacao.erro).toHaveBeenCalledWith('Token expirado');
  });

  it('401 comum sem detail usa a frase de sessão expirada', () => {
    falhar('GET', API + '/trips', 401);
    expect(notificacao.erro).toHaveBeenCalledWith('ERROS_API.SESSAO_EXPIRADA');
  });

  it('401 no login (senha errada) NÃO desloga e não abre toast', () => {
    falhar('POST', API + '/auth/login', 401, { detail: 'Invalid credentials', status: 401 });
    expect(estado.limparSessao).not.toHaveBeenCalled();
    expect(roteador.navigate).not.toHaveBeenCalled();
    expect(notificacao.erro).not.toHaveBeenCalled();
  });

  it('401 de "senha atual incorreta" na troca de senha NÃO desloga', () => {
    falhar('PATCH', API + '/users/me/password', 401, { detail: 'Current password is incorrect' });
    expect(estado.limparSessao).not.toHaveBeenCalled();
    expect(notificacao.erro).not.toHaveBeenCalled();
  });

  it('403 mostra o detail da API (RFC 7807)', () => {
    falhar('GET', API + '/users', 403, { detail: 'Forbidden resource', status: 403 });
    expect(notificacao.erro).toHaveBeenCalledWith('Forbidden resource');
    expect(estado.limparSessao).not.toHaveBeenCalled();
  });

  it('403 sem detail usa a frase padrão de sem permissão', () => {
    falhar('GET', API + '/users', 403);
    expect(notificacao.erro).toHaveBeenCalledWith('ERROS_API.SEM_PERMISSAO');
  });

  it('502 e 504 (ViaCEP fora do ar) mostram aviso de serviço externo', () => {
    falhar('GET', API + '/trips', 502);
    falhar('GET', API + '/trips', 504);
    expect(notificacao.erro).toHaveBeenNthCalledWith(1, 'ERROS_API.SERVICO_EXTERNO');
    expect(notificacao.erro).toHaveBeenNthCalledWith(2, 'ERROS_API.SERVICO_EXTERNO');
  });

  it('500 mostra erro de servidor', () => {
    falhar('GET', API + '/trips', 500);
    expect(notificacao.erro).toHaveBeenCalledWith('ERROS_API.SERVIDOR');
  });

  it('sem rede (status 0) mostra aviso de conexão', () => {
    http.get(API + '/trips').subscribe({ error: () => {} });
    controle.expectOne(API + '/trips').error(new ProgressEvent('error'));
    expect(notificacao.erro).toHaveBeenCalledWith('ERROS_API.SEM_CONEXAO');
  });

  it('409 (conflito) mostra o detail da API', () => {
    falhar('POST', API + '/vehicles', 409, { detail: 'Plate already registered', status: 409 });
    expect(notificacao.erro).toHaveBeenCalledWith('Plate already registered');
  });

  it('erro que a tela trata sozinha (exceto 401) não gera toast', () => {
    const contexto = new HttpContext().set(ERRO_TRATADO_NA_TELA, true);
    falhar('POST', API + '/trips', 400, { detail: 'Validation failed' }, contexto);
    expect(notificacao.erro).not.toHaveBeenCalled();
  });

  it('erro de site de terceiros não derruba a sessão nem avisa', () => {
    falhar('GET', 'https://viacep.com.br/ws/00000000/json/', 401);
    expect(estado.limparSessao).not.toHaveBeenCalled();
    expect(notificacao.erro).not.toHaveBeenCalled();
  });

  it('o erro continua chegando a quem chamou (a tela decide o resto)', () => {
    let recebido: number | null = null;
    http.get(API + '/trips').subscribe({ error: (erro) => (recebido = erro.status) });
    controle.expectOne(API + '/trips').flush(null, { status: 404, statusText: 'Not Found' });
    expect(recebido).toBe(404);
  });
});
