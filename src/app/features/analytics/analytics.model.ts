// Resposta de GET /analytics/vehicle/:id/efficiency.
export interface EficienciaVeiculo {
  vehicleId: string;
  totalKm: number;
  totalLiters: number;
  totalFuelCost: number;
  averageLitersPerKm: number;
  tripsCount: number;
  incidentsCount: number;
}

// Resposta de GET /analytics/driver/:id/trips.
export interface EstatisticasMotorista {
  driverId: string;
  tripsByStatus: {
    PLANNED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  totalKmCompleted: number;
  incidentsCount: number;
}

// Uma linha de legenda/tabela dos gráficos: sempre com ícone e texto, nunca só cor.
export interface ItemGrafico {
  chave: string;
  rotulo: string;
  total: number;
  cor: string;
  icone: string;
}

// Linha da tabela "alternativa ao gráfico" do km por mês.
export interface LinhaKmMensal {
  rotulo: string;
  km: number;
}

