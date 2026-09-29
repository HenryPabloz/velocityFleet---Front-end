import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { montarRespostaLogin } from '../../../testing/apoio';
import { PESSOAS } from '../../../testing/dados-reais';
import { AuthService } from '../services/auth.service';
import { AuthStateService } from '../services/auth-state.service';
import { NotificationService } from '../services/notification.service';
import { AuthGuard } from './auth.guard';
import { PapelGuard } from './papel.guard';
import { PermissaoGuard } from './permissao.guard';
import { PublicOnlyGuard } from './public-only.guard';

// Monta uma rota com o "data" que os guards leem.
function montarRota(dados: Record<string, unknown>): ActivatedRouteSnapshot {
  const rota = new ActivatedRouteSnapshot();
  rota.data = dados;
  return rota;
}

describe('Guards de rota', () => {
  let notificacao: { erro: jest.Mock };
  let authService: { login: jest.Mock };
  let estado: AuthStateService;

  function entrarComo(pessoa: typeof PESSOAS.marcos | typeof PESSOAS.patricia | typeof PESSOAS.roberto): void {
    authService.login.mockReturnValue(of(montarRespostaLogin(pessoa)));
    estado.login(pessoa.email, 'Frota@2026', 'vf_live_chave').subscribe();
  }

  beforeEach(() => {
    localStorage.clear();
    notificacao = { erro: jest.fn() };
    authService = { login: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: notificacao },
        { provide: AuthService, useValue: authService },
      ],
    });
    estado = TestBed.inject(AuthStateService);
  });

  afterEach(() => {
    estado.limparSessao();
    localStorage.clear();
  });

  describe('AuthGuard', () => {
    it('visitante sem login é mandado para /auth/login', () => {
      const resultado = TestBed.inject(AuthGuard).canActivate() as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/auth/login');
    });

    it('quem está logado passa', () => {
      entrarComo(PESSOAS.marcos);
      expect(TestBed.inject(AuthGuard).canActivate()).toBe(true);
    });
  });

  describe('PublicOnlyGuard', () => {
    it('visitante pode abrir a tela de login', () => {
      expect(TestBed.inject(PublicOnlyGuard).canActivate()).toBe(true);
    });

    it('quem já está logado é levado ao /dashboard em vez do login', () => {
      entrarComo(PESSOAS.patricia);
      const resultado = TestBed.inject(PublicOnlyGuard).canActivate() as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/dashboard');
    });
  });

  describe('PermissaoGuard', () => {
    const rotaDeManutencao = montarRota({ algumaPermissao: ['MAINTENANCE_VIEW_ALL'] });

    it('sem login vai para /auth/login', () => {
      const resultado = TestBed.inject(PermissaoGuard).canActivate(rotaDeManutencao) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/auth/login');
    });

    it('gerente com MAINTENANCE_VIEW_ALL entra na manutenção', () => {
      entrarComo(PESSOAS.patricia);
      expect(TestBed.inject(PermissaoGuard).canActivate(rotaDeManutencao)).toBe(true);
    });

    it('motorista sem a permission volta ao /dashboard e vê aviso de erro', () => {
      entrarComo(PESSOAS.marcos);
      const resultado = TestBed.inject(PermissaoGuard).canActivate(rotaDeManutencao) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/dashboard');
      expect(notificacao.erro).toHaveBeenCalledWith('Você não tem permissão para acessar esta área.');
    });

    it('basta ter UMA das permissions da lista (gerente só com USER_CREATE abre /admin)', () => {
      entrarComo(PESSOAS.patricia);
      const rotaAdmin = montarRota({ algumaPermissao: ['USER_VIEW', 'USER_CREATE'] });
      expect(TestBed.inject(PermissaoGuard).canActivate(rotaAdmin)).toBe(true);
    });

    it('rota sem lista de permissions bloqueia (nada é liberado por engano)', () => {
      entrarComo(PESSOAS.roberto);
      const resultado = TestBed.inject(PermissaoGuard).canActivate(montarRota({})) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/dashboard');
    });
  });

  describe('PapelGuard', () => {
    const rotaDeAdmin = montarRota({ papel: 'ADMIN' });

    it('sem login vai para /auth/login', () => {
      const resultado = TestBed.inject(PapelGuard).canActivate(rotaDeAdmin) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/auth/login');
    });

    it('administrador entra na rota exclusiva de ADMIN', () => {
      entrarComo(PESSOAS.roberto);
      expect(TestBed.inject(PapelGuard).canActivate(rotaDeAdmin)).toBe(true);
    });

    it('gerente é barrado na rota de ADMIN, mesmo com várias permissions', () => {
      entrarComo(PESSOAS.patricia);
      const resultado = TestBed.inject(PapelGuard).canActivate(rotaDeAdmin) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(resultado)).toBe('/dashboard');
      expect(notificacao.erro).toHaveBeenCalledTimes(1);
    });
  });
});
