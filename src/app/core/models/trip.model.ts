// GET /trips, GET /trips/:id, POST /trips
export interface Trip {
  id: string;
  driverId: string;
  vehicleId: string;
  status: TripStatus;
  startKm: number;
  // Só depois de PATCH /trips/:id/end: é o hodômetro FINAL (startKm + km rodados).
  endKm: number | null;
  // Só vem na resposta de PATCH /trips/:id/end (= endKm - startKm): a distância da viagem.
  distanceKm?: number;
  startLocation: string; // endereço resolvido pelo ViaCEP, não o CEP digitado
  endLocation: string;
  startTime: string;
  endTime: string | null;
  createdBy: string; // id do usuário que criou a viagem
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum TripStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Corpo de POST /trips, sem km (a API responde 400 se vier startKm). Os locais são CEPs.
export interface CriarViagemDto {
  driverId: string;
  vehicleId: string;
  startLocation: string;
  endLocation: string;
}

// Corpo de PATCH /trips/:id/end. endKm são os km RODADOS (1 a 100.000); o local final é texto livre.
export interface FinalizarViagemDto {
  endKm: number;
  endLocation: string;
}
