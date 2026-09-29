// GET /maintenances, GET /maintenances/:id, POST /maintenances
export interface Maintenance {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate: string | null;
  description: string;
  cost: number;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  INSPECTION = 'INSPECTION',
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

// Corpo de POST /maintenances. Sem status (nasce SCHEDULED) e sem isActive.
export interface CriarManutencaoDto {
  vehicleId: string;
  type: MaintenanceType;
  scheduledDate: string; // AAAA-MM-DD
  description: string;
  cost: number;
}
