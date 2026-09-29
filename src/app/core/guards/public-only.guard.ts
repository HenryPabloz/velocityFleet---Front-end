import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { AuthStateService } from '../services/auth-state.service';

// Telas públicas (login): quem já está logado é levado ao dashboard.
@Injectable({ providedIn: 'root' })
export class PublicOnlyGuard implements CanActivate {
  constructor(
    private estadoAutenticacao: AuthStateService,
    private router: Router,
  ) {}

  canActivate(): boolean | UrlTree {
    if (this.estadoAutenticacao.estaAutenticado) {
      return this.router.createUrlTree(['/dashboard']);
    }
    return true;
  }
}
