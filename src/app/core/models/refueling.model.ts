// GET /refuelings, GET /refuelings/:id, POST /refuelings
export interface Refueling {
  id: string;
  vehicleId: string;
  driverId: string;
  mileage: number;
  litersAdded: number;
  costPerLiter: number;
  totalCost: number; // calculado pela API; nunca enviar na criação
  fuelType: FuelType;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum FuelType {
  DIESEL = 'DIESEL',
  GASOLINE = 'GASOLINE',
  ETHANOL = 'ETHANOL',
  HYBRID = 'HYBRID',
}

// Corpo de POST /refuelings. Sem totalCost e sem mileage: a API calcula o total e pega o km do veículo.
export interface CriarAbastecimentoDto {
  vehicleId: string;
  driverId: string;
  litersAdded: number;
  costPerLiter: number;
  fuelType: FuelType;
}
