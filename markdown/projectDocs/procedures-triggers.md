# Procedures e Triggers do banco

> Levantado direto no banco (`docker exec fleet_postgres psql`) e nas migrations em `prisma/migrations/`. Banco: PostgreSQL 15, schema `public`.

## Resumo

| Item | Contagem real |
|---|---|
| Procedures (`information_schema.routines`, `routine_type = 'PROCEDURE'`) | **6** |
| Triggers (`pg_trigger` sem os internos) | **13** |
| CHECKs (`pg_constraint`, `contype = 'c'`) | **26** |
| Migrations aplicadas | **22** |

Consulta usada para conferir:

```sql
SELECT
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE') AS procedures,
  (SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal) AS triggers,
  (SELECT COUNT(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace) AS checks;
```

As procedures e triggers evoluíram em várias migrations (a versão vigente de cada uma nem sempre é a da migration onde ela nasceu — várias foram reescritas por `CREATE OR REPLACE` em migrations posteriores). Este documento descreve o comportamento **atual** de cada uma, já considerando a última reescrita.

---

## Procedures (6)

Todas são `PROCEDURE` (não `FUNCTION`) com parâmetros `OUT`, chamadas via `CALL` — cada `NULL` extra na chamada corresponde a um `OUT`. São `SECURITY DEFINER` e o `EXECUTE` de `PUBLIC` foi revogado (migration `20260921186000_concurrency_and_procedures`); hoje quem chama é o dono do banco (usuário da `DATABASE_URL`). O back-end (`TripsService`, `RefuelingsService`, `IncidentsController`) chama todas dentro de uma transação Prisma (`$transaction`), depois de rodar `SELECT set_config('app.current_user_id', '<uuid>', true)` — é esse valor que os triggers de auditoria usam para saber quem fez a mudança.

Erros de validação de negócio saem como `RAISE EXCEPTION` (SQLSTATE `P0001`); o back-end traduz o texto da mensagem para o status HTTP certo (400/404/409, conforme o caso).

**Veículo inativo (`vehicles.is_active = false`):** `create_trip`, `start_trip`, `register_refueling` e `register_incident` recusam o veículo com `RAISE EXCEPTION 'Vehicle is not active'`, traduzido para `409` (migration `20260924150000_block_inactive_vehicle_in_procedures`). `is_active` é gravado pelo soft delete (`false`) e pelo restore (`true`), não pela API diretamente. `end_trip` e `cancel_trip` não checam (uma viagem em andamento sempre pode ser encerrada ou cancelada).

### `create_trip`

- **Tabelas afetadas:** lê `users`, `drivers`, `vehicles`; escreve em `trips` e `vehicles`.
- **Disparo:** chamada manual, por `TripsService.criar()` (rota `POST /trips`).
- **Assinatura:** `create_trip(p_driver_id, p_vehicle_id, p_start_location, p_end_location, p_created_by, OUT id, OUT status)` — **sem parâmetro de km** (migration `20260924160000_trip_start_km_from_vehicle`).
- **O que faz:**
  - Confere que quem criou (`p_created_by`) existe e está ativo.
  - Valida `start_location`/`end_location` (trim, não vazio, até 255 caracteres) — hoje o app já manda o endereço resolvido pelo ViaCEP, não o CEP.
  - Confere que o motorista existe, está ativo, o usuário dele está ativo e a CNH (`license_expiry`) não está vencida.
  - Trava a linha do veículo (`FOR UPDATE`), exige que esteja ativo (`Vehicle is not active`) e `status = AVAILABLE` (rejeita `IN_USE`, `IN_MAINTENANCE`, `OUT_OF_SERVICE`, cada um com mensagem própria).
  - Insere a viagem com `status = PLANNED` e `start_km` **provisório = `vehicles.current_mileage`** (o km real é gravado depois por `start_trip`) e, na sequência, força `vehicles.status = IN_USE` (o trigger `trg_sync_vehicle_from_trip` já faria isso; a procedure garante mesmo assim).
- **Por que existe:** é o único caminho para nascer uma viagem — garante que veículo e motorista estão em condição de rodar antes de reservar o veículo, sem depender só de validação da aplicação (que poderia ser contornada por outro cliente batendo direto no banco).

### `start_trip`

- **Tabelas afetadas:** lê/escreve `trips`; escreve `vehicles`.
- **Disparo:** chamada manual, por `TripsService.iniciar()` (rota `PATCH /trips/:id/start`, body `{ currentMileage }`).
- **Assinatura:** `start_trip(p_trip_id, p_vehicle_id, p_current_mileage, OUT id, OUT status, OUT start_time)`.
- **O que faz:**
  - Exige `p_vehicle_id` informado.
  - Trava a viagem (`FOR UPDATE`) e exige `status = PLANNED`.
  - Confere que o veículo informado é o mesmo da viagem.
  - Confere que o motorista da viagem continua ativo.
  - Trava o veículo de novo (segunda camada de defesa), exige que esteja ativo (`Vehicle is not active`) e rejeita `IN_MAINTENANCE`/`OUT_OF_SERVICE`.
  - Valida `p_current_mileage` (a leitura real do hodômetro, vinda de `PATCH /trips/:id/start` no campo `currentMileage`): não pode ser nula nem menor que a quilometragem atual do veículo, e respeita o teto de 10.000.000.
  - Muda a viagem para `IN_PROGRESS` com `start_time = NOW()` e **`start_km = p_current_mileage`** (vira o `startKm` definitivo), e o veículo para `IN_USE` com a quilometragem nova.
- **Por que existe:** é o ponto em que o km de partida real entra na viagem e a quilometragem "oficial" do veículo é atualizada, e garante que a viagem só sai do papel se motorista e veículo ainda estiverem aptos (podem ter mudado de estado entre o create e o start).

### `end_trip`

- **Tabelas afetadas:** lê/escreve `trips`; escreve `vehicles`.
- **Disparo:** chamada manual, por `TripsService.finalizar()` (rota `PATCH /trips/:id/end`).
- **Assinatura:** `end_trip(p_trip_id, p_end_mileage, p_end_location, OUT id, OUT status, OUT total_km, OUT start_time, OUT end_time, OUT vehicle_mileage)`.
- **O que faz:**
  - Valida `end_location` (trim, não vazio, até 255 caracteres).
  - Trava a viagem e exige `status = IN_PROGRESS`.
  - Valida `p_end_mileage`: não pode ser menor que `start_km` nem que a quilometragem atual do veículo, respeita o teto de 10.000.000.
  - Calcula `end_time` com `clock_timestamp()` truncado em milissegundos e exige que seja depois de `start_time`.
  - Marca a viagem `COMPLETED`, grava `end_km`/`end_location`/`end_time`, e atualiza `vehicles.current_mileage`.
  - Libera o veículo (`IN_USE -> AVAILABLE`) só se ele ainda estiver `IN_USE` — quem faz a transição de status "de verdade" (olhando se não sobrou outra viagem ativa) é o trigger `trg_sync_vehicle_from_trip`, disparado pelo `UPDATE` de `status`/`end_km` feito aqui.
  - `total_km` de saída é calculado como `end_mileage - start_km`.
- **Por que existe:** fecha o ciclo de vida da viagem com os dois números batendo (km da viagem e km do veículo), e nunca deixa uma viagem `COMPLETED` sem `end_km`/`end_time` (reforçado também pelo CHECK `ck_trips_completed_requires_end`).

### `cancel_trip`

- **Tabelas afetadas:** lê/escreve `trips`; escreve `vehicles`.
- **Disparo:** chamada manual, por `TripsService.cancelar()` (rota `PATCH /trips/:id/cancel`).
- **Assinatura:** `cancel_trip(p_trip_id, OUT id, OUT status)`.
- **O que faz:**
  - Trava a viagem e exige `status IN (PLANNED, IN_PROGRESS)` — viagem já `COMPLETED`/`CANCELLED` não pode ser cancelada de novo.
  - Marca `status = CANCELLED`.
  - Libera o veículo (`IN_USE -> AVAILABLE`) só se ele estiver `IN_USE` **e** não houver nenhuma outra viagem `PLANNED`/`IN_PROGRESS` dele (proteção contra o caso de duas viagens apontarem pro mesmo veículo).
- **Por que existe:** é a única forma de tirar uma viagem do meio do caminho sem deixar o veículo "preso" em `IN_USE` — sem essa procedure, cancelar seria um `UPDATE` direto que não sabe se deve liberar o veículo.

### `register_refueling`

- **Tabelas afetadas:** lê `users`, `vehicles`, `drivers`, `trips`; escreve `refuelings` e `vehicles`.
- **Disparo:** chamada manual, por `RefuelingsService.criar()` (rota `POST /refuelings`).
- **Assinatura:** `register_refueling(p_vehicle_id, p_driver_id, p_mileage, p_liters, p_cost_per_liter, p_fuel_type, p_registered_by, OUT id, OUT total_cost, OUT vehicle_mileage)`.
- **O que faz:**
  - Confere que quem registrou existe.
  - Arredonda `liters` (2 casas) e `cost_per_liter` (4 casas) **antes** de validar e calcular — é isso que faz o valor gravado bater com o CHECK `ck_refuelings_total_cost_matches` (`total_cost = ROUND(liters_added * cost_per_liter, 2)`).
  - Valida faixas: quilometragem > 0 e até o teto, litros e custo/litro positivos e dentro do limite das colunas (`liters <= 99999999.99`, `cost_per_liter <= 999999.9999`, `total_cost <= 9999999999.99`).
  - Valida `fuel_type` (`DIESEL`, `GASOLINE`, `ETHANOL`, `HYBRID`).
  - Trava o veículo, exige que esteja ativo (`Vehicle is not active`) e rejeita `OUT_OF_SERVICE`.
  - Confere que o motorista existe e está ativo.
  - Se o veículo está com uma viagem `IN_PROGRESS`, exige que seja o motorista **dessa** viagem quem está abastecendo.
  - Quilometragem não pode retroceder em relação à do veículo.
  - Insere o abastecimento com `total_cost` calculado (nunca aceito do cliente) e atualiza `vehicles.current_mileage`.
- **Por que existe:** garante que o custo total sempre é litros × preço (sem depender do cliente mandar o valor certo) e que a quilometragem do abastecimento é coerente com a viagem em andamento, se houver uma.

### `register_incident`

- **Tabelas afetadas:** lê `users`, `vehicles`, `drivers`, `trips`; escreve `incidents`.
- **Disparo:** chamada manual, por `IncidentsService` (via `IncidentsController.criar()`, rota `POST /incidents`, multipart).
- **Assinatura:** `register_incident(p_trip_id, p_vehicle_id, p_driver_id, p_incident_type, p_severity, p_description, p_photo_url, p_photo_key, p_registered_by, OUT id, OUT status, OUT created_at)`.
- **O que faz:**
  - Confere que quem registrou existe.
  - Valida `incident_type` (`ACCIDENT`, `MECHANICAL_FAILURE`, `OTHER`), `severity` (`LOW`, `MEDIUM`, `HIGH`), `description` (trim, não vazia, até 1000 caracteres).
  - Se veio `photo_url`, exige que comece com `http://`/`https://` e até 500 caracteres; `photo_key` até 255 caracteres.
  - Lê o veículo, exige que esteja ativo (`Vehicle is not active`) e rejeita `OUT_OF_SERVICE`.
  - Confere que o motorista existe e está ativo.
  - `trip_id` é opcional; se vier: trava a viagem (`FOR UPDATE`, espera outra transação que esteja concluindo essa viagem), confere que é do mesmo veículo, do mesmo motorista, e que está `IN_PROGRESS`.
  - Insere o incidente com `status = REPORTED`.
- **Por que existe:** permite registrar um incidente vinculado (ou não) a uma viagem específica, sem deixar gravar um incidente "mentiroso" (viagem de outro veículo/motorista, ou viagem que já terminou).

---

## Triggers (13)

### Em `trips`

| Trigger | Evento | O que garante |
|---|---|---|
| `trg_prevent_vehicle_in_maintenance_from_trip` | `BEFORE INSERT OR UPDATE OF fk_vehicle_id, status` (só quando `NEW.status IN (PLANNED, IN_PROGRESS)`) | Bloqueia uma viagem nova/reativada para veículo `IN_MAINTENANCE`, `OUT_OF_SERVICE` ou `IN_USE`. Em `UPDATE`, só reavalia se trocou de veículo ou se a viagem estava inativa antes (evita re-checar em todo update irrelevante). `create_trip` insere a viagem antes de marcar o veículo `IN_USE`, por isso o fluxo funciona sem se autobloquear. |
| `trg_prevent_driver_double_active_trip` | `BEFORE INSERT OR UPDATE OF status, fk_driver_id` (`WHEN NEW.status IN (PLANNED, IN_PROGRESS)`) | Um motorista não pode ter duas viagens `PLANNED`/`IN_PROGRESS` ao mesmo tempo. Toma um `pg_advisory_xact_lock` (semente 1) na chave do motorista antes do `EXISTS`, para duas transações concorrentes não conseguirem criar viagem pro mesmo motorista ao mesmo tempo (corrida). |
| `trg_prevent_vehicle_double_active_trip` | `BEFORE INSERT OR UPDATE OF status, fk_vehicle_id` (`WHEN NEW.status IN (PLANNED, IN_PROGRESS)`) | Mesma regra, para veículo (advisory lock semente 2). |
| `trg_validate_trip_kilometers` | `BEFORE INSERT OR UPDATE` | `start_km` e `end_km` não podem ser negativos, e `end_km` não pode ser menor que `start_km`. |
| `trg_sync_vehicle_from_trip` | `AFTER INSERT OR DELETE OR UPDATE OF status, fk_vehicle_id, end_km` | O trigger "dono" da invariante veículo `IN_USE` <=> existe viagem ativa dele. Recalcula, para cada veículo afetado (o novo e, em troca de veículo, o antigo também), se existe viagem `PLANNED`/`IN_PROGRESS`: se sim, marca `IN_USE`; se não, marca `AVAILABLE` (só faz o `UPDATE` se o status atual permitir a transição). Também empurra `end_km` para `vehicles.current_mileage` quando a viagem termina (`COMPLETED`), sem nunca diminuir a quilometragem. |
| `trg_audit_trip_changes` | `AFTER INSERT OR UPDATE OR DELETE` | Grava uma linha em `audit_logs` por INSERT/UPDATE/DELETE. Em `UPDATE`, não grava nada se a única coluna que mudou foi `updated_at` (evita log vazio). Usa `app.current_user_id` (setado pela aplicação antes da operação); sem isso, cai para `fk_user_id` da própria linha. Se a auditoria falhar, a exceção é relançada — a operação inteira é abortada (não existe mudança sem log). |

### Em `refuelings`

| Trigger | Evento | O que garante |
|---|---|---|
| `trg_sync_vehicle_mileage_from_refueling` | `AFTER INSERT OR UPDATE OF mileage, fk_vehicle_id` | Empurra `mileage` do abastecimento para `vehicles.current_mileage`, só se for maior que a atual (nunca deixa a quilometragem do veículo regredir por causa de um abastecimento). |
| `trg_audit_refueling_changes` | `AFTER INSERT OR UPDATE OR DELETE` | Mesmo padrão de auditoria do `trg_audit_trip_changes`, para `refuelings` (`entity_type = 'REFUELING'`). |

### Em `incidents`

| Trigger | Evento | O que garante |
|---|---|---|
| `trg_audit_incident_changes` | `AFTER INSERT OR UPDATE OR DELETE` | Mesmo padrão de auditoria, para `incidents` (`entity_type = 'INCIDENT'`). |

### Em `vehicles`

| Trigger | Evento | O que garante |
|---|---|---|
| `trg_block_vehicle_in_use_on_insert` | `BEFORE INSERT` | Um veículo nunca nasce `IN_USE` — esse status só é setado pelas procedures de viagem. `AVAILABLE`, `IN_MAINTENANCE` e `OUT_OF_SERVICE` continuam livres na criação. |
| `trg_protect_vehicle_status_and_mileage` | `BEFORE UPDATE OF status, current_mileage` | Duas regras: (1) `current_mileage` nunca pode diminuir num `UPDATE` direto; (2) mudança de `status` só é aceita se for coerente com a existência (ou não) de viagem ativa — se o veículo tem viagem ativa, só pode ficar `IN_USE`; se não tem, não pode virar `IN_USE` "na mão" (mensagem `IN_USE is set only by trips`). É essa checagem que os testes de integridade do guia usam para provar que a API não deixa setar `IN_USE` manualmente. |

### Em `audit_logs`

| Trigger | Evento | O que garante |
|---|---|---|
| `trg_block_audit_logs_changes` | `BEFORE UPDATE OR DELETE` | `audit_logs` é append-only: `DELETE` e qualquer `UPDATE` são recusados com `RAISE EXCEPTION 'audit_logs is append-only'`, **exceto** a transição `fk_user_id` não nulo -> `NULL` com todas as outras colunas idênticas (anonimização do autor, migration `20260924120000_anonymize_audit_logs_author`). Fora isso, só é possível inserir. Existe pra garantir que o rastro de auditoria não possa ser adulterado nem apagado depois de gravado (nem por quem tem acesso direto ao banco) — sem isso, `trg_audit_trip_changes`/`trg_audit_refueling_changes`/`trg_audit_incident_changes` não teriam garantia nenhuma de integridade. Efeito na deleção total de usuário: `audit_logs.fk_user_id` agora é anulável, com FK `ON DELETE SET NULL`; ao apagar o usuário de vez (`DELETE /users/:id/permanent`), o banco zera o autor das linhas dele (a única mudança que o trigger aceita) e o histórico fica com autor `NULL` ("usuário removido"). **Decisão consciente:** o trigger aceita `UPDATE fk_user_id -> NULL` em qualquer linha; isso foi **aceito por design**, porque nenhum usuário nem a API tem acesso direto ao banco (não é risco, não é pendência). |
| `trg_block_audit_logs_truncate` | `BEFORE TRUNCATE` (por statement) | Triggers de linha não pegam `TRUNCATE`; este, de comando, fecha a brecha. Chama `fn_block_audit_logs_truncate()`, que faz `RAISE EXCEPTION 'audit_logs is append-only (TRUNCATE blocked)'`. Bloqueia `TRUNCATE audit_logs`, `TRUNCATE audit_logs CASCADE` e `TRUNCATE users CASCADE` (que propagaria para `audit_logs`). Migration `20260924130000_block_audit_logs_truncate`. Resolve a pendência antiga de `TRUNCATE` sem bloqueio. |

---

## CHECKs (26) — panorama rápido

Não são o foco deste documento (que é procedures/triggers), mas complementam as invariantes acima. Por tabela:

- **users (3):** `ck_users_email_normalized` (e-mail salvo em minúsculas, sem espaços), `ck_users_password_not_empty`, `ck_users_api_key_hash` (hash da API key precisa ser 64 hex ou `NULL`).
- **drivers (1):** `ck_drivers_license_number_format` (CNH com exatamente 11 dígitos).
- **vehicles (5):** ano entre 1900–2100, quilometragem (atual e da última manutenção) entre 0–10.000.000, placa normalizada (maiúscula, sem espaço nas pontas, no formato Mercosul ou antigo), modelo não vazio.
- **trips (6):** faixas de `start_km`/`end_km`, `end_km >= start_km`, `end_time >= start_time`, viagem `COMPLETED` exige `end_km` e `end_time`, locais não vazios.
- **refuelings (5):** faixa de quilometragem, litros e custo/litro positivos, custo total não negativo e igual a `ROUND(litros * custo_por_litro, 2)`.
- **maintenances (4):** custo não negativo, descrição não vazia, `completed_date >= scheduled_date`, manutenção `COMPLETED` exige `completed_date`.
- **incidents (2):** descrição não vazia, `photo_url` (quando existir) começando com `http://`/`https://`.

Consulta para listar todos: `SELECT conrelid::regclass, conname FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace ORDER BY 1, 2;`
