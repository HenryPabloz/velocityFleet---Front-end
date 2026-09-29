import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Incident,
  IncidentStatus,
  PaginatedResponse,
  Severity,
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';

export interface FiltrosIncidente {
  severity?: Severity | '';
  status?: IncidentStatus | '';
  vehicleId?: string;
  driverId?: string;
}

// Fala com /incidents. Todas as chamadas deixam a tela mostrar o erro (sem toast global).
@Injectable({ providedIn: 'root' })
export class IncidentesService {
  constructor(private api: ApiService) {}

  listar(
    pagina: number,
    tamanho: number,
    filtros: FiltrosIncidente = {},
  ): Observable<PaginatedResponse<Incident>> {
    let parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    if (filtros.severity) {
      parametros = parametros.set('severity', filtros.severity);
    }
    if (filtros.status) {
      parametros = parametros.set('status', filtros.status);
    }
    if (filtros.vehicleId) {
      parametros = parametros.set('vehicleId', filtros.vehicleId);
    }
    if (filtros.driverId) {
      parametros = parametros.set('driverId', filtros.driverId);
    }
    return this.api.get<PaginatedResponse<Incident>>('/incidents', parametros, true);
  }

  buscar(id: string): Observable<Incident> {
    return this.api.get<Incident>('/incidents/' + id, undefined, true);
  }

  // multipart/form-data: o navegador monta o cabeçalho sozinho. A foto vai no campo "photo".
  criar(dados: FormData): Observable<Incident> {
    return this.api.post<Incident>('/incidents', dados, true);
  }

  // Só ADMIN e FLEET_MANAGER; o status só avança (REPORTED, UNDER_INVESTIGATION, RESOLVED).
  atualizarStatus(id: string, status: IncidentStatus): Observable<Incident> {
    return this.api.patch<Incident>('/incidents/' + id + '/status', { status: status }, true);
  }

  // Exclusão lógica (soft delete): exige INCIDENT_DELETE.
  excluir(id: string): Observable<void> {
    return this.api.delete<void>('/incidents/' + id, true);
  }

  // Removidos: exige INCIDENT_RESTORE.
  listarExcluidos(pagina: number, tamanho: number): Observable<PaginatedResponse<Incident>> {
    const parametros = new HttpParams().set('page', pagina).set('pageSize', tamanho);
    return this.api.get<PaginatedResponse<Incident>>('/incidents/deleted/all', parametros, true);
  }

  restaurar(id: string): Observable<Incident> {
    return this.api.patch<Incident>('/incidents/' + id + '/restore', {}, true);
  }
}
