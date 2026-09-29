# Fleet Management — Visão geral do projeto

## 1. O que é e por que foi criado

O **Fleet Management** é uma API REST para gestão de frota corporativa (veículos, motoristas, viagens, abastecimentos, manutenções e incidentes), construída como avaliação técnica de back-end. O objetivo declarado no projeto é demonstrar, num sistema real e funcional:

- Modelagem de dados relacional com regras de integridade impostas no próprio banco (procedures, triggers, CHECKs), não só na aplicação.
- Autenticação e autorização em camadas (API key + JWT, RBAC por papel).
- Integração com uma API externa real (ViaCEP), com tratamento de erro de verdade (timeout, rate limit, bug de contrato da API).
- Boas práticas de API (paginação, filtros, soft delete, upload de arquivo, auditoria, logging, documentação Swagger).

O sistema resolve um problema concreto de gestão de frota: saber que veículo está disponível, quem está dirigindo o quê, quanto cada veículo gasta em combustível e manutenção, e manter um histórico auditável de tudo isso.

## 2. Principais funcionalidades

- **Autenticação em duas camadas, sem cadastro público:** quem tem `USER_CREATE` (ADMIN e FLEET_MANAGER) cria a conta em `POST /users`; o servidor gera a API key, grava o hash e devolve a chave em texto (`apiKey`) uma única vez, para ser entregue ao usuário. O login (`POST /auth/login`) exige e-mail + senha **e** a API key (header `x-api-key`) para devolver um JWT; as rotas de negócio usam o JWT (`Authorization: Bearer`). Também há renovação da própria API key (`PATCH /auth/regenerate-key`, exige a chave atual + `password`), reemissão da chave de outro usuário por um ADMIN (`POST /users/:id/regenerate-api-key`) e renovação de JWT (`POST /auth/refresh-token`).
- **RBAC (controle de acesso por papel e por permission):** 3 papéis (`DRIVER`, `FLEET_MANAGER`, `ADMIN`) e 44 permissions; cada rota decide quem pode acessar via `@Roles(...)` e/ou `@Permissions(...)`, avaliados pelo `RolesGuard`. A troca de papel de um usuário é `PATCH /users/:id/role` (ADMIN + `USER_ROLE_PROMOTE`/`USER_ROLE_DEMOTE`).
- **Recursos de frota** (motoristas, veículos, viagens, abastecimentos, manutenções e incidentes), com paginação e filtros em todas as listagens. O motorista não tem `POST` próprio: nasce junto com o usuário em `POST /users` (papel `DRIVER` + bloco `driver` com CNH).
- **Ciclo de vida de viagem** com 4 estados (`PLANNED -> IN_PROGRESS -> COMPLETED`, ou `CANCELLED` a qualquer momento antes de completar), implementado via procedures do banco (não é um `UPDATE` livre de status). A criação (`POST /trips`) não recebe km; a leitura real do hodômetro entra em `PATCH /trips/:id/start` (`currentMileage`).
- **Soft delete** em quase todas as entidades (`deletedAt`), com soft delete (`DELETE .../:id`) e restauração (`PATCH .../:id/restore`) delegáveis por permission (`<RECURSO>_DELETE`/`<RECURSO>_RESTORE`), e remoção definitiva/deleção total (`DELETE .../:id/permanent`, exclusiva do ADMIN por papel), implementado com uma Prisma Client Extension. Em veículos e manutenções o soft delete também grava `isActive = false` (o restore volta `true`).
- **Integração real com ViaCEP:** endereços de viagem (`startLocation`/`endLocation`) e o local inicial de um veículo são validados contra a API pública do ViaCEP antes de persistir. Só CEP inválido/inexistente dá `400`; indisponibilidade da API externa propaga como `504` (timeout, `429`) ou `502` (5xx, falha de rede), nunca como "CEP inválido".
- **Analytics/indicadores de frota:** 5 endpoints agregados (consumo de combustível, km por dia, eficiência por veículo, estatísticas por motorista, incidentes por severidade).
- **Upload de foto em incidentes:** multipart/form-data, validação de tipo (JPEG/PNG/PDF) e tamanho (até 10MB), arquivo salvo em `uploads/incidents/`.
- **Paginação e filtros** padronizados (`page`/`pageSize`, resposta `{ data, pagination }`) em todos os GETs de listagem, com filtros específicos por recurso (status, papel, motorista, veículo, severidade).
- **Logging estruturado:** um interceptor global loga uma linha por requisição (método, rota, status, duração, usuário), sem nunca logar corpo, headers, senha, token ou API key.
- **Auditoria append-only:** toda mudança em `trips`, `refuelings` e `incidents` gera uma linha em `audit_logs` (trigger de banco), e a tabela recusa `DELETE`, `TRUNCATE` e qualquer `UPDATE`, exceto a anonimização do autor (`fk_user_id` -> `NULL`, quando o usuário é apagado de vez).

## 3. Requisitos técnicos implementados

### Stack (versões reais, de `package-lock.json`)

| Pacote | Versão resolvida |
|---|---|
| `@nestjs/common` / `@nestjs/core` / `@nestjs/platform-express` | 11.2.5 |
| `@nestjs/config` | 12.0.0 |
| `@nestjs/jwt` | 12.0.2 |
| `@nestjs/passport` | 12.0.0 |
| `@nestjs/swagger` | 11.4.7 |
| `@nestjs/throttler` | 6.7.0 |
| `@nestjs/axios` | 12.0.1 |
| `@prisma/client` / `@prisma/adapter-pg` / `prisma` | 7.10.0 |
| `typescript` | 5.9.3 |
| `bcrypt` | 6.0.0 |
| `joi` | 18.2.9 |
| `class-validator` | 0.15.1 |
| `class-transformer` | 0.5.1 |
| `helmet` | 8.3.0 |
| `pg` | 8.23.0 |
| `multer` | 2.4.0 |

Banco: **PostgreSQL 15** (`postgres:15-alpine`, container `fleet_postgres`, porta local 5433).

### Arquitetura

- **NestJS modular:** um módulo por recurso (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`, `analytics`, `auth`), cada um com `controller`/`service`/`dto`/`module` próprios, seguindo o padrão `Controller -> Service -> PrismaService`.
- **Prisma 7 com `provider = "prisma-client"`:** o client sai de `src/generated/prisma` (não de `@prisma/client` importado direto), e a conexão usa um adapter (`@prisma/adapter-pg`) construído no `PrismaService` a partir da `DATABASE_URL` validada.
- **`DatabaseModule` global** (`@Global()`): expõe o `PrismaService` para todo o app sem precisar reimportar o módulo em cada lugar.
- **12 models + 9 enums** no `schema.prisma`: `User`, `Role`, `Permission`, `RolePermission`, `UserPermission`, `Driver`, `Vehicle`, `Trip`, `Refueling`, `Maintenance`, `Incident`, `AuditLog`; enums `VehicleStatus`, `TripStatus`, `FuelType`, `MaintenanceType`, `MaintenanceStatus`, `IncidentType`, `Severity`, `IncidentStatus`, `AuditAction`.
- **22 migrations** aplicadas (confirmado no diretório `prisma/migrations`), cobrindo: tabelas base, 6 procedures, 13 triggers, 26 CHECKs, índices, API key, soft delete, o ajuste de formato de placa/CNH, `20260924120000_anonymize_audit_logs_author` (autor de `audit_logs` anulável), `20260924130000_block_audit_logs_truncate` (trigger que bloqueia `TRUNCATE` em `audit_logs`), `20260924140000_add_is_active_vehicles_maintenances` (`isActive` em `vehicles` e `maintenances`), `20260924150000_block_inactive_vehicle_in_procedures` (as 4 procedures que usam veículo recusam veículo inativo) e, por último, `20260924160000_trip_start_km_from_vehicle` (`create_trip` sem km; `start_trip` recebe a leitura do hodômetro).

### Decisões técnicas relevantes

- **Prisma Client Extension para soft delete:** em vez de filtrar `deletedAt: null` manualmente em cada consulta, `src/database/soft-delete.extension.ts` intercepta as operações de leitura dos modelos com soft delete e aplica o filtro automaticamente. Como `$extends()` no Prisma 7 devolve um client novo (não dá para "estender a classe"), o `PrismaService` expõe os dois: o client normal (`this`, herdado de `PrismaClient`) e `this.comSoftDelete` (o client extendido), usado pelos resources que precisam ignorar/soft-deletar.
- **`useContainer` do `class-validator` apontando para o DI do Nest:** necessário porque `@IsValidCep()` é um `@ValidatorConstraint({ async: true })` que injeta o `ViaCepService` real via `@Injectable()` — sem `useContainer(app.select(AppModule), { fallbackOnErrors: true })` em `main.ts`, o `class-validator` usaria seu próprio container e a injeção falharia.
- **Regras de negócio em procedures, não só no `Service`:** `create_trip`/`start_trip`/`end_trip`/`cancel_trip`/`register_refueling`/`register_incident` rodam no banco, dentro de transação, com `FOR UPDATE`/advisory locks para concorrência. O `Service` chama a procedure e traduz o `RAISE EXCEPTION` (SQLSTATE `P0001`) pelo texto da mensagem para o status HTTP certo — a validação "de verdade" não pode ser contornada por outro cliente que bata direto no banco.
- **Auditoria via `set_config`:** antes de cada operação que precisa ser auditada, o app roda `SELECT set_config('app.current_user_id', '<uuid>', true)` na mesma transação; os triggers de auditoria leem essa configuração para saber quem fez a mudança (sem isso, cai para o `fk_user_id` da própria linha).
- **Throttling diferenciado:** limite geral de 20 requisições/minuto em toda a API (`ThrottlerGuard` global), e 5/minuto nas rotas sensíveis (`login`, `regenerate-key`, `refresh-token`), desligado quando `NODE_ENV=test` para não derrubar os testes E2E.
- **Nomenclatura em português no código de negócio**, mesmo usando bibliotecas/decorators em inglês (`@Injectable`, `@Roles`, etc.) — variáveis, métodos e comentários do domínio (ex: `servicoAuth`, `usuarioLogado`, `criar`, `listar`) ficam em PT-BR.

## 4. Rotas e regras de negócio por módulo

Todas as rotas de negócio, exceto `POST /auth/login` e `PATCH /auth/regenerate-key` (autenticadas por API key), exigem `Authorization: Bearer <jwt>` (`JwtAuthGuard`) e, quando marcado, um papel específico (`@Roles(...)`) e/ou uma permissão delegável (`@Permissions(...)`), avaliados pelo `RolesGuard`. Não existe rota pública de cadastro.

**Quem usa `@Permissions(...)` (delegável via `UserPermission`) vs `@Roles(...)` puro (fixo, nunca delegável):**

| Controller | Rotas em `@Permissions(...)` | Rotas que ficam em `@Roles(...)` |
|---|---|---|
| `users` | GET, GET/:id (`USER_VIEW`), GET deleted/all e restore (`USER_RESTORE`), POST (`USER_CREATE`), PATCH, PUT (`USER_UPDATE`), DELETE (`USER_DELETE`), `GET /me`, `PATCH /me`, `PATCH /me/password` | `PATCH /:id/role` (`@Roles('ADMIN')` + `USER_ROLE_PROMOTE`/`USER_ROLE_DEMOTE`), `POST /:id/regenerate-api-key`, deleção total |
| `drivers` | GET, GET/:id, PATCH, PUT, GET deleted/all, DELETE, restore | deleção total |
| `vehicles` | POST, PATCH, PUT, GET deleted/all, DELETE, restore | GET, GET in-use, GET not-in-use, GET/:id, deleção total |
| `trips` | GET, GET/:id, POST, cancel, GET deleted/all, DELETE, restore | start, end, deleção total |
| `refuelings` | GET, GET/:id, POST, GET deleted/all, DELETE, restore | deleção total |
| `incidents` | GET, GET/:id, POST, GET deleted/all, DELETE, restore | status, deleção total |
| `maintenances` | GET, GET/:id, POST, PATCH, PUT, GET deleted/all, DELETE, restore | deleção total |
| `analytics` | todas as 5 rotas | — |
| `audit-logs` | GET (única rota) | — |
| `roles` | `GET /roles` (`USER_CREATE` ou `USER_UPDATE`) | — |
| `permissions` | — | todas as 4 rotas (`@Roles('ADMIN')`, nunca `@Permissions`) |

**Carve-outs deliberados, sempre `@Roles('ADMIN')` (nunca só `@Permissions(...)`):**
1. **Deleção total (`DELETE .../:id/permanent`)**, exclusiva do ADMIN por papel, **sem permission**, nos 7 recursos que têm esse endpoint (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`) — remoção definitiva de dados é decisão administrativa, não uma ação que se queira delegar pontualmente.
2. **`PermissionsController` inteiro** (as 4 rotas de gestão da delegação) — se a concessão de permissão fosse ela mesma delegável, um usuário com uma permission emprestada poderia conceder permissions para outros, um escalonamento em cadeia que quebraria o modelo.
3. **`POST /users/:id/regenerate-api-key`** — reemitir a chave de outra pessoa é poder sensível, só ADMIN, não delegável.
4. **`PATCH /users/:id/role`** — `@Roles('ADMIN')` **e** a permission da direção (`USER_ROLE_PROMOTE` ou `USER_ROLE_DEMOTE`, conferida no serviço).

Além dos carve-outs acima, algumas rotas continuam em `@Roles(...)` por escolha deliberada mesmo sem ser um carve-out de segurança: `GET /vehicles`, `GET /vehicles/in-use`, `GET /vehicles/not-in-use` e `GET /vehicles/:id` ficam em `@Roles('ADMIN','FLEET_MANAGER','DRIVER')` porque a permission `VEHICLE_VIEW` do seed não cobre `DRIVER` — trocar para `@Permissions('VEHICLE_VIEW')` quebraria o acesso do motorista a ver os veículos disponíveis. `start`/`end` de viagem e o `PATCH .../status` de incidente também ficam em `@Roles(...)` porque o seed não tem um código de permission dedicado para essas ações.

### Auth (`/auth`) — `AuthController`

| Rota | Acesso | Regra principal |
|---|---|---|
| `POST /auth/login` | `ApiKeyGuard` (header `x-api-key`) | Confere e-mail + senha do corpo **e** a API key do header pertencerem ao mesmo usuário; devolve `{ accessToken, user }`, com `user: { id, email, fullName, role, permissions, driverId }` — `permissions: string[]` são as permissions efetivas (papel + delegadas) e `driverId: string \| null` é o perfil Driver ativo. Tempo de resposta não revela se o e-mail existe (compara com hash falso quando não existe). Limite: 5/min. |
| `PATCH /auth/regenerate-key` | `ApiKeyGuard` | Troca a **própria** API key. Exige a chave atual (header `x-api-key`) **e** `password` no corpo (`400` sem ela, `401` com senha errada); a antiga é invalidada na hora e a nova só aparece nesta resposta (`Cache-Control: no-store`), no formato `{ newApiKey, message }`. O JWT em uso continua válido; a chave só é usada no login. Limite: 5/min. |
| `POST /auth/refresh-token` | `JwtAuthGuard` | Troca um JWT ainda válido por um novo com a mesma carga (`sub`, `email`, `roleId`) e prazo renovado; reconfirma que a conta existe e está ativa. A resposta traz o mesmo `user` do login, inclusive `permissions` e `driverId` atualizados. Não é o mesmo fluxo de `regenerate-key` (aquele troca API key, este troca JWT). O front chama sozinho antes de expirar. Limite: 5/min. |

### Users (`/users`) — `UsersController`

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /users` | Permission `USER_VIEW` (ADMIN por papel; gerente só por delegação) | Lista usuários ativos, paginado. |
| `GET /users/deleted/all` | Permission `USER_RESTORE` (ADMIN por papel) | Lista usuários removidos (soft delete), paginado. |
| `GET /users/me` | Todos os papéis (`PROFILE_VIEW`) | Devolve os dados do próprio usuário autenticado (nunca senha/hash), mais `permissions: string[]` (efetivas: papel + delegadas) e `driverId: string \| null` (perfil Driver ativo). |
| `PATCH /users/me` | Todos os papéis (`PROFILE_UPDATE_OWN`) | Atualiza só o `fullName` do próprio usuário. E-mail, senha, `roleId` e `isActive` não entram aqui. |
| `PATCH /users/me/password` | Todos os papéis (`PASSWORD_CHANGE_OWN`) | Exige `currentPassword` correta antes de gravar `newPassword` (mesmo hash bcrypt do resto do projeto). |
| `GET /users/:id` | Permission `USER_VIEW` (ADMIN por papel; gerente só por delegação) | Busca por id. |
| `POST /users` | Permission `USER_CREATE` (ADMIN e FLEET_MANAGER) | **Único cadastro do sistema.** Cria o usuário com `roleId` explícito (e-mail único), gera a API key, grava só o hash e devolve a chave em texto (`apiKey`) **uma vez** (`Cache-Control: no-store`); nunca fica nula. Papel `DRIVER` exige o bloco `driver { licenseNumber (CNH, 11 dígitos), licenseExpiry }` e cria User + Driver de forma atômica; `driver` com outra role dá `400`. ADMIN atribui qualquer role; FLEET_MANAGER (ou quem tem `USER_CREATE` delegado e não é ADMIN) só cria `DRIVER` (`403` nas demais). |
| `PATCH /users/:id/role` | `@Roles('ADMIN')` + `USER_ROLE_PROMOTE`/`USER_ROLE_DEMOTE` | Body `{ roleId, driver? }`. Ranking `DRIVER < FLEET_MANAGER < ADMIN`; o serviço confere a permission da direção. ADMIN não é rebaixado por ninguém (`403`); ninguém muda a própria role (`409`); mesma role `409`; role inexistente `400`; alvo inexistente/soft-deletado `404`; virar `DRIVER` sem perfil exige `driver` (`400`); `driver` com outra role `400`. Vale na hora, inclusive para o JWT já emitido. |
| `POST /users/:id/regenerate-api-key` | Somente ADMIN | Reemite a chave de quem a perdeu (`200`); devolve `{ newApiKey, message }` uma vez; a antiga deixa de valer. (Atenção: `POST /users` devolve a chave no campo `apiKey`; as duas rotas de regeneração devolvem `newApiKey`.) |
| `PATCH /users/:id` | Permission `USER_UPDATE` (ADMIN por papel) | Atualiza só `fullName` e `isActive` (ambos opcionais) — e-mail, senha e `roleId` não entram aqui (`roleId` enviado dá `400`; a role só muda em `PATCH /users/:id/role`). Sujeito à proteção de contas ADMIN (abaixo). |
| `PUT /users/:id` | Permission `USER_UPDATE` (ADMIN por papel) | Substitui `fullName` e `isActive`, ambos obrigatórios; `roleId` enviado dá `400`. Mesma proteção de contas ADMIN. |
| `DELETE /users/:id` | Permission `USER_DELETE` (ADMIN por papel) | Soft delete. Mesma proteção de contas ADMIN. |
| `PATCH /users/:id/restore` | Permission `USER_RESTORE` (ADMIN por papel) | Reverte o soft delete. Só ADMIN restaura conta ADMIN. |
| `DELETE /users/:id/permanent` | Somente ADMIN | Deleção total, irreversível. Não apaga outro ADMIN (`403`) nem a própria conta (`409`). `409` se o usuário tiver `Driver` vinculado ou tiver registrado viagens/abastecimentos/manutenções/incidentes (FK `RESTRICT`). Os logs de auditoria dele ficam com autor `NULL`, sem bloquear. |

**Proteção de contas ADMIN** (`protegerContaAdmin` em `users.service.ts`; vale para editar, desativar, soft delete, restore e deleção total):
- Quem não é ADMIN (mesmo com `USER_UPDATE`/`USER_DELETE`/`USER_RESTORE` delegados) recebe `403` ("Only an ADMIN can modify another ADMIN account") ao mexer numa conta ADMIN.
- Um ADMIN não pode desativar (`isActive=false`), soft-deletar nem apagar de vez **outro** ADMIN (`403`), nem a própria conta (`409`, "You cannot deactivate or delete your own account").
- ADMIN pode editar o `fullName` de outro ADMIN, reativar e restaurar. Alvos não-ADMIN: comportamento normal.

**Nota operacional:** 3 usuários antigos (criados pelo `POST /users` da versão anterior) ficaram sem API key; reemitir com `POST /users/:id/regenerate-api-key`.

### Drivers (`/drivers`) — `DriversController`

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /drivers` | Permission `DRIVER_VIEW` (ADMIN, FLEET_MANAGER) | Lista motoristas ativos, paginado. |
| `GET /drivers/deleted/all` | Permission `DRIVER_RESTORE` (ADMIN por padrão) | Lista removidos, paginado. |
| `GET /drivers/:id` | Permission `DRIVER_VIEW` (ADMIN, FLEET_MANAGER) | Busca por id. |
| `PATCH /drivers/:id` | Permission `DRIVER_UPDATE` (ADMIN, FLEET_MANAGER) | Atualiza `licenseNumber`/`licenseExpiry`/`isActive` — `userId` é fixo. |
| `PUT /drivers/:id` | Permission `DRIVER_UPDATE` (ADMIN, FLEET_MANAGER) | Substitui os mesmos campos, todos obrigatórios. |
| `DELETE /drivers/:id` | Permission `DRIVER_DELETE` (ADMIN por padrão) | Soft delete. |
| `PATCH /drivers/:id/restore` | Permission `DRIVER_RESTORE` (ADMIN por padrão) | Reverte soft delete. |
| `DELETE /drivers/:id/permanent` | Somente ADMIN | Deleção total. `409` se o motorista tiver viagens, abastecimentos ou incidentes. |

Não há `POST /drivers`: o perfil de motorista é criado junto com o usuário (`POST /users` com papel `DRIVER` e bloco `driver`) ou ao virar `DRIVER` em `PATCH /users/:id/role`. A CNH é validada só pelo formato (11 dígitos numéricos), sem dígitos verificadores (limitação consciente).

### Vehicles (`/vehicles`) — `VehiclesController`

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /vehicles` | ADMIN, FLEET_MANAGER, DRIVER | Lista veículos ativos (total), paginado, com filtro opcional `status`. Motorista precisa ver o que está disponível. |
| `GET /vehicles/in-use` | ADMIN, FLEET_MANAGER, DRIVER | Veículos com status `IN_USE` (inclui os com viagem só planejada, pois `create_trip` já marca `IN_USE`). Sem filtro `status`. |
| `GET /vehicles/not-in-use` | ADMIN, FLEET_MANAGER, DRIVER | Demais status (`AVAILABLE`, `IN_MAINTENANCE`, `OUT_OF_SERVICE`); filtro `status` aceita só esses três (`IN_USE` dá `400`). `in-use` + `not-in-use` = `GET /vehicles`. |
| `GET /vehicles/deleted/all` | Permission `VEHICLE_RESTORE` (ADMIN, FLEET_MANAGER) | Lista removidos, paginado. |
| `GET /vehicles/:id` | ADMIN, FLEET_MANAGER, DRIVER | Busca por id. |
| `POST /vehicles` | Permission `VEHICLE_CREATE` (ADMIN, FLEET_MANAGER) | `status` aceita só `AVAILABLE`/`IN_MAINTENANCE`/`OUT_OF_SERVICE` (nunca `IN_USE` — isso só a procedure de viagem seta). Placa única. Aceita `initialLocationCep` opcional: se enviado, valida contra a API real do ViaCEP e enriquece a resposta com `initialLocation` **sem persistir no banco**. |
| `PATCH /vehicles/:id` | Permission `VEHICLE_UPDATE` (ADMIN, FLEET_MANAGER) | Atualização parcial. `isActive` é somente leitura (enviar dá `400`). |
| `PUT /vehicles/:id` | Permission `VEHICLE_UPDATE` (ADMIN, FLEET_MANAGER) | Substituição completa. |
| `DELETE /vehicles/:id` | Permission `VEHICLE_DELETE` (ADMIN, FLEET_MANAGER) | Soft delete: grava `deletedAt` e `isActive = false`. |
| `PATCH /vehicles/:id/restore` | Permission `VEHICLE_RESTORE` (ADMIN, FLEET_MANAGER) | Reverte soft delete (`isActive = true`). |
| `DELETE /vehicles/:id/permanent` | Somente ADMIN | Deleção total. `409` se o veículo tiver viagens, abastecimentos, manutenções ou incidentes. |

### Trips (`/trips`) — `TripsController`

Sem `PUT`/`PATCH` genérico de campos livres — a viagem só muda de estado pelas rotas de negócio, que chamam as procedures do banco (ver `projectDocs/procedures-triggers.md`).

**Escopo do motorista** (motorista = quem não tem `TRIP_VIEW_ALL` efetivo; ADMIN/FLEET_MANAGER seguem livres): `GET /trips/:id` e `PATCH /trips/:id/start|end|cancel` de viagem de outro motorista respondem `404`; `POST /trips` com `driverId` que não é o do próprio motorista responde `403` ("driverId must be your own driver profile"). O mesmo vale para refuelings e incidents (abaixo).

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /trips` | ADMIN, FLEET_MANAGER, DRIVER | Lista viagens ativas, paginado, filtros por `status`/`driverId`/`vehicleId`. Quem só tem `TRIP_VIEW_OWN` (DRIVER) vê só as próprias viagens: o filtro `driverId` da query é ignorado e forçado para o motorista vinculado ao usuário logado (sem erro, mesmo que a query mande outro id); sem `Driver` vinculado devolve lista vazia. Quem tem `TRIP_VIEW_ALL` (ADMIN/FLEET_MANAGER) vê tudo, filtro livre. |
| `GET /trips/deleted/all` | Permission `TRIP_RESTORE` (ADMIN por padrão) | Lista removidas, paginado. |
| `GET /trips/:id` | ADMIN, FLEET_MANAGER, DRIVER | Busca por id. |
| `POST /trips` | ADMIN, FLEET_MANAGER, DRIVER | `startLocation`/`endLocation` exigem **CEP brasileiro válido**, resolvidos contra a API real do ViaCEP antes de chamar `create_trip`; o que fica gravado é o endereço resolvido (ex: `"São Paulo, SP"`), não o CEP. CEP inválido/inexistente dá `400`; ViaCEP fora do ar dá `504` (timeout, `429`) ou `502` (5xx, rede). **Não recebe km** (enviar `startKm` dá `400`): o `start_km` provisório é a quilometragem atual do veículo. Reserva o veículo (`AVAILABLE -> IN_USE`); veículo inativo dá `409`. |
| `PATCH /trips/:id/start` | ADMIN, FLEET_MANAGER, DRIVER | Body `{ currentMileage }`: leitura real do hodômetro (maior ou igual ao km do veículo, até 10.000.000), que vira o `startKm` definitivo e a quilometragem do veículo. Chama `start_trip`; só funciona em `PLANNED` (senão 409). |
| `PATCH /trips/:id/end` | ADMIN, FLEET_MANAGER, DRIVER | Body `{ endMileage, endLocation }` (`endMileage` maior ou igual ao `startKm`). Chama `end_trip`; só funciona em `IN_PROGRESS`. Distância = `endKm - startKm`. |
| `PATCH /trips/:id/cancel` | ADMIN, FLEET_MANAGER, DRIVER | Chama `cancel_trip`; só funciona em `PLANNED`/`IN_PROGRESS`. |
| `DELETE /trips/:id` | Permission `TRIP_DELETE` (ADMIN por padrão) | Soft delete — só permitido se a viagem já estiver `COMPLETED`/`CANCELLED` (senão 409; cancele primeiro). |
| `PATCH /trips/:id/restore` | Permission `TRIP_RESTORE` (ADMIN por padrão) | Reverte soft delete. |
| `DELETE /trips/:id/permanent` | Somente ADMIN | Deleção total; só passa se TODOS os incidentes da viagem estiverem `RESOLVED` (senão `409` "…unresolved incidents. Resolve them first."). Quando passa, apaga os incidentes resolvidos na mesma transação (sem órfão) e remove as fotos do disco após o commit. |

### Refuelings (`/refuelings`) — `RefuelingsController`

Sem `PATCH`/`PUT`: abastecimento é registro histórico; corrigir um lançamento errado é apagar e recriar.

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /refuelings` | ADMIN, FLEET_MANAGER, DRIVER | Lista ativos, paginado, filtros `vehicleId`/`driverId`. Mesma regra de escopo de `GET /trips`: quem só tem `REFUELING_VIEW_OWN` (DRIVER) tem o `driverId` da query ignorado e forçado para o próprio motorista; quem tem `REFUELING_VIEW_ALL` vê tudo. |
| `GET /refuelings/deleted/all` | Permission `REFUELING_RESTORE` (ADMIN por padrão) | Lista removidos, paginado. |
| `GET /refuelings/:id` | ADMIN, FLEET_MANAGER, DRIVER | Busca por id. Motorista só vê o próprio: registro de outro motorista dá `404`. |
| `POST /refuelings` | ADMIN, FLEET_MANAGER, DRIVER | Motorista (sem `REFUELING_VIEW_ALL`) com `driverId` que não é o dele: `403` ("driverId must be your own driver profile"). Chama `register_refueling`, que calcula `totalCost` (nunca aceito do cliente) e atualiza `vehicles.currentMileage`. Se o veículo está em viagem ativa, o motorista precisa ser o da viagem; veículo inativo dá `409`. |
| `DELETE /refuelings/:id` | Permission `REFUELING_DELETE` (ADMIN por padrão) | Soft delete. |
| `PATCH /refuelings/:id/restore` | Permission `REFUELING_RESTORE` (ADMIN por padrão) | Reverte soft delete. |
| `DELETE /refuelings/:id/permanent` | Somente ADMIN | Deleção total. |

### Maintenances (`/maintenances`) — `MaintenancesController`

Não é assunto de motorista: leitura e escrita ficam só com ADMIN/FLEET_MANAGER.

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /maintenances` | ADMIN, FLEET_MANAGER | Lista ativas, paginado, filtros `status`/`vehicleId`. |
| `GET /maintenances/deleted/all` | Permission `MAINTENANCE_RESTORE` (ADMIN, FLEET_MANAGER) | Lista removidas, paginado. |
| `GET /maintenances/:id` | ADMIN, FLEET_MANAGER | Busca por id. |
| `POST /maintenances` | ADMIN, FLEET_MANAGER | Se nasce `SCHEDULED`/`IN_PROGRESS` e o veículo está `AVAILABLE`, marca o veículo `IN_MAINTENANCE` (feito na aplicação, não por trigger). |
| `PATCH /maintenances/:id` | ADMIN, FLEET_MANAGER | Atualização parcial; se `status` vira `COMPLETED`, preenche `completedDate` (se ausente), sincroniza `vehicles.lastMaintenanceKm` e devolve o veículo a `AVAILABLE` se não houver outra manutenção ativa. |
| `PUT /maintenances/:id` | ADMIN, FLEET_MANAGER | Substituição completa, mesma sincronia de conclusão. |
| `DELETE /maintenances/:id` | Permission `MAINTENANCE_DELETE` (ADMIN, FLEET_MANAGER) | Soft delete (grava `deletedAt` e `isActive = false`); mesma sincronia da conclusão — se a manutenção removida estava ativa (`SCHEDULED`/`IN_PROGRESS`) e não sobra outra manutenção ativa para o veículo, ele volta de `IN_MAINTENANCE` para `AVAILABLE`. |
| `PATCH /maintenances/:id/restore` | Permission `MAINTENANCE_RESTORE` (ADMIN, FLEET_MANAGER) | Reverte soft delete (`isActive = true`). |
| `DELETE /maintenances/:id/permanent` | Somente ADMIN | Deleção total. |

### Incidents (`/incidents`) — `IncidentsController`

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /incidents` | ADMIN, FLEET_MANAGER, DRIVER | Lista ativos, paginado, filtros `severity`/`status`/`vehicleId`/`driverId`. Mesma regra de escopo de `GET /trips`: quem só tem `INCIDENT_VIEW_OWN` (DRIVER) tem o `driverId` da query ignorado e forçado para o próprio motorista; quem tem `INCIDENT_VIEW_ALL` vê tudo. |
| `GET /incidents/deleted/all` | Permission `INCIDENT_RESTORE` (ADMIN, FLEET_MANAGER) | Lista removidos, paginado. |
| `GET /incidents/:id` | ADMIN, FLEET_MANAGER, DRIVER | Busca por id. Motorista só vê o próprio: incidente de outro motorista dá `404`. |
| `POST /incidents` | ADMIN, FLEET_MANAGER, DRIVER | Corpo `multipart/form-data`; foto opcional no campo `photo` (JPEG/PNG/PDF, até 10MB), salva em `uploads/incidents/`. Motorista (sem `INCIDENT_VIEW_ALL`) com `driverId` que não é o dele: `403` ("driverId must be your own driver profile") e a foto enviada é apagada do disco. Chama `register_incident`. `tripId` é **opcional**; se informado, a viagem precisa estar `IN_PROGRESS` e bater com o veículo e o motorista. Veículo inativo ou fora de serviço é recusado. |
| `PATCH /incidents/:id/status` | ADMIN, FLEET_MANAGER | Transição só para frente: `REPORTED -> UNDER_INVESTIGATION -> RESOLVED`; status igual ou anterior dá 400. |
| `DELETE /incidents/:id` | Permission `INCIDENT_DELETE` (ADMIN, FLEET_MANAGER) | Soft delete; não apaga o arquivo físico da foto (o incidente pode ser restaurado). |
| `PATCH /incidents/:id/restore` | Permission `INCIDENT_RESTORE` (ADMIN, FLEET_MANAGER) | Reverte soft delete. |
| `DELETE /incidents/:id/permanent` | Somente ADMIN | Deleção total — aqui sim apaga o arquivo físico da foto. |

### Analytics (`/analytics`) — `AnalyticsController`

Todas as rotas: ADMIN, FLEET_MANAGER (dado gerencial — motorista não vê números agregados da frota).

| Rota | Regra principal |
|---|---|
| `GET /analytics/fleet/fuel-consumption` | Litros/km médio de toda a frota (soma litros de `refuelings` e km de `trips COMPLETED`, agregado no banco). |
| `GET /analytics/fleet/daily-distance?days=` | Km rodados por dia (`DATE(end_time)`), últimos N dias (padrão 30). |
| `GET /analytics/vehicle/:id/efficiency` | Km, litros, custo, litros/km médio, viagens e incidentes de 1 veículo. Sem viagens, devolve zeros (200); 404 só se o veículo não existe. |
| `GET /analytics/driver/:id/trips` | Viagens por status, km total concluído, incidentes de 1 motorista. Mesma regra de zeros vs. 404. |
| `GET /analytics/incidents/severity?status=` | Incidentes agrupados por severidade, com filtro opcional por status. |

### Roles (`/roles`) — `RolesController`

Só leitura, sem paginação. Devolve `[{ id, name, description }]` ordenado por `name` (os 3 papéis fixos), para o `roleId` do formulário de criação de usuário (`POST /users`) e da troca de role (`PATCH /users/:id/role`).

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /roles` | `@Permissions('USER_CREATE','USER_UPDATE')` (basta uma): ADMIN e FLEET_MANAGER (`USER_CREATE` por padrão); DRIVER `403`; sem token `401` | Lista os papéis; o Swagger de `POST /users` e `PATCH /users/{id}/role` cita esta rota. |

### Audit logs (`/audit-logs`) — `AuditLogsController`

Só leitura: `audit_logs` é append-only (trigger do banco bloqueia `DELETE`, `TRUNCATE` e qualquer `UPDATE`, exceto `fk_user_id` -> `NULL`), não existe rota de escrita aqui. `changedBy` (`AuditLog.changedBy`, `String?`) pode vir `null` quando o autor foi apagado de vez ("usuário removido").

| Rota | Acesso | Regra principal |
|---|---|---|
| `GET /audit-logs` | ADMIN (permissão `AUDIT_VIEW`, por papel); outros papéis só via delegação granular (`POST /users/:id/permissions`) | Lista os registros de `audit_logs` gerados pelas procedures/triggers do banco a cada CREATE/UPDATE/DELETE relevante, paginado, com filtros opcionais `entityType`/`entityId`. |

## 5. Modelo de permissões (RBAC)

3 papéis fixos, definidos no seed (`prisma/seed.ts`): **DRIVER**, **FLEET_MANAGER**, **ADMIN**. 44 permissions cadastradas, com 83 vínculos em `role_permissions` (DRIVER: 10, FLEET_MANAGER: 29, ADMIN: 44 — ADMIN tem todas).

- **DRIVER:** cria e opera as próprias viagens (create/start/end/cancel), registra abastecimentos e incidentes, lê veículos disponíveis. Não gerencia usuários, motoristas, manutenções nem vê analytics.
- **FLEET_MANAGER:** tudo que o DRIVER faz, mais gestão operacional — CRUD de veículos e manutenções (com soft delete/restore de veículos, manutenções e incidentes), leitura e atualização de motoristas, visão de analytics e `USER_CREATE` (cria só usuários `DRIVER`, com CNH). Não lista usuários (`USER_VIEW` é do ADMIN, ou delegado), não troca role, não reemite chave.
- **ADMIN:** acesso total — inclui gestão de usuários (criar qualquer role, trocar role, reemitir API key), soft delete/restore de todos os recursos, deleção total (exclusiva sua por papel) e todas as 44 permissions.

O `RolesGuard` decide o acesso em duas camadas independentes:
1. **Papel (`@Roles(...)`):** busca o `Role` do usuário pelo `roleId` do JWT e confere se o `name` está na lista exigida pela rota.
2. **Permissão (`@Permissions(...)`):** busca as `RolePermission` do papel do usuário e confere se pelo menos uma bate com a exigida. Quando a rota exige os dois, precisa satisfazer ambos.

**Delegação granular por usuário (`UserPermission`):** além das permissões herdadas do papel (`RolePermission`), um `ADMIN` pode conceder uma permission pontual a um usuário específico, sem trocar o papel dele inteiro — útil para cobrir ausências (ex: alguém assume uma permissão de `FLEET_MANAGER` durante férias, sem virar `FLEET_MANAGER`). Gerenciado pelo `PermissionsController` (`GET /permissions`, `GET /users/:id/permissions`, `POST /users/:id/permissions`, `DELETE /users/:id/permissions/:code`, todas ADMIN-only) e conectado ao `RolesGuard`: a checagem de `@Permissions(...)` soma os códigos vindos de `RolePermission` **e** de `UserPermission` do usuário logado — qualquer um dos dois libera o acesso.

**Cobertura real da delegação:** `@Permissions(...)` hoje decide o acesso em 10 dos 12 controllers de negócio (`users`, `roles`, `drivers`, `vehicles` — só create/update/delete/restore —, `trips`, `refuelings`, `incidents`, `maintenances`, `analytics`, `audit-logs`), cobrindo **41 das 44 permissions** do catálogo (ver seção 4 para o detalhe rota a rota). As **3 permissions sem rota associada** hoje são todas decisão deliberada, não lacuna pendente:
- `VEHICLE_VIEW` — existe no seed, mas as rotas de leitura de veículo ficam em `@Roles('ADMIN','FLEET_MANAGER','DRIVER')`: a permission não cobre `DRIVER`, e trocar para `@Permissions('VEHICLE_VIEW')` quebraria o acesso do motorista aos veículos disponíveis. Decisão consciente para não regredir esse acesso.
- `ROLE_MANAGE`, `PERMISSION_MANAGE` — não existe rota para editar o catálogo de papéis/permissions em si (só para gerenciar a delegação pontual via `UserPermission`, que é uma ação diferente). Implementar isso exigiria CRUD dinâmico de papéis/permissions, fora de escopo por decisão explícita.

`DRIVER_CREATE` foi removida do catálogo (não protegia mais nenhuma rota: o cadastro de motorista é `POST /users`).

**Permissions de gestão de usuários e de exclusão:** `USER_VIEW` (`GET /users`, `GET /users/:id`), `USER_CREATE`, `USER_UPDATE`, `USER_DELETE`, `USER_RESTORE` (restore e `GET /users/deleted/all`), `USER_ROLE_PROMOTE`, `USER_ROLE_DEMOTE`; para os demais recursos, `<R>_DELETE` e `<R>_RESTORE` (drivers, vehicles, trips, refuelings, maintenances, incidents). Padrão: ADMIN tem todas; FLEET_MANAGER tem `USER_CREATE` e delete/restore só de vehicles, maintenances e incidents.

Decisão de segurança: a deleção total (`DELETE .../:id/permanent`) é exclusiva do ADMIN nos 7 recursos que têm esse endpoint, protegida só por `@Roles('ADMIN')`, nunca por `@Permissions(...)` — não é delegável, para não permitir que a concessão granular vire um jeito de criar "meio-admins". Pelo mesmo motivo, o `PermissionsController` inteiro (as 4 rotas de gestão da própria delegação) fica em `@Roles('ADMIN')` puro: se conceder permissão fosse delegável, criaria escalonamento em cadeia.

### Deleção total: regras e pendências

- **Quem pode:** deleção total só ADMIN (por papel, sem permission), nos 7 recursos. Soft delete/restore: por permission `<R>_DELETE`/`<R>_RESTORE`; ADMIN em todos; FLEET_MANAGER por padrão só em vehicles, maintenances e incidents; drivers, trips, refuelings e users só ADMIN por padrão (delegável); DRIVER nunca.
- **Bloqueios com `409` claro (RFC 7807, nunca 500):** usuário com `Driver` vinculado ou que registrou trips/refuelings/maintenances/incidents; motorista com trips/refuelings/incidents; veículo com trips/refuelings/maintenances/incidents; qualquer FK residual (rede de segurança no `SoftDeleteService`). Nenhuma procedure ou trigger bloqueia DELETE indevidamente.
- **Auditoria anonimizada:** migration `20260924120000_anonymize_audit_logs_author` tornou `audit_logs.fk_user_id` anulável, com FK `ON DELETE SET NULL`. O histórico não impede mais a deleção total de um usuário.
- **Expurgo único:** os dados de teste (tudo soft-deletado + usuários `@test.local`) foram apagados do banco de dev, com `pg_dump` prévio; os e2e agora limpam apagando de vez.
- **Swagger:** `POST /users` e `PATCH /users/{id}/role` mostram na descrição os IDs reais das roles do ambiente + 3 exemplos nomeados (injetado no boot por `src/common/swagger/enriquecer-swagger-com-roles.ts`).
- **`GET /roles` — resolvido:** a rota existe (ver seção Roles), então o front lista os papéis sem depender do Swagger.
- **`TRUNCATE audit_logs` — resolvido:** migration `20260924130000_block_audit_logs_truncate` criou o trigger de statement `trg_block_audit_logs_truncate` (`BEFORE TRUNCATE`), que bloqueia `TRUNCATE audit_logs`, `... CASCADE` e `TRUNCATE users CASCADE`.
- **`UPDATE fk_user_id -> NULL` em qualquer linha — decisão consciente:** aceito por design; nenhum usuário nem a API tem acesso direto ao banco, então não é risco.
- **Pendências em aberto:** nenhuma dessas três.

### Limitações conhecidas e decisões

Registradas de propósito, não são bugs escondidos:
- **`IsValidCnh` valida só o formato** (11 dígitos), sem os dígitos verificadores.
- **`POST /incidents`:** se a procedure falhar depois do upload, a foto pode ficar órfã no disco (comportamento anterior, não corrigido).
- **Utilitário duplicado:** `buscarDriverIdProprio` (qualquer Driver não removido, usado nos escopos) e `buscarDriverIdAtivo` (só Driver ativo, usado em login/refresh/`/users/me`).
- **Os e2e dependem da API pública ViaCEP**, mitigado com `jest.retryTimes(2)` nos specs `trips-refuelings-incidents` e `vehicles-maintenances`.
- **`POST /users/:id/permissions` devolve `200`**, não `201`.
- **`isActive` de veículo/manutenção é somente leitura** na API.
- **`tripId` de incidente continua opcional** por decisão do usuário.
- **`VEHICLE_VIEW`, `ROLE_MANAGE`, `PERMISSION_MANAGE` seguem sem rota** (decisão consciente, ver acima).

### Testes

`npm run test:e2e`: **16 suítes / 270 testes**. `npm test` (unitários): **3 suítes / 8 testes**. O teste de analytics não depende de totais globais, porque as suítes rodam em paralelo no mesmo banco.

## 6. Tratamento de erros (RFC 7807)

Desde a rodada de hardening, todo erro da API — exceção de negócio, erro de validação do `ValidationPipe`, ou falha não tratada — passa pelo `GlobalExceptionFilter` (`src/common/filters/global-exception.filter.ts`, registrado como `APP_FILTER` global em `app.module.ts`) e sai no formato **RFC 7807 (Problem Details)**, `content-type: application/problem+json`. Esse filtro substituiu por completo o formato antigo do Nest (`{ statusCode, message, error }`) e o antigo `ErroPadraoDto` em todas as rotas — mudança de contrato intencional, documentada também no Swagger via `ProblemDetailsDto` (`src/common/swagger/problem-details.schema.ts`).

- **Por que adotar um padrão (RFC 7807) em vez de um formato de erro próprio:** é um formato já conhecido por quem consome APIs REST (`type`, `title`, `status`, `detail`, `instance`), evita reinventar a roda e facilita integração de clientes genéricos que já sabem interpretar `application/problem+json`.
- **Exemplo de resposta (404):**

```json
{
  "type": "https://fleet-management.local/errors/not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "User not found",
  "instance": "/users/b3c1a2e4-6f5d-4a8b-9c2e-1a2b3c4d5e6f"
}
```

- **Erros de validação** (`ValidationPipe` global) ganham um campo extra `errors: string[]`, fora do padrão RFC 7807, com uma mensagem por campo inválido — o `detail` vira um resumo fixo ("Um ou mais campos da requisição são inválidos.") e a lista completa fica em `errors`.
- O mapeamento de `status` para `type`/`title` é fixo por código HTTP (`400` → `validation-error`, `401` → `unauthorized`, `403` → `insufficient-permissions`, `404` → `not-found`, `409` → `conflict`, `429` → `too-many-requests`, `500` → `internal-error`); qualquer outro status cai num `type`/`title` genérico (`error`/`Erro`).
- Erros não tratados (qualquer coisa que não seja `HttpException`) são logados com stack trace (`Logger.error`) e devolvidos ao cliente como `500` genérico, sem vazar detalhe interno.

## 7. Validadores de domínio BR

Dois decorators de `class-validator` centralizam validações de formato que antes estavam duplicadas como `@Matches` inline nos DTOs, em `src/common/validators/`:

- **`IsValidCnh()`** (`is-valid-cnh.validator.ts`): exige exatamente 11 dígitos numéricos (formato de CNH brasileira); **não** valida os dígitos verificadores (limitação consciente). Usado em `DadosMotoristaDto` (bloco `driver` de `POST /users` e de `PATCH /users/:id/role`), `UpdateDriverDto` e `ReplaceDriverDto`.
- **`IsValidPlaca()`** (`is-valid-placa.validator.ts`): aceita o formato Mercosul (`ABC1D23`) ou o formato antigo (`ABC1234` ou `ABC-1234`) — mesma regex que já era usada inline em `CreateVehicleDto`. Usado em `CreateVehicleDto`.

Ambos são validadores síncronos, sem chamada externa (diferente de `IsValidCep`, que é assíncrono e injeta `ViaCepService` via DI do Nest).

## 8. Health check (`GET /health`)

`HealthController` (`src/health/`), construído com `@nestjs/terminus`. Características:

- **Sem autenticação** e **fora do rate limiting** (`@SkipThrottle()`) — é o endpoint que um orquestrador (Docker, Kubernetes) chama com frequência alta para saber se o container está de pé.
- Verifica dois indicadores:
  - **Banco de dados:** `PrismaHealthIndicator.pingCheck('database', ...)`, contra o `PrismaService` real.
  - **Memória:** `MemoryHealthIndicator.checkHeap('memory_heap', ...)`, com limite de 300MB de heap — estourar isso é sinal de vazamento de memória.
- Resposta `200` com `status: "ok"` quando os dois indicadores passam. Quando algum indicador falha, o Terminus loga o motivo internamente e lança `ServiceUnavailableException(result)` — como é uma `HttpException`, ela também passa pelo `GlobalExceptionFilter` e sai `503` no envelope RFC 7807 (não no formato nativo do Terminus); como o objeto `result` do Terminus não tem uma propriedade `message`, o `detail` nesse caso vem genérico ("Service Unavailable Exception"), sem repetir no corpo da resposta qual indicador falhou (isso fica só no log do processo, via o logger interno do Terminus).

## 9. Containerização (Docker Compose)

A aplicação inteira (API + banco) sobe via `docker-compose.yml`, com dois serviços:

- **`postgres`** (`postgres:15-alpine`, container `fleet_postgres`): já existia antes desta rodada. Porta `5433` no host mapeada para `5432` no container; tem `healthcheck` próprio (`pg_isready`).
- **`app`** (container `fleet_api`): construído pelo `Dockerfile` multi-stage da raiz do projeto. Só inicia depois que o `postgres` fica `healthy` (`depends_on` com `condition: service_healthy`). No start do container, o `CMD` do `Dockerfile` roda `npx prisma migrate deploy` antes de subir a aplicação — as migrations são aplicadas automaticamente, sem passo manual. A pasta `uploads/` fica num volume nomeado (`uploads_data`), então os arquivos de incidente sobrevivem a um rebuild do container.

Dentro da rede interna do compose, o serviço `app` enxerga o Postgres como `postgres:5432` (nome do serviço, porta interna), diferente do `DATABASE_URL` usado fora do Docker (`localhost:5433`) — por isso o `docker-compose.yml` sobrescreve `DATABASE_URL` no serviço `app` em vez de reaproveitar o valor do `.env`.

Subir tudo: `docker compose up -d --build`. Derrubar sem apagar o volume do banco: `docker compose down`.

## 10. CORS

Habilitado em `main.ts` via `app.enableCors(...)`, configurável pela variável de ambiente `CORS_ORIGIN`: valor `*` libera qualquer origem (uso em dev, sem `credentials`); qualquer outro valor é tratado como lista de domínios separados por vírgula, e nesse caso `credentials: true` é habilitado junto (o navegador rejeita `*` combinado com `credentials: true`, por isso a distinção é necessária). Junto com o RBAC (`@Roles`/`@Permissions` avaliados no `RolesGuard`) e o rate limiting (`ThrottlerGuard`, seção 3), CORS é mais uma camada de controle de acesso na borda da API — quem pode nem chamar as rotas a partir do browser, antes mesmo de chegar em autenticação/autorização.
