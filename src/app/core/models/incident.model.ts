// GET /incidents, GET /incidents/:id, POST /incidents
export interface Incident {
  id: string;
  tripId: string | null;
  vehicleId: string;
  driverId: string;
  type: IncidentType;
  severity: Severity;
  status: IncidentStatus;
  description: string;
  photoUrl: string | null;
  photoKey: string | null;
  registeredBy: string; // id do usuário que registrou
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum IncidentType {
  ACCIDENT = 'ACCIDENT',
  MECHANICAL_FAILURE = 'MECHANICAL_FAILURE',
  OTHER = 'OTHER',
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum IncidentStatus {
  REPORTED = 'REPORTED',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  RESOLVED = 'RESOLVED',
}

// Corpo de PATCH /incidents/:id/status (o status só avança).
export interface AtualizarStatusIncidenteDto {
  status: IncidentStatus;
}
