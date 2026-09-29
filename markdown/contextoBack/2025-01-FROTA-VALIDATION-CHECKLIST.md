# Validation Checklist — Gestão de Frota Corporativa

> **Objetivo:** Evitar os 4 gaps principais do projeto anterior (Visitantes - 89.50/100)

---

## ⚠️ GAP ANTERIOR #1: Trigger Órfão

**O que aconteceu:**
- Migration `20260918221321` fez `DROP TABLE visit_audit`
- Mas triggers `trg_audit_visits` continuavam apontando para essa tabela
- POST /visits e PATCH /visits/:id/checkout quebravam com 500 (operação INSERT no trigger)

**Como evitar neste projeto:**

### Checkpoint 1.1: Schema está sincronizado com Migrations
- [ ] Rodar `npx prisma validate` → ✓ "Validation successful"
- [ ] Schema prisma define `audit_logs` com todos os campos necessários
- [ ] Schema define enums de `AuditAction` (CREATE, UPDATE, DELETE)

### Checkpoint 1.2: Triggers apontam SEMPRE para `audit_logs`
- [ ] Buscar em `prisma/migrations/*/migration.sql`: todas as ocorrências de `INSERT INTO audit_logs`
- [ ] Verificar que nome da tabela é EXATAMENTE `audit_logs` (não `audit_log` ou `audit`)
- [ ] Verificar que campos inseridos (id_audit_log, entity_type, entity_id, action, fk_user_id, old_values, new_values) EXISTEM na tabela

```sql
-- ✓ CORRETO:
INSERT INTO audit_logs (id_audit_log, entity_type, entity_id, action, fk_user_id, old_values, new_values)
VALUES (gen_random_uuid(), ...);

-- ✗ ERRADO:
INSERT INTO audit_log (entity_type, entity_id, ...)  -- nome errado
INSERT INTO audit_logs (wrong_field, ...)             -- campo inexistente
```

### Checkpoint 1.3: Nunca deletar tabela `audit_logs`
- [ ] Procurar em TODAS as migrations por: `DROP TABLE audit_logs`
- [ ] Se encontrar: **ERRO CRÍTICO** — remover essa migration ou mudar para `TRUNCATE`
- [ ] `audit_logs` é PERMANENTE e APPEND-ONLY (o banco bloqueia UPDATE/DELETE: `audit_logs is append-only`)

```sql
-- ✗ PROIBIDO:
DROP TABLE audit_logs;

-- ✓ PERMITIDO (se necessário limpar):
TRUNCATE TABLE audit_logs; -- apenas em desenvolvimento
```

### Checkpoint 1.4: Ao dropar qualquer outra tabela, limpar seus triggers na MESMA migration

**Regra:** Se uma migration faz `DROP TABLE X`, a MESMA migration deve fazer:

```sql
DROP TRIGGER IF EXISTS trg_something_on_X CASCADE;
DROP FUNCTION IF EXISTS fn_something_on_X CASCADE;
DROP TABLE X;
```

- [ ] Para cada `DROP TABLE` encontrado, verificar se há `DROP TRIGGER` correspondente
- [ ] Ordem: sempre `DROP TRIGGER` → `DROP FUNCTION` → `DROP TABLE`

### Checkpoint 1.5: Testar Operação INSERT pós-migration
**Quando:** Após aplicar cada migration que cria/modifica triggers

```bash
# 1. Aplicar migrations do zero
npx prisma migrate deploy

# 2. Fazer INSERT em tabela com trigger
# Exemplo: inserir trip (tem trigger de validação + auditoria)
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
CALL create_trip(..., NULL, NULL);  -- os NULL ocupam os parâmetros OUT (id, status)
-- Expected: ✓ Insert OK, sem erro de trigger órfão
EOF

# 3. Verificar audit_log
SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'TRIP';
-- Expected: ≥ 1 (foi registrado na auditoria)
```

**✅ PASS:** INSERT sucede, audit_log é criado, nenhum erro de trigger órfão

---

## ⚠️ GAP ANTERIOR #2: Validações Desincronizadas

**O que aconteceu:**
- Service validava regra X
- Procedure validava regra X novamente (redundante)
- Trigger validava regra X outra vez (complexo + confuso)
- Resulto: 3 cópias de lógica = fácil desincronizar

**Como evitar neste projeto:**

### Checkpoint 2.1: Separação Clara de Responsabilidades

**Service (NestJS):**
- Validar existência de recursos (driver existe? vehicle existe?)
- Validar permissões (usuário pode fazer X?)
- Validar estado de negócio simples (vehicle não está deleted?)
- Chamar Procedure (que faz DML)

```typescript
async createTrip(dto: CreateTripDto, userId: string) {
  // Validações aqui
  const driver = await this.prisma.driver.findUnique(...);
  if (!driver) throw new BadRequestException('Driver not found');
  
  if (!driver.isActive) throw new BadRequestException('Driver is inactive');
  
  // Chamar procedure (que valida OUTRA VEZ antes de inserir), na mesma transação do set_config
  const result = await this.prisma.$transaction(async (transacao) => {
    await transacao.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return transacao.$queryRaw`CALL create_trip(..., NULL, NULL)`;
  });
  
  return result;
}
```

**Procedure (PostgreSQL):**
- Validar dependências (driver existe? vehicle existe?)
- Validar estado crítico (vehicle não está IN_MAINTENANCE?)
- Executar DML (INSERT/UPDATE)
- Retornar resultado

```sql
-- Resumo do padrão (o SQL completo está no DESIGN, seção 5.2)
CREATE OR REPLACE PROCEDURE create_trip(
  p_driver_id UUID, p_vehicle_id UUID, ..., p_created_by UUID,
  OUT id UUID,
  OUT status VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validação 1: driver existe
  IF NOT EXISTS (SELECT 1 FROM drivers WHERE id_driver = p_driver_id) THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Validação 2: vehicle existe
  IF NOT EXISTS (SELECT 1 FROM vehicles WHERE id_vehicle = p_vehicle_id) THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;
  
  -- Validação 3: vehicle não está em manutenção
  IF (SELECT status FROM vehicles WHERE id_vehicle = p_vehicle_id) = 'IN_MAINTENANCE' THEN
    RAISE EXCEPTION 'Vehicle is under maintenance';
  END IF;
  
  -- DML: inserir
  INSERT INTO trips (...) VALUES (...) RETURNING trips.id_trip INTO id;
  
  -- Retornar: procedure não tem RETURN QUERY; o resultado sai pelos parâmetros OUT
  status := 'PLANNED';
END;
$$;
```

**Trigger (PostgreSQL):**
- Validar REGRAS DE NEGÓCIO críticas ANTES de INSERT (BEFORE)
- Auditar APÓS INSERT (AFTER)
- Nunca duplicar validação da Procedure

```sql
-- Trigger de VALIDAÇÃO (antes de inserir)
CREATE TRIGGER trg_prevent_vehicle_in_maintenance_from_trip
BEFORE INSERT OR UPDATE OF fk_vehicle_id, status ON trips
FOR EACH ROW
WHEN (NEW.status IN ('PLANNED', 'IN_PROGRESS'))
EXECUTE FUNCTION fn_prevent_vehicle_in_maintenance_from_trip();

-- Função do trigger: RED FLAG se Procedure já validou isso!
-- Se Procedure já valida, trigger é redundante
CREATE FUNCTION fn_prevent_vehicle_in_maintenance_from_trip()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT status FROM vehicles WHERE id_vehicle = NEW.fk_vehicle_id) IN ('IN_MAINTENANCE', 'OUT_OF_SERVICE', 'IN_USE') THEN
    RAISE EXCEPTION 'Vehicle is not available (maintenance, out of service, or already in use)';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger de AUDITORIA (depois de inserir)
CREATE TRIGGER trg_audit_trip_changes
AFTER INSERT OR UPDATE OR DELETE ON trips
FOR EACH ROW
EXECUTE FUNCTION fn_audit_trip_changes();
-- Isso NÃO duplica lógica, só registra
```

### Checkpoint 2.2: Não duplicar lógica crítica

**Regra:** Cada validação deve estar em EXATAMENTE 1 lugar:
1. **Service** → para validações de negócio lógico (permissões, estado)
2. **Procedure** → para validações de dependência + DML
3. **Trigger** → para validações de regra SQL pura + auditoria

- [ ] Para cada validação, perguntar: "Onde essa lógica vive?"
- [ ] Não deve estar em 2+ lugares

**Exemplo CORRETO:**
- Validação "driver existe": **Procedure**
- Validação "usuário tem permissão TRIP_CREATE": **Service**
- Validação "vehicle não está IN_MAINTENANCE": **Procedure + Trigger** (camadas)
- Auditoria "registrar mudança": **Trigger**

**Exemplo ERRADO:**
- Validação "driver existe": **Service + Procedure + Trigger** (3 lugares!)

### Checkpoint 2.3: Testar Call direto a Procedure
**Quando:** Após criar cada procedure

```bash
# Testar create_trip procedure
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
-- Assumir dados de teste existem
CALL create_trip(
  '<driver_uuid>',   -- p_driver_id
  '<vehicle_uuid>',  -- p_vehicle_id
  0,                 -- p_start_km
  'Local A',
  'Local B',
  '<user_uuid>',     -- p_created_by
  NULL, NULL         -- OUT: id, status
);
-- Expected: ✓ Success com ID + status retornado
EOF
```

### Checkpoint 2.4: Testar via Service
**Quando:** Após criar controller/service

```bash
# Fazer POST /trips
curl -X POST http://localhost:3000/trips \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"vehicleId": "22222222-...", "startKm": 0, ...}'
# Expected: ✓ 201 Created
```

**✅ PASS:** Procedure funciona, Service funciona, nenhuma duplicação

---

## ⚠️ GAP ANTERIOR #3: Sem Testes em Runtime

**O que aconteceu:**
- Schema passou em `npx prisma validate`
- Mas aplicação quebrou quando operação INSERT tentou disparar trigger órfão
- Nenhum teste de runtime

**Como evitar neste projeto:**

### Checkpoint 3.1: Validação de Schema
```bash
npx prisma validate
# Expected: ✓ Validation successful
```

### Checkpoint 3.2: Testar Migrações do Zero
**Quando:** Antes de considerar projeto "completo"

```bash
# 1. Parar container
docker compose down -v

# 2. Reiniciar (banco limpo)
docker compose up -d

# 3. Aguardar healthcheck
sleep 10

# 4. Aplicar TODAS as migrations
npx prisma migrate deploy

# Expected: ✓ Migrations applied successfully
```

### Checkpoint 3.3: Verificar Integridade do Banco
```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
-- 1. Contar tabelas
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 13 (os 12 models + _prisma_migrations)

-- 2. Contar procedures
SELECT COUNT(*) FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE';
-- Expected: 6 (create_trip, start_trip, end_trip, cancel_trip, register_refueling, register_incident)

-- 3. Contar triggers (pg_trigger; information_schema.triggers conta um por evento e mostraria 26)
SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal;
-- Expected: 12 (prevent_vehicle_in_maintenance_from_trip, prevent_driver_double_active_trip, etc)

-- 4. Verificar audit_logs NÃO foi deletada
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs');
-- Expected: true (tabela existe)

-- 5. Verificar que todo trigger tem função (nenhum órfão) e contar os CHECKs
SELECT COUNT(*) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid WHERE NOT t.tgisinternal;
-- Expected: 12
SELECT COUNT(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace;
-- Expected: 26
EOF
```

### Checkpoint 3.4: Testar Operações CRUD
**Quando:** Depois de aplicar migrations

```bash
docker exec -i fleet_postgres psql -U postgres -d fleet_db << 'EOF'
-- Rodar seed primeiro
-- Depois:

-- 1. Inserir trip (testa trigger de validação + auditoria)
CALL create_trip(..., NULL, NULL);
-- Expected: ✓ Sucesso

-- 2. Tentar inserir 2ª trip ativa (testa trigger de bloqueio)
CALL create_trip(..., NULL, NULL);
-- Expected: ✗ Error: Driver already has an active trip

-- 3. Verificar audit_log foi criado
SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'TRIP' AND action = 'CREATE';
-- Expected: ≥ 1
EOF
```

### Checkpoint 3.5: Rodar Build de Produção
```bash
npm run build
# Expected: ✓ Compilação sucede, nenhum erro TypeScript

npm run start
# Expected: ✓ Aplicação inicia, porta 3000 escuta
```

### Checkpoint 3.6: Rodar 10 Testes E2E
```bash
npm run test:e2e
# Expected: ✓ Todos os 10 testes passam
```

**✅ PASS:** Migrações aplicam, banco está integro, triggers funcionam, testes passam

---

## ⚠️ GAP ANTERIOR #4: Campos Mortos

**O que aconteceu:**
- `Visitor.cpf` foi declarado no Prisma schema
- Mas nunca foi usado em: Service, DTO, testes
- Resultado: campo dead code, confusão

**Como evitar neste projeto:**

### Checkpoint 4.1: Revisar Schema vs Implementação

Após criar Resource (ex: Users), verificar:

- [ ] **Cada campo no schema:**
  - Está em CreateDTO? ✓ ou (justificar se não)
  - Está em UpdateDTO? ✓ ou (justificar se não)
  - Está em ResponseDTO? ✓ ou (justificar se não)
  - É retornado em GET? ✓ ou (justificar se não)
  - É testado? ✓ ou (justificar se não)

```typescript
// ✓ CORRETO: campo está em todos os DTOs
export class CreateTripsDto {
  driverId: string;  // Usado ✓
  vehicleId: string; // Usado ✓
  startKm: number;   // Usado ✓
  startLocation: string; // Usado ✓
}

// ✗ ERRADO: campo está no schema mas não nos DTOs
model Trip {
  ...
  startKm: Int;           // Usado ✓
  endKm: Int;             // Usado ✓
  crypticField: String;   // Nunca usado ✗ → REMOVER do schema
}
```

### Checkpoint 4.2: Princípio YAGNI (You Aren't Gonna Need It)

- [ ] Adicionar campo ao schema APENAS se for usar em 1+ dos seguintes:
  - [ ] Filtro/busca (ex: GET /trips?status=COMPLETED)
  - [ ] Agregação (ex: analytics calcula em cima disso)
  - [ ] Validação (ex: trigger valida valor)
  - [ ] Output/response (ex: retornado em GET)
  - [ ] Teste (ex: teste valida esse campo)

**Se nenhuma das acima:** não adicionar ao schema

### Checkpoint 4.3: Auditoria de Schema

**Quando:** Antes de considerar design "aprovado"

```bash
# 1. Listar todos os campos do schema
# Exemplo para model Trip:
grep -A 50 "model Trip {" prisma/schema.prisma | grep -v "^--"

# 2. Para cada campo, responder: "Onde é usado?"
# - startKm: usado em CreateTripDto, UpdateTripDto, procedure validation, trigger validation, test_1, test_10
# - endKm: usado em UpdateTripDto, procedure validation, test_10, analytics
# - crypticField: ??? → REMOVER

# 3. Se campo não tem "onde é usado" → remover
```

**✅ PASS:** Schema é enxuto, nenhum campo morto

---

## 📋 QUICK CHECKLIST (30 min antes de entregar)

```bash
# 1. Schema validation
npx prisma validate
✓ Validation successful

# 2. Migrations zero
docker compose down -v
docker compose up -d
npx prisma migrate deploy
✓ All migrations applied

# 3. Integridade (cada consulta roda com: docker exec fleet_postgres psql -U postgres -d fleet_db -c "<consulta>")
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
✓ Result: 13 (12 models + _prisma_migrations)

SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE';
✓ Result: 6

SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal;
✓ Result: 12 (todos os triggers)

SELECT COUNT(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace;
✓ Result: 26 (CHECKs)

# 4. Nenhum trigger órfão (todo trigger tem função)
SELECT COUNT(*) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid WHERE NOT t.tgisinternal;
✓ Result: 12

# 5. Audit log não foi deletado
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs');
✓ Result: true

# 6. Build
npm run build
✓ Compilation successful

# 7. Testes
npm test
✓ All 10 E2E tests pass

# 8. App inicia
npm run start
✓ Listening on port 3000
```

---

## 🚨 RED FLAGS (parar e corrigir)

- [ ] `DROP TABLE audit_logs` em qualquer migration
- [ ] `INSERT INTO audit_log` (nome errado da tabela)
- [ ] Trigger apontando para tabela que foi dropada
- [ ] Campo no schema mas não em nenhum DTO
- [ ] Validação duplicada em Service + Procedure + Trigger
- [ ] `npx prisma validate` com erro
- [ ] Testes E2E falhando
- [ ] `npm run build` com erro

**Se alguma RED FLAG aparecer:** parar, corrigir, voltar aos checkpoints

---

**Documento Pronto! ✅**

