import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AtualizarVeiculoDto,
  CriarVeiculoDto,
  PaginatedResponse,
  Vehicle,
  VehicleStatus,
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

// Fala com /vehicles. Todas as chamadas deixam a tela mostrar o erro (sem toast global).
@Injectable({ providedIn: 'root' })
export class VeiculosService {
  constructor(private api: ApiService) {}

  listar(
    pagina: number,
    tamanho: number,
    status: VehicleStatus | '' = '',
  ): Observable<PaginatedResponse<Vehicle>> {
    let parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    if (status) {
      parametros = parametros.set('status', status);
    }
    return this.api.get<PaginatedResponse<Vehicle>>('/vehicles', parametros, true);
  }

  // Veículos removidos (soft delete): exige VEHICLE_RESTORE.
  listarExcluidos(pagina: number, tamanho: number): Observable<PaginatedResponse<Vehicle>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Vehicle>>('/vehicles/deleted/all', parametros, true);
  }

  buscar(id: string): Observable<Vehicle> {
    return this.api.get<Vehicle>('/vehicles/' + id, undefined, true);
  }

  criar(dados: CriarVeiculoDto): Observable<Vehicle> {
    return this.api.post<Vehicle>('/vehicles', dados, true);
  }

  atualizar(id: string, dados: AtualizarVeiculoDto): Observable<Vehicle> {
    return this.api.patch<Vehicle>('/vehicles/' + id, dados, true);
  }

  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/vehicles/' + id, true);
  }

  restaurar(id: string): Observable<Vehicle> {
    return this.api.patch<Vehicle>('/vehicles/' + id + '/restore', {}, true);
  }
}
