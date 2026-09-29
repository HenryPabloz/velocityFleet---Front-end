import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CriarViagemDto,
  FinalizarViagemDto,
  PaginatedResponse,
  Trip,
  TripStatus,
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

export interface FiltrosViagem {
  status?: TripStatus | '';
  driverId?: string;
  vehicleId?: string;
}

// Fala com /trips. Todas as chamadas deixam a tela mostrar o erro (sem toast global).
@Injectable({ providedIn: 'root' })
export class ViagensService {
  constructor(private api: ApiService) {}

  listar(
    pagina: number,
    tamanho: number,
    filtros: FiltrosViagem = {},
  ): Observable<PaginatedResponse<Trip>> {
    let parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    if (filtros.status) {
      parametros = parametros.set('status', filtros.status);
    }
    if (filtros.driverId) {
      parametros = parametros.set('driverId', filtros.driverId);
    }
    if (filtros.vehicleId) {
      parametros = parametros.set('vehicleId', filtros.vehicleId);
    }
    return this.api.get<PaginatedResponse<Trip>>('/trips', parametros, true);
  }

  buscar(id: string): Observable<Trip> {
    return this.api.get<Trip>('/trips/' + id, undefined, true);
  }

  criar(dados: CriarViagemDto): Observable<Trip> {
    return this.api.post<Trip>('/trips', dados, true);
  }

  // PATCH /trips/:id/start não recebe corpo (enviar qualquer campo dá 400).
  iniciar(id: string): Observable<Trip> {
    return this.api.patch<Trip>('/trips/' + id + '/start', undefined, true);
  }

  finalizar(id: string, dados: FinalizarViagemDto): Observable<Trip> {
    return this.api.patch<Trip>('/trips/' + id + '/end', dados, true);
  }

  cancelar(id: string): Observable<Trip> {
    return this.api.patch<Trip>('/trips/' + id + '/cancel', {}, true);
  }

  // Exclusão lógica (soft delete): exige TRIP_DELETE.
  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/trips/' + id, true);
  }

  // Viagens removidas (soft delete): exige TRIP_RESTORE.
  listarExcluidas(pagina: number, tamanho: number): Observable<PaginatedResponse<Trip>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Trip>>('/trips/deleted/all', parametros, true);
  }

  restaurar(id: string): Observable<Trip> {
    return this.api.patch<Trip>('/trips/' + id + '/restore', {}, true);
  }
}
