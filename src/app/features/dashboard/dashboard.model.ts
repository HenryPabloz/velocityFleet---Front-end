import { Severity, VehicleStatus } from '../../core/models';

// Em que momento cada bloco do painel está.
export type SituacaoBloco = 'carregando' | 'pronto' | 'erro' | 'sem-acesso' | 'limite';

// Cada bloco (card ou gráfico) guarda a situação e os dados que já chegaram.
export interface EstadoBloco<T> {
  situacao: SituacaoBloco;
  dados: T | null;
}

// Viagens do mês do motorista. "parcial" = há mais viagens do que a página trouxe.
export interface ResumoViagensMes {
  total: number;
  km: number;
  parcial: boolean;
}

export interface ResumoIncidentesMes {
  total: number;
  parcial: boolean;
}

export interface ProximaManutencao {
  semViagemAtiva: boolean;
  dataAgendada: string | null;
  descricao: string | null;
}

export interface ContagemStatusVeiculo {
  status: VehicleStatus;
  total: number;
}

// Resposta de GET /analytics/fleet/fuel-consumption.
export interface ConsumoFrota {
  averageLitersPerKm: number;
  totalLiters: number;
  totalKm: number;
}

// Resposta de GET /analytics/fleet/daily-distance (um item por dia).
export interface KmPorDia {
  date: string;
  totalKm: number;
}

export interface KmPorMes {
  mes: string; // "AAAA-MM"
  totalKm: number;
}

// Resposta de GET /analytics/incidents/severity.
export interface IncidentesPorSeveridade {
  severity: Severity;
  count: number;
}

export interface ResumoUsuarios {
  ativos: number;
  total: number;
  parcial: boolean;
}

// Só o que o card de saúde usa da resposta do /health (formato do Terminus).
export interface SaudeSistema {
  operacional: boolean;
  tempoBancoMs: number | null;
}
