import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { Vehicle } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { ConsumoFrota, IncidentesPorSeveridade, KmPorDia } from '../../dashboard/dashboard.model';
import { EficienciaVeiculo, EstatisticasMotorista } from '../analytics.model';

// O back-end limita 20 chamadas por minuto em cada rota: guardamos o resultado por 60 segundos.
const VALIDADE_DO_CACHE_MS = 60000;
const DIAS_DO_GRAFICO = 90;

interface EntradaDoCache {
  em: number;
  dados: unknown;
}

// Fala com /analytics/*. Os erros ficam para a tela mostrar (sem toast global).
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private cache = new Map<string, EntradaDoCache>();

  constructor(private api: ApiService) {}

  // "forcar" = true ignora o cache (botão "Atualizar" e "Tentar de novo").
  private buscarComCache<T>(caminho: string, parametros: HttpParams, forcar: boolean): Observable<T> {
    const chave = caminho + '?' + parametros.toString();
    const guardado = this.cache.get(chave);
    if (!forcar && guardado && Date.now() - guardado.em < VALIDADE_DO_CACHE_MS) {
      return of(guardado.dados as T);
    }
    return this.api.get<T>(caminho, parametros, true).pipe(
      tap((dados) => {
        this.cache.set(chave, { em: Date.now(), dados: dados });
      }),
    );
  }

  consumoDaFrota(forcar = false): Observable<ConsumoFrota> {
    return this.buscarComCache<ConsumoFrota>('/analytics/fleet/fuel-consumption', new HttpParams(), forcar);
  }

  // Um item por dia; a tela soma por mês (sem fuso) com agregarPorMes.
  kmPorDia(forcar = false): Observable<KmPorDia[]> {
    const parametros = new HttpParams().set('days', DIAS_DO_GRAFICO);
    return this.buscarComCache<KmPorDia[]>('/analytics/fleet/daily-distance', parametros, forcar);
  }

  eficienciaDoVeiculo(id: string, forcar = false): Observable<EficienciaVeiculo> {
    return this.buscarComCache<EficienciaVeiculo>(
      '/analytics/vehicle/' + id + '/efficiency',
      new HttpParams(),
      forcar,
    );
  }

  viagensDoMotorista(id: string, forcar = false): Observable<EstatisticasMotorista> {
    return this.buscarComCache<EstatisticasMotorista>(
      '/analytics/driver/' + id + '/trips',
      new HttpParams(),
      forcar,
    );
  }

  // O filtro de status é opcional (REPORTED, UNDER_INVESTIGATION ou RESOLVED).
  incidentesPorSeveridade(status: string, forcar = false): Observable<IncidentesPorSeveridade[]> {
    let parametros = new HttpParams();
    if (status) {
      parametros = parametros.set('status', status);
    }
    return this.buscarComCache<IncidentesPorSeveridade[]>('/analytics/incidents/severity', parametros, forcar);
  }

  // Cabeçalho da tela de veículo quando ele não veio na lista de escolha.
  buscarVeiculo(id: string): Observable<Vehicle> {
    return this.api.get<Vehicle>('/vehicles/' + id, undefined, true);
  }
}
