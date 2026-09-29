import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { AuthStateService } from '../services/auth-state.service';

// Só deixa entrar quem está logado; os outros vão para o login.
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private estadoAutenticacao: AuthStateService,
    private router: Router,
  ) {}

  canActivate(): boolean | UrlTree {
    if (this.estadoAutenticacao.estaAutenticado) {
      return true;
    }
    return this.router.createUrlTree(['/auth/login']);
  }
}
