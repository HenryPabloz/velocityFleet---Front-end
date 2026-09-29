# Segurança e Autenticação — Fleet Management

> Este documento descreve o fluxo **real** implementado no projeto (código em `src/auth/` e `src/users/`), não um template genérico. Revisado em 2026-09-25 contra o código e o banco atuais: **não existe mais cadastro público** (`POST /auth/signup` foi removido do projeto); toda conta nasce em `POST /users`, criada por quem já tem a permission `USER_CREATE`. Detalhes técnicos completos (DTOs, guards, seed, rotas por módulo) estão em `fleet-management/projectDocs/projeto-fleet-management.md`; este documento é o resumo prático do "como usar" a autenticação.

---

## 1. Visão geral do fluxo

```
1. POST /users                    (JWT + permission USER_CREATE)  → ADMIN/FLEET_MANAGER cria a conta; resposta traz apiKey em texto puro (só aparece aqui)
2. POST /auth/login               (x-api-key + email/senha)       → devolve JWT (accessToken, prazo definido por JWT_EXPIRATION no .env)
3. Rotas de negócio (users, vehicles, trips, ...)                 → Authorization: Bearer <jwt>
4. Renovar antes do JWT expirar:  POST /auth/refresh-token        (Authorization: Bearer <jwt ainda válido>)
   OU trocar a própria API key:   PATCH /auth/regenerate-key      (x-api-key + password no corpo)
   OU reemitir a de outra pessoa: POST /users/:id/regenerate-api-key (só ADMIN)
```

**Não existe rota pública de cadastro.** Quem cria a conta é sempre um usuário já autenticado com a permission `USER_CREATE` (ADMIN ou FLEET_MANAGER). Isso é proposital: ninguém entra no sistema sozinho.

Duas credenciais diferentes circulam no sistema, cada uma com seu papel:

| Credencial | Onde nasce | Onde é usada | Header |
|---|---|---|---|
| **API key** | `POST /users` (nova conta) ou `regenerate-key`/`regenerate-api-key` (troca) | só para logar (`login`) e trocar a própria chave (`regenerate-key`) | `x-api-key` |
| **JWT (accessToken)** | `login` ou `refresh-token` | todas as rotas de negócio (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`, `analytics`, `permissions`, `roles`, `audit-logs`) | `Authorization: Bearer <token>` |

O banco nunca guarda a API key nem a senha em texto puro: a API key vira hash SHA-256 (`users.api_key`, 64 caracteres hex) e a senha vira hash bcrypt (custo 10). A API key em texto puro só aparece na resposta HTTP de `POST /users`, `PATCH /auth/regenerate-key` e `POST /users/:id/regenerate-api-key` — se o cliente perder essa resposta, a única saída é reemitir uma chave nova.

---

## 2. Passo a passo detalhado

### 2.1 `POST /users` — único cadastro do sistema
- **Não é público.** Exige JWT + permission `USER_CREATE` (ADMIN e FLEET_MANAGER têm por padrão; delegável a outros via `UserPermission`).
- Corpo (`CreateUserDto`): `{ email, password, fullName, roleId, isActive?, driver? }`.
- ADMIN pode atribuir qualquer `roleId`. Quem não é ADMIN (ex: FLEET_MANAGER, ou alguém com `USER_CREATE` delegado) só consegue criar usuários com papel `DRIVER` — tentar outro papel dá `403`.
- Papel `DRIVER` **exige** o bloco `driver { licenseNumber (CNH, 11 dígitos), licenseExpiry }`: o `User` e o `Driver` nascem na mesma transação. Enviar `driver` com outro papel dá `400`.
- Resposta `201`, `Cache-Control: no-store` (a chave não pode ficar em cache): traz `apiKey` em texto puro **uma única vez**; o campo nunca fica nulo.
- E-mail duplicado → `409`.

### 2.2 `POST /auth/login` — troca API key + senha por JWT
- Exige o header `x-api-key` (checado pelo `ApiKeyGuard` antes do handler rodar) **e** corpo `{ email, password }`.
- A API key do header precisa ser do **mesmo usuário** do e-mail/senha do corpo — misturar credenciais de contas diferentes dá 401.
- E-mail normalizado (`trim().toLowerCase()`) antes de comparar. A senha é conferida com `bcrypt.compare`; se o e-mail não existe, o serviço compara mesmo assim com um hash falso, para o tempo de resposta não revelar quais e-mails estão cadastrados.
- 401 `Invalid credentials` é a mesma mensagem para e-mail errado, senha errada ou API key de outro usuário — não dá pra saber qual dos três falhou.
- 403 se a conta dona da API key está com `isActive = false`.
- Resposta 200: `{ accessToken, user: { id, email, fullName, role, permissions, driverId } }`. `permissions: string[]` são as permissions efetivas (papel + delegadas via `UserPermission`); `driverId: string | null` é o perfil Driver ativo do usuário.
- Limite: 5 chamadas/min.

### 2.3 Rotas de negócio — `Authorization: Bearer <jwt>`
- Todo o resto da API (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`, `analytics`, `permissions`, `roles`, `audit-logs`) usa `JwtAuthGuard` + `RolesGuard`.
- O `JwtAuthGuard` valida o token (assinatura, expiração) e, na `JwtStrategy`, confere de novo no banco se o usuário do token ainda existe e está ativo (401 `Invalid or expired token` para os dois casos — não revela qual). O payload do JWT vira `request.user` como `UsuarioLogado = { userId, email, roleId }`.
- O `RolesGuard` decide o 403 com base em `@Roles(...)` (papel fixo) e/ou `@Permissions(...)` (permission delegável) no controller — ver Seção 3.
- Token expirado, ausente ou malformado → 401.

### 2.4 Renovar a sessão: duas rotas, dois propósitos

Esta é a confusão mais comum do projeto — as duas rotas parecem fazer a mesma coisa, mas trocam credenciais diferentes:

| | `POST /auth/refresh-token` | `PATCH /auth/regenerate-key` |
|---|---|---|
| O que troca | O **JWT** (accessToken, prazo de `JWT_EXPIRATION`) | A **API key** (credencial de login) |
| Autenticação exigida | `Authorization: Bearer <jwt ainda válido>` | `x-api-key` (a chave atual) **e** `password` no corpo |
| Corpo | nenhum | `{ password }` (`400` sem ela, `401` se errada) |
| Resposta | `{ accessToken, user }` (mesmo formato do login) | `{ newApiKey, message }` |
| Efeito colateral | Nenhum na API key | Chave antiga invalidada **na hora** — não existe janela em que as duas funcionam |
| Quando usar | JWT perto de expirar, sessão ainda ativa no navegador/app | Suspeita de vazamento da própria API key, ou rotação periódica de credencial |
| Gera refresh token separado? | **Não.** Não existe cookie nem token de refresh; o cliente troca o Bearer atual por um novo antes que expire | — |

Renovar o JWT não gera uma API key nova, e trocar a API key não invalida os JWTs já emitidos (eles continuam valendo até expirar naturalmente — não há blacklist).

`POST /auth/refresh-token` confere de novo, no banco, que a conta ainda existe e está ativa (mesma checagem da `JwtStrategy`, repetida por ser ação sensível) antes de assinar o token novo, com a mesma carga (`sub`, `email`, `roleId`) e prazo renovado; a resposta traz o mesmo `user` do login, inclusive `permissions` e `driverId` atualizados. Limite: 5 chamadas/min.

**Chave perdida (não confundir com `regenerate-key`):** `POST /users/:id/regenerate-api-key`, somente ADMIN, reemite a chave de **outra** pessoa (quem perdeu a própria e não tem como pedir `regenerate-key` sozinho, por exemplo). Devolve `{ newApiKey, message }` uma vez.

### 2.5 Virar `FLEET_MANAGER` ou `ADMIN`
Não existe autopromoção nem rebaixamento pela API. Só um usuário `ADMIN` pode **promover** o papel de alguém:
- `PATCH /users/:id/role` (`@Roles('ADMIN')` + permission `USER_ROLE_PROMOTE`), corpo `{ roleId }`. **Só sobe** de papel: ranking `DRIVER < FLEET_MANAGER < ADMIN`; a mesma role ou uma role igual/menor dá `409` (rebaixar não é suportado pela API); mirar um ADMIN dá `403`; ninguém muda o próprio papel (`409`).
- `PATCH /users/:id` (`UpdateUserDto`, parcial, aceita só `fullName`/`isActive`) **não aceita `roleId`** — enviar dá `400`. A role só muda por `PATCH /users/:id/role`. Não existe `PUT` em nenhum recurso da API (foi removido do projeto).
- `POST /users` (permission `USER_CREATE`) cria um usuário já com o `roleId` escolhido, mas continua exigindo alguém autenticado com a permission — não é uma rota pública.

---

## 3. Papéis (roles) e permissions — o que cada um acessa

Três papéis, criados pelo seed (`prisma/seed.ts`): `DRIVER`, `FLEET_MANAGER`, `ADMIN`. O `RolesGuard` decide o acesso em duas camadas independentes, que podem valer juntas quando a rota exige as duas:

1. **Papel (`@Roles(...)`):** fixo, nunca delegável — confere se o `name` do papel do usuário está na lista exigida pela rota.
2. **Permission (`@Permissions(...)`):** delegável — soma os códigos vindos do papel (`RolePermission`) **e** das permissions concedidas individualmente ao usuário (`UserPermission`, via `PermissionsController`, ADMIN-only). Qualquer um dos dois libera o acesso.

Resumo por módulo (ver `fleet-management/projectDocs/projeto-fleet-management.md`, seção 4, para o detalhe rota a rota):

| Módulo | `DRIVER` | `FLEET_MANAGER` | `ADMIN` |
|---|---|---|---|
| `auth` (login, regenerate-key, refresh-token) | qualquer usuário autenticado pela API key/JWT correspondente (não usa `@Roles`) | idem | idem |
| `users` | sem acesso (exceto `/me`) | `USER_CREATE` (só cria `DRIVER`); não lista nem edita outros usuários por padrão | tudo (listar, criar, editar, trocar role, remover, restaurar, hard delete, reemitir chave alheia) |
| `drivers` | sem acesso | leitura e atualização (`DRIVER_VIEW`/`DRIVER_UPDATE`) | tudo, incluindo remover/restaurar/hard delete |
| `vehicles` | leitura (`GET /vehicles`, `in-use`, `not-in-use`, `:id`) | leitura + escrita completa (criar, editar, remover, restaurar) | tudo |
| `trips` | criar e gerenciar (start/end/cancel) as próprias | idem DRIVER, sem restrição de dono | tudo, incluindo remover/restaurar/hard delete |
| `refuelings` | criar e listar (os próprios) | idem, sem restrição de dono | tudo, incluindo remover/restaurar |
| `maintenances` | sem acesso | leitura e escrita completas | tudo |
| `incidents` | criar e listar (os próprios) | leitura e escrita completas | tudo, incluindo remover/restaurar |
| `analytics` | sem acesso | todos os 5 indicadores | idem |
| `permissions` | sem acesso | sem acesso | as 4 rotas de delegação (`@Roles('ADMIN')` puro, nunca delegável) |
| `audit-logs` | sem acesso por padrão | sem acesso por padrão (delegável) | leitura (`AUDIT_VIEW`) |

Regras gerais observadas no código:
- Todos os 7 resources com soft delete (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`) têm `DELETE /:id` (remoção lógica), `PATCH /:id/restore` (restauração) e `DELETE /:id/permanent` (hard delete, irreversível, sempre `@Roles('ADMIN')` puro, nunca delegável). Soft delete e restore são delegáveis por permission `<RECURSO>_DELETE`/`<RECURSO>_RESTORE`; por padrão FLEET_MANAGER só tem as de vehicles, maintenances e incidents.
- Onde o `DRIVER` (ou quem só tem a permission `*_VIEW_OWN`) tem acesso, ele enxerga e cria dados ligados a si mesmo; o filtro "só os meus" é aplicado no service/controller com o `driverId` do usuário logado, ignorando qualquer `driverId` vindo da query.
- **`UserPermission` é consultada pelo `RolesGuard`:** a checagem de `@Permissions(...)` soma os códigos do papel (`RolePermission`) com os concedidos individualmente ao usuário (`UserPermission`) — qualquer um dos dois libera a rota.

---

## 4. Validações implementadas

| Campo | Regra | Onde |
|---|---|---|
| `email` | Formato de e-mail (`@IsEmail`) + normalizado para minúsculas/sem espaços nas pontas antes de gravar/comparar + único no banco | DTO (`class-validator` + `@Transform`) e CHECK `ck_users_email_normalized` + índice único — 2 camadas |
| `password` (usuário) | 8 a 15 caracteres em texto puro no cadastro/login; hash bcrypt (custo 10) ao gravar | DTO + `UsersService`/`AuthService` |
| `licenseNumber` (CNH do motorista) | Exatamente 11 dígitos numéricos (`IsValidCnh()`); não valida dígitos verificadores | DTO (`DadosMotoristaDto`, só em `POST /users`) + CHECK `ck_drivers_license_number_format` |
| `licenseExpiry` (CNH do motorista) | Data ISO 8601, precisa ser futura | `UpdateDriverDto` (`PATCH /drivers/:id` — único campo aceito nessa rota) |
| `plate` (placa do veículo) | Maiúsculas, sem espaços nas pontas, formato Mercosul (`ABC1D23`) ou antigo (`ABC1234`/`ABC-1234`) | DTO (`IsValidPlaca()`) + CHECK `ck_vehicles_plate_normalized` |
| Datas (`scheduledDate`, etc.) | ISO 8601 (`@IsISO8601`), aceita data pura ou com hora | DTOs dos resources |
| Soft delete | Os 7 resources (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`, `incidents`) têm `deletedAt`, rota de remoção lógica (`DELETE /:id`), restauração (`PATCH /:id/restore`) e remoção permanente (`DELETE /:id/permanent`, irreversível) | Services + `@Roles(...)`/`@Permissions(...)` nos controllers (ver Seção 3) |

O DTO barra com `400` antes de chegar no banco, e o CHECK (`23514`) é a rede de proteção para escrita direta via Prisma sem passar pelo DTO.

---

## 5. Rate limiting

`@nestjs/throttler`, registrado global em `app.module.ts`:
- **Geral:** 20 requisições/minuto, para toda a API (`ThrottlerModule.forRoot`, aplicado por `APP_GUARD`). Desligado quando `NODE_ENV=test`, para não derrubar os testes e2e.
- **Rotas de `auth` (mais sensíveis a força bruta):** 5 requisições/minuto cada, via `@Throttle({ default: { limit: 5, ttl: 60000 } })` em `login`, `regenerate-key` **e** `refresh-token` (as 3 rotas do controller têm o mesmo limite).

---

## 6. Outras proteções

- **`helmet`** (`main.ts`): aplica os headers de segurança padrão e desliga o `X-Powered-By`.
- **`LoggingInterceptor`** (global, `src/common/interceptors/logging.interceptor.ts`): loga método, rota, status, duração e o `userId` autenticado (ou `anonimo`) de cada requisição — nunca loga corpo, headers, senha, token ou API key.
- **`ValidationPipe` global**: `whitelist` + `forbidNonWhitelisted` (campo extra no corpo é 400, não é ignorado silenciosamente) + `transform`.
- **Cache-Control: no-store** nas respostas que trazem credencial em texto puro (`POST /users`, `regenerate-key`, `regenerate-api-key`).
- **Proteção de contas ADMIN:** quem não é ADMIN (mesmo com `USER_UPDATE`/`USER_DELETE`/`USER_RESTORE` delegados) recebe `403` ao editar, desativar, apagar ou restaurar uma conta ADMIN. Um ADMIN não desativa, soft-deleta nem apaga de vez outro ADMIN (`403`), nem a própria conta (`409`).

---

## 7. O que ainda não existe / decisões conscientes

- Logout / invalidação de um JWT antes da expiração natural (não há blacklist de tokens).
- `@MaxLength(72)` na senha do login (o bcrypt só usa os 72 primeiros bytes; hoje o limite do DTO é 15).
- Rebaixar papel pela API (`PATCH /users/:id/role` só promove; a permission `USER_ROLE_DEMOTE` foi removida do catálogo).

**Não existe `POST /auth/signup` nem qualquer cadastro público.** Toda conta nasce em `POST /users`, criada por alguém já autenticado com `USER_CREATE`. Não existe verificação de dígito verificador de CPF — este projeto valida CNH (11 dígitos) e placa de veículo, não CPF.
