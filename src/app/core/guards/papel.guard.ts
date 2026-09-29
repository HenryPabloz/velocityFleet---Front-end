import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';

import { AuthStateService } from '../services/auth-state.service';
import { NotificationService } from '../services/notification.service';

// Só para rotas exclusivas de um papel (ex: ADMIN), em data: { papel: 'ADMIN' }.
@Injectable({ providedIn: 'root' })
export class PapelGuard implements CanActivate {
  constructor(
    private estadoAutenticacao: AuthStateService,
    private router: Router,
    private notificacao: NotificationService,
  ) {}

  canActivate(rota: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.estadoAutenticacao.estaAutenticado) {
      return this.router.createUrlTree(['/auth/login']);
    }

    const papelExigido: string = rota.data['papel'] ?? '';
    if (this.estadoAutenticacao.hasRole(papelExigido)) {
      return true;
    }

    this.notificacao.erro('Você não tem permissão para acessar esta área.');
    return this.router.createUrlTree(['/dashboard']);
  }
}
