import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { LoginResponse, UsuarioAutenticado } from '../models';
import { AuthService } from './auth.service';

// Renova o JWT quando faltarem 2 minutos para vencer.
const MARGEM_RENOVACAO_MS = 2 * 60 * 1000;
// Se o token vence antes disso, renova logo (evita timer com espera negativa).
const ESPERA_MINIMA_MS = 5 * 1000;
// setTimeout aceita no máximo ~24 dias; acima disso dispararia na hora.
const ESPERA_MAXIMA_MS = 2147483647;

// Guarda quem está logado (com permissions e driverId) e avisa a tela quando isso muda.
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private userSubject = new BehaviorSubject<UsuarioAutenticado | null>(this.lerUsuarioSalvo());
  user$ = this.userSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.temToken());
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private temporizadorRenovacao: ReturnType<typeof setTimeout> | null = null;
  private renovando = false;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    // Sessão já salva no navegador: continua renovando sem precisar logar de novo.
    if (this.temToken()) {
      this.agendarRenovacao();
      // Sessão salva antes da v1.1 não tem permissions: renova para buscá-las.
      const salvo = this.userSubject.value;
      if (salvo && !Array.isArray(salvo.permissions)) {
        // Adiado: pedir HTTP dentro do construtor criaria um ciclo com os interceptors.
        setTimeout(() => this.renovarEmSegundoPlano(), 0);
      }
    }
    // Aba em segundo plano atrasa o timer: ao voltar, confere se já está na hora.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.conferirRenovacao();
      }
    });
  }

  get estaAutenticado(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  get usuarioAtual(): UsuarioAutenticado | null {
    return this.userSubject.value;
  }

  login(email: string, senha: string): Observable<LoginResponse> {
    return this.authService.login(email, senha).pipe(
      tap((resposta) => {
        this.guardarSessao(resposta);
        this.agendarRenovacao();
      }),
    );
  }

  // Limpa só a sessão. O tema continua salvo para o próximo login.
  limparSessao(): void {
    this.cancelarRenovacao();
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    this.userSubject.next(null);
    this.isAuthenticatedSubject.next(false);
  }

  logout(): void {
    this.limparSessao();
    this.router.navigate(['/auth/login']);
  }

  // Depois de editar o perfil: troca o nome na sessão salva (o cabeçalho acompanha).
  atualizarNomeCompleto(nome: string): void {
    const usuario = this.userSubject.value;
    if (!usuario) {
      return;
    }
    const atualizado = { ...usuario, fullName: nome };
    localStorage.setItem('user', JSON.stringify(atualizado));
    this.userSubject.next(atualizado);
  }

  // "role" é texto simples: DRIVER, FLEET_MANAGER ou ADMIN.
  hasRole(papel: string): boolean {
    return this.userSubject.value?.role === papel;
  }

  // Permission efetiva (papel + delegadas). A API continua decidindo (403).
  temPermissao(codigo: string): boolean {
    const usuario = this.userSubject.value;
    if (!usuario) {
      return false;
    }
    const permissoes = usuario.permissions ?? [];
    return permissoes.includes(codigo);
  }

  // Verdadeiro se o usuário tem pelo menos uma das permissions da lista.
  temAlgumaPermissao(codigos: string[]): boolean {
    for (const codigo of codigos) {
      if (this.temPermissao(codigo)) {
        return true;
      }
    }
    return false;
  }

  // Id do perfil de motorista ativo (null se não houver): usado nos formulários do DRIVER.
  obterDriverId(): string | null {
    const usuario = this.userSubject.value;
    if (!usuario) {
      return null;
    }
    return usuario.driverId ?? null;
  }

  // Chama POST /auth/refresh-token e troca o JWT e o user (permissions novas, se houver).
  renovarSessao(): Observable<LoginResponse> {
    return this.authService.refreshToken().pipe(
      tap((resposta) => {
        this.guardarSessao(resposta);
        this.agendarRenovacao();
      }),
    );
  }

  private guardarSessao(resposta: LoginResponse): void {
    localStorage.setItem('access_token', resposta.accessToken);
    localStorage.setItem('user', JSON.stringify(resposta.user));
    this.userSubject.next(resposta.user);
    this.isAuthenticatedSubject.next(true);
  }

  // Lê o "exp" do JWT (em segundos) e agenda a renovação para pouco antes de vencer.
  private agendarRenovacao(): void {
    this.cancelarRenovacao();
    const vencimento = this.lerVencimentoDoToken();
    if (vencimento === null) {
      return;
    }
    let espera = vencimento - Date.now() - MARGEM_RENOVACAO_MS;
    if (espera < ESPERA_MINIMA_MS) {
      espera = ESPERA_MINIMA_MS;
    }
    if (espera > ESPERA_MAXIMA_MS) {
      espera = ESPERA_MAXIMA_MS;
    }
    this.temporizadorRenovacao = setTimeout(() => this.renovarEmSegundoPlano(), espera);
  }

  private cancelarRenovacao(): void {
    if (this.temporizadorRenovacao !== null) {
      clearTimeout(this.temporizadorRenovacao);
      this.temporizadorRenovacao = null;
    }
  }

  // Ao voltar para a aba: renova se faltar pouco. Se já venceu, o 401 do interceptor leva ao login.
  private conferirRenovacao(): void {
    if (!this.estaAutenticado) {
      return;
    }
    const vencimento = this.lerVencimentoDoToken();
    if (vencimento === null) {
      return;
    }
    if (vencimento - Date.now() <= MARGEM_RENOVACAO_MS) {
      this.renovarEmSegundoPlano();
    }
  }

  // Se a renovação falhar com 401, o ErrorInterceptor limpa a sessão e volta ao login.
  private renovarEmSegundoPlano(): void {
    if (this.renovando || !this.estaAutenticado) {
      return;
    }
    this.renovando = true;
    this.renovarSessao().subscribe({
      next: () => {
        this.renovando = false;
      },
      error: () => {
        this.renovando = false;
      },
    });
  }

  // Devolve o vencimento do JWT em milissegundos, ou null se não der para ler.
  private lerVencimentoDoToken(): number | null {
    const credencial = localStorage.getItem('access_token');
    if (!credencial) {
      return null;
    }
    const partes = credencial.split('.');
    if (partes.length < 2) {
      return null;
    }
    try {
      const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      const carga = JSON.parse(atob(base64)) as { exp?: number };
      if (typeof carga.exp !== 'number') {
        return null;
      }
      return carga.exp * 1000;
    } catch {
      return null;
    }
  }

  private temToken(): boolean {
    return !!localStorage.getItem('access_token');
  }

  private lerUsuarioSalvo(): UsuarioAutenticado | null {
    const texto = localStorage.getItem('user');
    if (!texto) {
      return null;
    }
    try {
      return JSON.parse(texto) as UsuarioAutenticado;
    } catch {
      return null;
    }
  }
}
