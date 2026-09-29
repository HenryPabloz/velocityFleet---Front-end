# Design Document — Gestão de Frota Corporativa

**Data:** 2025-01-15  
**Projeto:** AV-07-FROTA  
**Duração:** 5 dias  
**Nota Final Anterior:** 89.50 / 100 (Visitantes) → **Lições Aprendidas Aplicadas**

---

## 📋 Índice

1. [Visão Geral](#1-visão-geral)
2. [Requisitos e Escopo](#2-requisitos-e-escopo)
3. [Arquitetura](#3-arquitetura)
4. [Entidades e Relacionamentos](#4-entidades-e-relacionamentos)
5. [Procedures PostgreSQL](#5-procedures-postgresql)
6. [Triggers PostgreSQL](#6-triggers-postgresql)
7. [Autenticação e Autorização](#7-autenticação-e-autorização)
8. [Upload e Cloud Storage](#8-upload-e-cloud-storage)
9. [Integração Externa (HttpService)](#9-integração-externa-httpservice)
10. [Interceptors](#10-interceptors)
11. [Paginação e Filtros](#11-paginação-e-filtros)
12. [Indicadores de Frota](#12-indicadores-de-frota)
13. [Auditoria e Logs](#13-auditoria-e-logs)
14. [Tratamento de Erros](#14-tratamento-de-erros)
15. [Stack e Dependências](#15-stack-e-dependências)
16. [Gaps Anteriores — Mitigação](#16-gaps-anteriores--mitigação)

---

## 1. Visão Geral

**Objetivo:** API backend completa para gestão de frota corporativa com:
- Controle de drivers, veículos, trips, refuelings, maintenance, incidents
- 3 roles (DRIVER, FLEET_MANAGER, ADMIN) com matriz de permissões
- Procedures PostgreSQL (DML otimizado, 6 procedures) + Triggers (12 triggers: regras de negócio, sincronia do veículo, auditoria e proteção do log)
- Upload de fotos de incidentes (S3/GCP)
- Integração externa (CEP/localização)
- Auditoria imutável
- Paginação, filtros, indicadores

**Prazo:** 5 dias  
**MVP:** Tudo acima (sem Docker/Cloud na primeira entrega)  
**Incrementais:** Docker, Cloud Storage, Swagger, Relatórios, Dashboard

---

## 2. Requisitos e Escopo

### Funcionalidades Principais (MVP)

#### 2.1 Autenticação e Autorização
- [ ] JWT com `@CurrentUser()` decorator
- [ ] 3 roles: DRIVER, FLEET_MANAGER, ADMIN
- [ ] Matriz de permissões granulares (29 permissions no seed; ver seção 7.2)
- [ ] Proteção de recursos (não alterar dados de terceiros)
- [ ] Senha com bcrypt

#### 2.2 Gerenciamento de Usuários
- [ ] CRUD de Users (ADMIN only, exceto perfil próprio)
- [ ] Perfil do usuário autenticado
- [ ] Troca de senha
- [ ] Email gravado em minúsculas e sem espaços nas pontas (o banco recusa se não estiver normalizado)
- [ ] Soft delete (isActive)

#### 2.3 Gerenciamento de Drivers
- [ ] CRUD de Drivers (FLEET_MANAGER+)
- [ ] Validação de license
- [ ] Visualização de trips próprias (DRIVER)
- [ ] Visualização de drivers (FLEET_MANAGER+)

#### 2.4 Gerenciamento de Veículos
- [x] CRUD de Vehicles (FLEET_MANAGER+)
- [x] Status do veículo (AVAILABLE, IN_USE, IN_MAINTENANCE, OUT_OF_SERVICE); `IN_USE` só é definido pelas viagens (não pode ser gravado direto nem na criação)
- [x] Filtro por `status` em `GET /vehicles` (Passo 26 — estava faltando o `@ApiQuery`/uso do filtro na listagem; corrigido)
- [x] Mileagem atual (nunca diminui; atualizada por viagem e abastecimento; de 0 a 10.000.000)
- [x] Placa gravada em MAIÚSCULAS, sem espaços nas pontas, com 7 a 8 caracteres; ano entre 1900 e 2100 (o banco recusa se não estiver normalizado)
- [x] `initialLocationCep` opcional em `POST /vehicles`, enriquece a resposta via ViaCEP sem persistir (Passo 27 — ver seção 9)
- [ ] Histórico de manutenções

#### 2.5 Trips (Viagens)
- [x] Criar trip (DRIVER + vehicle deve estar AVAILABLE; veículo passa a IN_USE); `startLocation`/`endLocation` exigem CEP válido, resolvido via ViaCEP (Passo 27 — mudança de contrato, ver seção 9)
- [ ] Iniciar trip (mudar status PLANNED → IN_PROGRESS; confere veículo da viagem, motorista ativo e mileagem atual)
- [ ] Finalizar trip (mudar status IN_PROGRESS → COMPLETED, calcular km, atualizar mileagem e liberar o veículo)
- [ ] Cancelar trip (PLANNED ou IN_PROGRESS → CANCELLED; libera o veículo)
- [ ] Validação: KM inicial >= mileagem do veículo; KM final >= inicial e >= mileagem do veículo; horário de fim > início
- [ ] Validação: Não pode ter 2 trips ativas (PLANNED/IN_PROGRESS) por driver nem por vehicle (inclusive em requisições simultâneas)
- [ ] Validação: driver ativo, usuário do driver ativo e CNH não vencida; km até 10.000.000
- [ ] Paginação + filtros (por driver, vehicle, status, data)
- [ ] Listar trips ativas

#### 2.6 Refuelings (Abastecimentos)
- [ ] Registrar abastecimento (DRIVER + FLEET_MANAGER)
- [ ] Cálculo automático de custo total (litros e preço arredondados antes; total em 2 casas)
- [ ] Se o veículo está em viagem IN_PROGRESS, só o motorista da viagem abastece
- [ ] Atualiza a mileagem atual do veículo (nunca diminui)
- [ ] Histórico de abastecimentos

#### 2.7 Maintenance (Manutenções)
- [ ] Agendar manutenção
- [ ] Marcar como IN_PROGRESS (bloqueia trips; o veículo só pode ir para IN_MAINTENANCE sem viagem ativa)
- [ ] Marcar como COMPLETED
- [ ] Bloquear trips enquanto IN_MAINTENANCE

#### 2.8 Incidents (Incidentes)
- [ ] Registrar incidente com foto (upload S3/GCP); a viagem é opcional e, se informada, precisa ser do veículo e do motorista e estar IN_PROGRESS
- [ ] Tipos: ACCIDENT, MECHANICAL_FAILURE, OTHER
- [ ] Severidade: LOW, MEDIUM, HIGH
- [ ] Status: REPORTED, UNDER_INVESTIGATION, RESOLVED
- [ ] Validar presença, tamanho, tipo de arquivo

#### 2.9 Indicadores de Frota
- [x] Consumo médio de combustível (litros/km) — `GET /analytics/fleet/fuel-consumption` (Passo 28, ver seção 12.1)
- [x] Distância por dia — `GET /analytics/fleet/daily-distance` (Passo 28, ver seção 12.2)
- [x] Eficiência por veículo — `GET /analytics/vehicle/:id/efficiency` (Passo 28, ver seção 12.3)
- [x] Estatísticas de viagens por driver — `GET /analytics/driver/:id/trips` (Passo 28, ver seção 12.4)
- [x] Incidentes por severidade — `GET /analytics/incidents/severity` (Passo 28, ver seção 12.5; não é "custo total por período" do plano original, que não foi implementado)

#### 2.10 Paginação e Filtros
- [ ] Query params: page, limit, sort, filter
- [ ] Respostas: { data: [], total, page, pageSize }
- [ ] Filtros por: status, driver, vehicle, data, severidade, etc

#### 2.11 Seed
- [ ] Permissions (29 codes)
- [ ] Roles (DRIVER, FLEET_MANAGER, ADMIN)
- [ ] RolePermissions (62 vínculos: DRIVER 10, FLEET_MANAGER 23, ADMIN 29)
- [ ] Admin initial (`ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` do .env; obrigatórios em produção)

#### 2.12 Testes Obrigatórios
- [ ] 1. Fluxo principal com sucesso (trip completa)
- [ ] 2. Body inválido → 400
- [ ] 3. Ausência/token inválido → 401
- [ ] 4. Sem permissão → 403
- [ ] 5. Recurso inexistente → 404
- [ ] 6. Conflito de regra → 409 (2 trips ativas ou veículo indisponível)
- [ ] 7. Acesso a recurso de terceiro → 403
- [ ] 8. Upload válido e inválido
- [ ] 9. Integração externa ok + falha
- [ ] 10. Fluxo de mudança de estado completo

---

## 3. Arquitetura

### 3.1 Camadas

```
┌─────────────────────────────────────────────────────────┐
│ HTTP Layer (Controllers)                                │
│ ├─ DTO Validation (class-validator)                     │
│ ├─ JWT Guards + Roles + Permissions                     │
│ ├─ @CurrentUser() extraction                            │
│ └─ HttpExceptionFilter (tratamento de erros)            │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Business Logic Layer (Services)                         │
│ ├─ Regras de negócio                                    │
│ ├─ Validações de estado/existência                      │
│ ├─ Chamadas a Procedures                                │
│ ├─ Transações (quando necessário)                       │
│ └─ Tratamento de erros de negócio                       │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Database Layer                                          │
│ ├─ PROCEDURES (DML otimizado)                           │
│ │  ├─ create_trip                                       │
│ │  ├─ start_trip                                        │
│ │  ├─ end_trip                                          │
│ │  ├─ cancel_trip                                       │
│ │  ├─ register_refueling                                │
│ │  └─ register_incident                                 │
│ ├─ TRIGGERS (Validação + Auditoria)                     │
│ │  ├─ prevent_vehicle_in_maintenance_from_trip         │
│ │  ├─ prevent_driver_double_active_trip                │
│ │  ├─ prevent_vehicle_double_active_trip               │
│ │  ├─ validate_trip_kilometers                         │
│ │  ├─ sync_vehicle_from_trip                           │
│ │  ├─ protect_vehicle_status_and_mileage               │
│ │  ├─ block_vehicle_in_use_on_insert                   │
│ │  ├─ sync_vehicle_mileage_from_refueling              │
│ │  ├─ audit_trip_changes                               │
│ │  ├─ audit_refueling_changes                          │
│ │  ├─ audit_incident_changes                           │
│ │  └─ block_audit_logs_changes                         │
│ ├─ CONSTRAINTS (SQL level)                              │
│ │  ├─ UNIQUE constraints                                │
│ │  ├─ FK constraints                                    │
│ │  └─ CHECK constraints                                 │
│ └─ PRISMA (SELECT queries)                              │
└────────────────┬────────────────────────────────────────┘
                 ↓
         PostgreSQL Database (Docker)
```

### 3.2 Fluxo de Requisição

```
1. REQUEST
   POST /trips
   Headers: Authorization: Bearer <token>
   Body: { vehicleId, startKm, startLocation, endLocation }

2. CONTROLLER
   ├─ JwtAuthGuard valida token (401 se ausente, inválido ou expirado)
   ├─ RolesGuard valida papel/permissão TRIP_CREATE (403 se faltar)
   ├─ ValidationPipe valida DTO
   └─ @CurrentUser() entrega o usuário logado ({ userId, email, roleId })

3. SERVICE (TripsService)
   ├─ Valida se vehicle existe
   ├─ Valida se vehicle está AVAILABLE (não IN_USE, IN_MAINTENANCE ou OUT_OF_SERVICE)
   ├─ Valida se driver não tem TRIP ATIVA
   ├─ Abre transação e roda set_config('app.current_user_id', userId, true) (auditoria)
   ├─ Chama PROCEDURE create_trip(driverId, vehicleId, ...)
   └─ Retorna trip criada

4. PROCEDURE (create_trip)
   ├─ Valida usuário ativo, locais (trim, até 255), driver ativo com usuário ativo e CNH válida
   ├─ Trava o vehicle e confere se está AVAILABLE
   ├─ Confere start_km >= mileagem do vehicle
   ├─ Insere em trips com status PLANNED (os triggers rodam aqui)
   ├─ Marca o vehicle como IN_USE
   └─ Retorna id e status

5. TRIGGER (prevent_vehicle_in_maintenance_from_trip)
   ├─ BEFORE INSERT ON trips (o veículo ainda está AVAILABLE)
   └─ Se vehicle.status for IN_USE, IN_MAINTENANCE ou OUT_OF_SERVICE → RAISE EXCEPTION

6. TRIGGERS (prevent_driver_double_active_trip, prevent_vehicle_double_active_trip, validate_trip_kilometers)
   ├─ BEFORE INSERT ON trips
   └─ Se driver ou vehicle já tem TRIP ativa (PLANNED/IN_PROGRESS) → RAISE EXCEPTION

7. TRIGGERS (sync_vehicle_from_trip, audit_trip_changes)
   ├─ AFTER INSERT ON trips
   ├─ sync_vehicle_from_trip confirma vehicle IN_USE (viagem ativa)
   └─ audit_trip_changes insere em audit_logs com newValues (usuário = app.current_user_id ou fk_user_id)

8. ERRO (se algum RAISE EXCEPTION disparar)
   └─ Sai como P0001; o service traduz o texto para HTTP (tabela da seção 5.3)

9. RESPONSE
   ├─ Status 201 CREATED
   └─ Body: { id, status: PLANNED, ... }
```

---

## 4. Entidades e Relacionamentos

### 4.1 Diagrama ER (Simplificado)

```
User ◄──── Driver
  │         │
  │         ├──► Trip ◄──── Vehicle
  │         │              │
  │         ├──► Refueling  ├──► Maintenance
  │         │              │
  │         └──► Incident ──┘

Permission ◄──── RolePermission ──► Role ◄──► User

AuditLog ◄──── (tudo dispara triggers)
```

### 4.2 Entidades Detalhadas

> Trecho gerado a partir de `prisma/schema.prisma` (fonte da verdade).

**Convenções do banco:**
- Tabelas no plural e em `snake_case` (`@@map`): `users`, `audit_logs`...
- Chave primária própria: `id_<entidade>` (`id_user`, `id_trip`, `id_audit_log`).
- Chave estrangeira: `fk_<entidade>_id` (`fk_user_id`, `fk_driver_id`). Toda referência a `users` usa `fk_user_id`, seja `createdBy`, `registeredBy` ou `changedBy`.
- Todo o resto em minúsculas com `_` (`start_km`, `created_at`). Assim o SQL das procedures e triggers não precisa de aspas.
- Ids e chaves estrangeiras são `UUID` (`@db.Uuid`). Textos têm limite (`@db.VarChar`), dinheiro e litros usam `Decimal`.
- Os nomes dos campos no TypeScript continuam em camelCase (`userId`, `startKm`); o `@map` faz a ligação com a coluna.
- O banco não tem `DEFAULT` para `id` nem `updated_at` (o Prisma preenche na aplicação). Quem insere por SQL/procedure precisa informar `gen_random_uuid()` e `NOW()`.
- **CHECKs** com nome `ck_<tabela>_<regra>`: a maioria vem da migration `20260921185000_constraints_and_indexes`, com mais 2 adicionadas depois (`ck_users_api_key_hash` em `20260921187000_add_api_key_to_users`, `ck_drivers_license_number_format` em `20260922112403_fix_plate_and_license_format_checks`) — o Prisma não rastreia CHECK, então não aparecem no `schema.prisma` e o diff do Prisma continua limpo. Há **26** (tabela abaixo).
- **Normalização feita pelo aplicativo:** `vehicles.plate` em MAIÚSCULAS, sem espaços nas pontas, no formato Mercosul (`ABC1D23`) ou antigo (`ABC1234`/`ABC-1234`); `drivers.licenseNumber` com exatamente 11 dígitos numéricos; `users.email` em minúsculas e sem espaços nas pontas. Os DTOs (`@Matches` em `create-vehicle.dto.ts`, `drivers/dto/*.ts`) já recusam o formato errado com 400 antes de chegar no banco; o CHECK (`ck_vehicles_plate_normalized`, `ck_drivers_license_number_format`) é a segunda camada — o banco **não corrige**, ele **recusa** (`23514`). Migration da correção de formato: `prisma/migrations/20260922112403_fix_plate_and_license_format_checks/migration.sql`.
- **Tetos:** quilometragem de 0 a 10.000.000 (`current_mileage`, `last_maintenance_km`, `start_km`, `end_km`; abastecimento de 1 a 10.000.000) e `vehicles.year` de 1900 a 2100.
- **Índices:** além dos de FK, há 8 índices novos (`@@index` no schema): `trips(createdBy)`, `trips(vehicleId, status)`, `trips(driverId, status)`, `incidents(tripId)`, `incidents(registeredBy)`, `refuelings(registeredBy)`, `maintenances(registeredBy)` e `maintenances(vehicleId, status)`. Foram criados na migration `20260921185000_constraints_and_indexes` com o mesmo padrão de nome do Prisma.
- **Sem índice único parcial:** a regra "sem 2 viagens ativas (por motorista e por veículo)" seria um `UNIQUE ... WHERE status IN ('PLANNED', 'IN_PROGRESS')`, mas o Prisma não representa índice único parcial no `schema.prisma` (`@@unique(..., where:)` não existe) e um índice criado só por SQL apareceria como diferença nas próximas migrations do Prisma. Por isso a regra fica nos triggers, com advisory lock contra corrida (seção 6).
- `VehicleStatus`: `AVAILABLE` (livre), `IN_USE` (reservado ou em viagem; só as viagens definem esse status), `IN_MAINTENANCE`, `OUT_OF_SERVICE`.

#### **User**
```prisma
model User {
  id       String  @id @default(uuid()) @map("id_user") @db.Uuid
  email    String  @unique @db.VarChar(255)
  password String  @db.VarChar(255) // hash bcrypt (60 caracteres)
  fullName String  @map("full_name") @db.VarChar(150)
  roleId   String  @map("fk_role_id") @db.Uuid
  role     Role    @relation(fields: [roleId], references: [id])
  isActive Boolean @default(true) @map("is_active")

  // Relacionamentos
  driver       Driver?
  permissions  UserPermission[]
  createdTrips Trip[]           @relation("createdBy")
  refuelings   Refueling[]      @relation("registeredBy")
  maintenances Maintenance[]    @relation("registeredBy")
  incidents    Incident[]       @relation("registeredBy")
  auditLogs    AuditLog[]       @relation("changedBy")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([roleId])
  @@map("users")
}
```

#### **Role**
```prisma
model Role {
  id          String  @id @default(uuid()) @map("id_role") @db.Uuid
  name        String  @unique @db.VarChar(50) // DRIVER, FLEET_MANAGER, ADMIN
  description String? @db.VarChar(255)

  users       User[]
  permissions RolePermission[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("roles")
}
```

#### **Permission**
```prisma
model Permission {
  id          String  @id @default(uuid()) @map("id_permission") @db.Uuid
  code        String  @unique @db.VarChar(100) // ex: TRIP_CREATE, DRIVER_VIEW_OWN
  description String? @db.VarChar(255)

  roles RolePermission[]
  users UserPermission[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("permissions")
}
```

#### **RolePermission**
```prisma
model RolePermission {
  roleId       String @map("fk_role_id") @db.Uuid
  permissionId String @map("fk_permission_id") @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map("role_permissions")
}
```

#### **UserPermission** (permissões adicionais por usuário)
```prisma
model UserPermission {
  userId       String @map("fk_user_id") @db.Uuid
  permissionId String @map("fk_permission_id") @db.Uuid

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([userId, permissionId])
  @@index([permissionId])
  @@map("user_permissions")
}
```

#### **Driver**
```prisma
model Driver {
  id     String @id @default(uuid()) @map("id_driver") @db.Uuid
  userId String @unique @map("fk_user_id") @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  licenseNumber String   @unique @map("license_number") @db.VarChar(20)
  licenseExpiry DateTime @map("license_expiry") @db.Date
  isActive      Boolean  @default(true) @map("is_active")

  trips      Trip[]
  refuelings Refueling[]
  incidents  Incident[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("drivers")
}
```

#### **Vehicle**
```prisma
model Vehicle {
  id    String @id @default(uuid()) @map("id_vehicle") @db.Uuid
  plate String @unique @db.VarChar(8) // ex: ABC1D23 ou ABC-1234
  model String @db.VarChar(100)
  year  Int    @db.SmallInt

  status            VehicleStatus @default(AVAILABLE)
  currentMileage    Int           @map("current_mileage")
  lastMaintenanceKm Int           @map("last_maintenance_km")

  trips        Trip[]
  refuelings   Refueling[]
  maintenances Maintenance[]
  incidents    Incident[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([status])
  @@map("vehicles")
}
```

#### **Trip**
```prisma
model Trip {
  id String @id @default(uuid()) @map("id_trip") @db.Uuid

  driverId String @map("fk_driver_id") @db.Uuid
  driver   Driver @relation(fields: [driverId], references: [id])

  vehicleId String  @map("fk_vehicle_id") @db.Uuid
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id])

  status TripStatus @default(PLANNED)

  startKm Int  @map("start_km")
  endKm   Int? @map("end_km") // vazio até a viagem terminar

  startLocation String @map("start_location") @db.VarChar(255)
  endLocation   String @map("end_location") @db.VarChar(255)

  startTime DateTime  @default(now()) @map("start_time")
  endTime   DateTime? @map("end_time") // vazio até a viagem terminar

  createdBy     String @map("fk_user_id") @db.Uuid
  createdByUser User   @relation("createdBy", fields: [createdBy], references: [id])

  incidents Incident[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Motorista/veículo com 2 viagens ativas: regra fica nos triggers (passo 11).
  // O Prisma não suporta índice único parcial (where) no schema.
  @@index([driverId])
  @@index([vehicleId])
  @@index([status])
  @@index([createdAt])
  @@index([createdBy])
  @@index([vehicleId, status])
  @@index([driverId, status])
  @@map("trips")
}
```

#### **Refueling**
```prisma
model Refueling {
  id String @id @default(uuid()) @map("id_refueling") @db.Uuid

  vehicleId String  @map("fk_vehicle_id") @db.Uuid
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id])

  driverId String @map("fk_driver_id") @db.Uuid
  driver   Driver @relation(fields: [driverId], references: [id])

  mileage      Int
  litersAdded  Decimal @map("liters_added") @db.Decimal(10, 2)
  costPerLiter Decimal @map("cost_per_liter") @db.Decimal(10, 4)
  totalCost    Decimal @map("total_cost") @db.Decimal(12, 2)

  fuelType FuelType @map("fuel_type")

  registeredBy     String @map("fk_user_id") @db.Uuid
  registeredByUser User   @relation("registeredBy", fields: [registeredBy], references: [id])

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([vehicleId])
  @@index([driverId])
  @@index([createdAt])
  @@index([registeredBy])
  @@map("refuelings")
}
```

#### **Maintenance**
```prisma
model Maintenance {
  id String @id @default(uuid()) @map("id_maintenance") @db.Uuid

  vehicleId String  @map("fk_vehicle_id") @db.Uuid
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id])

  type   MaintenanceType
  status MaintenanceStatus @default(SCHEDULED)

  scheduledDate DateTime  @map("scheduled_date")
  completedDate DateTime? @map("completed_date")
  description   String    @db.VarChar(1000)
  cost          Decimal   @db.Decimal(12, 2)

  registeredBy     String @map("fk_user_id") @db.Uuid
  registeredByUser User   @relation("registeredBy", fields: [registeredBy], references: [id])

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([vehicleId])
  @@index([status])
  @@index([registeredBy])
  @@index([vehicleId, status])
  @@map("maintenances")
}
```

#### **Incident**
```prisma
model Incident {
  id String @id @default(uuid()) @map("id_incident") @db.Uuid

  tripId String? @map("fk_trip_id") @db.Uuid
  trip   Trip?   @relation(fields: [tripId], references: [id])

  vehicleId String  @map("fk_vehicle_id") @db.Uuid
  vehicle   Vehicle @relation(fields: [vehicleId], references: [id])

  driverId String @map("fk_driver_id") @db.Uuid
  driver   Driver @relation(fields: [driverId], references: [id])

  type     IncidentType
  severity Severity       @default(LOW)
  status   IncidentStatus @default(REPORTED)

  description String @db.VarChar(1000)

  photoUrl String? @map("photo_url") @db.VarChar(500) // URL da foto no S3/GCP
  photoKey String? @map("photo_key") @db.VarChar(255) // chave da foto, para apagar depois

  registeredBy     String @map("fk_user_id") @db.Uuid
  registeredByUser User   @relation("registeredBy", fields: [registeredBy], references: [id])

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([vehicleId])
  @@index([driverId])
  @@index([status])
  @@index([createdAt])
  @@index([tripId])
  @@index([registeredBy])
  @@map("incidents")
}
```

#### **AuditLog** (imutável)
```prisma
model AuditLog {
  id String @id @default(uuid()) @map("id_audit_log") @db.Uuid

  entityType String      @map("entity_type") @db.VarChar(50) // USER, TRIP, VEHICLE...
  entityId   String      @map("entity_id") @db.Uuid
  action     AuditAction

  changedBy     String @map("fk_user_id") @db.Uuid
  changedByUser User   @relation("changedBy", fields: [changedBy], references: [id])

  oldValues Json? @map("old_values") @db.JsonB // vazio quando é CREATE
  newValues Json? @map("new_values") @db.JsonB

  createdAt DateTime @default(now()) @map("created_at")

  @@index([entityType, entityId])
  @@index([changedBy])
  @@index([createdAt])
  @@map("audit_logs")
}
```

#### **Enums**
```prisma
enum VehicleStatus {
  AVAILABLE
  IN_USE
  IN_MAINTENANCE
  OUT_OF_SERVICE
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

enum Severity {
  LOW
  MEDIUM
  HIGH
}

enum IncidentStatus {
  REPORTED
  UNDER_INVESTIGATION
  RESOLVED
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}
```

#### **CHECKs (26)**
| Tabela | CHECK | Regra |
|---|---|---|
| `vehicles` | `ck_vehicles_year_range` | `year BETWEEN 1900 AND 2100` |
| `vehicles` | `ck_vehicles_current_mileage_range` | `current_mileage BETWEEN 0 AND 10000000` |
| `vehicles` | `ck_vehicles_last_maintenance_km_range` | `last_maintenance_km BETWEEN 0 AND 10000000` |
| `vehicles` | `ck_vehicles_plate_normalized` | `plate = upper(btrim(plate)) AND plate ~ '^([A-Z]{3}[0-9][A-Z][0-9]{2}\|[A-Z]{3}-?[0-9]{4})$'` (Mercosul ou antigo, com ou sem hífen) |
| `vehicles` | `ck_vehicles_model_not_empty` | `btrim(model) <> ''` |
| `users` | `ck_users_email_normalized` | `email = lower(btrim(email)) AND btrim(email) <> ''` |
| `users` | `ck_users_password_not_empty` | `btrim(password) <> ''` |
| `users` | `ck_users_api_key_hash` | `api_key IS NULL OR api_key ~ '^[0-9a-f]{64}$'` |
| `drivers` | `ck_drivers_license_number_format` | `license_number ~ '^[0-9]{11}$'` (11 dígitos numéricos) |
| `trips` | `ck_trips_start_km_range` | `start_km BETWEEN 0 AND 10000000` |
| `trips` | `ck_trips_end_km_range` | `end_km IS NULL OR end_km BETWEEN 0 AND 10000000` |
| `trips` | `ck_trips_end_km_gte_start_km` | `end_km IS NULL OR end_km >= start_km` |
| `trips` | `ck_trips_end_time_gte_start_time` | `end_time IS NULL OR end_time >= start_time` |
| `trips` | `ck_trips_completed_requires_end` | `status <> 'COMPLETED' OR (end_km IS NOT NULL AND end_time IS NOT NULL)` |
| `trips` | `ck_trips_locations_not_empty` | `btrim(start_location) <> '' AND btrim(end_location) <> ''` |
| `refuelings` | `ck_refuelings_mileage_range` | `mileage BETWEEN 1 AND 10000000` |
| `refuelings` | `ck_refuelings_liters_positive` | `liters_added > 0` |
| `refuelings` | `ck_refuelings_cost_per_liter_positive` | `cost_per_liter > 0` |
| `refuelings` | `ck_refuelings_total_cost_not_negative` | `total_cost >= 0` |
| `refuelings` | `ck_refuelings_total_cost_matches` | `total_cost = ROUND(liters_added * cost_per_liter, 2)` |
| `maintenances` | `ck_maintenances_cost_not_negative` | `cost >= 0` |
| `maintenances` | `ck_maintenances_description_not_empty` | `btrim(description) <> ''` |
| `maintenances` | `ck_maintenances_completed_after_scheduled` | `completed_date IS NULL OR completed_date >= scheduled_date` |
| `maintenances` | `ck_maintenances_completed_requires_date` | `status <> 'COMPLETED' OR completed_date IS NOT NULL` |
| `incidents` | `ck_incidents_description_not_empty` | `btrim(description) <> ''` |
| `incidents` | `ck_incidents_photo_url_http` | `photo_url IS NULL OR photo_url ~* '^https?://.+'` |

Uma violação sai do PostgreSQL como SQLSTATE `23514` (`check_violation`) e o erro traz o nome do CHECK (`error.constraint`, ou no texto: `violates check constraint "ck_..."`). O mapa para HTTP está na seção 5.3.

---

## 5. Procedures PostgreSQL

### 5.1 Convenção de Naming

- Todas as procedures em **snake_case**
- Prefixo conforme tipo: `create_*`, `start_*`, `end_*`, `cancel_*`, `register_*`
- São **procedures de verdade** (`CREATE PROCEDURE`). O PostgreSQL não permite `RETURNS TABLE` em procedure, então o resultado volta por parâmetros `OUT`.
- Chamada: `CALL nome(..., NULL, NULL);`. Cada `NULL` no fim ocupa o lugar de um `OUT` e a chamada devolve uma linha com as colunas `OUT` (`id`, `status`...).
- Todas usam `SECURITY DEFINER` com `SET search_path = public, pg_temp` e `#variable_conflict use_column` (se um nome for igual ao de uma coluna, vale a coluna).
- Geram o `id` (`gen_random_uuid()`) e preenchem `updated_at`, porque o banco não tem `DEFAULT` para eles.
- Estado final: **6 procedures** (`create_trip`, `start_trip`, `end_trip`, `cancel_trip`, `register_refueling`, `register_incident`). O SQL abaixo é a versão vigente, copiada da migration mais recente que define cada uma (indicada em cada subseção).
- Para mudar uma procedure, crie uma migration nova com `CREATE OR REPLACE`; não edite uma já aplicada. Se a lista de parâmetros (incluindo `OUT`) mudar, faça `DROP PROCEDURE` da assinatura antiga antes.
- O `EXECUTE` de `PUBLIC` foi revogado (seção 5.4).

**Ciclo de status do veículo:**

```
AVAILABLE --create_trip--> IN_USE --start_trip--> IN_USE --end_trip / cancel_trip--> AVAILABLE
```

- `IN_USE` significa "reservado ou em viagem": o veículo fica `IN_USE` desde a criação da viagem (`PLANNED`) até ela terminar ou ser cancelada.
- `IN_MAINTENANCE` e `OUT_OF_SERVICE` nunca são sobrescritos pelas procedures de viagem, e o veículo nesses status não recebe viagem nova.
- A regra "veículo `IN_USE` <=> existe viagem ativa (`PLANNED`/`IN_PROGRESS`)" é garantida também por triggers (seção 6.1), mesmo se alguém mexer direto nas tabelas.

### 5.2 Procedures Principais

#### **Procedure: create_trip**
Valida usuário criador (existe e ativo), locais (com `btrim`, até 255 caracteres), motorista (existe, ativo, com **usuário ativo** e **CNH não vencida**: `license_expiry >= CURRENT_DATE`), veículo existente e `AVAILABLE` (trava a linha com `FOR UPDATE`), `start_km` entre 0 e 10.000.000 e >= mileagem do veículo. Insere a viagem `PLANNED` e reserva o veículo (`IN_USE`).

- Retorna (`OUT`): `id`, `status`
- Origem do SQL: migration `20260921186000_concurrency_and_procedures`
- Exemplo: `CALL create_trip('<driver_uuid>', '<vehicle_uuid>', 15000, 'Origem', 'Destino', '<user_uuid>', NULL, NULL);`

```sql
CREATE OR REPLACE PROCEDURE create_trip(
  p_driver_id UUID,
  p_vehicle_id UUID,
  p_start_km INT,
  p_start_location TEXT,
  p_end_location TEXT,
  p_created_by UUID,
  OUT id UUID,
  OUT status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_creator_active BOOLEAN;
  v_driver_active BOOLEAN;
  v_driver_license_expiry DATE;
  v_driver_user_active BOOLEAN;
  v_vehicle_status "VehicleStatus";
  v_vehicle_mileage INT;
  v_start_location TEXT;
  v_end_location TEXT;
BEGIN
  -- Usuário que cria precisa existir e estar ativo
  IF p_created_by IS NOT NULL THEN
    SELECT u.is_active INTO v_creator_active FROM users u WHERE u.id_user = p_created_by;
  END IF;
  IF p_created_by IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF NOT v_creator_active THEN
    RAISE EXCEPTION 'User is not active';
  END IF;

  -- Locais (com trim) precisam ser válidos
  v_start_location := btrim(p_start_location);
  IF v_start_location IS NULL OR v_start_location = '' THEN
    RAISE EXCEPTION 'Start location cannot be empty';
  END IF;

  v_end_location := btrim(p_end_location);
  IF v_end_location IS NULL OR v_end_location = '' THEN
    RAISE EXCEPTION 'End location cannot be empty';
  END IF;

  IF char_length(v_start_location) > 255 OR char_length(v_end_location) > 255 THEN
    RAISE EXCEPTION 'Location cannot be longer than 255 characters';
  END IF;

  -- Motorista precisa existir, estar ativo, com CNH válida e usuário ativo
  SELECT d.is_active, d.license_expiry, u.is_active
  INTO v_driver_active, v_driver_license_expiry, v_driver_user_active
  FROM drivers d
  JOIN users u ON u.id_user = d.fk_user_id
  WHERE d.id_driver = p_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  IF NOT v_driver_active THEN
    RAISE EXCEPTION 'Driver is not active';
  END IF;

  IF NOT v_driver_user_active THEN
    RAISE EXCEPTION 'Driver user is not active';
  END IF;

  IF v_driver_license_expiry < CURRENT_DATE THEN
    RAISE EXCEPTION 'Driver license expired';
  END IF;

  -- Veículo precisa existir (trava a linha para ninguém mexer ao mesmo tempo)
  SELECT v.status, v.current_mileage INTO v_vehicle_status, v_vehicle_mileage
  FROM vehicles v
  WHERE v.id_vehicle = p_vehicle_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  -- Só veículo AVAILABLE pode ter viagem marcada
  IF v_vehicle_status = 'IN_USE' THEN
    RAISE EXCEPTION 'Vehicle is in use';
  END IF;

  IF v_vehicle_status = 'IN_MAINTENANCE' THEN
    RAISE EXCEPTION 'Vehicle is under maintenance';
  END IF;

  IF v_vehicle_status = 'OUT_OF_SERVICE' THEN
    RAISE EXCEPTION 'Vehicle is out of service';
  END IF;

  -- Quilometragem inicial: não negativa, dentro do teto e não menor que a do veículo
  IF p_start_km IS NULL OR p_start_km < 0 THEN
    RAISE EXCEPTION 'Start km cannot be negative';
  END IF;

  IF p_start_km > 10000000 THEN
    RAISE EXCEPTION 'Start km exceeds the maximum allowed (10000000)';
  END IF;

  IF p_start_km < v_vehicle_mileage THEN
    RAISE EXCEPTION 'Start km cannot be less than vehicle current mileage (%)', v_vehicle_mileage;
  END IF;

  INSERT INTO trips (id_trip, fk_driver_id, fk_vehicle_id, status, start_km, start_location, end_location, fk_user_id, updated_at)
  VALUES (gen_random_uuid(), p_driver_id, p_vehicle_id, 'PLANNED', p_start_km, v_start_location, v_end_location, p_created_by, NOW())
  RETURNING trips.id_trip INTO id;

  -- O trigger de sincronização já marca IN_USE; aqui só garantimos (não muda nada se já estiver)
  UPDATE vehicles
  SET status = 'IN_USE', updated_at = NOW()
  WHERE id_vehicle = p_vehicle_id;

  status := 'PLANNED';
END;
$$;
```

#### **Procedure: start_trip**
`p_vehicle_id` é obrigatório (`Vehicle is required`). A viagem precisa estar `PLANNED` e ser do veículo informado; motorista ativo, veículo fora de manutenção/serviço e mileagem atual >= a do veículo e a inicial, com teto de 10.000.000. Passa a viagem para `IN_PROGRESS` (`start_time = NOW()`) e grava a mileagem no veículo.

- Retorna (`OUT`): `id`, `status`, `start_time`
- Origem do SQL: migration `20260921186000_concurrency_and_procedures`
- Exemplo: `CALL start_trip('<trip_uuid>', '<vehicle_uuid>', 15000, NULL, NULL, NULL);`

```sql
CREATE OR REPLACE PROCEDURE start_trip(
  p_trip_id UUID,
  p_vehicle_id UUID,
  p_current_mileage INT,
  OUT id UUID,
  OUT status VARCHAR,
  OUT start_time TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_trip_vehicle_id UUID;
  v_trip_driver_id UUID;
  v_trip_start_km INT;
  v_driver_active BOOLEAN;
  v_vehicle_status "VehicleStatus";
  v_vehicle_mileage INT;
  v_start_time TIMESTAMP;
BEGIN
  IF p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle is required';
  END IF;

  -- A viagem precisa existir e estar PLANNED
  SELECT t.fk_vehicle_id, t.fk_driver_id, t.start_km
  INTO v_trip_vehicle_id, v_trip_driver_id, v_trip_start_km
  FROM trips t
  WHERE t.id_trip = p_trip_id AND t.status = 'PLANNED'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found or not in PLANNED status';
  END IF;

  -- O veículo informado precisa ser o mesmo da viagem
  IF v_trip_vehicle_id <> p_vehicle_id THEN
    RAISE EXCEPTION 'Trip does not belong to the informed vehicle';
  END IF;

  -- O motorista da viagem precisa continuar ativo
  SELECT d.is_active INTO v_driver_active FROM drivers d WHERE d.id_driver = v_trip_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  IF NOT v_driver_active THEN
    RAISE EXCEPTION 'Driver is not active';
  END IF;

  -- Confere o veículo de novo (segunda camada de defesa)
  SELECT v.status, v.current_mileage INTO v_vehicle_status, v_vehicle_mileage
  FROM vehicles v
  WHERE v.id_vehicle = p_vehicle_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  IF v_vehicle_status = 'IN_MAINTENANCE' THEN
    RAISE EXCEPTION 'Vehicle is under maintenance';
  END IF;

  IF v_vehicle_status = 'OUT_OF_SERVICE' THEN
    RAISE EXCEPTION 'Vehicle is out of service';
  END IF;

  -- A quilometragem atual não pode ser menor que a do veículo nem a inicial da viagem
  IF p_current_mileage IS NULL OR p_current_mileage < v_vehicle_mileage THEN
    RAISE EXCEPTION 'Current mileage cannot be less than vehicle current mileage (%)', v_vehicle_mileage;
  END IF;

  IF p_current_mileage > 10000000 THEN
    RAISE EXCEPTION 'Current mileage exceeds the maximum allowed (10000000)';
  END IF;

  IF p_current_mileage < v_trip_start_km THEN
    RAISE EXCEPTION 'Current mileage cannot be less than start_km';
  END IF;

  UPDATE trips
  SET status = 'IN_PROGRESS', start_time = NOW(), updated_at = NOW()
  WHERE id_trip = p_trip_id
  RETURNING trips.start_time INTO v_start_time;

  -- Veículo em uso (se estava AVAILABLE, regulariza) e com a quilometragem nova
  UPDATE vehicles
  SET status = 'IN_USE', current_mileage = p_current_mileage, updated_at = NOW()
  WHERE id_vehicle = p_vehicle_id;

  id := p_trip_id;
  status := 'IN_PROGRESS';
  start_time := v_start_time;
END;
$$;
```

#### **Procedure: end_trip**
A viagem precisa estar `IN_PROGRESS`; km final >= km inicial e >= mileagem do veículo, com teto de 10.000.000 (mensagem própria); horário de fim (`clock_timestamp` em milissegundos) > início. Conclui a viagem, atualiza `current_mileage` e libera o veículo (`IN_USE` -> `AVAILABLE`).

- Retorna (`OUT`): `id`, `status`, `total_km`, `start_time`, `end_time`, `vehicle_mileage`
- Origem do SQL: migration `20260921186000_concurrency_and_procedures`
- Exemplo: `CALL end_trip('<trip_uuid>', 15300, 'Destino final', NULL, NULL, NULL, NULL, NULL, NULL);`

```sql
CREATE OR REPLACE PROCEDURE end_trip(
  p_trip_id UUID,
  p_end_mileage INT,
  p_end_location TEXT,
  OUT id UUID,
  OUT status VARCHAR,
  OUT total_km INT,
  OUT start_time TIMESTAMP,
  OUT end_time TIMESTAMP,
  OUT vehicle_mileage INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_start_km INT;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_vehicle_id UUID;
  v_vehicle_mileage INT;
  v_end_location TEXT;
BEGIN
  v_end_location := btrim(p_end_location);
  IF v_end_location IS NULL OR v_end_location = '' THEN
    RAISE EXCEPTION 'End location cannot be empty';
  END IF;

  IF char_length(v_end_location) > 255 THEN
    RAISE EXCEPTION 'Location cannot be longer than 255 characters';
  END IF;

  -- A viagem precisa existir e estar IN_PROGRESS
  SELECT t.start_km, t.start_time, t.fk_vehicle_id
  INTO v_start_km, v_start_time, v_vehicle_id
  FROM trips t
  WHERE t.id_trip = p_trip_id AND t.status = 'IN_PROGRESS'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found or not in IN_PROGRESS status';
  END IF;

  SELECT v.current_mileage INTO v_vehicle_mileage
  FROM vehicles v
  WHERE v.id_vehicle = v_vehicle_id
  FOR UPDATE;

  -- A quilometragem final não pode ser menor que a inicial nem que a do veículo
  IF p_end_mileage IS NULL OR p_end_mileage < v_start_km THEN
    RAISE EXCEPTION 'End mileage cannot be less than start mileage';
  END IF;

  IF p_end_mileage > 10000000 THEN
    RAISE EXCEPTION 'End mileage exceeds the maximum allowed (10000000)';
  END IF;

  IF p_end_mileage < v_vehicle_mileage THEN
    RAISE EXCEPTION 'End mileage cannot be less than vehicle current mileage (%)', v_vehicle_mileage;
  END IF;

  -- Hora real em milissegundos (igual à coluna); precisa ser depois do início
  v_end_time := date_trunc('milliseconds', clock_timestamp());
  IF v_end_time <= v_start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  UPDATE trips
  SET status = 'COMPLETED', end_km = p_end_mileage, end_location = v_end_location,
      end_time = v_end_time, updated_at = NOW()
  WHERE id_trip = p_trip_id;

  -- Quilometragem do veículo; a liberação (IN_USE -> AVAILABLE) é feita pelo trigger
  UPDATE vehicles
  SET current_mileage = p_end_mileage, updated_at = NOW()
  WHERE id_vehicle = v_vehicle_id;

  UPDATE vehicles
  SET status = 'AVAILABLE', updated_at = NOW()
  WHERE id_vehicle = v_vehicle_id AND status = 'IN_USE';

  id := p_trip_id;
  status := 'COMPLETED';
  total_km := p_end_mileage - v_start_km;
  start_time := v_start_time;
  end_time := v_end_time;
  vehicle_mileage := p_end_mileage;
END;
$$;
```

#### **Procedure: cancel_trip**
Só cancela viagem `PLANNED` ou `IN_PROGRESS`. Libera o veículo (`IN_USE` -> `AVAILABLE`) se ele não tiver outra viagem ativa.

- Retorna (`OUT`): `id`, `status`
- Origem do SQL: migration `20260921181000_fix_procedures_and_cancel_trip`
- Exemplo: `CALL cancel_trip('<trip_uuid>', NULL, NULL);`

```sql
CREATE OR REPLACE PROCEDURE cancel_trip(
  p_trip_id UUID,
  OUT id UUID,
  OUT status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_trip_status "TripStatus";
  v_vehicle_id UUID;
BEGIN
  SELECT t.status, t.fk_vehicle_id INTO v_trip_status, v_vehicle_id
  FROM trips t
  WHERE t.id_trip = p_trip_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;

  -- Só viagem PLANNED ou IN_PROGRESS pode ser cancelada
  IF v_trip_status NOT IN ('PLANNED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Trip cannot be cancelled (status: %)', v_trip_status;
  END IF;

  UPDATE trips
  SET status = 'CANCELLED', updated_at = NOW()
  WHERE id_trip = p_trip_id;

  -- Libera o veículo só se estiver IN_USE e sem outra viagem ativa dele
  UPDATE vehicles
  SET status = 'AVAILABLE', updated_at = NOW()
  WHERE id_vehicle = v_vehicle_id
    AND status = 'IN_USE'
    AND NOT EXISTS (
      SELECT 1 FROM trips t
      WHERE t.fk_vehicle_id = v_vehicle_id AND t.status IN ('PLANNED', 'IN_PROGRESS')
    );

  id := p_trip_id;
  status := 'CANCELLED';
END;
$$;
```

#### **Procedure: register_refueling**
Valida usuário, mileagem (1 a 10.000.000), `fuel_type` (`DIESEL`, `GASOLINE`, `ETHANOL`, `HYBRID`), veículo não `OUT_OF_SERVICE`, motorista ativo (e igual ao da viagem `IN_PROGRESS`, se houver) e mileagem >= a do veículo. **Arredonda antes de calcular** (litros em 2 casas, preço por litro em 4) e só então faz `total_cost = ROUND(litros * preço, 2)`, para bater com o CHECK `ck_refuelings_total_cost_matches`. Faixas máximas: litros 99999999.99, preço 999999.9999, total 9999999999.99. Atualiza `current_mileage`.

- Retorna (`OUT`): `id`, `total_cost`, `vehicle_mileage`
- Origem do SQL: migration `20260921186000_concurrency_and_procedures`
- Exemplo: `CALL register_refueling('<vehicle_uuid>', '<driver_uuid>', 15100, 40.5, 5.899, 'GASOLINE', '<user_uuid>', NULL, NULL, NULL);`

```sql
CREATE OR REPLACE PROCEDURE register_refueling(
  p_vehicle_id UUID,
  p_driver_id UUID,
  p_mileage INT,
  p_liters DECIMAL,
  p_cost_per_liter DECIMAL,
  p_fuel_type VARCHAR,
  p_registered_by UUID,
  OUT id UUID,
  OUT total_cost DECIMAL,
  OUT vehicle_mileage INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_vehicle_status "VehicleStatus";
  v_vehicle_mileage INT;
  v_driver_active BOOLEAN;
  v_trip_driver_id UUID;
  v_liters DECIMAL;
  v_cost DECIMAL;
  v_total_cost DECIMAL;
BEGIN
  IF p_registered_by IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id_user = p_registered_by) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Números precisam ser positivos e caber nas colunas
  IF p_mileage IS NULL OR p_mileage <= 0 THEN
    RAISE EXCEPTION 'Mileage must be greater than zero';
  END IF;

  IF p_mileage > 10000000 THEN
    RAISE EXCEPTION 'Mileage exceeds the maximum allowed (10000000)';
  END IF;

  -- Arredonda antes de calcular: os valores gravados batem com o CHECK do total
  IF p_liters IS NULL OR ROUND(p_liters, 2) <= 0 THEN
    RAISE EXCEPTION 'Liters must be greater than zero';
  END IF;
  v_liters := ROUND(p_liters, 2);

  IF p_cost_per_liter IS NULL OR ROUND(p_cost_per_liter, 4) <= 0 THEN
    RAISE EXCEPTION 'Cost per liter must be greater than zero';
  END IF;
  v_cost := ROUND(p_cost_per_liter, 4);

  IF v_liters > 99999999.99 THEN
    RAISE EXCEPTION 'Liters exceeds the maximum allowed (99999999.99)';
  END IF;

  IF v_cost > 999999.9999 THEN
    RAISE EXCEPTION 'Cost per liter exceeds the maximum allowed (999999.9999)';
  END IF;

  v_total_cost := ROUND(v_liters * v_cost, 2);
  IF v_total_cost > 9999999999.99 THEN
    RAISE EXCEPTION 'Total cost exceeds the maximum allowed (9999999999.99)';
  END IF;

  IF p_fuel_type IS NULL OR p_fuel_type NOT IN ('DIESEL', 'GASOLINE', 'ETHANOL', 'HYBRID') THEN
    RAISE EXCEPTION 'Invalid fuel type (use DIESEL, GASOLINE, ETHANOL or HYBRID)';
  END IF;

  -- Veículo precisa existir e estar ativo (fora de serviço = inativo)
  SELECT v.status, v.current_mileage INTO v_vehicle_status, v_vehicle_mileage
  FROM vehicles v
  WHERE v.id_vehicle = p_vehicle_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  IF v_vehicle_status = 'OUT_OF_SERVICE' THEN
    RAISE EXCEPTION 'Vehicle is out of service';
  END IF;

  -- Motorista precisa existir e estar ativo
  SELECT d.is_active INTO v_driver_active FROM drivers d WHERE d.id_driver = p_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  IF NOT v_driver_active THEN
    RAISE EXCEPTION 'Driver is not active';
  END IF;

  -- Se o veículo está em viagem, quem abastece é o motorista da viagem
  SELECT t.fk_driver_id INTO v_trip_driver_id
  FROM trips t
  WHERE t.fk_vehicle_id = p_vehicle_id AND t.status = 'IN_PROGRESS';
  IF FOUND AND v_trip_driver_id <> p_driver_id THEN
    RAISE EXCEPTION 'Driver does not match the active trip of the vehicle';
  END IF;

  -- A quilometragem não pode andar para trás
  IF p_mileage < v_vehicle_mileage THEN
    RAISE EXCEPTION 'Mileage cannot be less than vehicle current mileage (%)', v_vehicle_mileage;
  END IF;

  INSERT INTO refuelings (id_refueling, fk_vehicle_id, fk_driver_id, mileage, liters_added, cost_per_liter, total_cost, fuel_type, fk_user_id, updated_at)
  VALUES (gen_random_uuid(), p_vehicle_id, p_driver_id, p_mileage, v_liters, v_cost, v_total_cost, p_fuel_type::"FuelType", p_registered_by, NOW())
  RETURNING refuelings.id_refueling INTO id;

  UPDATE vehicles
  SET current_mileage = p_mileage, updated_at = NOW()
  WHERE id_vehicle = p_vehicle_id;

  total_cost := v_total_cost;
  vehicle_mileage := p_mileage;
END;
$$;
```

#### **Procedure: register_incident**
Valida usuário, tipo (`ACCIDENT`, `MECHANICAL_FAILURE`, `OTHER`), severidade (`LOW`, `MEDIUM`, `HIGH`), descrição (até 1000), foto (URL `http(s)` até 500, chave até 255), veículo não `OUT_OF_SERVICE` e motorista ativo. `p_trip_id` é opcional; se vier, a viagem é lida com **`FOR UPDATE`** (espera outra transação que esteja concluindo a viagem) e precisa existir, ser do veículo e do motorista e estar `IN_PROGRESS`. Grava com status `REPORTED`.

- Retorna (`OUT`): `id`, `status`, `created_at`
- Origem do SQL: migration `20260921186000_concurrency_and_procedures`
- Exemplo: `CALL register_incident(NULL, '<vehicle_uuid>', '<driver_uuid>', 'ACCIDENT', 'HIGH', 'Descrição', NULL, NULL, '<user_uuid>', NULL, NULL, NULL);`

```sql
CREATE OR REPLACE PROCEDURE register_incident(
  p_trip_id UUID,
  p_vehicle_id UUID,
  p_driver_id UUID,
  p_incident_type VARCHAR,
  p_severity VARCHAR,
  p_description TEXT,
  p_photo_url TEXT,
  p_photo_key TEXT,
  p_registered_by UUID,
  OUT id UUID,
  OUT status VARCHAR,
  OUT created_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_vehicle_status "VehicleStatus";
  v_driver_active BOOLEAN;
  v_trip_vehicle_id UUID;
  v_trip_driver_id UUID;
  v_trip_status "TripStatus";
  v_description TEXT;
BEGIN
  IF p_registered_by IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id_user = p_registered_by) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Enums, descrição e foto
  IF p_incident_type IS NULL OR p_incident_type NOT IN ('ACCIDENT', 'MECHANICAL_FAILURE', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid incident type (use ACCIDENT, MECHANICAL_FAILURE or OTHER)';
  END IF;

  IF p_severity IS NULL OR p_severity NOT IN ('LOW', 'MEDIUM', 'HIGH') THEN
    RAISE EXCEPTION 'Invalid severity (use LOW, MEDIUM or HIGH)';
  END IF;

  v_description := btrim(p_description);
  IF v_description IS NULL OR v_description = '' THEN
    RAISE EXCEPTION 'Description cannot be empty';
  END IF;

  IF char_length(v_description) > 1000 THEN
    RAISE EXCEPTION 'Description cannot be longer than 1000 characters';
  END IF;

  IF p_photo_url IS NOT NULL THEN
    IF p_photo_url !~* '^https?://.+' THEN
      RAISE EXCEPTION 'Photo URL must start with http:// or https://';
    END IF;

    IF char_length(p_photo_url) > 500 THEN
      RAISE EXCEPTION 'Photo URL cannot be longer than 500 characters';
    END IF;
  END IF;

  IF p_photo_key IS NOT NULL AND char_length(p_photo_key) > 255 THEN
    RAISE EXCEPTION 'Photo key cannot be longer than 255 characters';
  END IF;

  -- Veículo precisa existir e estar ativo (fora de serviço = inativo)
  SELECT v.status INTO v_vehicle_status FROM vehicles v WHERE v.id_vehicle = p_vehicle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  IF v_vehicle_status = 'OUT_OF_SERVICE' THEN
    RAISE EXCEPTION 'Vehicle is out of service';
  END IF;

  -- Motorista precisa existir e estar ativo
  SELECT d.is_active INTO v_driver_active FROM drivers d WHERE d.id_driver = p_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;

  IF NOT v_driver_active THEN
    RAISE EXCEPTION 'Driver is not active';
  END IF;

  -- A viagem é opcional, mas se vier: existe, é do veículo, do motorista e está em andamento.
  -- FOR UPDATE: espera outra transação que esteja concluindo a viagem.
  IF p_trip_id IS NOT NULL THEN
    SELECT t.fk_vehicle_id, t.fk_driver_id, t.status
    INTO v_trip_vehicle_id, v_trip_driver_id, v_trip_status
    FROM trips t
    WHERE t.id_trip = p_trip_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Trip not found';
    END IF;

    IF v_trip_vehicle_id <> p_vehicle_id THEN
      RAISE EXCEPTION 'Trip does not belong to the informed vehicle';
    END IF;

    IF v_trip_driver_id <> p_driver_id THEN
      RAISE EXCEPTION 'Driver does not match the trip driver';
    END IF;

    IF v_trip_status <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'Trip is not in IN_PROGRESS status';
    END IF;
  END IF;

  INSERT INTO incidents (id_incident, fk_trip_id, fk_vehicle_id, fk_driver_id, type, severity, status, description, photo_url, photo_key, fk_user_id, updated_at)
  VALUES (gen_random_uuid(), p_trip_id, p_vehicle_id, p_driver_id, p_incident_type::"IncidentType", p_severity::"Severity", 'REPORTED', v_description, p_photo_url, p_photo_key, p_registered_by, NOW())
  RETURNING incidents.id_incident, incidents.created_at INTO id, created_at;

  status := 'REPORTED';
END;
$$;
```

### 5.3 Mensagens de Erro (para o back-end mapear)

Todo `RAISE EXCEPTION` sai com o mesmo SQLSTATE `P0001` (`raise_exception`); por isso o back-end **não** consegue distinguir os erros pelo código, só pelo **texto da mensagem** (`message` do erro do PostgreSQL). Sugestão: um mapa `mensagem -> { status HTTP, mensagem para o cliente }` no service (comparando com `startsWith`/regex nas mensagens que têm `(N)`/`(status: X)` no fim) e `500` para qualquer mensagem desconhecida.

Nas mensagens com `(N)` ou `(status: X)` o valor é dinâmico (mileagem do veículo, status da viagem); nas de "exceeds the maximum allowed" o número entre parênteses é o teto fixo. Erros nativos do banco (chave estrangeira `23503`, único `23505`, tamanho excedido `22001`, UUID inválido `22P02`, CHECK `23514`) têm códigos próprios; sugestão: 409, 409, 400, 400 e o da tabela de CHECKs abaixo.

**Erros de `RAISE EXCEPTION` (P0001):**

| Mensagem exata (`RAISE EXCEPTION`) | Significado | Onde ocorre | HTTP sugerido |
|---|---|---|---|
| `User not found` | Usuário (`created_by`/`registered_by`) nulo ou inexistente | create_trip, register_refueling, register_incident | 400 (ou 401 se o token aponta para usuário apagado) |
| `User is not active` | Usuário que está criando a viagem está inativo | create_trip | 403 |
| `Start location cannot be empty` | Origem vazia ou só espaços | create_trip | 400 |
| `End location cannot be empty` | Destino vazio ou só espaços | create_trip, end_trip | 400 |
| `Location cannot be longer than 255 characters` | Origem/destino com mais de 255 caracteres | create_trip, end_trip | 400 |
| `Driver not found` | Motorista inexistente | create_trip, start_trip, register_refueling, register_incident | 404 |
| `Driver is not active` | Motorista inativo (`is_active = false`) | create_trip, start_trip, register_refueling, register_incident | 409 |
| `Driver user is not active` | O usuário do motorista está inativo | create_trip | 409 |
| `Driver license expired` | CNH vencida (`license_expiry` anterior a hoje) | create_trip | 409 |
| `Vehicle is required` | `p_vehicle_id` nulo | start_trip | 400 |
| `Vehicle not found` | Veículo inexistente | create_trip, start_trip, register_refueling, register_incident | 404 |
| `Vehicle is in use` | Veículo `IN_USE` (já reservado ou em viagem) | create_trip | 409 |
| `Vehicle is under maintenance` | Veículo `IN_MAINTENANCE` | create_trip, start_trip | 409 |
| `Vehicle is out of service` | Veículo `OUT_OF_SERVICE` | create_trip, start_trip, register_refueling, register_incident | 409 |
| `Start km cannot be negative` | `start_km` nulo ou negativo | create_trip | 400 |
| `Start km exceeds the maximum allowed (10000000)` | `start_km` acima do teto | create_trip | 400 |
| `Start km cannot be less than vehicle current mileage (N)` | `start_km` menor que a mileagem do veículo (N) | create_trip | 409 |
| `Trip not found or not in PLANNED status` | Viagem inexistente ou não está `PLANNED` | start_trip | 409 (404 se o service já checou que a viagem não existe) |
| `Trip does not belong to the informed vehicle` | Viagem é de outro veículo | start_trip, register_incident | 400 |
| `Current mileage cannot be less than vehicle current mileage (N)` | Mileagem informada menor que a do veículo (N) | start_trip | 409 |
| `Current mileage exceeds the maximum allowed (10000000)` | Mileagem informada acima do teto | start_trip | 400 |
| `Current mileage cannot be less than start_km` | Mileagem informada menor que o `start_km` da viagem | start_trip | 400 |
| `Trip not found or not in IN_PROGRESS status` | Viagem inexistente ou não está `IN_PROGRESS` | end_trip | 409 (404 se o service já checou que a viagem não existe) |
| `End mileage cannot be less than start mileage` | Km final nulo ou menor que o inicial | end_trip | 400 |
| `End mileage exceeds the maximum allowed (10000000)` | Km final acima do teto | end_trip | 400 |
| `End mileage cannot be less than vehicle current mileage (N)` | Km final menor que a mileagem do veículo (N) | end_trip | 409 |
| `End time must be after start time` | Horário de fim não é depois do início | end_trip | 409 |
| `Trip not found` | Viagem inexistente | cancel_trip, register_incident | 404 |
| `Trip cannot be cancelled (status: X)` | Viagem já `COMPLETED` ou `CANCELLED` (X) | cancel_trip | 409 |
| `Mileage must be greater than zero` | Mileagem do abastecimento nula ou <= 0 | register_refueling | 400 |
| `Mileage exceeds the maximum allowed (10000000)` | Mileagem do abastecimento acima do teto | register_refueling | 400 |
| `Liters must be greater than zero` | Litros nulos ou <= 0 (após arredondar em 2 casas) | register_refueling | 400 |
| `Cost per liter must be greater than zero` | Preço por litro nulo ou <= 0 (após arredondar em 4 casas) | register_refueling | 400 |
| `Liters exceeds the maximum allowed (99999999.99)` | Litros acima da faixa da coluna | register_refueling | 400 |
| `Cost per liter exceeds the maximum allowed (999999.9999)` | Preço por litro acima da faixa da coluna | register_refueling | 400 |
| `Total cost exceeds the maximum allowed (9999999999.99)` | Total (litros x preço, arredondado) acima da faixa da coluna | register_refueling | 400 |
| `Invalid fuel type (use DIESEL, GASOLINE, ETHANOL or HYBRID)` | Combustível fora do enum | register_refueling | 400 |
| `Driver does not match the active trip of the vehicle` | Veículo em viagem `IN_PROGRESS` de outro motorista | register_refueling | 409 |
| `Mileage cannot be less than vehicle current mileage (N)` | Mileagem do abastecimento menor que a do veículo (N) | register_refueling | 409 |
| `Invalid incident type (use ACCIDENT, MECHANICAL_FAILURE or OTHER)` | Tipo fora do enum | register_incident | 400 |
| `Invalid severity (use LOW, MEDIUM or HIGH)` | Severidade fora do enum | register_incident | 400 |
| `Description cannot be empty` | Descrição vazia ou só espaços | register_incident | 400 |
| `Description cannot be longer than 1000 characters` | Descrição com mais de 1000 caracteres | register_incident | 400 |
| `Photo URL must start with http:// or https://` | URL da foto inválida | register_incident | 400 |
| `Photo URL cannot be longer than 500 characters` | URL da foto longa demais | register_incident | 400 |
| `Photo key cannot be longer than 255 characters` | Chave da foto longa demais | register_incident | 400 |
| `Driver does not match the trip driver` | Motorista diferente do motorista da viagem | register_incident | 409 |
| `Trip is not in IN_PROGRESS status` | Viagem informada não está em andamento | register_incident | 409 |
| `Vehicle is not available (maintenance, out of service, or already in use)` | Trigger: veículo `IN_MAINTENANCE`, `OUT_OF_SERVICE` ou `IN_USE` ao criar/reativar/trocar veículo da viagem | trigger `prevent_vehicle_in_maintenance_from_trip` | 409 |
| `Driver already has an active trip` | Trigger: motorista já tem viagem `PLANNED`/`IN_PROGRESS` | trigger `prevent_driver_double_active_trip` | 409 |
| `Vehicle already has an active trip` | Trigger: veículo já tem viagem `PLANNED`/`IN_PROGRESS` | trigger `prevent_vehicle_double_active_trip` | 409 |
| `Start kilometers cannot be negative` | Trigger: `start_km` negativo (escrita direta na tabela) | trigger `validate_trip_kilometers` | 400 |
| `End kilometers cannot be negative` | Trigger: `end_km` negativo | trigger `validate_trip_kilometers` | 400 |
| `End kilometers cannot be less than start kilometers` | Trigger: `end_km` menor que `start_km` | trigger `validate_trip_kilometers` | 400 |
| `Mileage cannot decrease` | Trigger: alguém tentou diminuir `vehicles.current_mileage` | trigger `protect_vehicle_status_and_mileage` | 409 |
| `Vehicle has an active trip: end or cancel it first` | Trigger: mudar o veículo para status diferente de `IN_USE` com viagem ativa (ex.: mandar para manutenção) | trigger `protect_vehicle_status_and_mileage` | 409 |
| `IN_USE is set only by trips` | Trigger: tentativa de gravar `IN_USE` sem viagem ativa (UPDATE) ou ao criar veículo (INSERT) | triggers `protect_vehicle_status_and_mileage` e `block_vehicle_in_use_on_insert` | 409 (400 ao criar veículo com `IN_USE`) |
| `audit_logs is append-only` | Trigger: tentativa de UPDATE ou DELETE em `audit_logs` | trigger `block_audit_logs_changes` | 500 (é bug ou acesso indevido; o app nunca deve fazer isso) |
| `Audit failed: <motivo>` | Trigger de auditoria não conseguiu gravar em `audit_logs`; a operação inteira é desfeita | triggers `audit_*_changes` | 500 |

**Erros de CHECK (SQLSTATE `23514`, identifique pelo nome do CHECK em `error.constraint`):** as procedures já barram quase tudo antes (mensagens acima), então o CHECK é a rede de proteção para escrita direta pelo Prisma. Critério: 400 para formato, faixa ou vazio; 422 para regra que compara campos.

| CHECK | Regra | HTTP sugerido |
|---|---|---|
| `ck_vehicles_year_range` | `year BETWEEN 1900 AND 2100` | 400 |
| `ck_vehicles_current_mileage_range` | `current_mileage BETWEEN 0 AND 10000000` | 400 |
| `ck_vehicles_last_maintenance_km_range` | `last_maintenance_km BETWEEN 0 AND 10000000` | 400 |
| `ck_vehicles_plate_normalized` | `plate = upper(btrim(plate)) AND plate ~ '^([A-Z]{3}[0-9][A-Z][0-9]{2}\|[A-Z]{3}-?[0-9]{4})$'` | 400 |
| `ck_vehicles_model_not_empty` | `btrim(model) <> ''` | 400 |
| `ck_users_email_normalized` | `email = lower(btrim(email)) AND btrim(email) <> ''` | 400 |
| `ck_users_password_not_empty` | `btrim(password) <> ''` | 400 |
| `ck_users_api_key_hash` | `api_key IS NULL OR api_key ~ '^[0-9a-f]{64}$'` | 400 |
| `ck_drivers_license_number_format` | `license_number ~ '^[0-9]{11}$'` | 400 |
| `ck_trips_start_km_range` | `start_km BETWEEN 0 AND 10000000` | 400 |
| `ck_trips_end_km_range` | `end_km IS NULL OR end_km BETWEEN 0 AND 10000000` | 400 |
| `ck_trips_end_km_gte_start_km` | `end_km IS NULL OR end_km >= start_km` | 422 |
| `ck_trips_end_time_gte_start_time` | `end_time IS NULL OR end_time >= start_time` | 422 |
| `ck_trips_completed_requires_end` | `status <> 'COMPLETED' OR (end_km IS NOT NULL AND end_time IS NOT NULL)` | 422 |
| `ck_trips_locations_not_empty` | `btrim(start_location) <> '' AND btrim(end_location) <> ''` | 400 |
| `ck_refuelings_mileage_range` | `mileage BETWEEN 1 AND 10000000` | 400 |
| `ck_refuelings_liters_positive` | `liters_added > 0` | 400 |
| `ck_refuelings_cost_per_liter_positive` | `cost_per_liter > 0` | 400 |
| `ck_refuelings_total_cost_not_negative` | `total_cost >= 0` | 400 |
| `ck_refuelings_total_cost_matches` | `total_cost = ROUND(liters_added * cost_per_liter, 2)` | 422 |
| `ck_maintenances_cost_not_negative` | `cost >= 0` | 400 |
| `ck_maintenances_description_not_empty` | `btrim(description) <> ''` | 400 |
| `ck_maintenances_completed_after_scheduled` | `completed_date IS NULL OR completed_date >= scheduled_date` | 422 |
| `ck_maintenances_completed_requires_date` | `status <> 'COMPLETED' OR completed_date IS NOT NULL` | 422 |
| `ck_incidents_description_not_empty` | `btrim(description) <> ''` | 400 |
| `ck_incidents_photo_url_http` | `photo_url IS NULL OR photo_url ~* '^https?://.+'` | 400 |

A validação de existência (404) também pode ser feita antes no service com o Prisma (ver seção 3.2); as tabelas valem como rede de proteção para corridas e chamadas diretas ao banco.

### 5.4 Permissões de execução (REVOKE / GRANT)

A migration `20260921186000_concurrency_and_procedures` tirou o `EXECUTE` de `PUBLIC` das 6 procedures e das 12 funções de trigger. Hoje o aplicativo conecta com o dono do banco (que continua podendo executar tudo), então nada muda no dia a dia.

**Se o app passar a usar uma role própria** (recomendado em produção), essa role precisa de `GRANT EXECUTE` em cada procedure, senão o `CALL` falha com `permission denied`. As procedures são `SECURITY DEFINER`: rodam com as permissões do dono, então a role do app não precisa de acesso direto às tabelas para chamá-las.

```sql
-- REVOKE aplicado na migration (procedures)
REVOKE ALL ON PROCEDURE create_trip(UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON PROCEDURE start_trip(UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON PROCEDURE end_trip(UUID, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON PROCEDURE cancel_trip(UUID) FROM PUBLIC;
REVOKE ALL ON PROCEDURE register_refueling(UUID, UUID, INT, DECIMAL, DECIMAL, VARCHAR, UUID) FROM PUBLIC;
REVOKE ALL ON PROCEDURE register_incident(UUID, UUID, UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;

-- GRANT para uma role de aplicação (trocar <role_app> pelo nome da role)
GRANT EXECUTE ON PROCEDURE create_trip(UUID, UUID, INT, TEXT, TEXT, UUID) TO <role_app>;
GRANT EXECUTE ON PROCEDURE start_trip(UUID, UUID, INT) TO <role_app>;
GRANT EXECUTE ON PROCEDURE end_trip(UUID, INT, TEXT) TO <role_app>;
GRANT EXECUTE ON PROCEDURE cancel_trip(UUID) TO <role_app>;
GRANT EXECUTE ON PROCEDURE register_refueling(UUID, UUID, INT, DECIMAL, DECIMAL, VARCHAR, UUID) TO <role_app>;
GRANT EXECUTE ON PROCEDURE register_incident(UUID, UUID, UUID, VARCHAR, VARCHAR, TEXT, TEXT, TEXT, UUID) TO <role_app>;
```

---

## 6. Triggers PostgreSQL

Estado final: **12 triggers** (`SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal;` = 12). Cada trigger tem uma função `fn_<nome>` e o trigger `trg_<nome>`. O SQL abaixo é a versão vigente, copiada das migrations `20260921182000_add_triggers`, `20260921183000_fix_qa_round1`, `20260921184000_block_vehicle_in_use_on_insert` e `20260921186000_concurrency_and_procedures`.

| Trigger | Tabela | Momento e evento | Função | Migration vigente |
|---|---|---|---|---|
| `trg_prevent_vehicle_in_maintenance_from_trip` | trips | BEFORE INSERT OR UPDATE OF `fk_vehicle_id`, `status` (só se o novo status é `PLANNED`/`IN_PROGRESS`) | regra de negócio | `183000_fix_qa_round1` |
| `trg_prevent_driver_double_active_trip` | trips | BEFORE INSERT OR UPDATE OF `status`, `fk_driver_id` | regra de negócio (advisory lock) | `186000_concurrency_and_procedures` (função) |
| `trg_prevent_vehicle_double_active_trip` | trips | BEFORE INSERT OR UPDATE OF `status`, `fk_vehicle_id` | regra de negócio (advisory lock) | `186000_concurrency_and_procedures` (função) |
| `trg_validate_trip_kilometers` | trips | BEFORE INSERT OR UPDATE | regra de negócio | `182000_add_triggers` |
| `trg_sync_vehicle_from_trip` | trips | AFTER INSERT OR DELETE OR UPDATE OF `status`, `fk_vehicle_id`, `end_km` | sincronia do veículo | `186000_concurrency_and_procedures` (trigger) e `183000_fix_qa_round1` (função) |
| `trg_sync_vehicle_mileage_from_refueling` | refuelings | AFTER INSERT OR UPDATE OF `mileage`, `fk_vehicle_id` | sincronia da mileagem | `186000_concurrency_and_procedures` |
| `trg_protect_vehicle_status_and_mileage` | vehicles | BEFORE UPDATE OF `status`, `current_mileage` | proteção do veículo | `183000_fix_qa_round1` |
| `trg_block_vehicle_in_use_on_insert` | vehicles | BEFORE INSERT | proteção do veículo | `184000_block_vehicle_in_use_on_insert` |
| `trg_audit_trip_changes` | trips | AFTER INSERT OR UPDATE OR DELETE | auditoria | `186000_concurrency_and_procedures` (função) |
| `trg_audit_refueling_changes` | refuelings | AFTER INSERT OR UPDATE OR DELETE | auditoria | `186000_concurrency_and_procedures` (função) |
| `trg_audit_incident_changes` | incidents | AFTER INSERT OR UPDATE OR DELETE | auditoria | `186000_concurrency_and_procedures` (função) |
| `trg_block_audit_logs_changes` | audit_logs | BEFORE UPDATE OR DELETE | proteção do log (append-only) | `186000_concurrency_and_procedures` |

> Em `information_schema.triggers` aparecem 26 linhas, porque essa view conta um trigger uma vez **por evento** (INSERT, UPDATE, DELETE). Para contar triggers de verdade use `pg_trigger`.

### 6.1 Invariante: veículo `IN_USE` <=> existe viagem ativa

**Regra:** um veículo está `IN_USE` se, e somente se, existe pelo menos uma viagem dele `PLANNED` ou `IN_PROGRESS`. Quem garante:

- `create_trip` reserva o veículo (`IN_USE`); `end_trip` e `cancel_trip` liberam (`AVAILABLE`), sem mexer em `IN_MAINTENANCE`/`OUT_OF_SERVICE`.
- `trg_sync_vehicle_from_trip` refaz a conta depois de qualquer INSERT/DELETE/UPDATE de status, veículo ou `end_km` na viagem: com viagem ativa, `AVAILABLE` vira `IN_USE`; sem viagem ativa, `IN_USE` volta a `AVAILABLE`. Também copia o `end_km` da viagem `COMPLETED` para `current_mileage` (nunca diminui), inclusive quando só o `end_km` é corrigido. Isso cobre viagem apagada, cancelada por UPDATE direto ou trocada de veículo.
- `trg_sync_vehicle_mileage_from_refueling` faz o mesmo para abastecimentos: um INSERT/UPDATE direto em `refuelings` (sem passar por `register_refueling`) também empurra `current_mileage` para cima, nunca para baixo.
- `trg_protect_vehicle_status_and_mileage` impede o caminho inverso: não deixa gravar `IN_USE` sem viagem ativa, não deixa tirar um veículo com viagem ativa de `IN_USE` (ex.: mandá-lo para manutenção) e não deixa a `current_mileage` diminuir.
- `trg_block_vehicle_in_use_on_insert` impede criar um veículo já como `IN_USE`.
- `trg_prevent_vehicle_in_maintenance_from_trip` barra viagem ativa para veículo `IN_USE`, `IN_MAINTENANCE` ou `OUT_OF_SERVICE` (no INSERT, ao trocar de veículo ou ao reativar uma viagem inativa). `create_trip` insere a viagem **antes** de marcar `IN_USE`, por isso o fluxo normal passa.

Consequência para o back-end: nunca grave `IN_USE` no veículo; para mandar um veículo para manutenção, finalize ou cancele a viagem ativa antes.

### 6.2 Validação de Regra de Negócio (Layer 1)

**Por que advisory lock nos triggers de viagem dupla:** o `EXISTS` do trigger só enxerga viagens já confirmadas (commit). Se duas sessões criarem viagem para o mesmo motorista (ou veículo) ao mesmo tempo, as duas rodam o `EXISTS`, nenhuma vê a outra, e as duas inserem. Para evitar isso, cada trigger chama antes `pg_advisory_xact_lock(hashtextextended(<id>::text, <semente>))` (semente 1 para motorista, 2 para veículo, para as chaves não colidirem). A segunda sessão **espera** a primeira terminar (o lock é liberado no commit/rollback) e só então roda o `EXISTS`, já vendo a viagem gravada, e falha com `Driver already has an active trip` / `Vehicle already has an active trip`. Um índice único parcial resolveria sem lock, mas o Prisma não o representa no schema (seção 4.2), por isso a regra ficou no trigger.

#### **Trigger: prevent_vehicle_in_maintenance_from_trip**
Barra viagem ativa para veículo que não esteja livre (`IN_USE`, `IN_MAINTENANCE` ou `OUT_OF_SERVICE`). O nome foi mantido por compatibilidade com o guia. Em UPDATE só confere se a viagem trocou de veículo ou estava inativa (reativação).

```sql
CREATE TRIGGER trg_prevent_vehicle_in_maintenance_from_trip
BEFORE INSERT OR UPDATE OF fk_vehicle_id, status ON trips
FOR EACH ROW
WHEN (NEW.status IN ('PLANNED', 'IN_PROGRESS'))
EXECUTE FUNCTION fn_prevent_vehicle_in_maintenance_from_trip();

CREATE OR REPLACE FUNCTION fn_prevent_vehicle_in_maintenance_from_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vehicle_status "VehicleStatus";
BEGIN
  -- Em UPDATE só confere se trocou de veículo ou se a viagem estava inativa (reativação)
  IF TG_OP = 'UPDATE' THEN
    IF NEW.fk_vehicle_id = OLD.fk_vehicle_id AND OLD.status IN ('PLANNED', 'IN_PROGRESS') THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT v.status INTO v_vehicle_status FROM vehicles v WHERE v.id_vehicle = NEW.fk_vehicle_id;

  IF v_vehicle_status IN ('IN_MAINTENANCE', 'OUT_OF_SERVICE', 'IN_USE') THEN
    RAISE EXCEPTION 'Vehicle is not available (maintenance, out of service, or already in use)';
  END IF;

  RETURN NEW;
END;
$$;
```

#### **Trigger: prevent_driver_double_active_trip**
Motorista não pode ter duas viagens ativas (ignora a própria linha). Usa advisory lock (semente 1) contra corrida.

```sql
CREATE TRIGGER trg_prevent_driver_double_active_trip
BEFORE INSERT OR UPDATE OF status, fk_driver_id ON trips
FOR EACH ROW
WHEN (NEW.status IN ('PLANNED', 'IN_PROGRESS'))
EXECUTE FUNCTION fn_prevent_driver_double_active_trip();

CREATE OR REPLACE FUNCTION fn_prevent_driver_double_active_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Chave da trava do motorista (semente 1, diferente da do veículo)
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.fk_driver_id::text, 1));

  IF EXISTS (
    SELECT 1 FROM trips t
    WHERE t.fk_driver_id = NEW.fk_driver_id
      AND t.status IN ('PLANNED', 'IN_PROGRESS')
      AND t.id_trip <> NEW.id_trip
  ) THEN
    RAISE EXCEPTION 'Driver already has an active trip';
  END IF;

  RETURN NEW;
END;
$$;
```

#### **Trigger: prevent_vehicle_double_active_trip**
Veículo não pode ter duas viagens ativas (ignora a própria linha). Usa advisory lock (semente 2) contra corrida.

```sql
CREATE TRIGGER trg_prevent_vehicle_double_active_trip
BEFORE INSERT OR UPDATE OF status, fk_vehicle_id ON trips
FOR EACH ROW
WHEN (NEW.status IN ('PLANNED', 'IN_PROGRESS'))
EXECUTE FUNCTION fn_prevent_vehicle_double_active_trip();

CREATE OR REPLACE FUNCTION fn_prevent_vehicle_double_active_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Chave da trava do veículo (semente 2, diferente da do motorista)
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.fk_vehicle_id::text, 2));

  IF EXISTS (
    SELECT 1 FROM trips t
    WHERE t.fk_vehicle_id = NEW.fk_vehicle_id
      AND t.status IN ('PLANNED', 'IN_PROGRESS')
      AND t.id_trip <> NEW.id_trip
  ) THEN
    RAISE EXCEPTION 'Vehicle already has an active trip';
  END IF;

  RETURN NEW;
END;
$$;
```

#### **Trigger: validate_trip_kilometers**
Quilometragens da viagem: nunca negativas e fim nunca menor que o início.

```sql
CREATE TRIGGER trg_validate_trip_kilometers
BEFORE INSERT OR UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION fn_validate_trip_kilometers();

CREATE OR REPLACE FUNCTION fn_validate_trip_kilometers()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.start_km < 0 THEN
    RAISE EXCEPTION 'Start kilometers cannot be negative';
  END IF;

  IF NEW.end_km IS NOT NULL AND NEW.end_km < 0 THEN
    RAISE EXCEPTION 'End kilometers cannot be negative';
  END IF;

  IF NEW.end_km IS NOT NULL AND NEW.end_km < NEW.start_km THEN
    RAISE EXCEPTION 'End kilometers cannot be less than start kilometers';
  END IF;

  RETURN NEW;
END;
$$;
```

### 6.3 Sincronia e Proteção do Veículo

#### **Trigger: sync_vehicle_from_trip**
Depois de mexer em uma viagem (status, veículo ou `end_km`), recalcula o status do veículo (regra da seção 6.1) e copia o `end_km` da viagem concluída para `current_mileage`. Roda como `SECURITY DEFINER`. O trigger é da migration `20260921186000_concurrency_and_procedures` (passou a disparar também em `UPDATE OF end_km`); a função é da `20260921183000_fix_qa_round1`.

```sql
CREATE TRIGGER trg_sync_vehicle_from_trip
AFTER INSERT OR DELETE OR UPDATE OF status, fk_vehicle_id, end_km ON trips
FOR EACH ROW
EXECUTE FUNCTION fn_sync_vehicle_from_trip();

CREATE OR REPLACE FUNCTION fn_sync_vehicle_from_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vehicle_ids UUID[];
  v_vehicle_id UUID;
BEGIN
  -- Veículos afetados: o novo e, se mudou de veículo, o antigo também
  IF TG_OP = 'INSERT' THEN
    v_vehicle_ids := ARRAY[NEW.fk_vehicle_id];
  ELSIF TG_OP = 'DELETE' THEN
    v_vehicle_ids := ARRAY[OLD.fk_vehicle_id];
  ELSE
    v_vehicle_ids := ARRAY[NEW.fk_vehicle_id, OLD.fk_vehicle_id];
  END IF;

  -- Viagem concluída: a quilometragem final vai para o veículo (nunca diminui)
  IF TG_OP <> 'DELETE' THEN
    IF NEW.status = 'COMPLETED' AND NEW.end_km IS NOT NULL THEN
      UPDATE vehicles
      SET current_mileage = NEW.end_km, updated_at = NOW()
      WHERE id_vehicle = NEW.fk_vehicle_id AND current_mileage < NEW.end_km;
    END IF;
  END IF;

  FOREACH v_vehicle_id IN ARRAY v_vehicle_ids LOOP
    IF EXISTS (
      SELECT 1 FROM trips t
      WHERE t.fk_vehicle_id = v_vehicle_id AND t.status IN ('PLANNED', 'IN_PROGRESS')
    ) THEN
      UPDATE vehicles SET status = 'IN_USE', updated_at = NOW()
      WHERE id_vehicle = v_vehicle_id AND status = 'AVAILABLE';
    ELSE
      UPDATE vehicles SET status = 'AVAILABLE', updated_at = NOW()
      WHERE id_vehicle = v_vehicle_id AND status = 'IN_USE';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;
```

#### **Trigger: sync_vehicle_mileage_from_refueling**
Depois de INSERT/UPDATE de `mileage` ou `fk_vehicle_id` em `refuelings`, sobe a `current_mileage` do veículo se a do abastecimento for maior. Roda como `SECURITY DEFINER`.

```sql
CREATE TRIGGER trg_sync_vehicle_mileage_from_refueling
AFTER INSERT OR UPDATE OF mileage, fk_vehicle_id ON refuelings
FOR EACH ROW
EXECUTE FUNCTION fn_sync_vehicle_mileage_from_refueling();

CREATE OR REPLACE FUNCTION fn_sync_vehicle_mileage_from_refueling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- A quilometragem do veículo só sobe (o trigger de proteção impede descer)
  UPDATE vehicles
  SET current_mileage = NEW.mileage, updated_at = NOW()
  WHERE id_vehicle = NEW.fk_vehicle_id AND current_mileage < NEW.mileage;

  RETURN NULL;
END;
$$;
```

#### **Trigger: protect_vehicle_status_and_mileage**
Protege `vehicles`: `current_mileage` nunca diminui e `IN_USE` só existe com viagem ativa.

```sql
CREATE TRIGGER trg_protect_vehicle_status_and_mileage
BEFORE UPDATE OF status, current_mileage ON vehicles
FOR EACH ROW
EXECUTE FUNCTION fn_protect_vehicle_status_and_mileage();

CREATE OR REPLACE FUNCTION fn_protect_vehicle_status_and_mileage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_active_trip BOOLEAN;
BEGIN
  IF NEW.current_mileage < OLD.current_mileage THEN
    RAISE EXCEPTION 'Mileage cannot decrease';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT EXISTS (
      SELECT 1 FROM trips t
      WHERE t.fk_vehicle_id = NEW.id_vehicle AND t.status IN ('PLANNED', 'IN_PROGRESS')
    ) INTO v_has_active_trip;

    IF v_has_active_trip AND NEW.status <> 'IN_USE' THEN
      RAISE EXCEPTION 'Vehicle has an active trip: end or cancel it first';
    END IF;

    IF NOT v_has_active_trip AND NEW.status = 'IN_USE' THEN
      RAISE EXCEPTION 'IN_USE is set only by trips';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
```

#### **Trigger: block_vehicle_in_use_on_insert**
Veículo não pode nascer `IN_USE`; `AVAILABLE`, `IN_MAINTENANCE` e `OUT_OF_SERVICE` continuam permitidos na criação.

```sql
CREATE TRIGGER trg_block_vehicle_in_use_on_insert
BEFORE INSERT ON vehicles
FOR EACH ROW
EXECUTE FUNCTION fn_block_vehicle_in_use_on_insert();

CREATE OR REPLACE FUNCTION fn_block_vehicle_in_use_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'IN_USE' THEN
    RAISE EXCEPTION 'IN_USE is set only by trips';
  END IF;

  RETURN NEW;
END;
$$;
```

### 6.4 Auditoria (Layer 2)

Três triggers `AFTER INSERT OR UPDATE OR DELETE` gravam em `audit_logs` (`entity_type` = `TRIP`, `REFUELING` ou `INCIDENT`; `action` = `CREATE`, `UPDATE` ou `DELETE`; `old_values`/`new_values` em JSON via `to_jsonb`). As três funções têm a mesma estrutura, mudando só a tabela, o `entity_type` e a coluna de id (`id_trip`, `id_refueling`, `id_incident`). Só `trips`, `refuelings` e `incidents` são auditadas.

- **UPDATE sem mudança real não gera log:** se, ignorando `updated_at`, a linha nova é igual à antiga (`(to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at')`), o trigger sai sem gravar. Assim as procedures que só "regularizam" o veículo (mesmo status) não poluem o log.
- **`audit_logs` é append-only:** `trg_block_audit_logs_changes` (BEFORE UPDATE OR DELETE) lança `audit_logs is append-only`. Só INSERT é permitido.

**Quem fez a alteração (`fk_user_id` do log):**

1. O trigger lê `current_setting('app.current_user_id', true)`. Se o aplicativo gravou o id do usuário logado nessa configuração, ele é usado.
2. Se a configuração não existir ou estiver vazia, cai para o `fk_user_id` da própria linha (quem criou a viagem/abastecimento/incidente; em DELETE, o da linha antiga).

**O que o aplicativo deve fazer:** dentro da **mesma transação** da operação, antes de chamar a procedure ou fazer o INSERT/UPDATE, executar:

```sql
SELECT set_config('app.current_user_id', '<uuid-do-usuario-logado>', true);
```

O terceiro argumento `true` (`is_local`) faz o valor valer só até o fim da transação; fora de transação ele se perde entre as chamadas (principalmente com pool de conexões). Sem esse passo o sistema continua funcionando, mas um UPDATE feito por outra pessoa fica registrado em nome de quem criou a linha. Exemplo de uso no service (Prisma):

```typescript
await this.prisma.$transaction(async (transacao) => {
  await transacao.$executeRaw`SELECT set_config('app.current_user_id', ${usuarioId}, true)`;
  // ...chamar a procedure ou fazer o UPDATE aqui, usando "transacao"
});
```

Se a gravação do log falhar por qualquer motivo, o `EXCEPTION WHEN OTHERS` relança `Audit failed: <motivo>` e a operação inteira é desfeita (auditoria nunca fica de fora).

#### **Trigger: audit_trip_changes**
Auditoria de viagens. `audit_refueling_changes` (tabela `refuelings`) e `audit_incident_changes` (tabela `incidents`) são idênticos, trocando `TRIP`/`id_trip`; os triggers deles:

```sql
CREATE TRIGGER trg_audit_trip_changes
AFTER INSERT OR UPDATE OR DELETE ON trips
FOR EACH ROW
EXECUTE FUNCTION fn_audit_trip_changes();

CREATE OR REPLACE FUNCTION fn_audit_trip_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- UPDATE sem mudança real (só updated_at) não gera log
    IF (to_jsonb(OLD) - 'updated_at') = (to_jsonb(NEW) - 'updated_at') THEN
      RETURN NEW;
    END IF;
  END IF;

  v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::uuid;

  IF TG_OP = 'INSERT' THEN
    IF v_user_id IS NULL THEN
      v_user_id := NEW.fk_user_id;
    END IF;
    INSERT INTO audit_logs (id_audit_log, entity_type, entity_id, action, fk_user_id, old_values, new_values)
    VALUES (gen_random_uuid(), 'TRIP', NEW.id_trip, 'CREATE', v_user_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_user_id IS NULL THEN
      v_user_id := NEW.fk_user_id;
    END IF;
    INSERT INTO audit_logs (id_audit_log, entity_type, entity_id, action, fk_user_id, old_values, new_values)
    VALUES (gen_random_uuid(), 'TRIP', NEW.id_trip, 'UPDATE', v_user_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  END IF;

  IF v_user_id IS NULL THEN
    v_user_id := OLD.fk_user_id;
  END IF;
  INSERT INTO audit_logs (id_audit_log, entity_type, entity_id, action, fk_user_id, old_values, new_values)
  VALUES (gen_random_uuid(), 'TRIP', OLD.id_trip, 'DELETE', v_user_id, to_jsonb(OLD), NULL);
  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Audit failed: %', SQLERRM;
END;
$$;
```

```sql
CREATE TRIGGER trg_audit_refueling_changes
AFTER INSERT OR UPDATE OR DELETE ON refuelings
FOR EACH ROW
EXECUTE FUNCTION fn_audit_refueling_changes();

CREATE TRIGGER trg_audit_incident_changes
AFTER INSERT OR UPDATE OR DELETE ON incidents
FOR EACH ROW
EXECUTE FUNCTION fn_audit_incident_changes();
```

#### **Trigger: block_audit_logs_changes**
Torna `audit_logs` só de inserção: qualquer UPDATE ou DELETE falha.

```sql
CREATE TRIGGER trg_block_audit_logs_changes
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION fn_block_audit_logs_changes();

CREATE OR REPLACE FUNCTION fn_block_audit_logs_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;
```

### 6.5 Important Notes

- **Nunca** usar auditoria para lógica de negócio crítica
- Auditoria é **APPEND-ONLY**, nunca deletar (o banco bloqueia UPDATE/DELETE em `audit_logs`)
- Trigger de auditoria **deve sempre suceder** (ou a operação inteira falha)
- `SECURITY DEFINER` nas procedures e nas funções que escrevem em outras tabelas (`fn_sync_vehicle_from_trip`, `fn_sync_vehicle_mileage_from_refueling` e as de auditoria)
- O `EXECUTE` de `PUBLIC` foi revogado das funções de trigger (seção 5.4)
- Os triggers são a última barreira; as procedures já validam antes, então a mensagem de erro normalmente vem da procedure (tabela da seção 5.3)
- Se dropar tabela, limpe os triggers/functions dela na mesma migration (ver seção 16.1)

---

## 7. Autenticação e Autorização

Código em `src/auth/` (`JwtAuthGuard`, `ApiKeyGuard`, `RolesGuard`, decorators, `AuthService`) e `prisma/seed.ts`. Passo a passo em `2025-01-FROTA-IMPLEMENTATION.md`, Tasks 3.2 a 3.4.

A autenticação tem duas camadas, cada uma para uma parte do fluxo:
1. **X-API-KEY** — só para `signup`, `login` e `regenerate-key`, em `src/auth/`. É o que identifica o dono da chave antes de emitir o JWT.
2. **JWT** — para todo o resto da API, **e também** para `POST /auth/refresh-token` (Seção 7.1 descreve o token; 7.1a cobre as rotas com X-API-KEY e o refresh; 7.2 a 7.4 continuam valendo sem mudança).

> **Não confunda as duas rotas de renovação:** `POST /auth/refresh-token` troca o **JWT** (usa `Authorization: Bearer`, exige um token ainda válido) e `PATCH /auth/regenerate-key` troca a **API key** (usa `x-api-key`). São credenciais diferentes, cada uma com sua rota — ver 7.1a.

> **O login antigo (só e-mail/senha, sem X-API-KEY, aberto ao público) foi removido.** `AuthService.login` não existe mais no código; o único jeito de logar é `POST /auth/login` com o header `x-api-key`, descrito em 7.1a.

### 7.1 JWT

- Secret: variável de environment `JWT_SECRET`, lida pela config validada (`jwt.secret`), nunca direto de `process.env`
- Expiração: `JWT_EXPIRATION`, **número + unidade** (ex.: `1h`, `30m`, `7d`, `3600s`). O `validateConfig` valida por regex e o app **não sobe** com outro formato (um número puro viraria milissegundos)
- Payload do token (`JwtPayload`): `{ sub (userId), email, roleId, iat, exp }`; `iat` e `exp` são do padrão JWT
- Algoritmo: HS256 (padrão do `@nestjs/jwt`)
- O token vai no header `Authorization: Bearer <token>`
- `JwtStrategy.validate` devolve o `UsuarioLogado` = `{ userId, email, roleId }`, que vira `request.user` (e é o que `@CurrentUser()` entrega). **Não** é o `JwtPayload`: lá o id se chama `sub`, aqui `userId`
- O `JwtAuthGuard` responde 401 `Invalid or expired token` para token ausente, inválido ou expirado
- 400: corpo inválido ou com campo extra em qualquer rota (o `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` e `transform`)

### 7.1a X-API-KEY (signup, login, regenerate-key) e refresh do JWT

Código: `guards/api-key.guard.ts` (`ApiKeyGuard`), `utils/api-key.util.ts` (`gerarApiKey`, `calcularHashApiKey`), DTOs `signup.dto.ts`, `signup-response.dto.ts`, `login-with-api-key.dto.ts`, `regenerate-api-key-response.dto.ts`; a lógica fica em `AuthService` (`signup`, `loginWithApiKey`, `regenerateApiKey`, `validateApiKey`, `generateApiKey`, `registrarUsoDaApiKey`).

**Formato da chave:** 32 bytes aleatórios (`crypto.randomBytes`) em hexadecimal — 64 caracteres `[0-9a-f]`. O banco (`users.api_key`) guarda só o **hash SHA-256** da chave (também 64 hex, `calcularHashApiKey`); a chave em texto puro nunca é persistida, só aparece uma vez na resposta HTTP de `signup` e de `regenerate-key`. Colunas: `api_key` (hash, único), `api_key_created_at`, `api_key_last_used_at` (atualizada a cada requisição autenticada pelo guard). Migration: `prisma/migrations/20260921187000_add_api_key_to_users/migration.sql`, com o CHECK `ck_users_api_key_hash` garantindo o formato do hash.

**`POST /auth/signup`** — pública, sem guard. Corpo (`SignupDto`): `{ email, password, fullName }`. **Não aceita `roleId`**: todo cadastro público entra como `DRIVER`, papel definido no servidor (campo extra no corpo é rejeitado pelo `ValidationPipe`). Resposta 201, com `Cache-Control: no-store` (a chave não pode ficar em cache): `{ userId, apiKey, email, message }`. E-mail duplicado → 409.

**`POST /auth/login`** — exige header `x-api-key` (validado pelo `ApiKeyGuard`). Corpo (`LoginWithApiKeyDto`, mesmos campos do `LoginDto`): `{ email, password }`. A chave do header precisa ser do **mesmo usuário** do e-mail/senha do corpo, senão 401. Resposta 200: `{ accessToken, user: { id, email, fullName, role } }`.
- O e-mail é normalizado (`trim().toLowerCase()`)
- A senha é conferida com `bcrypt.compare` (assíncrono); se o e-mail não existe, compara com um hash falso, para o tempo de resposta não revelar quais e-mails existem
- 401 `Invalid credentials`: mensagem única para e-mail errado, senha errada **ou** chave de outro usuário — não revela qual dos três falhou

**`PATCH /auth/regenerate-key`** — exige `x-api-key`. Sem corpo. Resposta 200, com `Cache-Control: no-store`: `{ newApiKey, message }`. Gravar o novo hash já invalida a chave antiga na hora (não existe janela em que as duas funcionam).

**`POST /auth/refresh-token`** — exige JWT válido (`JwtAuthGuard`, `Authorization: Bearer <token>`; **não** usa `x-api-key`). Sem corpo. Confirma de novo que a conta ainda existe e está ativa (`AuthService.refreshToken`, mesma checagem da `JwtStrategy`, repetida por ser uma ação sensível) e devolve um JWT novo com a mesma carga (`sub`, `email`, `roleId`) e prazo renovado (`JWT_EXPIRATION`). Resposta 200, com `Cache-Control: no-store`: mesmo formato de `login`, `LoginResponseDto` (`{ accessToken, user: { id, email, fullName, role } }`). Não existe refresh token separado (nem cookie): o cliente troca o Bearer atual, ainda válido, por um novo antes que expire. Token ausente/inválido/expirado, ou dono do token inativo/apagado → 401 `Invalid or expired token`. Limite: 5 chamadas/min (`@Throttle`), igual às demais rotas de `auth`.
- **Diferença para `PATCH /auth/regenerate-key`:** `refresh-token` troca o **JWT** (sessão de 1h) usando o próprio JWT como credencial; `regenerate-key` troca a **API key** (credencial de login) usando a API key atual. Uma não afeta a outra — renovar o JWT não gera uma API key nova, e trocar a API key não invalida os JWTs já emitidos (eles seguem valendo até expirar).

**`ApiKeyGuard`** (usado em `login` e `regenerate-key`; `signup` não tem guard):
1. Header `x-api-key` ausente → 401 `API key required`
2. Header com formato errado (não é string única de 64 hex) → 401 `Invalid API key`, sem consultar o banco
3. Hash não encontrado no banco → 401 `Invalid API key`
4. Usuário encontrado mas `isActive = false` → 403 `User account is inactive`
5. Chave válida → registra `apiKeyLastUsedAt` e popula `request.user` com `UsuarioLogado`

**Seed:** o admin do seed recebe uma chave a partir de `ADMIN_API_KEY` (variável de `.env`, 64 hex; `.env.example` traz `ADMIN_API_KEY=""` comentada).

### 7.2 Permissions Matrix

O que o seed cria **de fato** (`prisma/seed.ts`): **29 permissions**, **3 roles** e **62 vínculos** (DRIVER 10, FLEET_MANAGER 23, ADMIN 29). O seed é idempotente (`upsert`) e cria o usuário `admin@fleet.com`.

**Permissions (29):** `TRIP_CREATE`, `TRIP_VIEW_OWN`, `TRIP_VIEW_ALL`, `TRIP_CANCEL_OWN`, `REFUELING_CREATE`, `REFUELING_VIEW_OWN`, `REFUELING_VIEW_ALL`, `INCIDENT_CREATE`, `INCIDENT_VIEW_OWN`, `INCIDENT_VIEW_ALL`, `DRIVER_VIEW`, `DRIVER_CREATE`, `DRIVER_UPDATE`, `VEHICLE_VIEW`, `VEHICLE_CREATE`, `VEHICLE_UPDATE`, `MAINTENANCE_VIEW_ALL`, `MAINTENANCE_CREATE`, `MAINTENANCE_UPDATE`, `ANALYTICS_VIEW`, `PROFILE_VIEW`, `PROFILE_UPDATE_OWN`, `PASSWORD_CHANGE_OWN`, `USER_CREATE`, `USER_UPDATE`, `USER_DELETE`, `ROLE_MANAGE`, `PERMISSION_MANAGE`, `AUDIT_VIEW`.

**DRIVER (10):**
- `TRIP_CREATE`
- `TRIP_VIEW_OWN`
- `TRIP_CANCEL_OWN`
- `REFUELING_CREATE`
- `REFUELING_VIEW_OWN`
- `INCIDENT_CREATE`
- `INCIDENT_VIEW_OWN`
- `PROFILE_VIEW`
- `PROFILE_UPDATE_OWN`
- `PASSWORD_CHANGE_OWN`

**FLEET_MANAGER (23):**
- `TRIP_CREATE`
- `TRIP_VIEW_OWN`
- `TRIP_CANCEL_OWN`
- `REFUELING_CREATE`
- `REFUELING_VIEW_OWN`
- `INCIDENT_CREATE`
- `INCIDENT_VIEW_OWN`
- `PROFILE_VIEW`
- `PROFILE_UPDATE_OWN`
- `PASSWORD_CHANGE_OWN`
- `DRIVER_VIEW`
- `DRIVER_CREATE`
- `DRIVER_UPDATE`
- `VEHICLE_VIEW`
- `VEHICLE_CREATE`
- `VEHICLE_UPDATE`
- `TRIP_VIEW_ALL`
- `REFUELING_VIEW_ALL`
- `INCIDENT_VIEW_ALL`
- `MAINTENANCE_VIEW_ALL`
- `MAINTENANCE_CREATE`
- `MAINTENANCE_UPDATE`
- `ANALYTICS_VIEW`

**ADMIN (29):**
- `TRIP_CREATE`
- `TRIP_VIEW_OWN`
- `TRIP_VIEW_ALL`
- `TRIP_CANCEL_OWN`
- `REFUELING_CREATE`
- `REFUELING_VIEW_OWN`
- `REFUELING_VIEW_ALL`
- `INCIDENT_CREATE`
- `INCIDENT_VIEW_OWN`
- `INCIDENT_VIEW_ALL`
- `DRIVER_VIEW`
- `DRIVER_CREATE`
- `DRIVER_UPDATE`
- `VEHICLE_VIEW`
- `VEHICLE_CREATE`
- `VEHICLE_UPDATE`
- `MAINTENANCE_VIEW_ALL`
- `MAINTENANCE_CREATE`
- `MAINTENANCE_UPDATE`
- `ANALYTICS_VIEW`
- `PROFILE_VIEW`
- `PROFILE_UPDATE_OWN`
- `PASSWORD_CHANGE_OWN`
- `USER_CREATE`
- `USER_UPDATE`
- `USER_DELETE`
- `ROLE_MANAGE`
- `PERMISSION_MANAGE`
- `AUDIT_VIEW`

> Esta matriz é a que o próprio seed monta (o `FLEET_MANAGER` tem tudo do DRIVER mais 13 permissões; o `ADMIN` recebe **todas** as 29). O seed também apaga os códigos obsoletos de versões antigas (`TRIP_UPDATE`, `INCIDENT_UPDATE`, `MAINTENANCE_VIEW`, `TRIP_CANCEL`), com os vínculos deles.

O `RolesGuard` só considera as permissões do **papel** (`RolePermission`). A tabela `UserPermission` (permissões extras por usuário) existe no schema, mas o guard ainda não a consulta.

### 7.3 Guards e Decorators

```typescript
// Os dois guards juntos: primeiro autentica (401), depois autoriza (403)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trips')
export class TripsController {
  // Papel exigido E ao menos uma das permissões listadas
  @Roles('FLEET_MANAGER', 'ADMIN')
  @Permissions('TRIP_VIEW_ALL')
  @Get()
  listar(@CurrentUser() usuario: UsuarioLogado) {
    // usuario = { userId, email, roleId }  (NÃO é o JwtPayload, que tem sub/iat/exp)
    // Para "só as minhas viagens", filtre por usuario.userId
  }
}
```

- Os nomes de papel e de permissão são **strings** iguais às do seed (`'ADMIN'`, `'TRIP_VIEW_ALL'`); não existem enums `Role`/`Permission` no código.
- `@Roles(...)` e `@Permissions(...)` sem nenhum argumento lançam `Error` ao decorar (o app não sobe), para não deixar uma rota "protegida" sem proteção por esquecimento.
- `@CurrentUser() usuario: UsuarioLogado` devolve o `request.user` preenchido pelo `JwtAuthGuard`. Use `usuario.userId` para operações pessoais (nunca um id vindo do body).

**Comportamento do `RolesGuard`** (`src/auth/guards/roles.guard.ts`):
1. Lê `@Roles` e `@Permissions` do método e, se não achar, da classe (`getAllAndOverride`). Sem nenhum dos dois, a rota passa.
2. Sem `request.user`: 403 `User not found in request`.
3. `roleId` que não seja um UUID: 403 `Invalid user role` (sem esse teste o Prisma ignoraria o filtro inválido e liberaria tudo).
4. Se há `@Roles`: o nome do papel do usuário precisa estar na lista, senão 403 `Insufficient role`.
5. Se há `@Permissions`: o papel precisa ter **ao menos uma** das permissões listadas (`RolePermission`), senão 403 `Insufficient permissions`.
6. Com os dois decoradores, as duas condições valem (papel **E** permissão).

### 7.4 Seed

- Comando: `npm run seed` (`ts-node prisma/seed.ts`); precisa do banco com as migrations aplicadas.
- Cria/atualiza (`upsert`, pode rodar de novo sem duplicar): 29 permissions, 3 roles, 62 vínculos e o admin. Remove as permissions obsoletas (`TRIP_UPDATE`, `INCIDENT_UPDATE`, `MAINTENANCE_VIEW`, `TRIP_CANCEL`).
- Admin: e-mail de `ADMIN_EMAIL` (normalizado para minúsculas) e senha de `ADMIN_INITIAL_PASSWORD`, com hash bcrypt (custo 10). Fora de produção, os padrões do guia são `admin@fleet.com` e `Admin@123`. Com `NODE_ENV=production`, as duas variáveis são **obrigatórias** (sem elas o seed falha). Uma segunda execução **não** troca a senha de um admin existente.
- O seed usa o client gerado com `PrismaPg`; o `ts-node` só o resolve porque o generator do `schema.prisma` tem `importFileExtension = ""`.
- Saída esperada: `Seeded 29 permissions`, `Seeded 3 roles`, `Removed obsolete permissions (if any): 4 codes checked`, `Assigned permissions to roles`, `Admin user ready (...)`, `Seed completed successfully`.

### 7.5 Melhorias futuras (não implementadas)

- `@MaxLength(72)` na senha do login (o bcrypt só usa os 72 primeiros bytes)
- logout (invalidar um JWT antes da expiração natural; hoje não existe blacklist)
- considerar `UserPermission` no `RolesGuard` (a tabela existe no schema, mas o guard só olha `RolePermission`)

> Itens que já saíram desta lista, implementados na rodada de auditoria/correção mais recente: `throttler` (`@nestjs/throttler`, 20/min geral + 5/min em `signup`/`login`/`regenerate-key`/`refresh-token`), `helmet` (com `X-Powered-By` desligado, em `main.ts`), checagem de `isActive` na `JwtStrategy` (401 `User is inactive`) e `POST /auth/refresh-token` (Seção 7.1a).

---

## 8. Upload e Cloud Storage

### 8.1 Upload Local (MVP)

- Pasta: `uploads/incidents/`
- Validações:
  - Presença obrigatória
  - Tamanho máx: 10MB
  - Tipos: JPG, PNG, PDF
- Retornar: URL local ou chave de armazenamento

### 8.2 Cloud Storage (Incremental)

**AWS S3 ou GCP:**
- Usar `@aws-sdk/client-s3` ou `@google-cloud/storage`
- URL pública de acesso
- Chave única para deletar depois
- Timeout: 30s
- Retry: 3 tentativas

---

## 9. Integração Externa (HttpService)

**Status: implementado (Passo 27).** Esta seção descreve o código real; substitui o plano original do guia (que previa coordenadas/Google Maps, campo `locationData` em JSONB e nomes de arquivo diferentes — nada disso foi feito, porque não era necessário).

### 9.1 ViaCEP API — Integração Real (sem mock)

**Endpoint:** `https://viacep.com.br/ws/{cep}/json/` (configurável via `.env`, ver 9.5).

**2 pontos de integração:**
1. **`POST /vehicles`** — campo `initialLocationCep` é **opcional**. Se enviado, o CEP é validado e resolvido; o endereço volta no campo `initialLocation` da resposta, mas **não é persistido** no banco (não existe coluna para isso em `vehicles`).
2. **`POST /trips`** — campos `startLocation` e `endLocation` **exigem** um CEP brasileiro válido (não é mais texto livre). Os dois são resolvidos contra a API real e o texto gravado na viagem é o **endereço resolvido** (`fullAddress`, ex.: `"São Paulo, SP"`), não o CEP em si.

**Response ViaCEP (sucesso, HTTP 200):**
```json
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "complemento": "até 1000",
  "bairro": "Cerqueira César",
  "localidade": "São Paulo",
  "uf": "SP",
  "ibge": "3550308",
  "gia": "1004",
  "ddd": "11",
  "siafi": "7107"
}
```

**Response ViaCEP (não encontrado, HTTP 200 — não é 404):**
```json
{
  "erro": "true"
}
```

> ⚠️ **Pegadinha real da API (achado do dev-backend):** o campo `erro` volta como **STRING `"true"`**, não como booleano `true`. Comparar com `=== true` nunca bate, e o código ficaria sempre achando que o CEP foi encontrado mesmo quando não foi. O serviço (`ViaCepService.buscarPorCep`, `src/external/viacep/via-cep.service.ts`) checa **truthy** (`if (resposta.erro)`), não igualdade estrita — isso cobre tanto a string `"true"` real quanto um eventual booleano, se a API mudar no futuro. Quem for mexer nesse código depois precisa saber disso: um `=== true` aqui é um bug silencioso.

### 9.2 ViaCEP Service — Implementação Real

Arquivos em `src/external/viacep/`:
- `via-cep.service.ts` — `ViaCepService`, injeta `HttpService` (`@nestjs/axios`) e `ConfigService`.
- `dto/via-cep-endereco.dto.ts` — `ViaCepEnderecoDto`, formato de saída já enriquecido (campos da API + `fullAddress`).
- `interfaces/via-cep-resposta.interface.ts` — `ViaCepResposta` (união `ViaCepRespostaSucesso | ViaCepRespostaErro`), a forma crua que a API devolve antes do enriquecimento.
- `via-cep.module.ts` — módulo exporta `ViaCepService`; importado por `VehiclesModule` e `TripsModule`.

```typescript
// src/external/viacep/via-cep.service.ts (trecho real)
async buscarPorCep(cep: string): Promise<ViaCepEnderecoDto> {
  const cepLimpo = this.limparMascara(cep);

  // Formato errado nem chega a sair pra rede: falha rápido, sem esperar timeout.
  if (!/^\d{8}$/.test(cepLimpo)) {
    throw new BadRequestException(
      `CEP inválido: esperado 8 dígitos (ex: 01310-100 ou 01310100), recebido "${cep}"`,
    );
  }

  const resposta = await this.chamarApi(cepLimpo, cep);

  // A API do ViaCEP devolve o campo "erro" como STRING "true" (não boolean
  // true), então checamos truthy em vez de igualdade estrita.
  if (resposta.erro) {
    throw new BadRequestException(`CEP ${cep} não encontrado`);
  }

  return this.enriquecer(resposta);
}

// Tenta buscar o CEP e devolve true/false, sem lançar. Usado pelo validador assíncrono.
async cepEhValido(cep: string): Promise<boolean> {
  try {
    await this.buscarPorCep(cep);
    return true;
  } catch {
    return false;
  }
}
```

`enriquecer()` monta o `fullAddress` como `` `${dados.localidade}, ${dados.uf}` `` — é esse texto (ex.: `"São Paulo, SP"`) que vira `initialLocation.fullAddress` no veículo e `startLocation`/`endLocation` na viagem. Não existe cálculo de coordenadas nem integração com Google Maps — isso era ideia do plano original e não foi implementado (não era exigido).

### 9.3 Validador Assíncrono de CEP

`src/common/validators/is-valid-cep.validator.ts` — `IsValidCep()`, decorator de `class-validator` assíncrono (`@ValidatorConstraint({ async: true })`), injeta o `ViaCepService` de verdade e chama `cepEhValido()`. Campo vazio/`undefined` passa (quem decide obrigatoriedade é `@IsOptional()` no DTO). Usado em:
- `CreateVehicleDto.initialLocationCep` (opcional)
- `CreateTripDto.startLocation` e `CreateTripDto.endLocation` (obrigatórios)

Importante: como é assíncrono e de verdade chama a API do ViaCEP, qualquer erro de rede durante a *validação* (timeout, ViaCEP fora do ar) é capturado pelo `catch` de `cepEhValido()` e vira simplesmente "CEP inválido" (400) — o cliente não recebe 500/504 nesse ponto. Só depois, quando o service (`VehiclesService.criar`/`TripsService.criar`) chama `buscarPorCep()` de novo pra resolver o endereço de verdade, é que um erro de rede vira 500/502/504 (ver 9.4). Na prática isso é raro (o CEP já passou pela validação segundos antes), mas é uma janela real.

### 9.4 Tratamento de Erros — Mapeamento Real

Baseado em `ViaCepService.traduzirErroDeRede` (`src/external/viacep/via-cep.service.ts`):

```
Situação                                          HTTP Status    Exception
──────────────────────────────────────────────────────────────────────────
Formato inválido (não são 8 dígitos)              400            BadRequestException
CEP bem formado mas não encontrado (erro:"true")  400            BadRequestException
Timeout (> CEP_TIMEOUT_MS, padrão 10s)             504            GatewayTimeoutException
Rate limit (429 do ViaCEP)                        504            GatewayTimeoutException
Erro de conexão (ECONNREFUSED/ENOTFOUND/ETIMEDOUT) 500            InternalServerErrorException
ViaCEP com erro de servidor (>= 500)               500            InternalServerErrorException
Erro inesperado                                    500            InternalServerErrorException
```

Diferença do plano original: não existe distinção 503 vs 500 (tudo que é "não deu pra falar com a API" cai em `InternalServerErrorException`, 500), e rate limit também vira 504 (mesma exceção do timeout), não 429.

### 9.5 Configuração via .env

```env
# .env (chaves reais lidas via ConfigService, config namespace "external")
CEP_API_URL=https://viacep.com.br/ws
CEP_TIMEOUT_MS=10000
```

### 9.6 Testes

Testes de integração real (sem mock) contra a API pública do ViaCEP, cobrindo: CEP válido (Vehicle e Trip), CEP mal formatado (400 rápido, sem round-trip de rede), CEP bem formado mas inexistente (400, valida o tratamento do `erro:"true"`), e o contrato novo de `POST /trips` (CEP obrigatório, rejeita texto livre).

---

## 10. Interceptors

### 10.1 Logging Interceptor (implementado)

Código: `src/common/interceptors/logging.interceptor.ts` (`LoggingInterceptor`), registrado global em `app.module.ts` (`{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }`) — roda em toda requisição, não precisa decorar cada controller.

- Uma linha por requisição, no formato `${método} ${rota} ${statusCode} ${duração}ms user=${idUsuário}` (ex.: `GET /vehicles 200 42ms user=b3c1a2e4-...`), via `Logger` do Nest com o contexto `'Requisicao'`.
- `idUsuário` é o `userId` de `request.user` (preenchido pelo `JwtAuthGuard`/`ApiKeyGuard`) quando a rota é autenticada, ou a string `'anonimo'` em rotas públicas (ex.: `POST /auth/signup`).
- Duração medida do início do `intercept` até a resposta (`tap` no `Observable`), em milissegundos.
- **Nunca loga:** corpo da requisição, headers, senha, token JWT ou API key — só os metadados acima. Não existe log separado de "request" antes da resposta; é uma única linha depois que a resposta sai.

### 10.2 Response Transform Interceptor (não implementado)

Ideia original do guia, nunca construída: padronizar toda resposta em `{ data, message, timestamp }`. O projeto não tem esse interceptor — cada controller devolve o DTO de resposta direto (ver seção 14.2 para o formato de erro, que é o único envelope padronizado que existe hoje).

---

## 11. Paginação e Filtros

### 11.1 Query Params

```
GET /trips?page=1&pageSize=20&status=IN_PROGRESS&driverId=<id>&vehicleId=<id>
GET /vehicles?page=1&pageSize=20&status=AVAILABLE
```

Nota: os nomes reais dos query params são `page`/`pageSize` (não `limit`), e não existe `sort` implementado — o plano original previa esses dois, mas a API real só pagina e filtra. `GET /vehicles` também aceita `?status=` (`AVAILABLE`/`IN_USE`/`IN_MAINTENANCE`/`OUT_OF_SERVICE`) — esse filtro estava faltando e foi corrigido no Passo 26.

### 11.2 Response

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 12. Indicadores de Frota (Analytics)

**Status: implementado (Passo 28).** Módulo `src/analytics/` (`AnalyticsController` + `AnalyticsService`), 5 endpoints, todos `GET`, só leitura, `@ApiTags('analytics')`. Acesso: `ADMIN`, `FLEET_MANAGER` (o motorista não enxerga números agregados da frota nem de outros motoristas — o controller inteiro tem `@Roles('ADMIN', 'FLEET_MANAGER')`).

Todas as agregações rodam no banco (SQL puro via `$queryRaw` ou `groupBy`/`aggregate` do Prisma), não em memória.

### 12.1 `GET /analytics/fleet/fuel-consumption`

Consumo médio da frota inteira. Soma litros abastecidos e km rodados em viagens concluídas, em duas subqueries independentes (não um JOIN — `refuelings` e `trips` não têm relação 1-para-1, e somar depois de um JOIN duplicaria valores).

```sql
SELECT
  COALESCE((SELECT SUM(liters_added) FROM refuelings WHERE deleted_at IS NULL), 0) AS "totalLiters",
  COALESCE((SELECT SUM(end_km - start_km) FROM trips
    WHERE status = 'COMPLETED' AND deleted_at IS NULL AND end_km IS NOT NULL), 0) AS "totalKm"
```

Resposta: `{ averageLitersPerKm, totalLiters, totalKm }`. `averageLitersPerKm = totalLiters / totalKm` (0 se `totalKm` for 0, para não dividir por zero).

### 12.2 `GET /analytics/fleet/daily-distance?days=30`

Km rodados por dia, agrupando pelo dia de término (`end_time`) das viagens concluídas nos últimos `days` dias (query opcional, padrão 30).

```sql
SELECT DATE(end_time) AS "date", COALESCE(SUM(end_km - start_km), 0) AS "totalKm"
FROM trips
WHERE status = 'COMPLETED' AND deleted_at IS NULL AND end_km IS NOT NULL
  AND end_time >= NOW() - (INTERVAL '1 day' * ${dias})
GROUP BY DATE(end_time)
ORDER BY DATE(end_time)
```

Resposta: array de `{ date: "AAAA-MM-DD", totalKm }`.

### 12.3 `GET /analytics/vehicle/:id/efficiency`

Indicadores de um veículo específico: km total, litros abastecidos, custo total de combustível, média de litros/km, quantidade de viagens e de incidentes. Confirma que o veículo existe (404 se não); sem nenhuma viagem/abastecimento, devolve tudo zerado (200), o 404 é só para veículo inexistente.

Resposta: `{ vehicleId, totalKm, totalLiters, totalFuelCost, averageLitersPerKm, tripsCount, incidentsCount }`.

### 12.4 `GET /analytics/driver/:id/trips`

Estatísticas de viagens de um motorista: quantidade de viagens por status (`PLANNED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`, todas aparecem mesmo zeradas), km total rodado nas concluídas, quantidade de incidentes envolvendo o motorista. Mesma regra do anterior: 404 só se o motorista não existir.

Resposta: `{ driverId, tripsByStatus: { PLANNED, IN_PROGRESS, COMPLETED, CANCELLED }, totalKmCompleted, incidentsCount }`.

### 12.5 `GET /analytics/incidents/severity?status=REPORTED`

Quantidade de incidentes ativos agrupados por severidade (`LOW`/`MEDIUM`/`HIGH`), com filtro opcional por `status` (`REPORTED`/`UNDER_INVESTIGATION`/`RESOLVED`) aplicado antes do agrupamento.

Resposta: array de `{ severity, count }`.

---

## 13. Auditoria e Logs

### 13.1 Tabela AuditLog

- APPEND-ONLY (nunca delete; o banco bloqueia UPDATE/DELETE)
- Campos: entityType, entityId, action, changedBy, oldValues, newValues, createdAt
- Índices: (entityType, entityId, createdAt)

### 13.2 Quando Registrar

- Toda operação no domínio (CREATE, UPDATE, DELETE)
- Não registrar SELECTs
- Registrar por trigger (automático): `trips`, `refuelings` e `incidents` (seção 6.4); UPDATE sem mudança real (só `updated_at`) não gera log
- O usuário do log vem de `set_config('app.current_user_id', <uuid>, true)` chamado na transação; sem ele, usa `fk_user_id` da linha

---

## 14. Tratamento de Erros

### 14.1 HTTP Status Codes

```
400 Bad Request
  - DTO inválido
  - Validação de negócio (ex: KM inválido)
  
401 Unauthorized
  - Token ausente/expirado
  - Credenciais inválidas
  
403 Forbidden
  - Sem permissão
  - Tentativa de acesso a recurso de terceiro
  
404 Not Found
  - Recurso inexistente
  
409 Conflict
  - Regra de negócio violada (ex: 2 trips ACTIVE, veículo indisponível)
  - Erros das procedures/triggers (P0001) e de CHECK (23514): ver tabelas da seção 5.3
  - Recurso já existe (UNIQUE violation)
  
500 Internal Server Error
  - Erro não tratado
  - Erro do banco
```

### 14.2 Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "startKm",
      "message": "startKm must be a positive integer"
    }
  ],
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 15. Stack e Dependências

### 15.1 Core Stack

- **Runtime:** Node.js 18+
- **Framework:** NestJS 10+
- **Language:** TypeScript 5+
- **Database:** PostgreSQL 15+ (Docker)
- **ORM:** Prisma 7.10.0

### 15.2 Commands for Installation

```bash
# 1. Create NestJS project
nest new fleet-management

# 2. Install core dependencies
npm install \
  @nestjs/core \
  @nestjs/common \
  @nestjs/platform-express \
  @nestjs/config \
  @nestjs/jwt \
  @nestjs/passport \
  @nestjs/swagger \
  passport \
  passport-jwt \
  @prisma/client \
  @prisma/adapter-pg \
  prisma \
  pg \
  bcrypt \
  joi \
  class-validator \
  class-transformer \
  helmet \
  compression \
  axios

# 3. Install dev dependencies
npm install -D \
  @types/node \
  @types/express \
  @types/bcrypt \
  @types/passport-jwt \
  ts-loader \
  ts-node \
  typescript \
  prettier \
  eslint \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser

# 4. Install cloud storage (incremental)
npm install @aws-sdk/client-s3  # OR
npm install @google-cloud/storage

# 5. Install Docker (optional, for local dev)
# macOS: brew install docker
# Windows/Linux: https://www.docker.com/products/docker-desktop

# 6. Install testing libs (optional, for E2E tests)
npm install -D \
  @nestjs/testing \
  jest \
  ts-jest \
  @types/jest \
  supertest \
  @types/supertest
```

### 15.3 Versions to Pin

Versões reais do `package.json` do projeto (Prisma fixado na linha 7.10):

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/core": "^11.0.1",
    "@nestjs/config": "^12.0.0",
    "@nestjs/jwt": "^12.0.2",
    "@nestjs/passport": "^12.0.0",
    "@nestjs/swagger": "^11.4.7",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "bcrypt": "^6.0.0",
    "joi": "^18.2.9",
    "class-validator": "^0.15.1",
    "class-transformer": "^0.5.1",
    "helmet": "^8.3.0",
    "compression": "^1.8.2",
    "axios": "^1.20.0",
    "passport-jwt": "^4.0.1",
    "prisma": "^7.10.0"
  }
}
```

---

## 16. Gaps Anteriores — Mitigação

### 16.1 Gap #1: Trigger Órfão

**Problema anterior:** Migration dropou `visit_audit` table mas trigger `trg_audit_visits` continuava tentando inserir nela.

**Solução neste projeto:**
- ✅ Auditoria em tabela **PERMANENTE** (nunca deletar)
- ✅ Triggers de auditoria apontam sempre para mesma tabela
- ✅ Checklist de validação: se dropar tabela → limpar triggers/functions na mesma migration
- ✅ Teste ponta-a-ponta: aplicar migrations em banco limpo e testar operações

### 16.2 Gap #2: Validações Desincronizadas

**Problema anterior:** Service validava, Procedure validava, Trigger validava (redundante + complexo).

**Solução neste projeto:**
- ✅ Validação em Service (negócio)
- ✅ Validação em Procedure (antes de INSERT/UPDATE)
- ✅ Validação em Trigger (segunda camada, nem sempre)
- ✅ Não duplicar lógica crítica em 3 lugares

### 16.3 Gap #3: Sem Testes em Runtime

**Problema anterior:** `npx prisma validate` passou, mas aplicação quebrou em runtime com trigger órfão.

**Solução neste projeto:**
- ✅ Checklist de validação ponta-a-ponta
- ✅ Testes E2E obrigatórios (10 cenários)
- ✅ Teste de migrações antes de considerar completo

### 16.4 Gap #4: Campos Mortos

**Problema anterior:** `Visitor.cpf` declarado no schema mas nunca usado.

**Solução neste projeto:**
- ✅ Declarar campo APENAS se vai ser usado
- ✅ Revisão de schema vs DTOs/Services

---

## Aprovação

- [x] Seção 1: Visão Geral
- [x] Seção 2: Requisitos e Escopo
- [x] Seção 3: Arquitetura
- [x] Seção 4: Entidades e Relacionamentos
- [x] Seção 5: Procedures PostgreSQL
- [x] Seção 6: Triggers PostgreSQL
- [x] Seção 7: Autenticação e Autorização
- [x] Seção 8: Upload e Cloud Storage
- [x] Seção 9: Integração Externa
- [x] Seção 10: Interceptors
- [x] Seção 11: Paginação e Filtros
- [x] Seção 12: Indicadores de Frota
- [x] Seção 13: Auditoria e Logs
- [x] Seção 14: Tratamento de Erros
- [x] Seção 15: Stack e Dependências
- [x] Seção 16: Gaps Anteriores — Mitigação

**Design Document Aprovado:** ✅ Pronto para Implementation Plan

---

**Próximo Passo:** `/writing-plans` → Implementation Plan Sequenciado

