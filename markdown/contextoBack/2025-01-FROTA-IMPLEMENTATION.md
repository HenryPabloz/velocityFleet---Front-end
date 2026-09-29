# Implementation Plan — Gestão de Frota Corporativa

> **Usar skill superpowers:** `subagent-driven-development` ou `executing-plans` para executar task-by-task

**Goal:** Entregar API funcional, testada ponta-a-ponta, em 5 dias com procedures/triggers sincronizados (evitando gaps anteriores)

**Architecture:** 3 camadas (HTTP → Services → Procedures/Triggers/Database)

**Tech Stack:** NestJS + PostgreSQL + Prisma 7.10.0 + Procedures + Triggers

**Spec:** `2025-01-FROTA-DESIGN.md` (precede este documento)

---

## 🔧 Global Constraints

- **Node.js:** 18+
- **TypeScript:** 5+
- **Prisma:** 7.10.0 (fixado)
- **PostgreSQL:** 15+ (Docker recomendado)
- **JWT Secret:** Via `.env` (nunca em código)
- **Build:** `npm run build` sem erros  
- **Migrations:** Sempre sincronizadas (DROP TABLE → DROP TRIGGER/FUNCTION mesma migration)
- **Auditoria:** Tabela APPEND-ONLY, nunca deletar (o banco bloqueia UPDATE/DELETE em `audit_logs`)

---

## 📊 Fases e Milestones

```
FASE 1: Setup Base (1.5 dias)
  ├─ NestJS + Prisma
  ├─ PostgreSQL (Docker)
  └─ Variáveis de ambiente

FASE 2: Schema + Migrations (1 dia)
  ├─ Tabelas (sem procedures/triggers ainda)
  ├─ Procedures DML
  ├─ Triggers de validação
  └─ Triggers de auditoria

FASE 3: Auth + RBAC (1 dia)
  ├─ JWT + Strategies
  ├─ Guards + Decorators
  ├─ Permissions matrix
  └─ Seed de roles

FASE 4: Resources Principais (1.5 dias)
  ├─ Users, Drivers, Vehicles
  ├─ Trips (ciclo completo)
  ├─ Refuelings
  ├─ Maintenance
  └─ Incidents

FASE 5: Features Avançadas (1 dia)
  ├─ Paginação + Filtros
  ├─ Indicadores de Frota
  ├─ Upload + S3 (incremental)
  ├─ HttpService (CEP)
  └─ Interceptor

TOTAL: ~5 dias
```

---

## ⚠️ Checkpoints de Validação Crítica

Estas validações DEVEM passar antes de passar pra próxima fase:

### Checkpoint A1: Migrações Sincronizadas
- [ ] Rodar `npx prisma migrate deploy` em banco limpo (17 migrations)
- [ ] Verificar que nenhuma operação INSERT/UPDATE em `trips` lança erro de trigger órfão
- [ ] Verificar que `audit_logs` NÃO foi deletada em nenhuma migration (e que só aceita INSERT)
- [ ] Rodar: `SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal;` → 12
- [ ] Rodar: `SELECT COUNT(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace;` → 26

### Checkpoint A2: Procedures Funcionam
- [ ] `CALL create_trip(..., NULL, NULL)` → insere e retorna `id` e `status`
- [ ] `CALL start_trip(..., NULL, NULL, NULL)` → atualiza status
- [ ] `CALL end_trip(..., NULL x6)` → retorna km total
- [ ] `CALL cancel_trip(id, NULL, NULL)` → cancela e libera o veículo
- [ ] `CALL register_refueling(..., NULL, NULL, NULL)` → calcula total_cost
- [ ] `CALL register_incident(..., NULL, NULL, NULL)` → registra com status REPORTED

### Checkpoint A3: Triggers Bloqueiam Corretamente
- [ ] Criar trip com veículo IN_MAINTENANCE → error
- [ ] Criar 2ª trip ativa para o mesmo driver → error (`Driver already has an active trip`)
- [ ] Gravar trip com end_km < start_km → error
- [ ] Criar trip bem-sucedida → cria entry em audit_logs

---

## 📝 Fases Detalhadas

---

# FASE 1: SETUP BASE

---

## Task 1.1: Criar Projeto NestJS

**Duração:** 15 min

**Files:**
- Create: `package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`

**Steps:**

- [ ] **1.1.1: Executar command**

```bash
nest new fleet-management
cd fleet-management
```

**Expected:** Pasta `fleet-management/` com estrutura básica NestJS

- [ ] **1.1.2: Verificar instalação**

```bash
npm run start:dev
```

**Expected:** Aplicação rodando em `http://localhost:3000`, GET `/` retorna "Hello World!"

---

## Task 1.2: Instalar Dependências Core

**Duração:** 10 min

**Files:**
- Modify: `package.json`

**Steps:**

- [ ] **1.2.1: Instalar dependências**

```bash
npm install \
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
```

**Expected:** Todas as dependências em `node_modules/`

- [ ] **1.2.2: Instalar dev dependencies**

```bash
npm install -D \
  @types/node \
  @types/express \
  @types/bcrypt \
  @types/passport-jwt \
  @types/pg \
  ts-loader \
  ts-node \
  typescript \
  prettier \
  eslint \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser
```

**Expected:** Dev dependencies instaladas

- [ ] **1.2.3: Verificar Prisma**

```bash
npx prisma --version
```

**Expected:** Output: `prisma/7.10.0` (exatamente)

---

## Task 1.3: Setup PostgreSQL com Docker

**Duração:** 15 min

**Files:**
- Create: `docker-compose.yml`

**Steps:**

- [ ] **1.3.1: Criar docker-compose.yml**

```yaml

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: root
      POSTGRES_DB: fleet_db
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d fleet_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

- [ ] **1.3.2: Iniciar container**

```bash
docker compose up -d
```

**Expected:** Container `postgres` running, porta 5433 acessível (5432 dentro do container)

- [ ] **1.3.3: Verificar conexão**

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "SELECT 1;"
```

**Expected:** Output: `1` (conexão bem-sucedida)

---

## Task 1.4: Configurar Variáveis de Ambiente

**Duração:** 10 min

**Files:**
- Create: `.env`, `.env.example`
- Create: `src/config/configuration.ts`
- Modify: `src/app.module.ts`

**Steps:**

- [ ] **1.4.1: Criar .env**

```env
# Database (porta 5433 no seu PC; o container usa 5432 por dentro)
DATABASE_URL="postgresql://postgres:root@localhost:5433/fleet_db?schema=public"

# JWT (formato: número + unidade: 1h, 30m, 7d, 3600s; senão o app não sobe)
JWT_SECRET="troque-por-uma-senha-aleatoria-de-32-caracteres"
JWT_EXPIRATION="1h"

# Application
PORT=3000
NODE_ENV=development

# AWS S3 (incremental; pode ficar vazio)
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"
AWS_S3_BUCKET=""

# External APIs
CEP_API_URL="https://viacep.com.br/ws"
CEP_TIMEOUT_MS=10000

# Admin inicial (usado só pelo seed; em NODE_ENV=production os dois são obrigatórios)
ADMIN_EMAIL="admin@fleet.com"
ADMIN_INITIAL_PASSWORD="Admin@123"
```

- [ ] **1.4.2: Criar .env.example**

Mesmas chaves do `.env`, com os segredos vazios (`JWT_SECRET`, `ADMIN_INITIAL_PASSWORD`). O `.env` fica no `.gitignore`.

- [ ] **1.4.3: Criar configuration.ts**

Arquivo: `src/config/configuration.ts` (código real do projeto)
```typescript
import * as joi from 'joi';

// Formato das configurações que o resto do app vai usar.
export interface ConfigVars {
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    expiration: string;
  };
  app: {
    port: number;
    env: string;
  };
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    s3Bucket: string;
  };
  // gcp: {
  //   projectId: string;
  //   keyFile: string;
  // };
  external: {
    cepApiUrl: string;
  };
}

// Confere o .env ao iniciar: se faltar algo obrigatório, o app não sobe.
export function validateConfig(config: Record<string, unknown>): ConfigVars {
  const schema = joi.object({
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    // Aceita número + unidade (ex: 1h, 30m, 7d); número puro viraria milissegundos.
    JWT_EXPIRATION: joi
      .string()
      .pattern(/^\d+\s?(ms|s|m|h|d|w|y)$/i)
      .required()
      .messages({
        'string.pattern.base':
          'JWT_EXPIRATION must be a number followed by a unit (ms, s, m, h, d, w, y), e.g. 1h, 30m, 7d, 3600s',
      }),
    PORT: joi.number().default(3000),
    NODE_ENV: joi.string().default('development'),
    // A AWS é opcional: aceita a variável vazia (AWS_REGION="") no .env.
    AWS_ACCESS_KEY_ID: joi.string().allow('').optional(),
    AWS_SECRET_ACCESS_KEY: joi.string().allow('').optional(),
    AWS_REGION: joi.string().allow('').optional(),
    AWS_S3_BUCKET: joi.string().allow('').optional(),
    // GOOGLE_CLOUD_PROJECT_ID: joi.string().optional(),
    // GOOGLE_CLOUD_KEY_FILE: joi.string().optional(),
    CEP_API_URL: joi.string().default('https://viacep.com.br/ws'),
  });

  const { value, error } = schema.validate(config, { allowUnknown: true });

  if (error) {
    throw new Error(`Config validation failed: ${error.message}`);
  }

  return {
    database: { url: value.DATABASE_URL },
    jwt: { secret: value.JWT_SECRET, expiration: value.JWT_EXPIRATION },
    app: { port: value.PORT, env: value.NODE_ENV },
    aws: {
      accessKeyId: value.AWS_ACCESS_KEY_ID,
      secretAccessKey: value.AWS_SECRET_ACCESS_KEY,
      region: value.AWS_REGION,
      s3Bucket: value.AWS_S3_BUCKET,
    },
    // gcp: {
    //   projectId: value.GOOGLE_CLOUD_PROJECT_ID,
    //   keyFile: value.GOOGLE_CLOUD_KEY_FILE,
    // },
    external: { cepApiUrl: value.CEP_API_URL },
  };
}
```

Ajustes em relação ao guia antigo:
- As variáveis da AWS aceitam string vazia (`.allow('')`); sem isso `AWS_REGION=""` derruba o app na inicialização.
- `JWT_EXPIRATION` é validado por regex (número + unidade). Um número puro (ex.: `3600`) viraria milissegundos.
- O bloco do Google Cloud ficou comentado (incremental).

- [ ] **1.4.4: Registrar ConfigModule em AppModule**

Arquivo: `src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateConfig,
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

**Expected:** Config validado e acessível globalmente

---

## Task 1.5: Setup Prisma

**Duração:** 10 min

**Files:**
- Create: `prisma/schema.prisma` e `prisma.config.ts` (na raiz do projeto, gerados pelo `prisma init`)

**Steps:**

- [ ] **1.5.1: Inicializar Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

**Expected:** Pasta `prisma/` com `schema.prisma` e `prisma.config.ts` na raiz (o Prisma 7 lê a URL do banco daqui, via `process.env["DATABASE_URL"]`)

- [ ] **1.5.2: Ajustar o generator**

No Prisma 7 o client é gerado dentro do projeto e o `PrismaClient` sai dessa pasta, **não** de `@prisma/client`. Não existe mais `prisma/config.ts`: quem conecta no banco é o `PrismaService` (Task 3.1).

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  importFileExtension = ""
}
```

`importFileExtension = ""` faz o client gerado importar sem `.js`, e é isso que deixa o `ts-node` (usado pelo seed) resolver o client.

- [ ] **1.5.3: Validar e gerar o client**

```bash
npx prisma validate
npx prisma generate
```

**Expected:** "✓ Validation successful" e client gerado em `src/generated/prisma`

---

# FASE 2: SCHEMA + MIGRATIONS

---

## Task 2.1: Definir Schema Prisma

**Duração:** 1 hora

**Files:**
- Modify: `prisma/schema.prisma`

**Steps:**

- [ ] **2.1.1: Configurar datasource e generator**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  importFileExtension = ""
}

datasource db {
  provider = "postgresql"
}
```

(A URL do banco fica no `prisma.config.ts` da raiz, não no datasource.)

- [ ] **2.1.2: Definir todos os models** (copiar de Design Doc, Seção 4.2)

**Importante:** Copiar EXATAMENTE do design com:
- Todos os enums (VehicleStatus, TripStatus, FuelType, MaintenanceType, MaintenanceStatus, IncidentType, Severity, IncidentStatus, AuditAction)
- Todos os relacionamentos (@relation)
- Todos os índices (@@index, @@unique) e os `@map`/`@@map` (tabelas no plural em snake_case, `id_<entidade>`, `fk_<entidade>_id`)
- O Prisma não suporta índice único parcial: a regra "sem 2 viagens ativas" fica nos triggers (Design, seção 6)

**Expected:** `prisma/schema.prisma` com 12 models + 9 enums

- [ ] **2.1.3: Validar schema**

```bash
npx prisma validate
```

**Expected:** "✓ Validation successful"

---

## Task 2.2: Primeira Migration — Tabelas Base

**Duração:** 15 min

**Files:**
- Create: `prisma/migrations/[timestamp]_init/migration.sql`

**Steps:**

- [ ] **2.2.1: Criar migration**

```bash
npx prisma migrate dev --name init
```

**Expected:** Migration criada, tabelas no banco, Prisma client gerado

- [ ] **2.2.2: Verificar tabelas criadas**

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "\dt"
```

**Expected:** 13 tabelas: os 12 models (users, roles, permissions, role_permissions, user_permissions, drivers, vehicles, trips, refuelings, maintenances, incidents, audit_logs) + `_prisma_migrations`

- [ ] **2.2.3: Verificar constraints**

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "\d trips"
```

**Expected:** Mostrar colunas, constraints UNIQUE, indexes

**⚠️ Checkpoint A1.1:** Nenhum erro ao criar migrations

---

## Task 2.3: Segunda Migration — Procedures

**Duração:** 1 hora

**Files:**
- Create: `prisma/migrations/[timestamp]_add_procedures/migration.sql`

**Steps:**

- [ ] **2.3.1: Migrations de procedures (já existem no repositório)**

As procedures **não** são mais copiadas do Design: já estão em `prisma/migrations`. A versão vigente de cada uma (SQL completo) está no Design, seção 5.2. Migrations de procedures, em ordem: `171500_add_procedures`, `172000_end_trip_updates_mileage`, `173000_fix_procedures_gaps`, `174000_add_vehicle_status_in_use`, `174100_procedures_vehicle_status`, `175000_create_trip_block_vehicle_status`, `180000_procedures_integrity_checks`, `181000_fix_procedures_and_cancel_trip`, `183000_fix_qa_round1` e `186000_concurrency_and_procedures` (prefixo `20260921...`).

Estado final: **6 procedures** (`PROCEDURE` de verdade, com parâmetros `OUT`; o PostgreSQL não permite `RETURNS TABLE` nem `RETURN QUERY` em procedure):
- `create_trip`, `start_trip`, `end_trip`, `cancel_trip`, `register_refueling`, `register_incident`

- [ ] **2.3.2: Aplicar as migrations**

```bash
npx prisma migrate deploy
```

**Expected:** Migrations aplicadas sem erros. Para mudar uma procedure, crie uma migration nova com `CREATE OR REPLACE` (com `DROP PROCEDURE` antes se a lista de parâmetros mudar); nunca edite uma migration já aplicada.

- [ ] **2.3.3: Listar procedures criadas**

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "\df"
```

**Expected:** 6 procedures (tipo `proc`) e as funções `fn_*` dos triggers (tipo `func`). Contagem exata das procedures: `SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE';` → 6

- [ ] **2.3.4: Testar procedure manualmente** (opcional)

Cada `NULL` no fim da chamada ocupa um parâmetro `OUT` (`create_trip` tem 2: `id` e `status`). Este teste cria dados de exemplo e desfaz tudo no final (`ROLLBACK`); as colunas são as reais (`id_user`, `fk_role_id`, `fk_user_id`, `updated_at`, sem `DEFAULT` para `id`) e precisa do seed já rodado (papel ADMIN):

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
BEGIN;
INSERT INTO users (id_user, email, password, full_name, fk_role_id, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'teste.frota@fleet.com', 'x', 'Usuario Teste',
        (SELECT id_role FROM roles WHERE name = 'ADMIN'), NOW());
INSERT INTO drivers (id_driver, fk_user_id, license_number, license_expiry, updated_at)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'DRV123456', CURRENT_DATE + 365, NOW());
INSERT INTO vehicles (id_vehicle, plate, model, year, status, current_mileage, last_maintenance_km, updated_at)
VALUES ('00000000-0000-0000-0000-000000000003', 'ABC1D23', 'Fiat Ducato', 2023, 'AVAILABLE', 1000, 1000, NOW());

CALL create_trip(
  '00000000-0000-0000-0000-000000000002',  -- p_driver_id
  '00000000-0000-0000-0000-000000000003',  -- p_vehicle_id
  1000,                                     -- p_start_km
  'Local A',                                -- p_start_location
  'Local B',                                -- p_end_location
  '00000000-0000-0000-0000-000000000001',  -- p_created_by
  NULL, NULL                                -- OUT: id, status
);
ROLLBACK;
EOF
```

**Expected:** uma linha com o `id` da viagem e `status = PLANNED` (o `ROLLBACK` desfaz o teste). Se uma validação falhar, o erro sai como `P0001` com a mensagem do Design, seção 5.3.

**⚠️ Checkpoint A2.1:** Procedures funcionam

---

## Task 2.4: Terceira Migration — Triggers

**Duração:** 1.5 horas

**Files:**
- Create: `prisma/migrations/[timestamp]_add_triggers/migration.sql`

**Steps:**

- [ ] **2.4.1: Migrations de triggers e CHECKs (já existem no repositório)**

Os triggers também **não** são mais copiados do Design: já estão em `prisma/migrations` (o SQL vigente está no Design, seção 6). Migrations: `182000_add_triggers`, `183000_fix_qa_round1`, `184000_block_vehicle_in_use_on_insert`, `185000_constraints_and_indexes` (CHECKs e 8 índices — total de 26 CHECKs depois de `20260922112403_fix_plate_and_license_format_checks`) e `186000_concurrency_and_procedures`.

Estado final: **12 triggers**:
- Regras (trips): `prevent_vehicle_in_maintenance_from_trip`, `prevent_driver_double_active_trip`, `prevent_vehicle_double_active_trip`, `validate_trip_kilometers`
- Sincronia/proteção do veículo: `sync_vehicle_from_trip`, `sync_vehicle_mileage_from_refueling`, `protect_vehicle_status_and_mileage`, `block_vehicle_in_use_on_insert`
- Auditoria: `audit_trip_changes`, `audit_refueling_changes`, `audit_incident_changes`
- Proteção do log: `block_audit_logs_changes` (`audit_logs` é só de inserção)

**⚠️ CRÍTICO (regra para qualquer migration futura):** o trigger de auditoria grava em `audit_logs` (colunas `id_audit_log`, `entity_type`, `entity_id`, `action`, `fk_user_id`, `old_values`, `new_values`). Se dropar ou renomear essa tabela ou colunas, ajuste as funções `fn_audit_*` na mesma migration.

- [ ] **2.4.2: Aplicar as migrations**

```bash
npx prisma migrate deploy
```

**Expected:** Migrations aplicadas sem erros

- [ ] **2.4.3: Contar triggers e CHECKs**

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal;"
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "SELECT COUNT(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace;"
```

**Expected:** 12 triggers e 26 CHECKs. (`information_schema.triggers` também mostraria 26 linhas para os triggers, por coincidência — ele conta um trigger por evento INSERT/UPDATE/DELETE; use `pg_trigger` para o total real de 12 triggers.)

- [ ] **2.4.4: Testar triggers manualmente**

Teste da regra "sem 2 viagens ativas para o mesmo motorista" (tudo desfeito no final). O segundo `create_trip` usa outro veículo livre, então quem barra é o trigger:

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
BEGIN;
INSERT INTO users (id_user, email, password, full_name, fk_role_id, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'teste.frota@fleet.com', 'x', 'Usuario Teste',
        (SELECT id_role FROM roles WHERE name = 'ADMIN'), NOW());
INSERT INTO drivers (id_driver, fk_user_id, license_number, license_expiry, updated_at)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'DRV123456', CURRENT_DATE + 365, NOW());
INSERT INTO vehicles (id_vehicle, plate, model, year, status, current_mileage, last_maintenance_km, updated_at)
VALUES ('00000000-0000-0000-0000-000000000003', 'ABC1D23', 'Fiat Ducato', 2023, 'AVAILABLE', 1000, 1000, NOW()),
       ('00000000-0000-0000-0000-000000000004', 'XYZ9K87', 'Renault Master', 2022, 'AVAILABLE', 2000, 2000, NOW());

CALL create_trip('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 1000,
                 'Local A', 'Local B', '00000000-0000-0000-0000-000000000001', NULL, NULL);
CALL create_trip('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 2000,
                 'Local C', 'Local D', '00000000-0000-0000-0000-000000000001', NULL, NULL);
ROLLBACK;
EOF
```

**Expected:** o primeiro `CALL` funciona; o segundo falha com `ERROR: Driver already has an active trip` (trigger `prevent_driver_double_active_trip`). Para um veículo `IN_MAINTENANCE` ou `IN_USE` a própria procedure já recusa (`Vehicle is under maintenance` / `Vehicle is in use`).

- [ ] **2.4.5: Testar trigger de auditoria**

Dentro do teste acima, antes do `ROLLBACK`, rode:

```sql
SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'TRIP';
```

**Expected:** 1 (em banco sem outras viagens auditadas). O usuário do log vem de `set_config('app.current_user_id', '<uuid>', true)`, se o app o chamar na transação, ou do `fk_user_id` da viagem (Design, seção 6.4).

**⚠️ Checkpoint A3.1:** Triggers bloqueiam e auditam corretamente

---

## Task 2.5: Validação Ponta-a-Ponta de Migrações

**Duração:** 30 min

**Steps:**

- [ ] **2.5.1: Dropar banco e recriar do zero**

```bash
docker compose down -v  # Remove volumes
docker compose up -d    # Restart container (banco vazio)
npx prisma migrate deploy  # Aplicar TODAS as migrations em ordem
```

**Expected:** Todas as migrations aplicadas com sucesso

- [ ] **2.5.2: Verificar integridade**

```bash
npx prisma validate
```

**Expected:** "✓ Validation successful"

- [ ] **2.5.3: Listar tudo que foi criado**

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') AS tables,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE') AS procedures,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') AS functions,
  (SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers,
  (SELECT COUNT(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace) AS checks,
  (SELECT COUNT(*) FROM _prisma_migrations) AS migrations;
EOF
```

**Expected:**
- Tabelas: 13 (12 models + `_prisma_migrations`)
- Procedures: 6
- Functions: 12 (uma por trigger)
- Triggers: 12
- CHECKs: 24
- Migrations: 14

- [ ] **2.5.4: Testar operação INSERT bem-sucedida** (CRÍTICO)

Use os testes das tasks 2.3.4 e 2.4.4 (dados de exemplo com as colunas reais, chamando `CALL create_trip(..., NULL, NULL)`, tudo desfeito com `ROLLBACK`).

**Expected:**
- ✓ Trip criada com sucesso (`status = PLANNED`, veículo passa a `IN_USE`)
- ✓ Audit log criado
- ✓ 2ª trip do mesmo motorista bloqueada com `Driver already has an active trip`

**✅ Checkpoint A1, A2, A3 passam aqui**

---

# FASE 3: AUTH + RBAC

---

## Task 3.1: Criar PrismaService

**Duração:** 15 min

> **Prisma 7:** o `PrismaClient` vem do client gerado (`src/generated/prisma`, definido pelo `output` do schema), **não** de `@prisma/client`, e precisa de um adapter (`@prisma/adapter-pg`). O código abaixo é o real do projeto (o do guia antigo, `import { PrismaClient } from '@prisma/client'` sem construtor, não funciona).

**Files:**
- Create: `src/database/prisma.service.ts`
- Create: `src/database/database.module.ts`
- Modify: `src/app.module.ts`, `src/main.ts`, `tsconfig.build.json`, `package.json`

**Steps:**

- [ ] **3.1.1: Criar PrismaService**

O service **estende o `PrismaClient` gerado** e monta o adapter com a URL vinda do `ConfigService<ConfigVars, true>` (chave `database.url`, tipada com `infer: true`).

Arquivo: `src/database/prisma.service.ts`
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigVars } from '../config/configuration';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(servicoDeConfiguracao: ConfigService<ConfigVars, true>) {
    // O adapter faz o Prisma falar com o PostgreSQL usando a URL do .env.
    const adaptador = new PrismaPg({
      connectionString: servicoDeConfiguracao.getOrThrow('database.url', {
        infer: true,
      }),
    });
    super({ adapter: adaptador });
  }

  // Abre a conexão com o banco quando o módulo inicia.
  async onModuleInit() {
    await this.$connect();
  }

  // Fecha a conexão quando o app é encerrado.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **3.1.2: Criar DatabaseModule**

O módulo é `@Global()`: qualquer módulo usa o `PrismaService` sem importar o `DatabaseModule`.

Arquivo: `src/database/database.module.ts`
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: qualquer módulo usa o PrismaService sem importar este módulo.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

- [ ] **3.1.3: Registrar em AppModule**

Arquivo: `src/app.module.ts` (versão final, já com o `AuthModule` da Task 3.3; o `ConfigModule` é `isGlobal`, por isso o `ConfigService` chega ao `PrismaService`)
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate: validateConfig,
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **3.1.4: Configurar main.ts**

Arquivo: `src/main.ts`: desliga o banco com elegância (`enableShutdownHooks`) e valida os DTOs em toda a API (`whitelist` remove campos extras, `forbidNonWhitelisted` recusa com 400, `transform` aplica os `@Transform`).
```typescript
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Faz o Nest fechar tudo direito (inclusive o banco) ao receber Ctrl+C ou SIGTERM.
  app.enableShutdownHooks();
  // Faz os decorators do DTO (ex: @IsEmail) valerem e recusa campos extras.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **3.1.5: Ajustes de build e testes (Prisma 7 + Nest)**

- `prisma/config.ts` do guia antigo **não existe mais**; o app usa o `PrismaService`. O `prisma.config.ts` da raiz continua (é o do Prisma CLI).
- `tsconfig.build.json` com `"include": ["src"]`, para o build gerar `dist/main.js` (sem isso o `prisma/seed.ts` entra no build e o `dist` muda de estrutura, quebrando o `start:prod`).
```json
{
  "extends": "./tsconfig.json",
  "include": ["src"],
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```
- Script `"test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"` e, no bloco `jest` do `package.json`, `"moduleNameMapper": { "^(\\.{1,2}/.*)\\.js$": "$1" }` (o client gerado usa imports `.js` que o Jest precisa mapear).
- Variáveis da AWS vazias e `JWT_EXPIRATION` com regex: ver Task 1.4.3.

**Expected:** PrismaService disponível em toda aplicação (`DatabaseModule` exporta o service).

**Verificar:**
- `npx tsc --noEmit -p tsconfig.json` sem erros
- `npm run build` gera `dist/main.js`
- `npm run start:dev` sobe sem erro de configuração nem de conexão com o banco (`start:prod` também funciona)

---

## Task 3.2: Criar JWT Strategy e Guards

**Duração:** 45 min

**Files:**
- Create: `src/auth/interfaces/jwt-payload.interface.ts`
- Create: `src/auth/interfaces/usuario-logado.interface.ts`
- Create: `src/auth/constants/auth.constants.ts`
- Create: `src/auth/strategies/jwt.strategy.ts`
- Create: `src/auth/guards/jwt.guard.ts`
- Create: `src/auth/guards/roles.guard.ts`
- Create: `src/auth/decorators/current-user.decorator.ts`
- Create: `src/auth/decorators/roles.decorator.ts`
- Create: `src/auth/decorators/permissions.decorator.ts`

**Steps:**

- [ ] **3.2.1: Criar as interfaces e as constantes**

`JwtPayload` é o que vai **dentro do token** (`sub`, `iat` e `exp` são do padrão JWT). `UsuarioLogado` é o que a strategy coloca em `request.user`, e é o tipo que os controllers recebem em `@CurrentUser()`.

Arquivo: `src/auth/interfaces/jwt-payload.interface.ts`
```typescript
export interface JwtPayload {
  sub: string; // userId
  email: string;
  roleId: string;
  iat: number;
  exp: number;
}
```

Arquivo: `src/auth/interfaces/usuario-logado.interface.ts`
```typescript
// Usuário que a JwtStrategy coloca em request.user.
export interface UsuarioLogado {
  userId: string;
  email: string;
  roleId: string;
}
```

Arquivo: `src/auth/constants/auth.constants.ts`
```typescript
// Chaves usadas para guardar e ler papéis e permissões nas rotas.
export const CHAVE_PAPEIS = 'roles';
export const CHAVE_PERMISSOES = 'permissions';
```

- [ ] **3.2.2: Criar JWT Strategy**

O segredo vem do `jwt.secret` da configuração validada (não de `process.env` direto).

Arquivo: `src/auth/strategies/jwt.strategy.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ConfigVars } from '../../config/configuration';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsuarioLogado } from '../interfaces/usuario-logado.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(servicoDeConfiguracao: ConfigService<ConfigVars, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: servicoDeConfiguracao.getOrThrow('jwt.secret', {
        infer: true,
      }),
    });
  }

  // O que este método devolver vira o "request.user".
  async validate(carga: JwtPayload): Promise<UsuarioLogado> {
    return {
      userId: carga.sub,
      email: carga.email,
      roleId: carga.roleId,
    };
  }
}
```

- [ ] **3.2.3: Criar JWT Guard**

Arquivo: `src/auth/guards/jwt.guard.ts`
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Se der erro ou não tiver usuário, o token é inválido ou expirou.
  handleRequest<TUser>(erro: Error | null, usuario: TUser | false): TUser {
    if (erro || !usuario) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return usuario;
  }
}
```

- [ ] **3.2.4: Criar Roles Guard**

Comportamento: sem `@Roles` nem `@Permissions` a rota passa. O guard lê o decorator do método e, se não achar, o da classe (`getAllAndOverride`). Exige o **papel** (se houver `@Roles`) **e** ao menos **uma** das permissões listadas (se houver `@Permissions`). Só conta a permissão do **papel** (`RolePermission`); as permissões extras por usuário (`UserPermission`) não são consideradas. `roleId` que não seja um UUID gera 403 (`Invalid user role`), porque o Prisma ignoraria um filtro inválido e liberaria tudo. Os erros são 403: `User not found in request`, `Invalid user role`, `Insufficient role` e `Insufficient permissions`.

Arquivo: `src/auth/guards/roles.guard.ts`
```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../constants/auth.constants';
import { UsuarioLogado } from '../interfaces/usuario-logado.interface';

// Formato de um UUID (o id do papel no banco).
const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private refletor: Reflector,
    private servicoPrisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Lê o decorator do método e, se não achar, o da classe.
    const alvos = [context.getHandler(), context.getClass()];
    const papeisExigidos = this.refletor.getAllAndOverride<string[]>(
      CHAVE_PAPEIS,
      alvos,
    );
    const permissoesExigidas = this.refletor.getAllAndOverride<string[]>(
      CHAVE_PERMISSOES,
      alvos,
    );

    if (!papeisExigidos && !permissoesExigidas) {
      return true; // Nenhuma restrição
    }

    const requisicao = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioLogado }>();
    const usuario = requisicao.user; // Preenchido pelo JwtAuthGuard

    if (!usuario) {
      throw new ForbiddenException('User not found in request');
    }

    // Sem um roleId válido, o Prisma ignoraria o filtro e liberaria tudo.
    if (
      typeof usuario.roleId !== 'string' ||
      !FORMATO_UUID.test(usuario.roleId)
    ) {
      throw new ForbiddenException('Invalid user role');
    }

    // Verificar roles
    if (papeisExigidos && papeisExigidos.length > 0) {
      const papelDoUsuario = await this.servicoPrisma.role.findUnique({
        where: { id: usuario.roleId },
      });

      if (!papelDoUsuario || !papeisExigidos.includes(papelDoUsuario.name)) {
        throw new ForbiddenException('Insufficient role');
      }
    }

    // Verificar permissions
    if (permissoesExigidas && permissoesExigidas.length > 0) {
      const permissoesDoPapel =
        await this.servicoPrisma.rolePermission.findMany({
          where: { roleId: usuario.roleId },
          include: { permission: true },
        });

      const codigosDePermissao = permissoesDoPapel.map(
        (item) => item.permission.code,
      );
      const temPermissao = permissoesExigidas.some((codigo) =>
        codigosDePermissao.includes(codigo),
      );

      if (!temPermissao) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
```

- [ ] **3.2.5: Criar Decorators**

`@Roles()` e `@Permissions()` sem argumentos lançam `Error` ao decorar (o app nem sobe), para não deixar uma rota sem proteção por esquecimento.

Arquivo: `src/auth/decorators/current-user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioLogado } from '../interfaces/usuario-logado.interface';

// Devolve o usuário logado, que o JwtAuthGuard colocou no request.
export const CurrentUser = createParamDecorator(
  (dados: unknown, contexto: ExecutionContext): UsuarioLogado => {
    const requisicao = contexto
      .switchToHttp()
      .getRequest<{ user: UsuarioLogado }>();
    return requisicao.user;
  },
);
```

Arquivo: `src/auth/decorators/roles.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
import { CHAVE_PAPEIS } from '../constants/auth.constants';

// Guarda os papéis exigidos na rota; sem nenhum papel, dá erro ao subir o app.
export const Roles = (...papeis: string[]) => {
  if (papeis.length === 0) {
    throw new Error('Roles() requires at least one role');
  }
  return SetMetadata(CHAVE_PAPEIS, papeis);
};
```

Arquivo: `src/auth/decorators/permissions.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
import { CHAVE_PERMISSOES } from '../constants/auth.constants';

// Guarda as permissões exigidas; sem nenhuma, dá erro ao subir o app.
export const Permissions = (...permissoes: string[]) => {
  if (permissoes.length === 0) {
    throw new Error('Permissions() requires at least one permission');
  }
  return SetMetadata(CHAVE_PERMISSOES, permissoes);
};
```

Uso em um controller:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trips')
export class TripsController {
  @Roles('FLEET_MANAGER', 'ADMIN')
  @Permissions('TRIP_VIEW_ALL')
  @Get()
  listar(@CurrentUser() usuario: UsuarioLogado) {
    // usuario = { userId, email, roleId }
  }
}
```

**Expected:** Guards e decorators funcionando

---

## Task 3.3: Criar Auth Module e Service

> **Nota:** o código abaixo é o registro histórico da implementação original (login só com e-mail/senha). Esse fluxo **evoluiu** para um esquema de duas camadas (X-API-KEY para `signup`/`login`/`regenerate-key`, JWT para o resto) — `AuthService.login` não existe mais. Fluxo atual, rotas, erros e o hash da chave: `2025-01-FROTA-DESIGN.md`, Seção 7.1a.

**Duração:** 45 min

**Files:**
- Create: `src/auth/dto/login.dto.ts`
- Create: `src/auth/auth.service.ts`
- Create: `src/auth/auth.controller.ts`
- Create: `src/auth/auth.module.ts`

**Steps:**

- [ ] **3.3.1: Criar Login DTO**

O `@Transform` tira os espaços das pontas do e-mail antes de validar (com o `transform: true` do `ValidationPipe`).

Arquivo: `src/auth/dto/login.dto.ts`
```typescript
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Tira espaços das pontas antes de validar, senão " a@b.com" seria recusado.
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
```

- [ ] **3.3.2: Criar Auth Service**

O login normaliza o e-mail (`trim().toLowerCase()`, já que o banco só guarda em minúsculas), usa `bcrypt.compare` assíncrono e compara com um hash falso quando o e-mail não existe (o tempo de resposta não revela se o e-mail está cadastrado). Erros 401: `Invalid credentials` (e-mail ou senha errados) e `User is inactive` (só depois de a senha estar certa).

Arquivo: `src/auth/auth.service.ts`
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

// Hash fixo usado para gastar o mesmo tempo quando o e-mail não existe.
const HASH_FALSO =
  '$2b$10$Gkbv/VFucUEMp3JrsU2xAuZ6idnNtTW0WqM8ZT3oNy4LZ0r8AxdSm';

@Injectable()
export class AuthService {
  constructor(
    private servicoPrisma: PrismaService,
    private servicoJwt: JwtService,
  ) {}

  async login(dadosLogin: LoginDto) {
    // O banco só guarda e-mail em minúsculas e sem espaços.
    const emailNormalizado = dadosLogin.email.trim().toLowerCase();

    const usuario = await this.servicoPrisma.user.findUnique({
      where: { email: emailNormalizado },
      include: { role: true },
    });

    // Mesmo sem usuário, compara com um hash falso para não revelar o e-mail pelo tempo.
    let hashParaComparar = HASH_FALSO;
    if (usuario) {
      hashParaComparar = usuario.password;
    }
    const senhaCorreta = await bcrypt.compare(
      dadosLogin.password,
      hashParaComparar,
    );

    if (!usuario || !senhaCorreta) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Só avisa que está inativo depois de a senha estar certa.
    if (!usuario.isActive) {
      throw new UnauthorizedException('User is inactive');
    }

    const carga: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: usuario.id,
      email: usuario.email,
      roleId: usuario.roleId,
    };

    return {
      accessToken: this.servicoJwt.sign(carga),
      user: {
        id: usuario.id,
        email: usuario.email,
        fullName: usuario.fullName,
        role: usuario.role.name,
      },
    };
  }
}
```

- [ ] **3.3.3: Criar Auth Controller**

Rota: `POST /auth/login`, com corpo `{ "email": "...", "password": "..." }` e resposta `{ accessToken, user: { id, email, fullName, role } }`.

Arquivo: `src/auth/auth.controller.ts`
```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private servicoAuth: AuthService) {}

  @Post('login')
  async login(@Body() dadosLogin: LoginDto) {
    return this.servicoAuth.login(dadosLogin);
  }
}
```

- [ ] **3.3.4: Criar Auth Module**

O `JwtModule` é configurado por `registerAsync` com o `ConfigService` (segredo e `jwt.expiration` da config validada).

Arquivo: `src/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ConfigVars } from '../config/configuration';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (servicoDeConfiguracao: ConfigService<ConfigVars, true>) => ({
        secret: servicoDeConfiguracao.getOrThrow('jwt.secret', { infer: true }),
        signOptions: {
          // A config guarda texto (ex: "1h"); o tipo da lib aceita só formatos como "1h".
          expiresIn: servicoDeConfiguracao.getOrThrow('jwt.expiration', {
            infer: true,
          }) as JwtSignOptions['expiresIn'],
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
```

- [ ] **3.3.5: Registrar AuthModule em AppModule**

Já está no `src/app.module.ts` da Task 3.1.3 (`imports: [ConfigModule..., DatabaseModule, AuthModule]`).

**Expected:** Login endpoint funcionando (`POST /auth/login` com o admin do seed devolve o token)

**Melhorias futuras (não implementadas):** `@MaxLength(72)` na senha (limite do bcrypt), `throttler` (limite de tentativas), refresh token/logout, endpoint de `register`, checar `isActive` na `JwtStrategy`, considerar `UserPermission` no `RolesGuard` e `helmet`/desligar `X-Powered-By`.

---

## Task 3.4: Criar Seed de Roles e Permissions

**Duração:** 30 min

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (script seed) e `prisma/schema.prisma` (`importFileExtension = ""`)

**Steps:**

- [ ] **3.4.1: Criar seed.ts**

O seed é **idempotente** (`upsert`: pode rodar de novo sem duplicar), usa o client gerado com `PrismaPg`, normaliza o e-mail do admin, gera o hash com bcrypt (custo 10) e **não sobrescreve** a senha de um admin que já existe. Em `NODE_ENV=production`, `ADMIN_EMAIL` e `ADMIN_INITIAL_PASSWORD` são obrigatórios (a senha padrão só existe fora de produção). Também apaga as permissions obsoletas de versões antigas do seed (TRIP_UPDATE, INCIDENT_UPDATE, MAINTENANCE_VIEW, TRIP_CANCEL).

Estado real do seed: **29 permissions**, **3 roles** e **62 vínculos** (DRIVER 10, FLEET_MANAGER 23, ADMIN 29, que recebe todas). A matriz é a da seção 7.2 do Design.

Arquivo: `prisma/seed.ts`
```typescript
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

// Códigos de permissão e nomes de papel seguem o guia (ficam em inglês).
const permissoes = [
  // Trip
  { code: 'TRIP_CREATE', description: 'Create trip' },
  { code: 'TRIP_VIEW_OWN', description: 'View own trips' },
  { code: 'TRIP_VIEW_ALL', description: 'View all trips' },
  { code: 'TRIP_CANCEL_OWN', description: 'Cancel own trip' },

  // Refueling
  { code: 'REFUELING_CREATE', description: 'Create refueling' },
  { code: 'REFUELING_VIEW_OWN', description: 'View own refuelings' },
  { code: 'REFUELING_VIEW_ALL', description: 'View all refuelings' },

  // Incident
  { code: 'INCIDENT_CREATE', description: 'Create incident' },
  { code: 'INCIDENT_VIEW_OWN', description: 'View own incidents' },
  { code: 'INCIDENT_VIEW_ALL', description: 'View all incidents' },

  // Driver
  { code: 'DRIVER_VIEW', description: 'View drivers' },
  { code: 'DRIVER_CREATE', description: 'Create driver' },
  { code: 'DRIVER_UPDATE', description: 'Update driver' },

  // Vehicle
  { code: 'VEHICLE_VIEW', description: 'View vehicles' },
  { code: 'VEHICLE_CREATE', description: 'Create vehicle' },
  { code: 'VEHICLE_UPDATE', description: 'Update vehicle' },

  // Maintenance
  { code: 'MAINTENANCE_VIEW_ALL', description: 'View all maintenance' },
  { code: 'MAINTENANCE_CREATE', description: 'Create maintenance' },
  { code: 'MAINTENANCE_UPDATE', description: 'Update maintenance' },

  // Analytics
  { code: 'ANALYTICS_VIEW', description: 'View analytics' },

  // Profile
  { code: 'PROFILE_VIEW', description: 'View own profile' },
  { code: 'PROFILE_UPDATE_OWN', description: 'Update own profile' },
  { code: 'PASSWORD_CHANGE_OWN', description: 'Change own password' },

  // User, role, permission and audit (admin)
  { code: 'USER_CREATE', description: 'Create user' },
  { code: 'USER_UPDATE', description: 'Update user' },
  { code: 'USER_DELETE', description: 'Delete user' },
  { code: 'ROLE_MANAGE', description: 'Manage roles' },
  { code: 'PERMISSION_MANAGE', description: 'Manage permissions' },
  { code: 'AUDIT_VIEW', description: 'View audit logs' },
];

// Códigos do seed antigo que não existem mais no DESIGN: o seed apaga só estes.
const permissoesObsoletas = [
  'TRIP_UPDATE',
  'INCIDENT_UPDATE',
  'MAINTENANCE_VIEW',
  'TRIP_CANCEL',
];

const papeis = [
  { name: 'DRIVER', description: 'Fleet driver' },
  { name: 'FLEET_MANAGER', description: 'Fleet manager' },
  { name: 'ADMIN', description: 'Administrator' },
];

// Matriz da seção 7.2 do DESIGN.
const codigosMotorista = [
  'TRIP_CREATE',
  'TRIP_VIEW_OWN',
  'TRIP_CANCEL_OWN',
  'REFUELING_CREATE',
  'REFUELING_VIEW_OWN',
  'INCIDENT_CREATE',
  'INCIDENT_VIEW_OWN',
  'PROFILE_VIEW',
  'PROFILE_UPDATE_OWN',
  'PASSWORD_CHANGE_OWN',
];

// O gerente tem tudo do motorista mais estes.
const codigosExtrasGerente = [
  'DRIVER_VIEW',
  'DRIVER_CREATE',
  'DRIVER_UPDATE',
  'VEHICLE_VIEW',
  'VEHICLE_CREATE',
  'VEHICLE_UPDATE',
  'TRIP_VIEW_ALL',
  'REFUELING_VIEW_ALL',
  'INCIDENT_VIEW_ALL',
  'MAINTENANCE_VIEW_ALL',
  'MAINTENANCE_CREATE',
  'MAINTENANCE_UPDATE',
  'ANALYTICS_VIEW',
];

function montarPermissoesPorPapel() {
  const codigosGerente: string[] = [];
  for (const codigo of codigosMotorista) {
    codigosGerente.push(codigo);
  }
  for (const codigo of codigosExtrasGerente) {
    codigosGerente.push(codigo);
  }

  // O admin recebe TODAS as permissões da lista acima.
  const codigosAdmin: string[] = [];
  for (const permissao of permissoes) {
    codigosAdmin.push(permissao.code);
  }

  return [
    { papel: 'DRIVER', codigos: codigosMotorista },
    { papel: 'FLEET_MANAGER', codigos: codigosGerente },
    { papel: 'ADMIN', codigos: codigosAdmin },
  ];
}

// Valores padrão do guia: só valem fora de produção.
const EMAIL_ADMIN_PADRAO = 'admin@fleet.com';
const SENHA_ADMIN_PADRAO = 'Admin@123';

function criarPrisma(): PrismaClient {
  const urlBanco = process.env.DATABASE_URL;
  if (!urlBanco) {
    throw new Error('DATABASE_URL is not set (check your .env file)');
  }

  const adaptador = new PrismaPg({ connectionString: urlBanco });
  return new PrismaClient({ adapter: adaptador });
}

// Devolve o e-mail em minúsculas (o banco só aceita assim).
// Em produção o e-mail é obrigatório; fora dela usa o padrão do guia.
function lerEmailAdmin(): string {
  let email = process.env.ADMIN_EMAIL;
  if (!email || email.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_EMAIL is required when NODE_ENV=production');
    }
    email = EMAIL_ADMIN_PADRAO;
  }
  return email.trim().toLowerCase();
}

// Em produção a senha é obrigatória; fora dela usa o padrão do guia.
function lerSenhaAdmin(): string {
  const senha = process.env.ADMIN_INITIAL_PASSWORD;
  if (senha && senha !== '') {
    return senha;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_INITIAL_PASSWORD is required when NODE_ENV=production');
  }
  return SENHA_ADMIN_PADRAO;
}

async function criarPermissoes(clientePrisma: PrismaClient) {
  for (const permissao of permissoes) {
    await clientePrisma.permission.upsert({
      where: { code: permissao.code },
      update: { description: permissao.description },
      create: permissao,
    });
  }
  console.log(`Seeded ${permissoes.length} permissions`);
}

async function criarPapeis(clientePrisma: PrismaClient) {
  for (const papel of papeis) {
    await clientePrisma.role.upsert({
      where: { name: papel.name },
      update: { description: papel.description },
      create: papel,
    });
  }
  console.log(`Seeded ${papeis.length} roles`);
}

// Apaga só as permissões obsoletas (os vínculos saem junto, por cascade).
async function removerPermissoesObsoletas(clientePrisma: PrismaClient) {
  for (const codigo of permissoesObsoletas) {
    await clientePrisma.permission.deleteMany({ where: { code: codigo } });
  }
  console.log(`Removed obsolete permissions (if any): ${permissoesObsoletas.length} codes checked`);
}

async function ligarPermissoesAosPapeis(clientePrisma: PrismaClient) {
  const permissoesPorPapel = montarPermissoesPorPapel();
  for (const item of permissoesPorPapel) {
    const papel = await clientePrisma.role.findUnique({ where: { name: item.papel } });
    if (!papel) {
      throw new Error(`Role ${item.papel} not found`);
    }

    for (const codigo of item.codigos) {
      const permissao = await clientePrisma.permission.findUnique({ where: { code: codigo } });
      if (!permissao) {
        throw new Error(`Permission ${codigo} not found`);
      }

      await clientePrisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: papel.id, permissionId: permissao.id },
        },
        update: {},
        create: { roleId: papel.id, permissionId: permissao.id },
      });
    }
  }
  console.log('Assigned permissions to roles');
}

async function criarAdmin(clientePrisma: PrismaClient, email: string, senha: string) {
  const papelAdmin = await clientePrisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!papelAdmin) {
    throw new Error('Role ADMIN not found');
  }

  const senhaComHash = bcrypt.hashSync(senha, 10);

  // update vazio: numa segunda execução não troca a senha do admin.
  await clientePrisma.user.upsert({
    where: { email: email },
    update: {},
    create: {
      email: email,
      password: senhaComHash,
      fullName: 'Admin User',
      roleId: papelAdmin.id,
      isActive: true,
    },
  });
  console.log(`Admin user ready (${email})`);
}

async function main() {
  console.log('Starting seed...');

  // Lê as configurações antes de gravar qualquer coisa (falha cedo).
  const emailAdmin = lerEmailAdmin();
  const senhaAdmin = lerSenhaAdmin();
  const clientePrisma = criarPrisma();

  try {
    await criarPermissoes(clientePrisma);
    await criarPapeis(clientePrisma);
    await removerPermissoesObsoletas(clientePrisma);
    await ligarPermissoesAosPapeis(clientePrisma);
    await criarAdmin(clientePrisma, emailAdmin, senhaAdmin);
    console.log('Seed completed successfully');
  } finally {
    await clientePrisma.$disconnect();
  }
}

main().catch((erro) => {
  // Mostra só a mensagem quando for um Error (sem stack e sem segredos).
  let mensagem = erro;
  if (erro instanceof Error) {
    mensagem = erro.message;
  }
  console.error('Seed failed:', mensagem);
  process.exit(1);
});
```

- [ ] **3.4.2: Adicionar script no package.json**

```json
{
  "scripts": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

O `ts-node` só resolve o client gerado porque o generator do `schema.prisma` tem `importFileExtension = ""` (Task 1.5.2).

- [ ] **3.4.3: Rodar seed**

```bash
npm run seed
```

**Expected (saída):** `Seeded 29 permissions`, `Seeded 3 roles`, `Removed obsolete permissions (if any): 4 codes checked`, `Assigned permissions to roles`, `Admin user ready (admin@fleet.com)`, `Seed completed successfully`. Conferência:

```bash
docker exec fleet_postgres psql -U postgres -d fleet_db -c "SELECT (SELECT COUNT(*) FROM permissions) AS permissions, (SELECT COUNT(*) FROM roles) AS roles, (SELECT COUNT(*) FROM users WHERE email = 'admin@fleet.com') AS admin;"
```

Resultado esperado: `29 | 3 | 1` (e `62` linhas em `role_permissions`).

**⚠️ Checkpoint:** Login endpoint retorna token válido

---

# FASE 4: RESOURCES PRINCIPAIS

(Condensado — seguir mesmo padrão de Task acima)

---

## Task 4.1-4.7: Implementar CRUD Resources

**Duração:** 1.5 dias

Por cada resource (Users, Drivers, Vehicles, Trips, Refuelings, Maintenances, Incidents):

1. Criar DTOs (create, update, response)
2. Criar Service (CRUD + validações + chamadas a procedures)
3. Criar Controller (endpoints com Guards + Decorators)
4. Criar Module
5. Registrar em AppModule

**Exemplo Task 4.1: Users Resource**

- [ ] Arquivo: `src/users/dto/create-user.dto.ts`
- [ ] Arquivo: `src/users/dto/update-user.dto.ts`
- [ ] Arquivo: `src/users/users.service.ts`
- [ ] Arquivo: `src/users/users.controller.ts`
- [ ] Arquivo: `src/users/users.module.ts`

(Padrão: Services chamam procedures quando necessário, não Prisma direto)

**Expected ao final:** CRUD completo para 7 resources

---

# FASE 5: FEATURES AVANÇADAS

---

## Task 5.1: Paginação + Filtros

**Duração:** 2 horas

- [ ] Criar `src/common/dto/pagination.dto.ts`
- [ ] Criar middleware/interceptor de paginação
- [ ] Todos os GET endpoints retornam `{ data: [], pagination: {...} }`

---

## Task 5.2: Indicadores de Frota

**Duração:** 2 horas

- [ ] Criar `src/analytics/analytics.service.ts`
- [ ] Endpoints: /analytics/fleet/*, /analytics/vehicle/*, /analytics/driver/*
- [ ] Usar agregações SQL (GROUP BY, SUM, AVG)

---

## Task 5.3: Upload (Local)

**Duração:** 1 hora

- [ ] Validar arquivo (presença, tamanho, tipo)
- [ ] Armazenar em `uploads/incidents/`
- [ ] Retornar URL

---

## Task 5.4: HttpService + ViaCEP Integration (OBRIGATÓRIO)

**Duração:** 3 horas

**Requisito Avaliação:** Usar HttpService para consumir API externa

> **Histórico — esta seção (5.4.1 a 5.4.12) é o rascunho original da task, já aplicado com nomes e comportamento diferentes.**
> Nomes reais: `src/external/viacep/via-cep.service.ts` e `via-cep.module.ts` (não `viacep.service.ts`/`viacep.module.ts`); classe/métodos reais `ViaCepService.buscarPorCep()` / `.cepEhValido()` (não `searchByCep`/`isCepValid`/`validateMultipleCeps`). `CreateVehicleDto.initialLocationCep` é opcional e não persistido no banco; `CreateTripDto` não tem `startLocation`/`endLocation`. `VehiclesService`/`TripsService` reais usam as procedures (`create_trip` etc.), não `prisma.vehicle.create` direto como nos trechos abaixo. Para o comportamento atual, leia `src/external/viacep/` e `markdown/2025-01-FROTA-VIACEP-SERVICE.md` (mesma ressalva lá).

**Files:**
- Create: `src/external/viacep/` (service, module, DTOs, interfaces)
- Create: `src/common/validators/is-valid-cep.validator.ts`
- Modify: `src/vehicles/dto/create-vehicle.dto.ts` (adicionar @IsValidCep)
- Modify: `src/trips/dto/create-trip.dto.ts` (adicionar @IsValidCep)
- Modify: `src/vehicles/vehicles.service.ts` (integrar ViaCepService)
- Modify: `src/trips/trips.service.ts` (integrar ViaCepService)
- Modify: `src/app.module.ts` (importar ViaCepModule)

**Steps:**

- [ ] **5.4.1: Instalar HttpModule**

```bash
npm install @nestjs/axios axios
```

- [ ] **5.4.2: Criar DTOs**

Arquivo: `src/external/viacep/dto/viacep-address.dto.ts`
```typescript
export class ViaCepAddressDto {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  ddd: string;
  siafi: string;
  fullAddress?: string;
  coordinates?: { latitude: number; longitude: number };
}
```

(Ver arquivo completo em `2025-01-FROTA-VIACEP-SERVICE.md`)

- [ ] **5.4.3: Criar ViaCepService**

Arquivo: `src/external/viacep/viacep.service.ts`

**Incluir:**
- `searchByCep(cep: string)` → retorna ViaCepAddressDto
- `isCepValid(cep: string)` → retorna boolean
- `validateMultipleCeps(ceps: string[])` → retorna Record<string, boolean>
- Tratamento de erros:
  - BadRequestException (CEP inválido, formato errado, não encontrado)
  - GatewayTimeoutException (timeout, rate limit)
  - InternalServerErrorException (erro de rede, servidor)
- Logging estruturado

(Ver código completo em `2025-01-FROTA-VIACEP-SERVICE.md`)

**Expected:** Service funciona, trata erros corretamente

- [ ] **5.4.4: Criar ViaCepModule**

Arquivo: `src/external/viacep/viacep.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ViaCepService } from './viacep.service';

@Module({
  imports: [HttpModule],
  providers: [ViaCepService],
  exports: [ViaCepService],
})
export class ViaCepModule {}
```

- [ ] **5.4.5: Criar Validador Customizado**

Arquivo: `src/common/validators/is-valid-cep.validator.ts`

**Incluir:**
- `IsValidCepConstraint` (ValidatorConstraint async)
- `@IsValidCep()` decorator

**Funciona em DTOs:**
```typescript
export class CreateVehicleDto {
  @IsValidCep() // Valida contra ViaCEP antes de criar
  initialLocationCep: string;
}
```

(Ver código completo em `2025-01-FROTA-VIACEP-SERVICE.md`)

- [ ] **5.4.6: Integrar com CreateVehicleDto**

Modificar: `src/vehicles/dto/create-vehicle.dto.ts`
```typescript
export class CreateVehicleDto {
  @IsString()
  plate: string;

  @IsString()
  model: string;

  @IsInt()
  @Min(1900)
  @Max(2099)
  year: number;

  @IsInt()
  @Min(0)
  currentMileage: number;

  @IsOptional()
  @IsString()
  @IsValidCep() // ✓ Valida CEP antes de criar
  initialLocationCep?: string;
}
```

**Expected:** DTO valida CEP via ViaCEP antes de passar pro Service

- [ ] **5.4.7: Integrar com CreateTripDto**

Modificar: `src/trips/dto/create-trip.dto.ts`
```typescript
export class CreateTripDto {
  @IsString()
  driverId: string;

  @IsString()
  vehicleId: string;

  @IsInt()
  @Min(0)
  startKm: number;

  @IsString()
  @IsValidCep() // ✓ Valida CEP de início
  startLocation: string;

  @IsString()
  @IsValidCep() // ✓ Valida CEP de fim
  endLocation: string;
}
```

**Expected:** DTOs validam ambos os CEPs via ViaCEP

- [ ] **5.4.8: Integrar ViaCepService com VehiclesService**

Modificar: `src/vehicles/vehicles.service.ts`
```typescript
async create(dto: CreateVehicleDto) {
  let locationData = null;

  // Se CEP foi fornecido, buscar localização
  if (dto.initialLocationCep) {
    locationData = await this.viaCepService.searchByCep(dto.initialLocationCep);
  }

  // Criar veículo
  const vehicle = await this.prisma.vehicle.create({...});

  // Retornar com localização enriquecida
  return {
    ...vehicle,
    initialLocation: locationData,
  };
}
```

**Expected:** Vehicle criado com localização enriquecida (ex: "São Paulo, SP")

- [ ] **5.4.9: Integrar ViaCepService com TripsService**

Modificar: `src/trips/trips.service.ts`
```typescript
async createTrip(dto: CreateTripDto, userId: string) {
  // Validar existência
  const driver = await this.prisma.driver.findUnique({...});
  if (!driver) throw new BadRequestException('Driver not found');

  const vehicle = await this.prisma.vehicle.findUnique({...});
  if (!vehicle) throw new BadRequestException('Vehicle not found');

  // Buscar localização de início (ViaCEP)
  const startLocationData = await this.viaCepService.searchByCep(dto.startLocation);

  // Buscar localização de fim (ViaCEP)
  const endLocationData = await this.viaCepService.searchByCep(dto.endLocation);

  // Chamar procedure com localização enriquecida
  // A procedure e o set_config rodam na MESMA transação (o set_config diz quem está agindo, para a auditoria).
  // Os dois NULL no fim ocupam os parâmetros OUT (id, status).
  const result = await this.prisma.$transaction(async (transacao) => {
    await transacao.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return transacao.$queryRaw`
      CALL create_trip(
        ${dto.driverId}::uuid,
        ${dto.vehicleId}::uuid,
        ${dto.startKm}::int,
        ${startLocationData.fullAddress}::text,
        ${endLocationData.fullAddress}::text,
        ${userId}::uuid,
        NULL,
        NULL
      )
    `;
  });

  return result;
}
```

**Expected:** Trips criadas com localização enriquecida

- [ ] **5.4.10: Importar ViaCepModule no AppModule**

Modificar: `src/app.module.ts`
```typescript
import { ViaCepModule } from './external/viacep/viacep.module';

@Module({
  imports: [
    ConfigModule.forRoot({...}),
    DatabaseModule,
    ViaCepModule, // ✓ Adicionar aqui
    AuthModule,
    // ... outros
  ],
  controllers: [...],
  providers: [...],
})
export class AppModule {}
```

- [ ] **5.4.11: Adicionar variáveis .env**

Modificar: `.env`
```env
# ViaCEP API
CEP_API_URL="https://viacep.com.br/ws"
CEP_TIMEOUT_MS=10000
```

Modificar: `.env.example`
```env
CEP_API_URL="https://viacep.com.br/ws"
CEP_TIMEOUT_MS=10000
```

- [ ] **5.4.12: Testar manualmente**

```bash
# 1. Iniciar aplicação
npm run start:dev

# 2. Fazer POST /vehicles com CEP válido
curl -X POST http://localhost:3000/vehicles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plate": "ABC-1234",
    "model": "Fiat Ducato",
    "year": 2023,
    "currentMileage": 1000,
    "initialLocationCep": "01310-100"
  }'
# Expected: 201 Created
# Response: { id, plate, model, year, currentMileage, initialLocation: { cep, localidade, uf, fullAddress, ... } }

# 3. Fazer POST /vehicles com CEP inválido
curl -X POST http://localhost:3000/vehicles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "plate": "ABC-1234",
    "model": "Fiat Ducato",
    "year": 2023,
    "currentMileage": 1000,
    "initialLocationCep": "00000-000"
  }'
# Expected: 400 Bad Request
# Message: "CEP 00000-000 not found in Brazil"

# 4. Fazer POST /trips com CEPs válidos
curl -X POST http://localhost:3000/trips \
  -H "Authorization: Bearer <driverToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "...",
    "vehicleId": "...",
    "startKm": 0,
    "startLocation": "01310-100",
    "endLocation": "20040020"
  }'
# Expected: 201 Created, trip com status PLANNED

# 5. Fazer POST /trips com CEP inválido
curl -X POST http://localhost:3000/trips \
  -H "Authorization: Bearer <driverToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": "...",
    "vehicleId": "...",
    "startKm": 0,
    "startLocation": "01310-100",
    "endLocation": "ABC-DEFG"
  }'
# Expected: 400 Bad Request
# Message: "Invalid CEP format..."
```

**✅ PASS:** Requests com CEPs válidos → sucesso, com inválidos → erro apropriado

**⚠️ Checkpoint 5.4:** HttpService + ViaCEP funcionando, testes passando

---

## Task 5.5: Interceptor

**Duração:** 45 min

- [ ] Logging estruturado
- [ ] Response transform
- [ ] Timing

---

# FASE 6: TESTES E VALIDAÇÃO FINAL

---

## Task 6.1-6.10: Testes Obrigatórios E2E

**Duração:** 1 dia

### **Test 1:** Fluxo Principal (Trip Completa)
- [ ] Criar driver, vehicle, trip
- [ ] Iniciar trip (PLANNED → IN_PROGRESS)
- [ ] Finalizar trip (IN_PROGRESS → COMPLETED)
- [ ] Verificar que audit_log foi preenchido
- **Expected:** 201 → 200 → 200, trip com end_km calculado

### **Test 2:** Body Inválido → 400
- [ ] POST /trips com startKm string (não int)
- [ ] POST /drivers com license_expiry em formato errado
- [ ] POST /refuelings com litersAdded negativo
- **Expected:** 400 Bad Request com campo inválido

### **Test 3:** Sem Token → 401
- [ ] GET /trips sem header Authorization
- [ ] POST /vehicles sem header Authorization
- **Expected:** 401 Unauthorized

### **Test 4:** Sem Permissão → 403
- [ ] DRIVER tenta GET /users (só ADMIN)
- [ ] DRIVER tenta POST /drivers (só FLEET_MANAGER+)
- **Expected:** 403 Forbidden

### **Test 5:** Recurso Não Existe → 404
- [ ] GET /trips/nonexistent-id
- [ ] GET /vehicles/nonexistent-id
- **Expected:** 404 Not Found

### **Test 6:** Regra de Negócio (2 Trips Ativas) → 409
- [ ] Criar trip 1 com driver X e status PLANNED
- [ ] Tentar criar trip 2 com driver X e status PLANNED
- **Expected:** 409 Conflict (trigger bloqueou)
- **Log:** Verificar que audit_log registrou a tentativa

### **Test 7:** Acesso a Recurso de Terceiro → 403
- [ ] DRIVER A tenta GET /trips?driverId=<driver_b_id>
- [ ] DRIVER A tenta PATCH /trips/<trip_de_driver_b>
- **Expected:** 403 Forbidden (verificar ownership)

### **Test 8:** Upload Válido + Inválido
- [ ] POST /incidents com foto válida (JPG/PNG, <10MB)
  - **Expected:** 201 Created, photoUrl preenchido
- [ ] POST /incidents com arquivo grande (>10MB)
  - **Expected:** 413 Payload Too Large
- [ ] POST /incidents com arquivo tipo errado (EXE, ZIP)
  - **Expected:** 415 Unsupported Media Type

### **Test 9:** HttpService + ViaCEP (API Externa)
**Sub-testes (9.1-9.5):**

- [ ] **9.1:** ViaCEP com CEP válido → sucesso
  - POST /vehicles com initialLocationCep="01310-100"
  - **Expected:** 201, initialLocation.localidade="São Paulo"

- [ ] **9.2:** ViaCEP com CEP não encontrado → 400
  - POST /vehicles com initialLocationCep="00000-000"
  - **Expected:** 400, message="CEP 00000-000 not found"

- [ ] **9.3:** ViaCEP com CEP formato errado → 400
  - POST /vehicles com initialLocationCep="ABC-DEFG"
  - **Expected:** 400, message="Invalid CEP format"

- [ ] **9.4:** Trip com múltiplos CEPs válidos → sucesso
  - POST /trips com startLocation="01310-100", endLocation="20040020"
  - **Expected:** 201, trip.status="PLANNED"

- [ ] **9.5:** ViaCEP timeout simulado → 504
  - (Requer mock do HttpService com delay >10s)
  - **Expected:** 504 Gateway Timeout

### **Test 10:** Estado Completo (PLANNED → IN_PROGRESS → COMPLETED)
- [ ] Criar trip: status=PLANNED, end_km=null, end_time=null
- [ ] Start trip: status=IN_PROGRESS, end_km=null, end_time=null
- [ ] End trip: status=COMPLETED, end_km=<calculado>, end_time=<now>
- [ ] Verificar que:
  - Trigger de validação passou (vehicle não IN_MAINTENANCE, driver sem outra trip ativa)
  - Trigger de auditoria registrou 3 mudanças (CREATE, UPDATE, UPDATE)
  - Procedure retornou km total
  - Response contém todo o ciclo de vida
- **Expected:** 201 → 200 → 200, audit_log com 3 entries

---

### Checklist de Todos os 10 Testes

```bash
# Rodar testes E2E
npm test -- --testPathPattern=e2e

# Expected output:
#   ✓ Test 1: Fluxo principal (trip completa)
#   ✓ Test 2: Body inválido → 400
#   ✓ Test 3: Sem token → 401
#   ✓ Test 4: Sem permissão → 403
#   ✓ Test 5: Recurso não existe → 404
#   ✓ Test 6: Regra de negócio → 409
#   ✓ Test 7: Acesso a recurso de terceiro → 403
#   ✓ Test 8: Upload válido + inválido
#   ✓ Test 9.1-9.5: ViaCEP + HttpService
#   ✓ Test 10: Estado completo (PLANNED → IN_PROGRESS → COMPLETED)
#
# 10 passed, 0 failed
```

**✅ PASS:** Todos os 10 testes passam

---

## Task 6.2: Validação Ponta-a-Ponta Final

**Duração:** 2 horas

- [ ] **6.2.1:** Dropar banco, recriar do zero, rodar seed
- [ ] **6.2.2:** Rodar `npm run build` (sem erros)
- [ ] **6.2.3:** Rodar `npx prisma validate`
- [ ] **6.2.4:** Rodar testes E2E (todos passam)
- [ ] **6.2.5:** Testar cada endpoint manualmente (curl ou Postman)
- [ ] **6.2.6:** Verificar que nenhum trigger órfão existe
- [ ] **6.2.7:** Verificar que audit_logs está preenchido

**⚠️ CRÍTICO:** Se algum teste falhar, PARAR e corrigir antes de continuar

---

## Task 6.3: Documentação Final

**Duração:** 2 horas

- [ ] README.md (instalação, config, execução, endpoints)
- [ ] .env.example (sem segredos)
- [ ] Lista de endpoints (método, URL, autenticação, body, respostas)

---

## ✅ CHECKLIST FINAL

- [x] Schema Prisma completo
- [x] Migrations (tabelas + procedures + triggers)
- [x] Procedures funcionam
- [x] Triggers bloqueiam + auditam
- [x] Auth (JWT + Guards + Roles)
- [x] Seed (roles + permissions + admin)
- [x] Resources CRUD (Users, Drivers, Vehicles, Trips, Refuelings, Maintenances, Incidents)
- [x] Paginação + Filtros
- [x] Indicadores de Frota
- [x] Upload (local)
- [x] HttpService (CEP)
- [x] Interceptor (logging)
- [x] 10 Testes E2E (todos passam)
- [x] `npm run build` (sem erros)
- [x] `npx prisma validate` (sucesso)
- [x] README.md completo
- [x] .env.example
- [x] Nenhum trigger órfão
- [x] audit_logs preenchido

---

**Projeto Entregue! 🚀**

