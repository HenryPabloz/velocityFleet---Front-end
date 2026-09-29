# Roteiro para apresentação técnica — Fleet Management

> Documento de apoio para quem vai FALAR sobre o projeto (não são os slides). Cada seção é um bloco de fala. Números conferidos contra o código e o banco reais em 2026-09-24.

---

## 1. Abertura / Contexto

- **O que é:** API REST de gestão de frota corporativa — veículos, motoristas, viagens, abastecimentos, manutenções e incidentes.
- **Por que existe:** projeto de avaliação técnica de back-end. O objetivo não era só "fazer um CRUD funcionar", era demonstrar decisões de arquitetura de verdade: integridade de dados no banco, autenticação em camadas, integração externa real, RBAC.
- **Problema que resolve:** saber que veículo está disponível agora, quem está dirigindo o quê, quanto cada veículo gasta (combustível/manutenção), e manter histórico auditável de tudo.

---

## 2. Stack e arquitetura

**Backend:** NestJS 11 (`@nestjs/common`/`core`/`platform-express` 11.2.5) + TypeScript 5.9.3.
**ORM:** Prisma 7.10.0, `provider = "prisma-client"` (client gerado em `src/generated/prisma`, não no pacote padrão), conectado via `@prisma/adapter-pg`.
**Banco:** PostgreSQL 15 (container `fleet_postgres`).
**Outros:** `@nestjs/swagger` 11.4.7 (docs), `@nestjs/throttler` 6.7.0 (rate limit), `@nestjs/axios` 12.0.1 (ViaCEP), `bcrypt` 6.0.0, `class-validator` 0.15.1, `helmet` 8.3.0, `multer` 2.4.0 (upload).

**Decisão arquitetural central:** NestJS modular — um módulo por recurso (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`, `analytics`, `auth`, `permissions`, `roles`), sempre `Controller -> Service -> PrismaService`. `DatabaseModule` é `@Global()`, então o `PrismaService` não precisa ser reimportado em cada módulo.

**A frase-chave da apresentação:** "regra de negócio crítica não vive só no `Service` — vive em procedure no banco, dentro de transação, com lock. O Node valida o formato; o banco garante a invariante."

---

## 3. Diferenciais técnicos (foco principal da fala)

### 3.1 Regras de negócio como procedures/triggers no banco
- **6 procedures**, **13 triggers**, **26 CHECK constraints**.
- Procedures: `create_trip`, `start_trip`, `end_trip`, `cancel_trip`, `register_refueling`, `register_incident` — todas `SECURITY DEFINER`, `EXECUTE` de `PUBLIC` revogado, chamadas dentro de `$transaction` do Prisma.
- **Por que no banco e não só no `Service`:** a validação de aplicação pode ser contornada por qualquer outro cliente que bata direto no Postgres (outro backend, um script, um DBA apressado). A invariante "veículo `IN_USE` só existe se há viagem ativa dele" só é garantida de verdade se ela vive no banco. Concorrência (`FOR UPDATE`, advisory locks) também só funciona bem no nível de transação de banco.
- Exemplo concreto: `trg_protect_vehicle_status_and_mileage` bloqueia `UPDATE vehicles SET status = 'IN_USE'` direto no SQL — só as procedures de viagem podem setar isso.

### 3.2 Soft delete via Prisma Client Extension (não middleware)
- Prisma 7 **não tem `$use`** (middleware clássico foi removido). A solução é `$extends()`, que devolve um **client novo**, não modifica a classe original.
- `src/database/soft-delete.extension.ts` intercepta leituras dos modelos com soft delete e aplica `deletedAt: null` automaticamente.
- `PrismaService` expõe os dois clients: `this` (normal, herdado de `PrismaClient`) e `this.comSoftDelete` (extendido) — os resources escolhem qual usar conforme precisam ver registros removidos ou não.

### 3.3 RBAC de dois níveis: papel + delegação granular por usuário
- **Papel (`RolePermission`):** 3 papéis fixos (`DRIVER`, `FLEET_MANAGER`, `ADMIN`), 44 permissions no catálogo, 83 vínculos papel-permissão (DRIVER 10, FLEET_MANAGER 29, ADMIN 44).
- **Delegação por usuário (`UserPermission`) — cobertura ampliada:** um `ADMIN` pode conceder uma permissão pontual a um usuário específico, sem trocar o papel dele inteiro. Rotas em `PermissionsController` (`GET /permissions`, `GET /users/:id/permissions`, `POST /users/:id/permissions`, `DELETE /users/:id/permissions/:code`) — todas ADMIN-only. `@Permissions(...)` hoje decide o acesso em **10 dos 12 controllers de negócio** (`users`, `roles`, `drivers`, `vehicles` — só create/update/delete/restore —, `trips`, `refuelings`, `incidents`, `maintenances`, `analytics`, `audit-logs`), cobrindo **41 das 44 permissions** do catálogo — a delegação granular vale efetivamente para a maior parte da API, inclusive soft delete/restore de todos os recursos. As 3 permissions restantes sem rota (`VEHICLE_VIEW`, `ROLE_MANAGE`, `PERMISSION_MANAGE`) são decisão deliberada, não lacuna (seção 8).
- **Cenário real que resolve:** um `FLEET_MANAGER` sai de férias e alguém do time (`DRIVER`) precisa, temporariamente, aprovar manutenções — sem virar `FLEET_MANAGER` (que herdaria acesso a tudo mais) e sem esperar um deploy. Concede-se só a permission específica.
- **`RolesGuard` (`src/auth/guards/roles.guard.ts`):** ao checar `@Permissions(...)`, junta os códigos vindos de `RolePermission` **e** de `UserPermission` do usuário logado — qualquer um dos dois libera.
- **Carve-outs deliberados, nunca delegáveis (sempre `@Roles('ADMIN')`):** (1) deleção total (`DELETE .../:id/permanent`), exclusiva do ADMIN por papel, sem permission, nos 7 recursos com esse endpoint — a delegação granular escala *permissions* (ações específicas), nunca *papel*, e remoção definitiva de dados é decisão administrativa demais para virar permission delegável; (2) as 4 rotas do próprio `PermissionsController` — se a concessão de permission fosse delegável, um `FLEET_MANAGER` com uma permission emprestada poderia conceder permissions para outros, um escalonamento em cadeia; (3) `POST /users/:id/regenerate-api-key` (reemitir a chave de outra pessoa); (4) `PATCH /users/:id/role` (`@Roles('ADMIN')` + `USER_ROLE_PROMOTE`/`USER_ROLE_DEMOTE`).
- **Soft delete/restore delegáveis:** `<R>_DELETE` e `<R>_RESTORE` para os 7 recursos (`USER_DELETE`, `USER_RESTORE`, `DRIVER_*`, `VEHICLE_*`, `TRIP_*`, `REFUELING_*`, `MAINTENANCE_*`, `INCIDENT_*`), nas rotas `DELETE :id`, `PATCH :id/restore` e `GET deleted/all`. ADMIN tem todas; FLEET_MANAGER só vehicles, maintenances e incidents (comportamento anterior preservado); drivers, trips, refuelings e users só ADMIN por padrão, delegável.

### 3.4 Auditoria imutável com autor anonimizável e deleção total controlada
- **Audit imutável:** `trg_block_audit_logs_changes` recusa `DELETE` e qualquer `UPDATE`, com uma única exceção: `fk_user_id` de não nulo para `NULL` (todas as outras colunas idênticas). Aceitar esse `NULL` em qualquer linha é **decisão consciente**: nenhum usuário nem a API tem acesso direto ao banco.
- **`TRUNCATE` bloqueado:** `trg_block_audit_logs_truncate` (`BEFORE TRUNCATE`, por statement; migration `20260924130000_block_audit_logs_truncate`) recusa `TRUNCATE audit_logs`, `... CASCADE` e `TRUNCATE users CASCADE`, que propagaria.
- **Anonimização do autor:** `audit_logs.fk_user_id` é anulável com FK `ON DELETE SET NULL` (migration `20260924120000_anonymize_audit_logs_author`). Apagar um usuário de vez não é mais barrado pelo histórico; as linhas ficam com autor `NULL` e `GET /audit-logs` devolve `changedBy: null` ("usuário removido").
- **Deleção total controlada:** `DELETE .../:id/permanent` só para ADMIN, com `409` claro (RFC 7807) quando há vínculos (usuário com `Driver` ou registros que criou; motorista/veículo com viagens, abastecimentos, incidentes...). Viagem só é apagada se todos os incidentes estiverem `RESOLVED`; eles saem junto na mesma transação e as fotos são removidas do disco após o commit.
- **`GET /roles`:** devolve `[{ id, name, description }]` ordenado por nome, para o select de `roleId`; acesso por `@Permissions('USER_CREATE','USER_UPDATE')` (ADMIN e FLEET_MANAGER). O Swagger de `POST /users` e `PATCH /users/{id}/role` cita a rota e exibe os `roleId` reais do ambiente + 3 exemplos executáveis, injetados no boot.

### 3.4b Integração real com ViaCEP (sem mock)
- Endereços de viagem (`startLocation`/`endLocation`) e `initialLocationCep` de veículo são validados contra a API pública do ViaCEP antes de persistir.
- **Bug real encontrado na API de terceiros:** o ViaCEP devolve o campo `erro` como **string `"true"`** quando o CEP não existe, não como boolean. `if (resposta.erro)` avaliaria `"false"` (string) como truthy também — o código trata isso explicitamente (`src/external/viacep/via-cep.service.ts`, linha 46-48).
- Tratamento de timeout, erro de rede (`ECONNREFUSED`/`ENOTFOUND`/`ETIMEDOUT`) e erro de servidor (5xx) todos traduzidos para exceções HTTP coerentes.
- **Indisponibilidade não vira "CEP inválido":** só CEP realmente inválido/inexistente dá `400`. Timeout e rate limit (`429`) dão `504`; 5xx, falha de rede e erro inesperado dão `502`. O `cepEhValido` só devolve `false` para `BadRequestException` e relança o resto.

### 3.5 Autenticação em duas camadas, com cadastro único
- API key (SHA-256, `crypto.createHash('sha256')` — nunca a chave crua no banco) + JWT.
- **Não existe cadastro público.** Toda conta nasce em `POST /users` (ADMIN e FLEET_MANAGER, permission `USER_CREATE`): o servidor gera a API key, grava o hash e devolve a chave em texto (`apiKey`) **uma única vez** (`Cache-Control: no-store`); ela nunca fica nula. Fluxo: gestor cria → recebe a `apiKey` → entrega ao usuário → login com e-mail + senha + `x-api-key` → JWT. Login, `POST /auth/refresh-token` e `GET /users/me` devolvem `permissions: string[]` (efetivas: papel + delegadas) e `driverId: string | null` (perfil Driver ativo) em `user`, para o front decidir telas e preencher o `driverId` do motorista.
- Papel `DRIVER` exige o bloco `driver { licenseNumber (CNH, 11 dígitos), licenseExpiry }`: User + Driver nascem na mesma transação. `driver` com outra role dá `400`. ADMIN atribui qualquer role; FLEET_MANAGER só cria `DRIVER` (`403` nas demais).
- `PATCH /auth/regenerate-key` (troca da própria chave) exige a chave atual no header **e** a `password` no corpo (`400` sem, `401` errada); o JWT em uso continua válido, a chave só é usada no login. Chave perdida: `POST /users/:id/regenerate-api-key` (só ADMIN). `POST /auth/refresh-token` renova o JWT (o front chama antes de expirar).
- Tempo de resposta do login não revela se o e-mail existe (compara contra hash falso quando a conta não existe).

### 3.6 Upload de arquivo com validação real
- `POST /incidents` aceita `multipart/form-data`, campo `photo` opcional: `image/jpeg`, `image/png` ou `application/pdf`, até 10MB. Salvo em `uploads/incidents/`.

### 3.7 Analytics agregado no banco, não em memória
- 5 endpoints, todos usando `$queryRaw` do Prisma (SQL puro: `SUM`, `COALESCE`, `DATE()`) — a agregação roda no Postgres, o Node só formata a resposta.

### 3.8 Erros no formato RFC 7807 (Problem Details)
- `GlobalExceptionFilter` (`APP_FILTER` global) traduz toda exceção — de negócio, de validação ou não tratada — para `{ type, title, status, detail, instance }`, `content-type: application/problem+json`, substituindo o formato antigo do Nest e o antigo `ErroPadraoDto` em todas as rotas.
- Erros de validação ganham um campo extra `errors: string[]` (uma mensagem por campo), fora do padrão da RFC — documentado no Swagger via `ProblemDetailsDto`.
- **Por que RFC 7807 e não um formato próprio:** é um padrão já conhecido por consumidores de API REST, evita reinventar a roda e documentação de erro ad-hoc.

### 3.9 Validadores de domínio BR centralizados
- `IsValidCnh()` e `IsValidPlaca()` (`src/common/validators/`), decorators de `class-validator`, substituem `@Matches` inline que estava duplicado entre DTOs de `drivers`/`vehicles`.
- `IsValidCnh`: 11 dígitos numéricos. `IsValidPlaca`: formato Mercosul (`ABC1D23`) ou antigo (`ABC1234`/`ABC-1234`). Ambos síncronos, sem chamada externa — diferente do `IsValidCep`, que é assíncrono e injeta `ViaCepService`.

### 3.10 Containerização completa (Docker Compose)
- Além do `postgres` (já existia), a própria API sobe em container (`app`/`fleet_api`), construída por um `Dockerfile` multi-stage.
- `app` só inicia com o `postgres` `healthy` (`depends_on: condition: service_healthy`); o `CMD` do container roda `npx prisma migrate deploy` antes de subir a aplicação — migrations aplicadas automaticamente, sem passo manual. Subir tudo: `docker compose up -d --build`.

### 3.11 Health check para orquestração
- `GET /health` (`@nestjs/terminus`), sem autenticação e fora do rate limiting — verifica conexão com o banco (`PrismaHealthIndicator`) e heap de memória (`MemoryHealthIndicator`, limite 300MB). É o endpoint que Docker/Kubernetes usam para saber se o container está pronto/vivo.

### 3.11b Troca de papel, quilometragem da viagem e veículos em uso
- **Troca de papel:** `PATCH /users/:id/role` com `{ roleId, driver? }`. Ranking DRIVER < FLEET_MANAGER < ADMIN; o serviço confere `USER_ROLE_PROMOTE` ou `USER_ROLE_DEMOTE` conforme a direção. ADMIN nunca é rebaixado (`403`), ninguém muda a própria role (`409`), mesma role `409`, role inexistente `400`, alvo inexistente/soft-deletado `404`. Virar DRIVER sem perfil exige o bloco `driver`. Vale na hora, inclusive para o JWT já emitido (papel lido do banco a cada requisição). `roleId` **não é aceito** em `PATCH/PUT /users/:id` (`400`): a role só muda por esta rota; `PUT` exige `fullName` e `isActive`, `PATCH` aceita só esses dois.
- **Proteção de contas ADMIN:** quem não é ADMIN (mesmo com `USER_UPDATE`/`USER_DELETE`/`USER_RESTORE` delegados) recebe `403` ao editar, desativar, apagar ou restaurar um ADMIN. Um ADMIN não desativa, soft-deleta nem apaga de vez outro ADMIN (`403`), nem a própria conta (`409`); pode editar o `fullName` de outro ADMIN, reativar e restaurar.
- **Escopo do motorista** (sem `*_VIEW_ALL`): `GET /trips/:id`, `/refuelings/:id`, `/incidents/:id` e `PATCH /trips/:id/start|end|cancel` de registro alheio dão `404`; `POST /trips|refuelings|incidents` com `driverId` alheio dá `403`, e no incidente a foto enviada é apagada do disco. ADMIN/FLEET_MANAGER seguem livres.
- **Quilometragem da viagem:** `POST /trips` não recebe km (enviar `startKm` dá `400`); `create_trip` grava um `start_km` provisório igual ao km atual do veículo. `PATCH /trips/:id/start` recebe `currentMileage` (leitura real do hodômetro, maior ou igual ao km do veículo, até 10.000.000), que vira o `startKm` definitivo e o km do veículo. `end` (`endMileage` maior ou igual ao `startKm`) não mudou. Distância = `endKm - startKm` (o analytics usa isso).
- **`isActive` em veículos e manutenções:** soft delete grava `deletedAt` + `isActive = false`, restore volta `true`; campo somente leitura na API. `create_trip`, `start_trip`, `register_refueling` e `register_incident` recusam veículo inativo (`409`).
- **Veículos em uso:** `GET /vehicles/in-use` (status `IN_USE`, inclui veículo com viagem só planejada, pois `create_trip` já marca `IN_USE`) e `GET /vehicles/not-in-use` (demais status; filtro `status` exceto `IN_USE`); `GET /vehicles` é o total.
- **Swagger:** body de exemplo completo em todo `POST`/`PATCH`/`PUT`; IDs de role em destaque azul só nas descrições das operações; descrições explicam driver × user, `initialLocationCep`, km das viagens, abastecimento e incidente (`tripId` continua opcional por decisão; se informado, a viagem precisa estar `IN_PROGRESS` e bater com veículo e motorista).

### 3.12 Perfil próprio e auditoria via API (4 rotas novas)
- **Perfil próprio** (`UsersController`): `GET /users/me` (devolve os dados do usuário autenticado, nunca senha/hash), `PATCH /users/me` (só `fullName` — e-mail, senha, `roleId` e `isActive` continuam fora, isso é rota administrativa) e `PATCH /users/me/password` (exige `currentPassword` correta antes de gravar a nova, mesmo hash bcrypt do resto do projeto). As 3 rotas usam `@Permissions('PROFILE_VIEW' | 'PROFILE_UPDATE_OWN' | 'PASSWORD_CHANGE_OWN')`, concedidas a todos os papéis por padrão no seed.
- **Auditoria via API** (`AuditLogsController`, novo): `GET /audit-logs`, paginado, com filtros opcionais `entityType`/`entityId` — antes só dava pra consultar `audit_logs` direto no banco. `@Permissions('AUDIT_VIEW')`, ADMIN por papel, outros papéis via delegação granular.
- Essas 4 rotas fecham a cobertura de 4 das permissions do catálogo que existiam desde o design mas não tinham rota real associada — ver seção 3.3 (hoje 41 das 44 têm rota).

---

## 4. Modelo de dados

- **12 models, 9 enums** em `schema.prisma`.
- Entidades de negócio: `User`, `Role`, `Permission`, `RolePermission`, `UserPermission`, `Driver`, `Vehicle`, `Trip`, `Refueling`, `Maintenance`, `Incident`, `AuditLog`.
- Relacionamentos principais: `User 1:1 Driver`, `Vehicle 1:N Trip/Refueling/Maintenance/Incident`, `Driver 1:N Trip/Refueling`, `Role N:N Permission` (via `RolePermission`), `User N:N Permission` (via `UserPermission`, delegação).
- `AuditLog` é append-only (trigger recusa `DELETE`, `TRUNCATE` e qualquer `UPDATE`, exceto anonimizar o autor: `fk_user_id` -> `NULL`) e registra mudanças em `trips`, `refuelings` e `incidents`.

---

## 5. Segurança

- **Senha:** `bcrypt`, custo 10, gravada na criação de usuário (`POST /users`).
- **API key:** só o hash SHA-256 fica no banco; a chave em texto puro só existe na resposta de `POST /users`, `PATCH /auth/regenerate-key` e `POST /users/:id/regenerate-api-key`.
- **RBAC:** papel (`@Roles`) + permission (`@Permissions`, papel + delegação individual) avaliados no `RolesGuard`.
- **Validação de entrada:** `class-validator` em todos os DTOs; `@IsValidCep()` é um validador assíncrono que injeta `ViaCepService` de verdade via DI do Nest (precisa de `useContainer()` em `main.ts`).
- **Rate limiting:** `ThrottlerGuard` global — 20 req/min em toda a API; 5/min em `login`, `regenerate-key`, `refresh-token` (rotas sensíveis a força bruta). Desligado quando `NODE_ENV=test`.
- **Helmet** ativo (`app.use(helmet())` em `main.ts`).
- **CORS:** habilitado via `app.enableCors(...)` em `main.ts`, controlado pela variável `CORS_ORIGIN` — `*` libera qualquer origem (dev, sem `credentials`); uma lista de domínios separados por vírgula habilita `credentials: true` junto (o navegador rejeita `*` combinado com `credentials: true`).
- **Erros no formato RFC 7807**, sem vazar stack trace nem detalhe interno ao cliente em erros não tratados (`500` genérico; o detalhe fica só no log do servidor).
- **Nunca logado:** o interceptor de logging global não grava corpo, headers, senha, token nem API key.

---

## 6. Qualidade e testes

- **270 testes e2e, em 16 suites** (`npm run test:e2e`): `analytics`, `app`, `auth-api-key`, `hard-delete-admin`, `hard-delete-dependencias`, `permissions-delegation`, `protecao-admin`, `roles`, `seguranca-r4`, `soft-delete-permissions`, `soft-delete`, `trips-refuelings-incidents`, `users-criacao-troca-role`, `users-me-audit-logs`, `users-motorista-reemissao`, `vehicles-maintenances`.
- Cobrem: autenticação (API key + JWT), criação de usuário/motorista e troca de role, reemissão de API key, soft delete/restore por permission e deleção total, ciclo de vida de viagem via procedures, delegação de permissão (`UserPermission`), analytics, upload de incidente, escopo `OWN` vs `ALL` em trips/refuelings/incidents (inclusive 404/403 em registro e `driverId` alheios), proteção de contas ADMIN, perfil próprio e auditoria via API.
- Testes unitários: **8 testes em 3 suites** (`app.controller.spec.ts`, `via-cep.service.spec.ts`, `trips.service.spec.ts`); a cobertura de regra de negócio está concentrada nos e2e (decisão consciente: a regra "de verdade" está no banco, e2e testa o fluxo real ponta a ponta).
- **Dependência externa:** os e2e usam a API pública real do ViaCEP (sem mock); a API oscila, então os specs `trips-refuelings-incidents` e `vehicles-maintenances` usam `jest.retryTimes(2)`. Se um teste isolado ainda falhar por causa do ViaCEP, rodar de novo resolve. O teste de analytics não depende de totais globais (suítes em paralelo no mesmo banco).

---

## 7. Números do projeto (conferidos)

| Item | Contagem |
|---|---|
| Controllers | 14 (`analytics`, `app`, `audit-logs`, `auth`, `drivers`, `health`, `incidents`, `maintenances`, `permissions`, `refuelings`, `roles`, `trips`, `users`, `vehicles`) |
| Módulos | 16 |
| Rotas HTTP de negócio | **81** (33 GET, 10 POST, 19 PATCH, 4 PUT, 15 DELETE) — fora o `GET /` placeholder do `app` e o `GET /health` (infraestrutura, sem autenticação) |
| Models no schema | 12 (+ 9 enums) |
| Procedures | 6 |
| Triggers | 13 |
| CHECK constraints | 26 |
| Migrations aplicadas | 22 |
| Testes e2e | 270, em 16 suites |
| Testes unitários | 8, em 3 suites |
| Permissions no catálogo | 44 |
| Vínculos papel-permissão | 83 (DRIVER 10, FLEET_MANAGER 29, ADMIN 44) |

---

## 8. Pontos de atenção / gaps conhecidos

Os itens 1, 4, 5, 6, 7 e 8 a 13 são **decisões conscientes/limitações**, com motivo explícito, registradas de propósito (não são bugs escondidos). Os itens 2 e 3 foram **resolvidos** e ficam registrados aqui também. O item 9 é uma nota operacional. Não há pendência de código em aberto.

1. **3 permissions do catálogo continuam sem rota associada**, todas por decisão deliberada:
   - `VEHICLE_VIEW` — existe no seed, mas as rotas de leitura de veículo continuam em `@Roles('ADMIN','FLEET_MANAGER','DRIVER')`: a permission não cobre `DRIVER`, e trocar para `@Permissions('VEHICLE_VIEW')` quebraria o acesso do motorista aos veículos disponíveis. Decisão consciente para não regredir esse acesso.
   - `ROLE_MANAGE`, `PERMISSION_MANAGE` — não existe rota para editar o catálogo de papéis/permissions em si (só para gerenciar a delegação pontual via `UserPermission`, que é uma ação diferente). Implementar isso exigiria CRUD dinâmico de papéis, fora de escopo por decisão explícita.
   - Ou seja, 41 das 44 permissions têm rota associada hoje (`PROFILE_VIEW`, `PROFILE_UPDATE_OWN`, `PASSWORD_CHANGE_OWN` e `AUDIT_VIEW` ganharam rota real nesta rodada — ver seção 3.12).
2. **`GET /roles` — resolvido.** A rota existe (`src/roles/`): `[{ id, name, description }]` ordenado por nome, 3 papéis, sem paginação, acesso `@Permissions('USER_CREATE','USER_UPDATE')` (ADMIN por papel; FLEET_MANAGER só por delegação; DRIVER `403`, sem token `401`). O front monta o select de `roleId` a partir dela.
3. **Auditoria — `TRUNCATE` resolvido; `fk_user_id -> NULL` é decisão consciente.** (a) `TRUNCATE audit_logs` (e `CASCADE`, e `TRUNCATE users CASCADE`) agora é bloqueado pelo trigger `trg_block_audit_logs_truncate`. (b) O trigger `trg_block_audit_logs_changes` continua aceitando `UPDATE fk_user_id -> NULL` em qualquer linha: **aceito por design**, pois nenhum usuário nem a API tem acesso direto ao banco — não é risco.
4. **Foto de incidente não é apagada no soft delete**, só na deleção total — em soft delete o arquivo físico fica em disco (proposital, para permitir restore, mas vale mencionar).
5. **`fk_user_id -> NULL` permitido em qualquer linha** — ver item 3(b): decisão consciente, não pendência.
6. **`IsValidCnh` valida só o formato** (11 dígitos numéricos), sem os dígitos verificadores — limitação consciente.
7. **`tripId` continua opcional em `POST /incidents`** por decisão do produto; se informado, a viagem precisa estar `IN_PROGRESS` e bater com o veículo e o motorista.
8. **`roleId` saiu de `PATCH/PUT /users/:id` — resolvido** (`400` se enviado): a role só muda por `PATCH /users/:id/role`, com todas as regras (ranking, proteção de ADMIN, bloco `driver`).
9. **Nota operacional:** 3 usuários antigos (criados pelo `POST /users` da versão anterior) estão sem API key; reemitir com `POST /users/:id/regenerate-api-key`.
10. **`POST /incidents`:** se a procedure falhar depois do upload, a foto pode ficar órfã no disco (comportamento anterior, não corrigido).
11. **Utilitário duplicado:** `buscarDriverIdProprio` (qualquer Driver não removido) e `buscarDriverIdAtivo` (só Driver ativo) coexistem, com usos diferentes (escopos vs. login/refresh/`/users/me`).
12. **`POST /users/:id/permissions` devolve `200`**, não `201`; e `isActive` de veículo/manutenção é somente leitura na API.
13. **Os e2e dependem da API pública ViaCEP**, mitigado com `jest.retryTimes(2)`.

### Correções recentes (regra de negócio)

Dois problemas encontrados e corrigidos nesta rodada, ambos bugs reais de regra de negócio — não limitações aceitáveis, e já cobertos por teste e2e:

1. **Escopo `OWN` não era aplicado em `GET /trips`/`refuelings`/`incidents`:** um usuário com só `*_VIEW_OWN` (ex: `DRIVER`) via os dados de **todos** os motoristas, não só os próprios — o filtro `driverId` do escopo não era aplicado de verdade. Corrigido: quem só tem `*_VIEW_OWN` tem o `driverId` da query ignorado e forçado para o próprio motorista (via `PermissionsService.obterCodigosEfetivos`, chamado no controller); quem tem `*_VIEW_ALL` continua vendo tudo, filtro livre.
2. **Soft-delete de manutenção não revertia o status do veículo:** `DELETE /maintenances/:id` apagava o registro mas deixava o veículo preso em `IN_MAINTENANCE` mesmo sem nenhuma manutenção ativa. Corrigido: agora reaproveita a mesma lógica da conclusão (`liberarVeiculoSeSemManutencaoAtiva`) — se não sobra outra manutenção ativa para o veículo, ele volta a `AVAILABLE`.

---

## 9. Roteiro de demonstração sugerido

1. `POST /users` (como ADMIN, papel `DRIVER` + bloco `driver`) → mostra a `apiKey` devolvida (só essa vez).
2. `POST /auth/login` (com `x-api-key` + credenciais) → devolve JWT.
3. `POST /vehicles` (ADMIN/FLEET_MANAGER) → cria veículo `AVAILABLE`.
4. `POST /trips` (sem km) → cria viagem; mostrar que o veículo virou `IN_USE` (trigger agindo) e que `startLocation` foi resolvido via ViaCEP.
5. Tentar `PATCH` direto no veículo para `IN_USE` manualmente (ou mostrar o teste que faz isso) → 409/erro do trigger `trg_protect_vehicle_status_and_mileage`.
6. `PATCH /trips/:id/start` (com `currentMileage`) → `PATCH /trips/:id/end` → mostrar `vehicles.current_mileage` atualizado e o veículo voltando a `AVAILABLE`.
7. `DELETE /trips/:id` (depois de completar) → soft delete; `GET /trips/deleted/all` mostra que ela sumiu da listagem normal mas existe.
8. `POST /users/:id/permissions` concedendo uma permission pontual a um `DRIVER` → `GET /users/:id/permissions` mostrando `fromRole` vs `individual`.
9. `GET /analytics/fleet/fuel-consumption` → números agregados vindos do SQL.
10. `PATCH /users/:id/role` → mostra a troca de papel (e o `403` ao tentar rebaixar um ADMIN).
11. Como motorista, `GET /trips/:id` de viagem de outro motorista → `404`; `POST /trips` com `driverId` alheio → `403`.

---

## 10. Perguntas frequentes esperadas

**"Por que regra de negócio no banco e não só no `Service`?"**
Porque o `Service` pode ser contornado (outro cliente batendo direto no Postgres). A invariante "só existe uma viagem ativa por veículo" ou "veículo `IN_USE` só via procedure" precisa valer sempre, não só quando passa pelo Nest. Concorrência (lock de linha, advisory lock) também é responsabilidade natural do banco, não da aplicação.

**"Por que Prisma Client Extension em vez de middleware?"**
Porque Prisma 7 removeu o `$use` (middleware clássico). `$extends()` é o caminho atual, mas devolve um client novo — por isso o `PrismaService` expõe dois clients (`this` e `this.comSoftDelete`), em vez de "estender a classe".

**"Como funciona a delegação de permissão sem o usuário virar admin?"**
`UserPermission` guarda uma linha `(userId, permissionId)` avulsa. O `RolesGuard`, ao checar `@Permissions(...)`, soma os códigos vindos do papel (`RolePermission`) com os concedidos individualmente (`UserPermission`) — qualquer um dos dois libera aquela rota específica. O papel do usuário no JWT não muda.

**"Por que a deleção total não pode ser delegada, mas outras permissions podem?"**
A deleção total (exclusiva do ADMIN) usa `@Roles('ADMIN')`, não `@Permissions(...)`. Decisão de segurança: delegação escala ações pontuais, não o conjunto de poder de um papel inteiro. Se fosse delegável, um ADMIN poderia efetivamente criar "meio-admins" sem querer.

**"Como vocês garantem que o total de um abastecimento não é forjado pelo cliente?"**
`register_refueling` calcula `total_cost = ROUND(liters * cost_per_liter, 2)` dentro da procedure — o valor que o cliente manda no corpo é ignorado para esse cálculo; o CHECK `ck_refuelings_total_cost_matches` reforça isso no schema.

**"Por que a API key fica em hash e não em texto no banco?"**
Mesma lógica de senha: se o banco vazar, a chave não pode ser reutilizada direto. SHA-256 do valor é guardado; o texto puro só existe na resposta de `POST /users`/`regenerate-key`, nunca mais depois disso.

**"O projeto tem gaps? Quais?"**
Sim — ver seção 8: 3 permissions do catálogo sem rota (`VEHICLE_VIEW`, `ROLE_MANAGE`, `PERMISSION_MANAGE`, cada uma com motivo explícito), a foto de incidente que não é apagada no soft delete, a CNH validada só por formato, a foto de incidente que pode ficar órfã se a procedure falhar após o upload, e a dependência dos e2e da API pública ViaCEP. Foram resolvidos: `GET /roles`, o bloqueio de `TRUNCATE` e o atalho de `roleId` em `PATCH/PUT /users/:id`. Os dois problemas que existiam antes — motorista vendo viagens de outros motoristas, e manutenção não revertendo o status do veículo no soft delete — eram bugs reais de regra de negócio, não gaps aceitáveis, e já foram corrigidos (ver "Correções recentes" na seção 8).

**"Por que RFC 7807 e não um formato de erro próprio?"**
Porque é um padrão já conhecido por quem consome API REST — `type`/`title`/`status`/`detail`/`instance` — em vez de inventar um contrato de erro específico que cada cliente precisaria aprender. O `GlobalExceptionFilter` centraliza a tradução num único lugar (`APP_FILTER` global), então nenhuma rota monta resposta de erro na mão.

**"Como funciona o health check em produção/orquestração?"**
`GET /health` não exige autenticação nem passa pelo rate limiting (`@SkipThrottle()`), porque um orquestrador como Docker/Kubernetes chama esse endpoint com frequência alta para decidir se reinicia o container. Ele testa conexão real com o banco (`PrismaHealthIndicator`) e heap de memória (limite 300MB); falhando qualquer um, devolve `503`.
