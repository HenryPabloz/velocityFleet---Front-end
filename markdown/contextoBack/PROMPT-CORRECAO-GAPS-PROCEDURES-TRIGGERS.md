> **Histórico:** já aplicado, veja o DESIGN seções 5 e 6 (`2025-01-FROTA-DESIGN.md`).

# 🔧 PROMPT PARA CLAUDE CODE
## Correção de Gaps em Procedures e Triggers — Banco de Dados

> **Copie e cole este prompt inteiro no Claude Code para corrigir todos os gaps**

---

```
Você é um especialista em PostgreSQL e segue práticas rigorosas de integridade de banco de dados.

CONTEXTO:
Projeto: Gestão de Frota Corporativa
Database: PostgreSQL 15
ORM: Prisma 7.10.0
Stack: NestJS + TypeScript

TAREFA:
Revisar e CORRIGIR TODAS as procedures e triggers com gaps de lógica de banco de dados.
NÃO deixar nenhum gap passar. Ser RIGOROSO com validações e atualizações de estado.

PROCEDURES A CORRIGIR:

1. create_trip(p_driver_id, p_vehicle_id, p_start_km, p_start_location, p_end_location, p_created_by)
   
   GAPS IDENTIFICADOS:
   ❌ Não valida se vehicle.status = OUT_OF_SERVICE (bloqueia trips)
   ❌ Não valida se vehicle.status = IN_USE (já tem trip ativa)
   ❌ Não valida se driver.isActive = false
   ❌ Não valida se p_start_km < 0 (km não pode ser negativo)
   ❌ Não valida se p_start_km < vehicle.currentMileage (km inicial não pode ser menor que atual)
   ❌ Não valida se p_start_km está alinhado com mileagem real
   ❌ Não atualiza vehicle.status para PLANNED (ou estado apropriado)
   
   CORREÇÃO ESPERADA:
   - Adicionar TODAS as validações acima
   - Validar: vehicle.isActive = true
   - Validar: driver.isActive = true
   - Adicionar mensagens de erro específicas para cada validação
   - Atualizar vehicle.status para PLANNED? (ou deixar como está e controlar via status da trip?)
   - DECIDIR: Vehicle vai para PLANNED ou fica AVAILABLE até start_trip?
   - Retornar resultado com mensagem clara


2. start_trip(p_trip_id, p_current_mileage)
   
   GAPS IDENTIFICADOS:
   ❌ Não valida se p_current_mileage <= vehicle.currentMileage (não pode ter km menor que mileagem atual)
   ❌ Não atualiza trip.start_time = NOW() (falta timestamp de início real)
   ❌ Não atualiza vehicle.status = 'IN_USE' (CRÍTICO: outras procedures precisam saber que vehicle está em uso)
   ❌ Não faz double-check de vehicle.status != IN_MAINTENANCE (validação redundante mas segura)
   ❌ Não valida se trip.driver_id existe ainda (soft delete check)
   
   CORREÇÃO ESPERADA:
   - Adicionar validação: p_current_mileage >= vehicle.currentMileage
   - SEMPRE atualizar trip.start_time = NOW()
   - SEMPRE atualizar vehicle.status = 'IN_USE'
   - Adicionar check redundante de manutenção (camadas de defesa)
   - Retornar trip com status IN_PROGRESS e start_time


3. end_trip(p_trip_id, p_end_mileage, p_end_location)
   
   GAPS IDENTIFICADOS:
   ❌ Não valida se p_end_mileage >= vehicle.currentMileage (não pode terminar com km menor que mileagem atual)
   ❌ Não atualiza trip.end_time = NOW() (CRÍTICO: falta timestamp de finalização)
   ❌ Não atualiza vehicle.currentMileage = p_end_mileage (CRÍTICO: mileagem não é propagada para vehicle)
   ❌ Não atualiza vehicle.status = 'AVAILABLE' (CRÍTICO: vehicle continua IN_USE indefinidamente)
   ❌ Não valida se end_time > start_time (pode terminar antes de começar)
   ❌ Não valida se trip realmente está IN_PROGRESS (double check)
   
   CORREÇÃO ESPERADA:
   - Adicionar validação: p_end_mileage >= vehicle.currentMileage
   - SEMPRE atualizar trip.end_time = NOW()
   - SEMPRE atualizar vehicle.currentMileage = p_end_mileage (propagar mileagem)
   - SEMPRE atualizar vehicle.status = 'AVAILABLE'
   - Validar: trip.start_time < NOW() (pelo menos 1 segundo)
   - Calcular: total_km = p_end_mileage - start_km
   - Retornar trip completo com all timestamps e vehicle.currentMileage atualizado


4. register_refueling(p_vehicle_id, p_driver_id, p_mileage, p_liters, p_cost_per_liter, p_fuel_type, p_registered_by)
   
   GAPS IDENTIFICADOS:
   ❌ Não valida se p_mileage > 0 (litros não pode ser zero ou negativo)
   ❌ Não valida se p_mileage >= vehicle.currentMileage (abastecimento não pode ocorrer com km regressivo)
   ❌ Não valida se p_liters > 0 (litros deve ser positivo)
   ❌ Não valida se p_cost_per_liter > 0 (custo deve ser positivo)
   ❌ Não valida se p_fuel_type é um dos valores válidos: DIESEL, GASOLINE, ETHANOL, HYBRID
   ❌ Não atualiza vehicle.currentMileage = p_mileage (CRÍTICO: mileagem do abastecimento não é registrada)
   ❌ Não valida se vehicle existe e isActive = true
   ❌ Não valida se driver existe e isActive = true
   
   CORREÇÃO ESPERADA:
   - Adicionar validação de todos os parâmetros numéricos > 0
   - Adicionar validação: p_mileage >= vehicle.currentMileage
   - Adicionar validação: p_fuel_type IN ('DIESEL', 'GASOLINE', 'ETHANOL', 'HYBRID')
   - Adicionar validação: vehicle.isActive = true
   - Adicionar validação: driver.isActive = true
   - SEMPRE atualizar vehicle.currentMileage = p_mileage
   - Calcular: total_cost = p_liters * p_cost_per_liter
   - Retornar refueling com id, total_cost e confirmação de mileagem atualizada


5. register_incident(p_trip_id, p_vehicle_id, p_driver_id, p_incident_type, p_severity, p_description, p_photo_url, p_photo_key, p_registered_by)
   
   GAPS IDENTIFICADOS:
   ❌ Não valida se p_trip_id (quando fornecido) existe
   ❌ Não valida se p_trip_id pertence ao p_vehicle_id (integridade referencial)
   ❌ Não valida se p_trip_id está em status IN_PROGRESS (incident apenas durante trip ativa)
   ❌ Não valida se vehicle existe e isActive = true
   ❌ Não valida se driver existe e isActive = true
   ❌ Não valida se p_incident_type IN ('ACCIDENT', 'MECHANICAL_FAILURE', 'OTHER')
   ❌ Não valida se p_severity IN ('LOW', 'MEDIUM', 'HIGH')
   ❌ Não valida se p_description não está vazia
   ❌ Não valida tamanho de p_description (máximo 1000 caracteres)
   ❌ Não valida se p_photo_url é URL válida (se fornecida)
   ❌ Não bloqueia/finaliza trip após incident crítico
   ❌ Não atualiza trip.status = 'BLOCKED' ou similar se ACCIDENT/HIGH severity
   
   CORREÇÃO ESPERADA:
   - Adicionar validação de todos os enums (incident_type, severity)
   - Adicionar validação de integridade: trip_id pertence a vehicle_id
   - Adicionar validação: trip.status = IN_PROGRESS (se trip_id fornecido)
   - Adicionar validação: description não vazia E <= 1000 caracteres
   - Adicionar validação: vehicle.isActive = true
   - Adicionar validação: driver.isActive = true
   - CONDICIONAL: Se incident_type = 'ACCIDENT' E severity = 'HIGH' → trip.status = 'BLOCKED' ou fica como está?
   - Retornar incident com id, status=REPORTED, timestamp


TRIGGERS A CORRIGIR:

1. prevent_vehicle_in_maintenance_from_trip
   
   GAPS:
   ❌ Não bloqueia se vehicle.status = OUT_OF_SERVICE
   ❌ Não bloqueia se vehicle.status = IN_USE (já tem trip ativa)
   
   CORREÇÃO:
   - Atualizar condição para: status IN ('IN_MAINTENANCE', 'OUT_OF_SERVICE', 'IN_USE')
   - Mensagem: "Vehicle is not available (maintenance, out of service, or already in use)"


2. prevent_driver_double_active_trip
   
   GAPS:
   ❌ Implicitamente bloqueia CANCELLED (talvez não deveria, mas está correto)
   
   STATUS: OK (sem gaps)


3. prevent_vehicle_double_active_trip
   
   GAPS:
   ❌ Implicitamente bloqueia CANCELLED (talvez não deveria, mas está correto)
   
   STATUS: OK (sem gaps)


4. validate_trip_kilometers
   
   GAPS:
   ❌ Não valida se start_km < 0
   ❌ Não valida se end_km < 0 (quando fornecido)
   
   CORREÇÃO:
   - Adicionar validação: start_km >= 0
   - Adicionar validação: end_km >= 0 (se não null)
   - Manter validação existente: end_km >= start_km


5. audit_trip_changes
   
   GAPS:
   ❌ Como obtém updated_by em UPDATE? Campo não existe em trips (updated_by não é foreign key)
   ❌ Procedure não passa updated_by como parâmetro
   ❌ Não há tratamento de erro se audit_logs não existir
   ❌ Pode falhar silenciosamente
   
   CORREÇÃO:
   - DECIDIR: Como rastrear quem atualiza trip em UPDATE?
   - OPÇÃO 1: Adicionar coluna updated_by em trips
   - OPÇÃO 2: Usar current_user do PostgreSQL (mas não sempre funciona)
   - OPÇÃO 3: Passar updated_by como parâmetro implícito (via context)
   - Adicionar BEGIN/EXCEPTION para garantir que falhas são loggadas
   - Testar: INSERT em audit_logs sempre funciona, mesmo se tabela não existir (deve falhar)


6. audit_refueling_changes
   
   GAPS: Mesmos de audit_trip_changes


7. audit_incident_changes
   
   GAPS: Mesmos de audit_trip_changes


REGRAS DE VALIDAÇÃO GERAIS:

✅ SEMPRE validar existência de ForeignKeys (exceto se FK constraint faz isso)
✅ SEMPRE validar valores de ENUM antes de INSERT
✅ SEMPRE validar valores numéricos > 0 quando apropriado
✅ SEMPRE validar strings não vazias
✅ SEMPRE atualizar timestamps em INSERT/UPDATE
✅ SEMPRE atualizar status do vehicle quando estado muda
✅ SEMPRE manter mileagem sincronizada (não deixar desatualizada)
✅ SEMPRE usar mensagens de erro específicas
✅ NUNCA deixar estado inconsistente (ex: vehicle IN_USE mas sem trip ativa)
✅ NUNCA dropar validação existente que funciona


DECISÕES ARQUITETURAIS A CONFIRMAR:

1️⃣ Vehicle Status Flow:
   Deve ser: AVAILABLE → PLANNED (create_trip) → IN_USE (start_trip) → AVAILABLE (end_trip)?
   OU: AVAILABLE → IN_USE (start_trip) → AVAILABLE (end_trip)?
   OU: trip.status controla tudo e vehicle.status fica como está?

2️⃣ Refueling Timing:
   Pode registrar refueling durante trip IN_PROGRESS?
   Deve atualizar vehicle.currentMileage em refueling ou apenas em end_trip?

3️⃣ Incident Severity:
   Incident ACCIDENT/HIGH deve bloquear trip ou apenas registrar?
   Trip continua IN_PROGRESS após incident ou muda de status?

4️⃣ Audit Updates:
   Quem é considerado "changed_by" em UPDATE? (não há updated_by em trips)
   Como passar context de usuário para triggers?


SAÍDA ESPERADA:

1. File: prisma/migrations/[timestamp]_fix_procedures_triggers/migration.sql
   - Dropar TODAS as procedures com gaps
   - Dropar TODAS as trigger functions com gaps
   - Criar NOVAS versões corrigidas com TODAS as validações
   - Testar cada uma
   - Mensagens de erro claras

2. Confirmação textual:
   - Listar cada gap corrigido
   - Decidir sobre arquitetura (vehicle status flow, etc)
   - Confirmar que nenhum gap foi deixado

3. Relatório de testes:
   - Test cada procedure com valores válidos e inválidos
   - Test cada trigger com casos de bloqueio
   - Confirmar que audit_log registra tudo
   - Confirmar que vehicle.currentMileage sempre sincronizada


⚠️ CRÍTICO:
Nenhum gap deve ser deixado. Ser RIGOROSO. Validar TUDO.
Vehicle.currentMileage NUNCA pode ficar desatualizado.
Vehicle.status NUNCA deve ser inconsistente.
Trip NUNCA pode ficar em estado inválido.
Refueling NUNCA pode registrar sem atualizar mileagem.

Começar agora!
```

---

## 📋 Como Usar Este Prompt

1. **Copie o prompt inteiro** (entre as 3 aspas)
2. **Abra Claude Code** (ou use skill subagent-driven-development)
3. **Cole o prompt** na conversa
4. **Claude Code irá:**
   - Analisar cada procedure e trigger
   - Identificar todos os gaps listados
   - Criar migration .sql com correções
   - Fornecer relatório de validações

---

## ✅ Gaps Confirmados para Corrigir

### **PROCEDURES:**
- ❌ create_trip: 6 validações faltando
- ❌ start_trip: 4 correções críticas
- ❌ end_trip: 5 correções críticas
- ❌ register_refueling: 8 validações faltando
- ❌ register_incident: 10 validações faltando

### **TRIGGERS:**
- ❌ prevent_vehicle_in_maintenance_from_trip: 2 status faltando
- ❌ audit_*_changes (3 triggers): Como rastrear updated_by?

### **TOTAL: 35+ gaps identificados**

---

## 🚨 Gaps Críticos (Bloqueiam Funcionamento)

1. **vehicle.currentMileage nunca é atualizado** (end_trip, register_refueling)
2. **vehicle.status nunca é atualizado** (start_trip, end_trip)
3. **end_trip não registra timestamps** (end_time faltando)
4. **Vehicle pode ficar IN_USE indefinidamente**
5. **Refueling não sincroniza mileagem**
6. **Incident pode ficar sem validação**

---

**Pronto para usar! 🚀**

