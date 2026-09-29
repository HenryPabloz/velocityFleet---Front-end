import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CriarManutencaoDto,
  Maintenance,
  MaintenanceStatus,
  PaginatedResponse,
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

export interface FiltrosManutencao {
  status?: MaintenanceStatus | '';
  vehicleId?: string;
}

// Fala com /maintenances. Todas as chamadas deixam a tela mostrar o erro (sem toast global).
@Injectable({ providedIn: 'root' })
export class ManutencoesService {
  constructor(private api: ApiService) {}

  listar(
    pagina: number,
    tamanho: number,
    filtros: FiltrosManutencao = {},
  ): Observable<PaginatedResponse<Maintenance>> {
    let parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    if (filtros.status) {
      parametros = parametros.set('status', filtros.status);
    }
    if (filtros.vehicleId) {
      parametros = parametros.set('vehicleId', filtros.vehicleId);
    }
    return this.api.get<PaginatedResponse<Maintenance>>('/maintenances', parametros, true);
  }

  buscar(id: string): Observable<Maintenance> {
    return this.api.get<Maintenance>('/maintenances/' + id, undefined, true);
  }

  // Não enviamos status nem isActive: a manutenção nasce SCHEDULED.
  criar(dados: CriarManutencaoDto): Observable<Maintenance> {
    return this.api.post<Maintenance>('/maintenances', dados, true);
  }

  // A API preenche a data de conclusão, sincroniza o KM e libera o veículo. Não chamamos /vehicles.
  concluir(id: string): Observable<Maintenance> {
    return this.api.patch<Maintenance>('/maintenances/' + id, { status: 'COMPLETED' }, true);
  }

  // Exclusão lógica (soft delete): exige MAINTENANCE_DELETE.
  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/maintenances/' + id, true);
  }

  // Removidas: exige MAINTENANCE_RESTORE.
  listarExcluidas(pagina: number, tamanho: number): Observable<PaginatedResponse<Maintenance>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Maintenance>>('/maintenances/deleted/all', parametros, true);
  }

  restaurar(id: string): Observable<Maintenance> {
    return this.api.patch<Maintenance>('/maintenances/' + id + '/restore', {}, true);
  }
}
