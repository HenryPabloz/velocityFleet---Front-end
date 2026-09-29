import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';

import {
  Incident,
  Maintenance,
  PaginatedResponse,
  Trip,
  TripStatus,
  User,
  Vehicle,
  VehicleStatus,
} from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import {
  ConsumoFrota,
  ContagemStatusVeiculo,
  IncidentesPorSeveridade,
  KmPorDia,
  ProximaManutencao,
  ResumoIncidentesMes,
  ResumoUsuarios,
  ResumoViagensMes,
  SaudeSistema,
} from '../dashboard.model';
import { estaNoMesAtual } from '../utils/datas-dashboard';

const STATUS_DOS_VEICULOS: VehicleStatus[] = [
  VehicleStatus.AVAILABLE,
  VehicleStatus.IN_USE,
  VehicleStatus.IN_MAINTENANCE,
  VehicleStatus.OUT_OF_SERVICE,
];

const DIAS_DO_GRAFICO = 90;

// Só conversa com a API do painel. Erros vão para a tela (o toast global fica desligado aqui).
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private cacheFrota: { em: number; dados: ContagemStatusVeiculo[] } | null = null;

  constructor(private api: ApiService) {}

  // GET /trips já vem só com as viagens do motorista (regra OWN). Filtramos o mês aqui.
  buscarViagensDoMes(): Observable<ResumoViagensMes> {
    const parametros = new HttpParams().set('pageSize', 100);
    return this.api.get<PaginatedResponse<Trip>>('/trips', parametros, true).pipe(
      map((resposta) => {
        let total = 0;
        let km = 0;
        for (const viagem of resposta.data) {
          if (estaNoMesAtual(viagem.startTime)) {
            total = total + 1;
          }
          if (viagem.status === TripStatus.COMPLETED && viagem.endKm !== null) {
            if (estaNoMesAtual(viagem.endTime ?? viagem.startTime)) {
              km = km + (viagem.endKm - viagem.startKm);
            }
          }
        }
        return { total, km, parcial: this.mesPodeEstarTruncado(resposta) };
      }),
    );
  }

  buscarIncidentesDoMes(): Observable<ResumoIncidentesMes> {
    const parametros = new HttpParams().set('pageSize', 100);
    return this.api.get<PaginatedResponse<Incident>>('/incidents', parametros, true).pipe(
      map((resposta) => {
        let total = 0;
        for (const incidente of resposta.data) {
          if (estaNoMesAtual(incidente.createdAt)) {
            total = total + 1;
          }
        }
        return { total, parcial: this.mesPodeEstarTruncado(resposta) };
      }),
    );
  }

  // Há mais páginas E o registro mais antigo desta página (o último) ainda é do mês atual.
  private mesPodeEstarTruncado(resposta: PaginatedResponse<{ createdAt: string }>): boolean {
    if (resposta.pagination.totalPages <= 1 || resposta.data.length === 0) {
      return false;
    }
    const maisAntigo = resposta.data[resposta.data.length - 1];
    return estaNoMesAtual(maisAntigo.createdAt);
  }

  // Veículo = o da viagem em andamento. Motorista pode receber 403 em /maintenances.
  buscarProximaManutencao(): Observable<ProximaManutencao> {
    const parametrosViagem = new HttpParams().set('status', TripStatus.IN_PROGRESS).set('pageSize', 1);
    return this.api.get<PaginatedResponse<Trip>>('/trips', parametrosViagem, true).pipe(
      switchMap((viagens) => {
        if (viagens.data.length === 0) {
          const semViagem: ProximaManutencao = {
            semViagemAtiva: true,
            dataAgendada: null,
            descricao: null,
          };
          return of(semViagem);
        }
        const parametrosManutencao = new HttpParams()
          .set('vehicleId', viagens.data[0].vehicleId)
          .set('status', 'SCHEDULED')
          .set('pageSize', 100);
        return this.api
          .get<PaginatedResponse<Maintenance>>('/maintenances', parametrosManutencao, true)
          .pipe(map((manutencoes) => this.acharMaisProxima(manutencoes.data)));
      }),
    );
  }

  // Devolve a manutenção agendada com a data mais próxima.
  private acharMaisProxima(manutencoes: Maintenance[]): ProximaManutencao {
    let maisProxima: Maintenance | null = null;
    for (const manutencao of manutencoes) {
      if (maisProxima === null || manutencao.scheduledDate < maisProxima.scheduledDate) {
        maisProxima = manutencao;
      }
    }
    if (maisProxima === null) {
      return { semViagemAtiva: false, dataAgendada: null, descricao: null };
    }
    return {
      semViagemAtiva: false,
      dataAgendada: maisProxima.scheduledDate,
      descricao: maisProxima.description,
    };
  }

  // 4 chamadas com pageSize=1: só interessa o pagination.total de cada status.
  buscarFrotaPorStatus(): Observable<ContagemStatusVeiculo[]> {
    // O back-end limita 20 chamadas/min por rota: reaproveita o resultado por 60 s.
    if (this.cacheFrota !== null && Date.now() - this.cacheFrota.em < 60000) {
      return of(this.cacheFrota.dados);
    }
    const chamadas = STATUS_DOS_VEICULOS.map((status) => {
      const parametros = new HttpParams().set('status', status).set('pageSize', 1);
      return this.api.get<PaginatedResponse<Vehicle>>('/vehicles', parametros, true);
    });
    return forkJoin(chamadas).pipe(
      map((respostas) => {
        const contagens: ContagemStatusVeiculo[] = [];
        for (let posicao = 0; posicao < STATUS_DOS_VEICULOS.length; posicao++) {
          contagens.push({
            status: STATUS_DOS_VEICULOS[posicao],
            total: respostas[posicao].pagination.total,
          });
        }
        this.cacheFrota = { em: Date.now(), dados: contagens };
        return contagens;
      }),
    );
  }

  buscarConsumoTotal(): Observable<ConsumoFrota> {
    return this.api.get<ConsumoFrota>('/analytics/fleet/fuel-consumption', undefined, true);
  }

  buscarViagensAtivas(): Observable<number> {
    const parametros = new HttpParams().set('status', TripStatus.IN_PROGRESS).set('pageSize', 1);
    return this.api
      .get<PaginatedResponse<Trip>>('/trips', parametros, true)
      .pipe(map((resposta) => resposta.pagination.total));
  }

  // Conta os ativos entre os 100 primeiros usuários (a API não filtra por isActive).
  buscarUsuariosAtivos(): Observable<ResumoUsuarios> {
    const parametros = new HttpParams().set('pageSize', 100);
    return this.api.get<PaginatedResponse<User>>('/users', parametros, true).pipe(
      map((resposta) => {
        let ativos = 0;
        for (const usuario of resposta.data) {
          if (usuario.isActive) {
            ativos = ativos + 1;
          }
        }
        return {
          ativos,
          total: resposta.pagination.total,
          parcial: resposta.pagination.totalPages > 1,
        };
      }),
    );
  }

  // /health é público e não traz "uptime": mostramos se está de pé e o tempo do banco.
  buscarSaudeDoSistema(): Observable<SaudeSistema> {
    interface RespostaSaude {
      status: string;
      details?: { database?: { responseTime?: number } };
    }
    return this.api.get<RespostaSaude>('/health', undefined, true).pipe(
      map((resposta) => {
        let tempoBancoMs: number | null = null;
        const tempo = resposta.details?.database?.responseTime;
        if (tempo !== undefined) {
          tempoBancoMs = tempo;
        }
        return { operacional: resposta.status === 'ok', tempoBancoMs };
      }),
    );
  }

  buscarKmPorDia(): Observable<KmPorDia[]> {
    const parametros = new HttpParams().set('days', DIAS_DO_GRAFICO);
    return this.api.get<KmPorDia[]>('/analytics/fleet/daily-distance', parametros, true);
  }

  buscarIncidentesPorSeveridade(): Observable<IncidentesPorSeveridade[]> {
    return this.api.get<IncidentesPorSeveridade[]>('/analytics/incidents/severity', undefined, true);
  }

  // A API devolve as mais novas primeiro (createdAt desc).
  buscarUltimasViagens(): Observable<Trip[]> {
    const parametros = new HttpParams().set('pageSize', 5);
    return this.api
      .get<PaginatedResponse<Trip>>('/trips', parametros, true)
      .pipe(map((resposta) => resposta.data));
  }
}

