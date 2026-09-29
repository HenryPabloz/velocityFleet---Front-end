import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { MeuPerfil, TrocarSenhaDto, User } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

// Fala com /users/me. Os erros ficam para a tela mostrar (sem toast global).
@Injectable({ providedIn: 'root' })
export class ContaService {
  constructor(private api: ApiService) {}

  perfil(): Observable<MeuPerfil> {
    return this.api.get<MeuPerfil>('/users/me', undefined, true);
  }

  // PATCH /users/me aceita só fullName.
  atualizarPerfil(nomeCompleto: string): Observable<User> {
    return this.api.patch<User>('/users/me', { fullName: nomeCompleto }, true);
  }

  // 200 sem dados. Senha atual errada volta 401 (o interceptor não desloga neste caso).
  trocarSenha(dados: TrocarSenhaDto): Observable<void> {
    return this.api.patch<void>('/users/me/password', dados, true);
  }
}
