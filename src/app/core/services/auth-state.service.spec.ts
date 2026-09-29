import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';

import { montarRespostaLogin, montarTokenFalso } from '../../../testing/apoio';
import { PESSOAS, SENHA_VALIDA } from '../../../testing/dados-reais';
import { AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  let authService: { login: jest.Mock; refreshToken: jest.Mock };
  let roteador: { navigate: jest.Mock };

  let ouvintesDaAba: Array<() => void> = [];

  // Só chama o ouvinte do serviço deste teste (os de testes antigos continuam no document).
  function aoVoltarParaAba(): void {
    for (const ouvinte of ouvintesDaAba) {
      ouvinte();
    }
  }

  function criarServico(): AuthStateService {
    ouvintesDaAba = [];
    const original = document.addEventListener.bind(document);
    jest.spyOn(document, 'addEventListener').mockImplementation((tipo: string, ouvinte: any, opcoes?: any) => {
      if (tipo === 'visibilitychange') {
        ouvintesDaAba.push(ouvinte);
        return;
      }
      original(tipo, ouvinte, opcoes);
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: roteador },
      ],
    });
    return TestBed.inject(AuthStateService);
  }

  beforeEach(() => {
    // O jsdom começa com a aba "invisível": deixamos visível.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    jest.useFakeTimers();
    localStorage.clear();
    // Por padrão a renovação não responde nada (serviços de testes antigos ainda escutam a aba).
    authService = { login: jest.fn(), refreshToken: jest.fn().mockReturnValue(EMPTY) };
    roteador = { navigate: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    localStorage.clear();
  });

  it('começa deslogado quando não há sessão salva', () => {
    const servico = criarServico();
    expect(servico.estaAutenticado).toBe(false);
    expect(servico.usuarioAtual).toBeNull();
  });

  it('login guarda token e usuário e passa a estar autenticado', () => {
    const resposta = montarRespostaLogin();
    authService.login.mockReturnValue(of(resposta));
    const servico = criarServico();

    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    expect(authService.login).toHaveBeenCalledWith(PESSOAS.marcos.email, SENHA_VALIDA);
    expect(servico.estaAutenticado).toBe(true);
    expect(localStorage.getItem('access_token')).toBe(resposta.accessToken);
    expect(JSON.parse(localStorage.getItem('user') as string).fullName).toBe('Marcos Vinícius Andrade');
  });

  it('login com erro não guarda nada', () => {
    authService.login.mockReturnValue(throwError(() => new Error('401')));
    const servico = criarServico();

    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe({ error: () => {} });

    expect(servico.estaAutenticado).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('restaura a sessão salva no navegador', () => {
    const resposta = montarRespostaLogin();
    localStorage.setItem('access_token', resposta.accessToken);
    localStorage.setItem('user', JSON.stringify(resposta.user));

    const servico = criarServico();

    expect(servico.estaAutenticado).toBe(true);
    expect(servico.usuarioAtual?.email).toBe('marcos.andrade@velocityfleet.com.br');
  });

  it('ignora usuário salvo com JSON quebrado', () => {
    localStorage.setItem('user', '{quebrado');
    const servico = criarServico();
    expect(servico.usuarioAtual).toBeNull();
  });

  describe('permissions', () => {
    let servico: AuthStateService;

    beforeEach(() => {
      authService.login.mockReturnValue(of(montarRespostaLogin()));
      servico = criarServico();
      servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();
    });

    it('temPermissao confere a lista efetiva', () => {
      expect(servico.temPermissao('TRIP_CREATE')).toBe(true);
      expect(servico.temPermissao('USER_DELETE')).toBe(false);
    });

    it('temAlgumaPermissao é verdadeiro se bater ao menos uma', () => {
      expect(servico.temAlgumaPermissao(['USER_DELETE', 'TRIP_VIEW_OWN'])).toBe(true);
      expect(servico.temAlgumaPermissao(['USER_DELETE', 'USER_VIEW'])).toBe(false);
      expect(servico.temAlgumaPermissao([])).toBe(false);
    });

    it('hasRole compara o papel', () => {
      expect(servico.hasRole('DRIVER')).toBe(true);
      expect(servico.hasRole('ADMIN')).toBe(false);
    });

    it('obterDriverId devolve o id do motorista', () => {
      expect(servico.obterDriverId()).toBe(PESSOAS.marcos.driverId);
    });
  });

  it('sem usuário: permissões falsas e driverId nulo', () => {
    const servico = criarServico();
    expect(servico.temPermissao('TRIP_CREATE')).toBe(false);
    expect(servico.obterDriverId()).toBeNull();
    expect(servico.hasRole('ADMIN')).toBe(false);
  });

  it('driverId nulo continua nulo (usuário sem perfil de motorista)', () => {
    authService.login.mockReturnValue(of(montarRespostaLogin(PESSOAS.roberto)));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();
    expect(servico.obterDriverId()).toBeNull();
  });

  it('sessão antiga sem permissions renova em segundo plano para buscá-las', () => {
    const resposta = montarRespostaLogin();
    const antigo = { ...resposta.user } as Partial<typeof resposta.user>;
    delete antigo.permissions;
    localStorage.setItem('access_token', resposta.accessToken);
    localStorage.setItem('user', JSON.stringify(antigo));
    authService.refreshToken.mockReturnValue(of(resposta));

    const servico = criarServico();
    expect(servico.temPermissao('TRIP_CREATE')).toBe(false);

    jest.advanceTimersByTime(1);
    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    expect(servico.temPermissao('TRIP_CREATE')).toBe(true);
  });

  it('renovarSessao troca token e usuário (permissions novas)', () => {
    authService.login.mockReturnValue(of(montarRespostaLogin()));
    const nova = montarRespostaLogin(PESSOAS.patricia, { permissions: ['TRIP_VIEW_ALL', 'USER_CREATE'] });
    authService.refreshToken.mockReturnValue(of(nova));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    servico.renovarSessao().subscribe();

    expect(servico.hasRole('FLEET_MANAGER')).toBe(true);
    expect(servico.temPermissao('USER_CREATE')).toBe(true);
    expect(localStorage.getItem('access_token')).toBe(nova.accessToken);
  });

  it('renova sozinho perto do vencimento do token', () => {
    const vence = Math.floor(Date.now() / 1000) + 10 * 60;
    const resposta = montarRespostaLogin();
    resposta.accessToken = montarTokenFalso(vence);
    authService.login.mockReturnValue(of(resposta));
    authService.refreshToken.mockReturnValue(of(montarRespostaLogin()));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    // Faltam 10 min; renova aos 8 min (margem de 2 min).
    jest.advanceTimersByTime(7 * 60 * 1000);
    expect(authService.refreshToken).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2 * 60 * 1000);
    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
  });

  it('token ilegível não agenda renovação', () => {
    const resposta = montarRespostaLogin();
    resposta.accessToken = 'token-sem-pontos';
    authService.login.mockReturnValue(of(resposta));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    jest.advanceTimersByTime(60 * 60 * 1000);
    expect(authService.refreshToken).not.toHaveBeenCalled();
  });

  it('atualizarNomeCompleto muda o nome na sessão salva', () => {
    authService.login.mockReturnValue(of(montarRespostaLogin()));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    servico.atualizarNomeCompleto('Marcos Vinícius Andrade Filho');

    expect(servico.usuarioAtual?.fullName).toBe('Marcos Vinícius Andrade Filho');
    expect(JSON.parse(localStorage.getItem('user') as string).fullName).toBe('Marcos Vinícius Andrade Filho');
  });

  it('atualizarNomeCompleto sem usuário não faz nada', () => {
    const servico = criarServico();
    servico.atualizarNomeCompleto('Juliana Souza Barbosa');
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('logout limpa a sessão e vai para o login', () => {
    authService.login.mockReturnValue(of(montarRespostaLogin()));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    servico.logout();

    expect(servico.estaAutenticado).toBe(false);
    expect(servico.usuarioAtual).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(roteador.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('ao voltar para a aba com token perto de vencer, renova', () => {
    const resposta = montarRespostaLogin();
    resposta.accessToken = montarTokenFalso(Math.floor(Date.now() / 1000) + 60);
    authService.login.mockReturnValue(of(resposta));
    authService.refreshToken.mockReturnValue(of(montarRespostaLogin()));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    aoVoltarParaAba();

    expect(authService.refreshToken).toHaveBeenCalled();
  });

  it('falha na renovação em segundo plano libera nova tentativa', () => {
    const resposta = montarRespostaLogin();
    resposta.accessToken = montarTokenFalso(Math.floor(Date.now() / 1000) + 30);
    authService.login.mockReturnValue(of(resposta));
    authService.refreshToken.mockReturnValue(throwError(() => new Error('falhou')));
    const servico = criarServico();
    servico.login(PESSOAS.marcos.email, SENHA_VALIDA).subscribe();

    aoVoltarParaAba();
    aoVoltarParaAba();

    expect(authService.refreshToken).toHaveBeenCalledTimes(2);
  });
});
