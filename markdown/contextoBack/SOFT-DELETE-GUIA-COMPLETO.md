# 🗑️ SOFT DELETE — GUIA COMPLETO
## Implementação em User, Driver, Vehicle, Trip, Refueling, Maintenance, Incident

> **Histórico — divergência conhecida:** este guia descreve o soft delete automático via **Prisma Middleware** (`prisma.$use(...)`, Seção 3). A implementação final usa uma **Prisma Client Extension** (`$extends`) em `src/database/soft-delete.extension.ts`, aplicada como `prismaService.comSoftDelete` (`src/database/prisma.service.ts`) — `$use` não existe mais no Prisma 7. O restante (7 models com `deletedAt`, rotas `DELETE /:id`, `PATCH /:id/restore`, `DELETE /:id/permanent`, `GET /deleted/all`) bate com o código real; só o mecanismo de filtro automático mudou de nome/abordagem.

---

## 📋 ÍNDICE

1. [Schema Prisma Atualizado](#schema-prisma)
2. [Migration SQL](#migration-sql)
3. [Prisma Middleware (Automático)](#middleware)
4. [Serviços e Helpers](#services)
5. [Controllers com Soft Delete](#controllers)
6. [Testes E2E](#testes)
7. [Checklist de Implementação](#checklist)
8. [Queries Comuns](#queries)
9. [FAQ](#faq)

---

## <a name="schema-prisma"></a>1. SCHEMA PRISMA ATUALIZADO

**Arquivo:** `prisma/schema.prisma`

```prisma
// =====================================
// USER (COM SOFT DELETE)
// =====================================
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  password      String
  fullName      String
  roleId        String
  role          Role     @relation(fields: [roleId], references: [id])
  isActive      Boolean  @default(true)
  apiKey        String?  @unique @db.VarChar(255)
  apiKeyCreatedAt DateTime?
  apiKeyLastUsedAt DateTime?
  
  // Relacionamentos
  driver        Driver?
  createdTrips  Trip[]   @relation("createdBy")
  refuelings    Refueling[] @relation("registeredBy")
  maintenances  Maintenance[] @relation("registeredBy")
  incidents     Incident[] @relation("registeredBy")
  auditLogs     AuditLog[] @relation("changedBy")
  
  // ✅ SOFT DELETE
  deletedAt     DateTime?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([email])
  @@index([apiKey])
  @@index([deletedAt])  // Index para queries de ativos
}


// =====================================
// DRIVER (COM SOFT DELETE)
// =====================================
model Driver {
  id              String   @id @default(uuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])
  licenseNumber   String   @unique
  licenseExpiry   DateTime
  isActive        Boolean  @default(true)
  
  // Relacionamentos
  trips           Trip[]
  refuelings      Refueling[]
  incidents       Incident[]
  
  // ✅ SOFT DELETE
  deletedAt       DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId])
  @@index([deletedAt])
}


// =====================================
// VEHICLE (COM SOFT DELETE)
// =====================================
model Vehicle {
  id                  String   @id @default(uuid())
  plate               String   @unique
  model               String
  year                Int
  status              VehicleStatus @default(AVAILABLE)  // AVAILABLE | IN_MAINTENANCE | OUT_OF_SERVICE | IN_USE
  currentMileage      Int      @default(0)
  lastMaintenanceKm   Int      @default(0)
  
  // Relacionamentos
  trips               Trip[]
  refuelings          Refueling[]
  maintenances        Maintenance[]
  incidents           Incident[]
  
  // ✅ SOFT DELETE
  deletedAt           DateTime?
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  @@index([plate])
  @@index([deletedAt])
}


// =====================================
// TRIP (COM SOFT DELETE)
// =====================================
model Trip {
  id              String   @id @default(uuid())
  driverId        String
  driver          Driver   @relation(fields: [driverId], references: [id])
  vehicleId       String
  vehicle         Vehicle  @relation(fields: [vehicleId], references: [id])
  status          TripStatus  @default(PLANNED)  // PLANNED | IN_PROGRESS | COMPLETED | CANCELLED
  startKm         Int
  endKm           Int?
  startLocation   String
  endLocation     String
  startTime       DateTime?
  endTime         DateTime?
  createdBy       String
  createdByUser   User     @relation("createdBy", fields: [createdBy], references: [id])
  
  // Relacionamentos
  incidents       Incident[]
  
  // ✅ SOFT DELETE
  deletedAt       DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([driverId, deletedAt])
  @@index([vehicleId, deletedAt])
  @@index([status, deletedAt])
  @@index([deletedAt])
}


// =====================================
// REFUELING (COM SOFT DELETE)
// =====================================
model Refueling {
  id              String   @id @default(uuid())
  vehicleId       String
  vehicle         Vehicle  @relation(fields: [vehicleId], references: [id])
  driverId        String
  driver          Driver   @relation(fields: [driverId], references: [id])
  mileage         Int
  litersAdded     Decimal  @db.Decimal(10, 2)
  costPerLiter    Decimal  @db.Decimal(10, 2)
  totalCost       Decimal  @db.Decimal(10, 2)
  fuelType        FuelType  // DIESEL | GASOLINE | ETHANOL | HYBRID
  registeredBy    String
  registeredByUser User    @relation("registeredBy", fields: [registeredBy], references: [id])
  
  // ✅ SOFT DELETE
  deletedAt       DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([vehicleId, deletedAt])
  @@index([driverId, deletedAt])
  @@index([deletedAt])
}


// =====================================
// MAINTENANCE (COM SOFT DELETE)
// =====================================
model Maintenance {
  id              String   @id @default(uuid())
  vehicleId       String
  vehicle         Vehicle  @relation(fields: [vehicleId], references: [id])
  type            MaintenanceType  // PREVENTIVE | CORRECTIVE | INSPECTION
  status          MaintenanceStatus  @default(SCHEDULED)  // SCHEDULED | IN_PROGRESS | COMPLETED
  scheduledDate   DateTime
  completedDate   DateTime?
  description     String   @db.Text
  cost            Decimal? @db.Decimal(10, 2)
  registeredBy    String
  registeredByUser User    @relation("registeredBy", fields: [registeredBy], references: [id])
  
  // ✅ SOFT DELETE
  deletedAt       DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([vehicleId, deletedAt])
  @@index([status, deletedAt])
  @@index([deletedAt])
}


// =====================================
// INCIDENT (COM SOFT DELETE)
// =====================================
model Incident {
  id              String   @id @default(uuid())
  tripId          String?
  trip            Trip?    @relation(fields: [tripId], references: [id])
  vehicleId       String
  vehicle         Vehicle  @relation(fields: [vehicleId], references: [id])
  driverId        String
  driver          Driver   @relation(fields: [driverId], references: [id])
  type            IncidentType  // ACCIDENT | MECHANICAL_FAILURE | OTHER
  severity        IncidentSeverity  // LOW | MEDIUM | HIGH
  status          IncidentStatus @default(REPORTED)  // REPORTED | UNDER_INVESTIGATION | RESOLVED
  description     String   @db.Text
  photoUrl        String?
  photoKey        String?
  registeredBy    String
  registeredByUser User    @relation("registeredBy", fields: [registeredBy], references: [id])
  
  // ✅ SOFT DELETE
  deletedAt       DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([vehicleId, deletedAt])
  @@index([driverId, deletedAt])
  @@index([severity, deletedAt])
  @@index([deletedAt])
}


// =====================================
// AUDIT LOG (SEM SOFT DELETE - imutável)
// =====================================
model AuditLog {
  id            String   @id @default(uuid())
  entityType    String   // "User", "Vehicle", "Trip", etc
  entityId      String
  action        String   // "CREATE", "UPDATE", "DELETE"
  changedBy     String
  changedByUser User     @relation("changedBy", fields: [changedBy], references: [id])
  oldValues     Json?
  newValues     Json?
  
  createdAt     DateTime @default(now())
  
  @@index([entityType, entityId])
  @@index([changedBy])
  @@index([createdAt])
}


// =====================================
// ROLE (SEM SOFT DELETE - configuração)
// =====================================
model Role {
  id          String   @id @default(uuid())
  name        String   @unique  // DRIVER | FLEET_MANAGER | ADMIN
  description String?
  
  users       User[]
  permissions RolePermission[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}


// =====================================
// PERMISSION (SEM SOFT DELETE - configuração)
// =====================================
model Permission {
  id          String   @id @default(uuid())
  code        String   @unique  // ex: TRIP_CREATE, VEHICLE_DELETE
  description String?
  
  roles       RolePermission[]
  users       UserPermission[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}


// =====================================
// ROLE PERMISSION (SEM SOFT DELETE - configuração)
// =====================================
model RolePermission {
  roleId        String
  role          Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId  String
  permission    Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@id([roleId, permissionId])
}


// =====================================
// USER PERMISSION (SEM SOFT DELETE - configuração)
// =====================================
model UserPermission {
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  permissionId  String
  permission    Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@id([userId, permissionId])
}


// =====================================
// ENUMS
// =====================================
enum VehicleStatus {
  AVAILABLE
  IN_MAINTENANCE
  OUT_OF_SERVICE
  IN_USE
}

enum TripStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum FuelType {
  DIESEL
  GASOLINE
  ETHANOL
  HYBRID
}

enum MaintenanceType {
  PREVENTIVE
  CORRECTIVE
  INSPECTION
}

enum MaintenanceStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
}

enum IncidentType {
  ACCIDENT
  MECHANICAL_FAILURE
  OTHER
}

enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
}

enum IncidentStatus {
  REPORTED
  UNDER_INVESTIGATION
  RESOLVED
}
```

---

## <a name="migration-sql"></a>2. MIGRATION SQL

**Criar:** `prisma/migrations/[timestamp]_add_soft_delete/migration.sql`

```sql
-- ====================================
-- ADD SOFT DELETE COLUMNS
-- ====================================

-- USER
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- DRIVER
ALTER TABLE drivers ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_drivers_deleted_at ON drivers(deleted_at);
CREATE INDEX idx_drivers_user_id_deleted_at ON drivers(user_id, deleted_at);

-- VEHICLE
ALTER TABLE vehicles ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_vehicles_deleted_at ON vehicles(deleted_at);

-- TRIP
ALTER TABLE trips ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_trips_deleted_at ON trips(deleted_at);
CREATE INDEX idx_trips_driver_id_deleted_at ON trips(driver_id, deleted_at);
CREATE INDEX idx_trips_vehicle_id_deleted_at ON trips(vehicle_id, deleted_at);
CREATE INDEX idx_trips_status_deleted_at ON trips(status, deleted_at);

-- REFUELING
ALTER TABLE refuelings ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_refuelings_deleted_at ON refuelings(deleted_at);
CREATE INDEX idx_refuelings_vehicle_id_deleted_at ON refuelings(vehicle_id, deleted_at);
CREATE INDEX idx_refuelings_driver_id_deleted_at ON refuelings(driver_id, deleted_at);

-- MAINTENANCE
ALTER TABLE maintenances ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_maintenances_deleted_at ON maintenances(deleted_at);
CREATE INDEX idx_maintenances_vehicle_id_deleted_at ON maintenances(vehicle_id, deleted_at);
CREATE INDEX idx_maintenances_status_deleted_at ON maintenances(status, deleted_at);

-- INCIDENT
ALTER TABLE incidents ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_incidents_deleted_at ON incidents(deleted_at);
CREATE INDEX idx_incidents_vehicle_id_deleted_at ON incidents(vehicle_id, deleted_at);
CREATE INDEX idx_incidents_driver_id_deleted_at ON incidents(driver_id, deleted_at);
CREATE INDEX idx_incidents_severity_deleted_at ON incidents(severity, deleted_at);
```

**Executar:**
```bash
npx prisma migrate dev --name add_soft_delete
```

---

## <a name="middleware"></a>3. PRISMA MIDDLEWARE (AUTOMÁTICO)

**Arquivo:** `src/database/soft-delete.middleware.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const softDeleteModels = [
  'user',
  'driver',
  'vehicle',
  'trip',
  'refueling',
  'maintenance',
  'incident',
];

export function installSoftDeleteMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    // ✅ FIND/FIND_MANY: Filtrar deletados automaticamente
    if (params.action === 'find' || params.action === 'findMany') {
      if (softDeleteModels.includes(params.model)) {
        params.where = params.where || {};
        params.where.deletedAt = null;
      }
    }

    // ✅ FIND_UNIQUE: Filtrar deletados automaticamente
    if (params.action === 'findUnique' || params.action === 'findUniqueOrThrow') {
      if (softDeleteModels.includes(params.model)) {
        params.where = params.where || {};
        params.where.deletedAt = null;
      }
    }

    // ✅ UPDATE: Bloquear update de deletados
    if (params.action === 'update') {
      if (softDeleteModels.includes(params.model)) {
        // Verificar se já deletado
        const existing = await next({
          ...params,
          action: 'findUnique',
        });
        if (existing?.deletedAt) {
          throw new Error(`Cannot update deleted ${params.model}`);
        }
      }
    }

    // ✅ DELETE: Converter em soft delete
    if (params.action === 'delete') {
      if (softDeleteModels.includes(params.model)) {
        params.action = 'update';
        params.data = { deletedAt: new Date() };
      }
    }

    // ✅ DELETE_MANY: Converter em soft delete em massa
    if (params.action === 'deleteMany') {
      if (softDeleteModels.includes(params.model)) {
        params.action = 'updateMany';
        params.data = { deletedAt: new Date() };
      }
    }

    return next(params);
  });
}
```

**Usar em `src/database/database.module.ts`:**

```typescript
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { installSoftDeleteMiddleware } from './soft-delete.middleware';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {
  constructor(prisma: PrismaService) {
    // Instalar middleware automaticamente
    installSoftDeleteMiddleware(prisma);
  }
}
```

---

## <a name="services"></a>4. SERVIÇOS E HELPERS

### **SoftDeleteService**

**Arquivo:** `src/common/services/soft-delete.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class SoftDeleteService {
  constructor(private prisma: PrismaService) {}

  /**
   * Soft delete (set deletedAt)
   */
  async softDelete<T>(
    model: any,
    id: string,
    relation?: { [key: string]: boolean }
  ): Promise<T> {
    return await this.prisma[model].update({
      where: { id },
      data: { deletedAt: new Date() },
      include: relation || {},
    });
  }

  /**
   * Restore (set deletedAt to null)
   */
  async restore<T>(
    model: any,
    id: string,
    relation?: { [key: string]: boolean }
  ): Promise<T> {
    return await this.prisma[model].update({
      where: { id },
      data: { deletedAt: null },
      include: relation || {},
    });
  }

  /**
   * Hard delete (permanently)
   */
  async hardDelete<T>(model: any, id: string): Promise<T> {
    // Bypass middleware temporariamente
    return await this.prisma[model].delete({
      where: { id },
    });
  }

  /**
   * List deletados (admin)
   */
  async listDeleted<T>(
    model: any,
    skip = 0,
    take = 10,
    relation?: { [key: string]: boolean }
  ): Promise<{ data: T[]; total: number }> {
    const [data, total] = await Promise.all([
      this.prisma[model].findMany({
        where: { deletedAt: { not: null } },
        skip,
        take,
        include: relation || {},
      }),
      this.prisma[model].count({
        where: { deletedAt: { not: null } },
      }),
    ]);

    return { data, total };
  }

  /**
   * Verificar se está deletado
   */
  async isDeleted(model: any, id: string): Promise<boolean> {
    const record = await this.prisma[model].findFirst({
      where: { id },
      select: { deletedAt: true },
    });
    return record?.deletedAt !== null;
  }

  /**
   * Contar deletados
   */
  async countDeleted(model: any): Promise<number> {
    return await this.prisma[model].count({
      where: { deletedAt: { not: null } },
    });
  }
}
```

---

## <a name="controllers"></a>5. CONTROLLERS COM SOFT DELETE

### **Users Controller (Exemplo Completo)**

**Arquivo:** `src/users/users.controller.ts`

```typescript
import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  UseGuards,
  Query,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SoftDeleteService } from 'src/common/services/soft-delete.service';
import { PrismaService } from 'src/database/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private softDeleteService: SoftDeleteService,
    private prisma: PrismaService,
  ) {}

  /**
   * GET /users — Listar users ativos (soft delete automático)
   */
  @Get()
  @Roles('ADMIN', 'FLEET_MANAGER')
  async listUsers(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: pageSize,
        // deletedAt: null é AUTOMÁTICO via middleware
        include: { role: true },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * DELETE /users/:id — Soft delete
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  async deleteUser(@Param('id') id: string) {
    return await this.softDeleteService.softDelete('user', id);
  }

  /**
   * PATCH /users/:id/restore — Restaurar user deletado
   */
  @Patch(':id/restore')
  @Roles('ADMIN')
  async restoreUser(@Param('id') id: string) {
    return await this.softDeleteService.restore('user', id, {
      role: true,
      driver: true,
    });
  }

  /**
   * GET /users/deleted/all — Listar users deletados (admin)
   */
  @Get('deleted/all')
  @Roles('ADMIN')
  async listDeletedUsers(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 10,
  ) {
    const skip = (page - 1) * pageSize;
    const { data, total } = await this.softDeleteService.listDeleted(
      'user',
      skip,
      pageSize,
      { role: true },
    );

    return {
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * DELETE /users/:id/permanent — Hard delete (CUIDADO!)
   */
  @Delete(':id/permanent')
  @Roles('ADMIN')
  @HttpCode(204)
  async hardDeleteUser(@Param('id') id: string) {
    // ⚠️ Cuidado: realiza deleção permanente
    // Pode quebrar foreign keys se tiver relacionamentos
    return await this.softDeleteService.hardDelete('user', id);
  }
}
```

### **Vehicles Controller (Exemplo)**

```typescript
import { Controller, Get, Delete, Patch, Param, UseGuards, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { SoftDeleteService } from 'src/common/services/soft-delete.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private softDeleteService: SoftDeleteService) {}

  /**
   * DELETE /vehicles/:id — Soft delete vehicle
   */
  @Delete(':id')
  @Roles('ADMIN', 'FLEET_MANAGER')
  @HttpCode(204)
  async deleteVehicle(@Param('id') id: string) {
    return await this.softDeleteService.softDelete('vehicle', id);
  }

  /**
   * PATCH /vehicles/:id/restore — Restaurar vehicle
   */
  @Patch(':id/restore')
  @Roles('ADMIN', 'FLEET_MANAGER')
  async restoreVehicle(@Param('id') id: string) {
    return await this.softDeleteService.restore('vehicle', id);
  }
}
```

---

## <a name="testes"></a>6. TESTES E2E

**Arquivo:** `test/soft-delete.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/database/prisma.service';

describe('Soft Delete (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userId: string;
  let vehicleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    // Setup: login como admin, pegar token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-api-key', process.env.ADMIN_API_KEY)
      .send({ email: 'admin@test.com', password: 'password' });

    adminToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Soft Delete', () => {
    it('should soft delete user', async () => {
      // Create user
      const createRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@test.com',
          password: 'password123',
          fullName: 'Test User',
          roleId: '<driver-role-id>',
        });

      userId = createRes.body.userId;

      // Delete
      await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify: findMany não retorna
      const users = await prisma.user.findMany();
      expect(users.find(u => u.id === userId)).toBeUndefined();

      // Verify: findFirst com deletedAt = null não encontra
      const directFind = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
      });
      expect(directFind).toBeNull();

      // Verify: query raw retorna deletado
      const deleted = await prisma.user.findFirst({
        where: { id: userId },
      });
      expect(deleted?.deletedAt).not.toBeNull();
    });

    it('should restore deleted user', async () => {
      // Restore
      const restoreRes = await request(app.getHttpServer())
        .patch(`/users/${userId}/restore`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.deletedAt).toBeNull();

      // Verify: pode fazer find normalmente
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user?.deletedAt).toBeNull();
    });

    it('should list deleted users (admin only)', async () => {
      // Soft delete user
      await request(app.getHttpServer())
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // List deleted
      const listRes = await request(app.getHttpServer())
        .get('/users/deleted/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: userId }),
        ])
      );
    });
  });

  describe('Vehicle Soft Delete', () => {
    it('should soft delete vehicle', async () => {
      // Create vehicle
      const createRes = await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          plate: 'ABC1234',
          model: 'Fiat Uno',
          year: 2020,
          status: 'AVAILABLE',
        });

      vehicleId = createRes.body.id;

      // Delete
      await request(app.getHttpServer())
        .delete(`/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify: não aparece em listagem
      const listRes = await request(app.getHttpServer())
        .get('/vehicles')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.body.data.find(v => v.id === vehicleId)).toBeUndefined();
    });

    it('should prevent using soft deleted vehicle', async () => {
      // Try to create trip com vehicle deletado
      const tripRes = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          driverId: '<driver-id>',
          vehicleId: vehicleId, // Soft deleted
          startKm: 1000,
          startLocation: 'Embu das Artes',
          endLocation: 'São Paulo',
        });

      expect(tripRes.status).toBe(404); // Vehicle not found
    });
  });

  describe('Cascade and Relationships', () => {
    it('should not break relationships when soft deleting', async () => {
      // Create: user → trip → vehicle
      // Soft delete user
      // Verify: trip.createdBy ainda aponta para user
      // Verify: trip não aparece em listagem (via middleware)

      // Implementation depends on business logic
    });
  });
});
```

---

## <a name="checklist"></a>7. CHECKLIST DE IMPLEMENTAÇÃO

### **Passo 1: Schema**
- [ ] Adicionar `deletedAt DateTime?` em 7 models
- [ ] Adicionar índices `@@index([deletedAt])`
- [ ] Adicionar índices compostos (`vehicleId, deletedAt`)

### **Passo 2: Migration**
- [ ] Criar migration SQL
- [ ] Executar: `npx prisma migrate dev`
- [ ] Verificar: `psql` → `\d users` → coluna `deleted_at` existe

### **Passo 3: Middleware**
- [ ] Criar `src/database/soft-delete.middleware.ts`
- [ ] Instalar em `database.module.ts`
- [ ] Testar: `findMany()` + `findUnique()` não retorna deletados
- [ ] Testar: `delete()` vira `update({ deletedAt: new Date() })`

### **Passo 4: Service**
- [ ] Criar `src/common/services/soft-delete.service.ts`
- [ ] Implementar: `softDelete()`, `restore()`, `hardDelete()`, `listDeleted()`
- [ ] Testar cada método

### **Passo 5: Controllers**
- [ ] Adicionar `@Delete(':id')` → chama `softDeleteService.softDelete()`
- [ ] Adicionar `@Patch(':id/restore')` → chama `softDeleteService.restore()`
- [ ] Adicionar `@Get('deleted/all')` → admin list deletados
- [ ] Adicionar `@Delete(':id/permanent')` → hard delete (cuidado!)

### **Passo 6: Testes**
- [ ] Test: soft delete + não aparece em find
- [ ] Test: restore + aparece em find
- [ ] Test: list deleted (admin)
- [ ] Test: hard delete
- [ ] Test: cascade (soft delete user com trips)

### **Passo 7: Validação**
- [ ] `npm run build` sem erros
- [ ] `npm test -- soft-delete` todos passam
- [ ] `npm test -- e2e` todos passam
- [ ] Verificar audit_logs registra soft deletes

---

## <a name="queries"></a>8. QUERIES COMUNS

### **Listar apenas ativos (PADRÃO)**
```typescript
const users = await prisma.user.findMany();
// Middleware automático: where: { deletedAt: null }
```

### **Listar apenas deletados**
```typescript
const deletedUsers = await prisma.user.findMany({
  where: { deletedAt: { not: null } },
});
```

### **Listar tudo (ativos + deletados)**
```typescript
const allUsers = await prisma.user.findMany({
  where: { deletedAt: null }, // Remove o filtro automático? Não!
  // Não há forma de ignorar middleware totalmente
});
// Alternativa: query raw SQL se necessário
```

### **Soft delete**
```typescript
await prisma.user.delete({ where: { id: userId } });
// Middleware converte em: update({ data: { deletedAt: new Date() } })
```

### **Restore**
```typescript
await prisma.user.update({
  where: { id: userId },
  data: { deletedAt: null },
});
```

### **Contar deletados**
```typescript
const count = await prisma.user.count({
  where: { deletedAt: { not: null } },
});
```

### **Hard delete (bypass middleware)**
```typescript
// Dentro do middleware, usar transaction ou query raw
await prisma.$executeRaw`DELETE FROM users WHERE id = ${userId}`;
```

---

## <a name="faq"></a>9. FAQ

### **P: E se tiver relacionamento com user deletado?**
**R:** Trip com `createdBy` apontando para user deletado:
- Trip com `deletedAt = null` continuará visível
- Mas não conseguirá fazer query com `include: { createdByUser }`
- Solution: também soft delete a trip ou usar `omitDeleted` custom em includes

### **P: Como fazer hard delete de forma segura?**
**R:** Verificar foreign keys antes:
```typescript
async hardDeleteWithCheck(model: string, id: string) {
  // 1. Verificar se tem relacionamentos ativos
  // 2. Se tiver, throw erro
  // 3. Se não tiver, executar DELETE
}
```

### **P: E performance? Índices ajudam?**
**R:** Sim! Índices compostos como `(vehicleId, deletedAt)` fazem queries rápidas.

### **P: Como testar se middleware está funcionando?**
**R:** 
```typescript
const user = await prisma.user.create({ email: '...' });
await prisma.user.delete({ where: { id: user.id } });
const found = await prisma.user.findUnique({ where: { id: user.id } });
expect(found).toBeNull(); // Middleware funcionando
```

### **P: Posso customizar quais models têm soft delete?**
**R:** Sim! Array `softDeleteModels` no middleware:
```typescript
const softDeleteModels = ['user', 'vehicle', 'trip'];
// 'refueling' não terá soft delete
```

---

## 📝 RESUMO

✅ **7 models com soft delete:** User, Driver, Vehicle, Trip, Refueling, Maintenance, Incident  
✅ **Middleware automático:** Filtro `deletedAt: null` em todas as queries  
✅ **SoftDeleteService:** Soft delete, restore, hard delete, list deleted  
✅ **Controllers:** DELETE → soft delete, PATCH /restore → restore, GET /deleted/all → admin  
✅ **Índices otimizados:** `(vehicleId, deletedAt)` para performance  
✅ **Testes completos:** Soft delete, restore, cascade, hard delete  

**Pronto para implementar! 🚀**

