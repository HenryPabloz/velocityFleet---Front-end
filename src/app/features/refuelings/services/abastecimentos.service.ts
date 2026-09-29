import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CriarAbastecimentoDto, PaginatedResponse, Refueling } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

export interface FiltrosAbastecimento {
  vehicleId?: string;
  driverId?: string;
}

// Fala com /refuelings. Todas as chamadas deixam a tela mostrar o erro (sem toast global).
@Injectable({ providedIn: 'root' })
export class AbastecimentosService {
  constructor(private api: ApiService) {}

  listar(
    pagina: number,
    tamanho: number,
    filtros: FiltrosAbastecimento = {},
  ): Observable<PaginatedResponse<Refueling>> {
    let parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    if (filtros.vehicleId) {
      parametros = parametros.set('vehicleId', filtros.vehicleId);
    }
    if (filtros.driverId) {
      parametros = parametros.set('driverId', filtros.driverId);
    }
    return this.api.get<PaginatedResponse<Refueling>>('/refuelings', parametros, true);
  }

  buscar(id: string): Observable<Refueling> {
    return this.api.get<Refueling>('/refuelings/' + id, undefined, true);
  }

  // O total (totalCost) é calculado pela API: nunca vai no corpo.
  criar(dados: CriarAbastecimentoDto): Observable<Refueling> {
    return this.api.post<Refueling>('/refuelings', dados, true);
  }

  // Exclusão lógica (soft delete): exige REFUELING_DELETE.
  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/refuelings/' + id, true);
  }

  // Removidos: exige REFUELING_RESTORE.
  listarExcluidos(pagina: number, tamanho: number): Observable<PaginatedResponse<Refueling>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Refueling>>('/refuelings/deleted/all', parametros, true);
  }

  restaurar(id: string): Observable<Refueling> {
    return this.api.patch<Refueling>('/refuelings/' + id + '/restore', {}, true);
  }
}
