import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';

import { AuthStateService } from '../services/auth-state.service';
import { NotificationService } from '../services/notification.service';

// Libera a rota se o usuário tem ALGUMA das permissions de data: { algumaPermissao: [...] }.
@Injectable({ providedIn: 'root' })
export class PermissaoGuard implements CanActivate {
  constructor(
    private estadoAutenticacao: AuthStateService,
    private router: Router,
    private notificacao: NotificationService,
  ) {}

  canActivate(rota: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.estadoAutenticacao.estaAutenticado) {
      return this.router.createUrlTree(['/auth/login']);
    }

    const exigidas: string[] = rota.data['algumaPermissao'] ?? [];
    if (this.estadoAutenticacao.temAlgumaPermissao(exigidas)) {
      return true;
    }

    this.notificacao.erro('Você não tem permissão para acessar esta área.');
    return this.router.createUrlTree(['/dashboard']);
  }
}
