import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AtualizarUsuarioDto,
  CriarUsuarioDto,
  PaginatedResponse,
  Role,
  User,
  UsuarioCriado,
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

// Ordem dos papéis: quanto maior o número, mais poder. Só dá para subir.
export const NIVEL_DO_PAPEL: Record<string, number> = {
  DRIVER: 1,
  FLEET_MANAGER: 2,
  ADMIN: 3,
};

// Fala com /users e /roles. Todas as chamadas deixam a tela mostrar o erro (sem toast global).
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  constructor(private api: ApiService) {}

  listar(pagina: number, tamanho: number): Observable<PaginatedResponse<User>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<User>>('/users', parametros, true);
  }

  // Removidos: exige USER_RESTORE.
  listarExcluidos(pagina: number, tamanho: number): Observable<PaginatedResponse<User>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<User>>('/users/deleted/all', parametros, true);
  }

  buscar(id: string): Observable<User> {
    return this.api.get<User>('/users/' + id, undefined, true);
  }

  criar(dados: CriarUsuarioDto): Observable<UsuarioCriado> {
    return this.api.post<UsuarioCriado>('/users', dados, true);
  }

  // PATCH aceita só fullName e isActive (não existe PUT).
  atualizar(id: string, dados: AtualizarUsuarioDto): Observable<User> {
    return this.api.patch<User>('/users/' + id, dados, true);
  }

  // Só ADMIN; o papel só sobe.
  promover(id: string, roleId: string): Observable<User> {
    return this.api.patch<User>('/users/' + id + '/role', { roleId: roleId }, true);
  }

  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/users/' + id, true);
  }

  restaurar(id: string): Observable<User> {
    return this.api.patch<User>('/users/' + id + '/restore', {}, true);
  }

  // GET /roles: exige USER_CREATE ou USER_UPDATE.
  listarPapeis(): Observable<Role[]> {
    return this.api.get<Role[]>('/roles', undefined, true);
  }
}
