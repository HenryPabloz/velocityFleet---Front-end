import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Driver, PaginatedResponse } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

// Fala com /drivers (exige DRIVER_VIEW). Todas as chamadas deixam a tela mostrar o erro.
@Injectable({ providedIn: 'root' })
export class MotoristasService {
  constructor(private api: ApiService) {}

  listar(pagina: number, tamanho: number): Observable<PaginatedResponse<Driver>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Driver>>('/drivers', parametros, true);
  }

  // Motoristas removidos (soft delete): exige DRIVER_RESTORE.
  listarExcluidos(pagina: number, tamanho: number): Observable<PaginatedResponse<Driver>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Driver>>('/drivers/deleted/all', parametros, true);
  }

  buscar(id: string): Observable<Driver> {
    return this.api.get<Driver>('/drivers/' + id, undefined, true);
  }

  // Excluir (DRIVER_DELETE) e restaurar (DRIVER_RESTORE).
  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/drivers/' + id, true);
  }

  restaurar(id: string): Observable<Driver> {
    return this.api.patch<Driver>('/drivers/' + id + '/restore', {}, true);
  }
}
