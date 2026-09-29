// GET /vehicles, GET /vehicles/:id, POST /vehicles
export interface Vehicle {
  id: string;
  // Aceita Mercosul ("ABC1D23") ou o formato antigo ("ABC1234" / "ABC-1234").
  plate: string;
  model: string;
  year: number;
  status: VehicleStatus;
  currentMileage: number;
  lastMaintenanceKm: number;
  // Somente leitura: false quando o veículo está removido (soft delete). Nunca enviar em PATCH.
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

// Corpo de POST /vehicles. A API não aceita IN_USE em "status" (só as viagens colocam o veículo em uso).
export interface CriarVeiculoDto {
  plate: string;
  model: string;
  year: number;
  status?: VehicleStatus;
  currentMileage?: number;
  lastMaintenanceKm?: number;
}

// Corpo de PATCH /vehicles/:id: só os campos que mudaram (a placa não muda depois de criada).
export interface AtualizarVeiculoDto {
  model?: string;
  year?: number;
  status?: VehicleStatus;
  currentMileage?: number;
  lastMaintenanceKm?: number;
}
