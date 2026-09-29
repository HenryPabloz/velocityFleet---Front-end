# 🚀 VELOCITYFLEET FRONT-END — DOCUMENTAÇÃO TÉCNICA COMPLETA

> **Plataforma de Gestão de Frota Corporativa**
> Angular + Bootstrap 5 + GSAP + VantaJS + ApexCharts
>
> Versão: 1.1.0 | Data: 24/09/2026

---

## 📋 ÍNDICE

1. [Visão Geral do Projeto](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Links de Download](#links-de-download)
4. [Arquitetura Modular](#arquitetura-modular)
5. [Estrutura de Pastas](#estrutura-de-pastas)
6. [Setup Inicial](#setup-inicial)
7. [Módulos e Rotas](#módulos-e-rotas)
8. [Especificação das Telas](#especificação-das-telas)
9. [Consumo da API Back-end](#consumo-da-api-back-end)
10. [State Management](#state-management)
11. [i18n (Internacionalização)](#i18n)
12. [Testes](#testes)
13. [Roadmap de Desenvolvimento](#roadmap)

---

## <a name="visão-geral"></a>1. Visão Geral do Projeto

### 1.1 Sobre o VelocityFleet

**VelocityFleet** é a plataforma web da empresa **VelocityFleet Ltda** (fictícia) para gestão corporativa de frota. Este front-end consome a API REST NestJS (repositório separado) e apresenta interfaces adaptadas para 3 perfis de usuário:

- 🚗 **DRIVER** — Motoristas (registro de viagens, abastecimentos, incidentes)
- 📊 **FLEET_MANAGER** — Gerenciamento operacional e analytics
- 🔧 **ADMIN** — Configurações, usuários, controle total

### 1.2 Objetivos Técnicos

- ✅ Mobile-first + responsivo (celulares, tablets, TVs até 1920px)
- ✅ Modular monolítico com lazy loading (Approach 3)
- ✅ Dark mode com detecção automática + toggle manual
- ✅ Animações premium no login (GSAP + VantaJS)
- ✅ Preparado para i18n (PT-BR + estrutura para outros idiomas)
- ✅ Cobertura de testes: Unit (Jest) + E2E (Cypress)

### 1.3 Acesso Restrito

O sistema é **de uso exclusivo** dos funcionários da **VelocityFleet Ltda**. A tela de login deixa isso explícito com aviso destacado.

> ⚠️ **Nota sobre RBAC**: o guard de rota do Angular (`PermissaoGuard`, §7.3) decide o acesso pela **permission efetiva** do usuário (papel + delegações individuais), não só pelo `role`. O back-end suporta **delegação granular de permissão por usuário** — um ADMIN concede ou revoga permissões individuais via `GET /permissions` (catálogo) e `POST`/`DELETE /users/:id/permissions` (todas ADMIN-only). Essa v1 do front não tem tela para gerenciar a delegação. **Resolvido na API:** `POST /auth/login`, `POST /auth/refresh-token` e `GET /users/me` devolvem `permissions: string[]` (permissions **efetivas** = papel + delegadas) e `driverId: string | null` (perfil de motorista ativo) dentro de `user` (no `/users/me`, no próprio corpo). O `AuthStateService` (§10.2) guarda os dois e o `PermissaoGuard` usa `user.permissions`; a API continua sendo a fonte da verdade (`403`). Uma delegação feita depois do login só aparece no front após novo login ou `POST /auth/refresh-token`.

### 1.4 Matriz de Permissões por Papel

Esta seção detalha, recurso por recurso, o que cada papel pode fazer **por padrão** — e deixa explícita a diferença entre as 2 camadas de autorização que o back-end real usa. Conferido contra o banco (43 permissions; DRIVER 10, FLEET_MANAGER 29, ADMIN 43) e os decorators `@Roles`/`@Permissions` de cada controller.

#### As 2 camadas: papel vs. permissão delegada

1. **Papel (`role`)** — definido quando um ADMIN ou gerente cria o usuário (`POST /users`) e alterado só por `PATCH /users/:id/role` (ADMIN). Cada papel já nasce com um conjunto de permissões padrão (tabela abaixo).
2. **Permissão individual delegada (`UserPermission`)** — um ADMIN pode conceder (`POST /users/:id/permissions`, body `{ permissionCode }`) ou revogar (`DELETE /users/:id/permissions/:code`) uma permissão específica pra um usuário, **além** do que o papel dele já dá. Não tem prazo de validade — vale até ser revogada.

O back-end calcula o conjunto efetivo de permissões de um usuário somando as duas camadas (função real `obterCodigosEfetivos`, usada por `trips`, `refuelings`, `incidents`, etc. pra decidir se o usuário vê "tudo" ou só "o que é dele" — ver regra OWN abaixo). O `RolesGuard` da API faz o mesmo em toda rota `@Permissions(...)`.

**Exemplo prático**: um `FLEET_MANAGER` já tem `USER_CREATE` por padrão (cria usuários, mas só com papel `DRIVER`), porém **não** tem `USER_VIEW`: por padrão ele não lista usuários. Um ADMIN pode conceder `USER_VIEW` a um gerente específico via `POST /users/:id/permissions`; a partir daí a API deixa esse gerente usar `GET /users` e `GET /users/:id`, mesmo com `role: FLEET_MANAGER`. Por isso o botão/rota "Usuários" deve olhar a permission efetiva (`USER_VIEW`), nunca `role === 'ADMIN'`.

#### Matriz por módulo (permissões padrão de cada papel)

| Módulo / Recurso | Ação | Rota (permission ou `@Roles`) | `DRIVER` | `FLEET_MANAGER` | `ADMIN` |
|---|---|---|:---:|:---:|:---:|
| **Fleet / Vehicles** | Ver | `GET /vehicles`, `GET /vehicles/in-use`, `GET /vehicles/not-in-use`, `GET /vehicles/:id` (por `@Roles`, não por permission) | ✅ | ✅ | ✅ |
| | Criar | `POST /vehicles` (`VEHICLE_CREATE`) | ❌ | ✅ | ✅ |
| | Editar | `PATCH /vehicles/:id` (`VEHICLE_UPDATE`; não existe `PUT`) | ❌ | ✅ | ✅ |
| | Remover (soft delete) | `DELETE /vehicles/:id` (`VEHICLE_DELETE`) | ❌ | ✅ | ✅ |
| | Restaurar / ver removidos | `PATCH /vehicles/:id/restore`, `GET /vehicles/deleted/all` (`VEHICLE_RESTORE`) | ❌ | ✅ | ✅ |
| | Excluir definitivamente | `DELETE /vehicles/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Drivers** | Ver | `GET /drivers`, `GET /drivers/:id` (`DRIVER_VIEW`) | ❌ | ✅ | ✅ |
| | Criar | não há rota própria: o motorista nasce em `POST /users` (role DRIVER + bloco `driver`, `USER_CREATE`) | ❌ | ✅ | ✅ |
| | Editar | `PATCH /drivers/:id` (`DRIVER_UPDATE`; aceita só `licenseExpiry`; não existe `PUT`) | ❌ | ✅ | ✅ |
| | Remover (soft delete) | `DELETE /drivers/:id` (`DRIVER_DELETE`) | ❌ | ❌ | ✅ |
| | Restaurar / ver removidos | `PATCH /drivers/:id/restore`, `GET /drivers/deleted/all` (`DRIVER_RESTORE`) | ❌ | ❌ | ✅ |
| | Excluir definitivamente | `DELETE /drivers/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Trips** | Criar (sem km) | `POST /trips` (`TRIP_CREATE`) | ✅ | ✅ | ✅ |
| | Ver | `GET /trips`, `GET /trips/:id` — **só as próprias** (`TRIP_VIEW_OWN`; de outro motorista: `404`) | ✅ (OWN) | ✅ (`TRIP_VIEW_ALL` — vê tudo) | ✅ (`TRIP_VIEW_ALL`) |
| | Iniciar (com leitura do hodômetro) / Finalizar | `PATCH /trips/:id/start`, `PATCH /trips/:id/end` (por `@Roles`) | ✅ | ✅ | ✅ |
| | Cancelar | `PATCH /trips/:id/cancel` (`TRIP_CANCEL_OWN`) | ✅ (a própria) | ✅ | ✅ |
| | Remover (soft delete) | `DELETE /trips/:id` (`TRIP_DELETE`) | ❌ | ❌ | ✅ |
| | Restaurar / ver removidas | `PATCH /trips/:id/restore`, `GET /trips/deleted/all` (`TRIP_RESTORE`) | ❌ | ❌ | ✅ |
| | Excluir definitivamente | `DELETE /trips/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Refuelings** | Criar | `POST /refuelings` (`REFUELING_CREATE`) | ✅ | ✅ | ✅ |
| | Ver | `GET /refuelings`, `GET /refuelings/:id` — **só os próprios** (`REFUELING_VIEW_OWN`; de outro motorista: `404`) | ✅ (OWN) | ✅ (`REFUELING_VIEW_ALL`) | ✅ (`REFUELING_VIEW_ALL`) |
| | Remover (soft delete) | `DELETE /refuelings/:id` (`REFUELING_DELETE`) | ❌ | ❌ | ✅ |
| | Restaurar / ver removidos | `PATCH /refuelings/:id/restore`, `GET /refuelings/deleted/all` (`REFUELING_RESTORE`) | ❌ | ❌ | ✅ |
| | Excluir definitivamente | `DELETE /refuelings/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Incidents** | Criar | `POST /incidents` (`INCIDENT_CREATE`) | ✅ | ✅ | ✅ |
| | Ver | `GET /incidents`, `GET /incidents/:id` — **só os próprios** (`INCIDENT_VIEW_OWN`; de outro motorista: `404`) | ✅ (OWN) | ✅ (`INCIDENT_VIEW_ALL`) | ✅ (`INCIDENT_VIEW_ALL`) |
| | Mudar status | `PATCH /incidents/:id/status` (`@Roles('ADMIN','FLEET_MANAGER')`) | ❌ | ✅ | ✅ |
| | Remover (soft delete) | `DELETE /incidents/:id` (`INCIDENT_DELETE`) | ❌ | ✅ | ✅ |
| | Restaurar / ver removidos | `PATCH /incidents/:id/restore`, `GET /incidents/deleted/all` (`INCIDENT_RESTORE`) | ❌ | ✅ | ✅ |
| | Excluir definitivamente | `DELETE /incidents/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Maintenance** | Ver / Criar / Editar | `GET`/`POST`/`PATCH /maintenances` (`MAINTENANCE_VIEW_ALL`/`_CREATE`/`_UPDATE`; não existe `PUT`) | ❌ | ✅ | ✅ |
| | Remover (soft delete) | `DELETE /maintenances/:id` (`MAINTENANCE_DELETE`) | ❌ | ✅ | ✅ |
| | Restaurar / ver removidas | `PATCH /maintenances/:id/restore`, `GET /maintenances/deleted/all` (`MAINTENANCE_RESTORE`) | ❌ | ✅ | ✅ |
| | Excluir definitivamente | `DELETE /maintenances/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Analytics** | Ver (todos os 5 indicadores) | `GET /analytics/*` (`ANALYTICS_VIEW`) | ❌ | ✅ | ✅ |
| **Users / Admin** | Listar / ver por id | `GET /users`, `GET /users/:id` (`USER_VIEW`) | ❌ | ❌ (só por delegação) | ✅ |
| | Criar usuário (gera a API key) | `POST /users` (`USER_CREATE`) — gerente só cria `DRIVER`; ADMIN cria qualquer role | ❌ | ✅ (só DRIVER) | ✅ |
| | Listar papéis (`roleId` do criar usuário e da troca de role) | `GET /roles` (`USER_CREATE` ou `USER_UPDATE`) | ❌ | ✅ | ✅ |
| | Editar usuário (só `fullName` e `isActive`; **sem `roleId`**) | `PATCH /users/:id` (`USER_UPDATE`; não existe `PUT`); conta ADMIN só editável por ADMIN | ❌ | ❌ | ✅ |
| | Trocar role (**só promove**, não existe rebaixar) | `PATCH /users/:id/role` (`@Roles('ADMIN')` + `USER_ROLE_PROMOTE`) | ❌ | ❌ | ✅ |
| | Reemitir API key de outro usuário | `POST /users/:id/regenerate-api-key` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| | Remover (soft delete) | `DELETE /users/:id` (`USER_DELETE`) | ❌ | ❌ | ✅ |
| | Restaurar / ver removidos | `PATCH /users/:id/restore`, `GET /users/deleted/all` (`USER_RESTORE`) | ❌ | ❌ | ✅ |
| | Excluir definitivamente | `DELETE /users/:id/permanent` (`@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Minha conta** | Ver próprio perfil | `GET /users/me` (`PROFILE_VIEW`) | ✅ | ✅ | ✅ |
| | Editar próprio perfil / senha | `PATCH /users/me`, `PATCH /users/me/password` (`PROFILE_UPDATE_OWN`, `PASSWORD_CHANGE_OWN`) | ✅ | ✅ | ✅ |
| | Trocar a própria API key | `PATCH /auth/regenerate-key` (chave atual no header + `password` no corpo; sem JWT de papel) | ✅ | ✅ | ✅ |
| **Permissions** | Catálogo, listar/conceder/revogar | `GET /permissions`, `GET`/`POST /users/:id/permissions`, `DELETE /users/:id/permissions/:code` (todas por `@Roles('ADMIN')`) | ❌ | ❌ | ✅ |
| **Audit Logs** | Ver | `GET /audit-logs` (`AUDIT_VIEW`); `changedBy` pode ser `null` (ver §1.5) | ❌ | ❌ | ✅ |

> Onde a tabela diz `@Roles` (em vez de só um código de permission), a rota checa o papel direto, sem passar pela camada de permission — nesses casos **delegação individual não muda o acesso**. Em `PATCH /users/:id/role` valem as duas checagens: papel ADMIN **e** a permission `USER_ROLE_PROMOTE` (a rota só promove — não existe mais rebaixar pela API, a permission `USER_ROLE_DEMOTE` foi removida do catálogo).

#### 🔒 Regra OWN — motorista só vê o que é dele (leia antes de implementar QUALQUER listagem de Trips/Refuelings/Incidents)

> **`DRIVER` sem `TRIP_VIEW_ALL`/`REFUELING_VIEW_ALL`/`INCIDENT_VIEW_ALL` só enxerga os próprios registros — nunca os de outro motorista. E isso é GARANTIDO PELO BACK-END, não é um filtro que o front escolhe aplicar.**
>
> - `GET /trips`: o motorista vê as viagens que ele **já realizou** (`COMPLETED`), **está realizando** (`IN_PROGRESS`), **vai realizar** (`PLANNED`) e as que **cancelou** (`CANCELLED`) — mas só as dele. Se o front mandar `?driverId=<uuid-de-outro-motorista>`, a API **ignora esse valor** e força o filtro pro motorista logado mesmo assim (o service resolve isso via `resolver-driver-proprio.util.ts`, comentário real no código: *"sem TRIP_VIEW_ALL, o filtro driverId da query é ignorado e forçado para o motorista logado"*).
> - **O mesmo vale para `GET /refuelings` e `GET /incidents`**: sem `REFUELING_VIEW_ALL`/`INCIDENT_VIEW_ALL`, qualquer `driverId` enviado na query é substituído pelo do usuário logado (mesmo mecanismo, confirmado em `refuelings.service.ts`).
> - **O front NÃO precisa (e não deveria) reimplementar esse filtro no cliente.** Não filtre `res.data` por `driverId === usuarioLogado.id` depois de receber a resposta — a API já devolve só o que o motorista pode ver. Mandar ou não `driverId` na query não muda nada pro `DRIVER`.
> - **Detalhe e ações de registro alheio: `404`.** Para o motorista (quem não tem o `*_VIEW_ALL` efetivo), `GET /trips/:id`, `GET /refuelings/:id`, `GET /incidents/:id` e `PATCH /trips/:id/start`, `PATCH /trips/:id/end`, `PATCH /trips/:id/cancel` de registro de outro motorista respondem `404` ("não encontrado"), igual a um id inexistente. Trate como "Registro não encontrado" e volte para a lista; não trate como erro de permissão.
> - **`driverId` alheio: `403`.** `POST /trips`, `POST /refuelings` e `POST /incidents` com `driverId` que não é o do próprio motorista respondem `403` ("driverId must be your own driver profile"). O front do DRIVER deve preencher `driverId` a partir de `user.driverId` (login/refresh/`GET /users/me`, §10.2), nunca de um campo editável; mesmo assim, exiba o `detail` do `403`. Se `user.driverId` for `null` (usuário DRIVER sem perfil de motorista ativo), bloqueie os formulários com uma mensagem clara. No `POST /incidents`, se o `403` ocorre a foto enviada é apagada do servidor; nada a limpar no front.
> - `FLEET_MANAGER` e `ADMIN` (que têm `TRIP_VIEW_ALL`/`REFUELING_VIEW_ALL`/`INCIDENT_VIEW_ALL`) veem **tudo** por padrão, e podem **opcionalmente filtrar por motorista** — `GET /trips?driverId=<uuid>`, `GET /refuelings?driverId=<uuid>`, `GET /incidents?driverId=<uuid>` — pra ver as viagens/abastecimentos/incidentes de um motorista específico. Sem esse filtro, a listagem vem com todo mundo.

### 1.5 Exclusão definitiva, 409 e listagem de papéis

**Soft delete, restore e exclusão definitiva.** O **soft delete** (`DELETE /:id`), o **restore** (`PATCH /:id/restore`) e a lista de removidos (`GET /:recurso/deleted/all`) são **delegáveis por permission**: `<R>_DELETE` e `<R>_RESTORE` (`USER_`, `DRIVER_`, `VEHICLE_`, `TRIP_`, `REFUELING_`, `MAINTENANCE_`, `INCIDENT_`). Por padrão, ADMIN tem todas; FLEET_MANAGER só as de veículos, manutenções e incidentes; drivers, trips, refuelings e users só ADMIN (ou quem recebeu delegação). A **exclusão definitiva** (`DELETE /:id/permanent`) é **exclusiva do ADMIN por papel** nos 7 recursos e **não é uma permission** (não é delegável). `DRIVER` nunca vê nenhum dos botões. Regras para o front:

- Mostre "Excluir" (soft) só com `<R>_DELETE` e "Restaurar"/aba "Removidos" só com `<R>_RESTORE` (§8.14). Mostre "Excluir definitivamente" **só** quando `usuario.role === 'ADMIN'`, sempre atrás de um modal de confirmação (a ação é irreversível). Para os outros papéis esconda o botão (não desabilite): a API responde `403`.
- Em veículos e manutenções o soft delete grava também `isActive = false` e o restore volta `true` (campo somente leitura: enviar `isActive` em `PATCH` dá `400`; não existe `PUT`). Mostre o item removido como "inativo" na aba "Removidos".
- **Trate o 409 da deleção total mostrando o `detail`** do `ProblemDetailsDto` (nunca um erro genérico). Bloqueios legítimos: usuário com `Driver` vinculado ou que registrou viagens/abastecimentos/manutenções/incidentes; motorista com viagens/abastecimentos/incidentes; veículo com viagens/abastecimentos/manutenções/incidentes; e qualquer outro vínculo residual (409 genérico).
- **Viagem x incidentes:** `DELETE /trips/:id/permanent` só passa se **todos** os incidentes da viagem estiverem `RESOLVED`; senão vem 409 ("Cannot permanently delete a trip with unresolved incidents. Resolve them first."). Quando passa, os incidentes resolvidos são apagados junto. Avise isso no modal antes de confirmar.
- Após sucesso, remova o item da lista.

**Audit log com autor nulo.** `GET /audit-logs` pode devolver `changedBy: null`: o autor foi apagado definitivamente (as linhas de auditoria continuam, sem autor). Na tela, mostre "usuário removido" quando `changedBy` for nulo; tipar como `changedBy: string | null`.

**Papéis para o select do formulário de usuário: `GET /roles` (resolvido).** O select de papel do formulário de criação de usuário (`POST /users`) e da tela de troca de role (`PATCH /users/:id/role`), campo `roleId`, consome `GET /roles`. O formulário de **edição** de usuário (`PATCH /users/:id`) **não** tem select de papel. Não há mais lacuna nem configuração provisória: **não pegue IDs do Swagger e não fixe UUIDs no código.**

- **Rota:** `GET /roles` (sem paginação, sem filtros). Devolve um array `[{ id, name, description }]`, ordenado por `name`, com os 3 papéis fixos (`ADMIN`, `DRIVER`, `FLEET_MANAGER`).
- **Acesso por permissão:** `@Permissions('USER_CREATE','USER_UPDATE')` — basta ter uma das duas. ADMIN tem por papel; FLEET_MANAGER tem `USER_CREATE` por padrão (então também acessa). `DRIVER` recebe `403`; sem token, `401`. Carregue a lista ao abrir o formulário de criação (§8.9) e trate `403` mostrando o `detail`. Para o gerente, mostre no select **só** a opção `DRIVER` (a API recusa as demais com `403`).
- **Tipo:** `Role { id: string; name: string; description: string }` (ver §9.4). Use `id` como valor do `<option>` (é o `roleId` enviado) e `name`/`description` como rótulo. Nunca envie o nome do papel no lugar do `roleId`.

---

## <a name="stack-tecnológica"></a>2. Stack Tecnológica

### 2.1 Core Framework

| Tecnologia | Versão | Propósito |
|-----------|--------|-----------|
| **Angular** | 17+ | Framework SPA |
| **TypeScript** | 5.2+ | Linguagem tipada |
| **RxJS** | 7+ | Programação reativa |
| **Node.js** | 18 LTS+ | Runtime de build |

### 2.2 UI & Estilização

| Tecnologia | Versão | Propósito |
|-----------|--------|-----------|
| **Bootstrap** | 5.3+ | Framework CSS base |
| **SCSS** | Latest | Pré-processador |
| **Lucide Angular** | 0.383+ | Biblioteca de ícones |

### 2.3 Animações

| Tecnologia | Versão | Propósito |
|-----------|--------|-----------|
| **GSAP** | 3.12+ | Animações complexas (timelines, tweens) |
| **VantaJS** | 0.5.24+ | Backgrounds 3D animados (login) |

### 2.4 Charts & Data Viz

| Tecnologia | Versão | Propósito |
|-----------|--------|-----------|
| **ApexCharts** | 3.44+ | Gráficos interativos |
| **ng-apexcharts** | 1.9+ | Wrapper Angular |

### 2.5 Testes

| Tecnologia | Versão | Propósito |
|-----------|--------|-----------|
| **Jest** | 29+ | Unit tests |
| **Cypress** | 13+ | E2E tests |
| **@testing-library/angular** | 15+ | Testing utilities |

### 2.6 Utilidades

| Tecnologia | Versão | Propósito |
|-----------|--------|-----------|
| **@ngx-translate/core** | 15+ | i18n |
| **@ngx-translate/http-loader** | 8+ | Carrega arquivos JSON |
| **date-fns** | 3+ | Manipulação de datas |
| **ngx-toastr** | 18+ | Notificações toast |
| **ngx-mask** | 17+ | Máscaras de input |

---

## <a name="links-de-download"></a>3. Links de Download

### 3.1 Core Framework

```bash
# Angular CLI (instalação global)
npm install -g @angular/cli
```
- **Docs**: https://angular.io/cli
- **Docs Angular 17**: https://angular.dev

### 3.2 UI Libraries

**Bootstrap 5**
- **NPM**: `npm install bootstrap @popperjs/core`
- **Docs**: https://getbootstrap.com/docs/5.3/getting-started/introduction/
- **Icons (opcional)**: https://icons.getbootstrap.com/

**Lucide Angular**
- **NPM**: `npm install lucide-angular`
- **Docs**: https://lucide.dev/guide/packages/lucide-angular
- **Explorer**: https://lucide.dev/icons/

**@ng-bootstrap/ng-bootstrap** (Componentes Angular do Bootstrap)
- **NPM**: `npm install @ng-bootstrap/ng-bootstrap`
- **Docs**: https://ng-bootstrap.github.io/

### 3.3 Animações

**GSAP (GreenSock Animation Platform)**
- **NPM**: `npm install gsap`
- **Docs**: https://gsap.com/docs/v3/
- **Playground**: https://gsap.com/community/starter-templates
- **Plugins (opcionais)**:
  - ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
  - Flip: https://gsap.com/docs/v3/Plugins/Flip/

**VantaJS**
- **NPM**: `npm install three vanta`
- **Docs**: https://www.vantajs.com/
- **Playground**: https://www.vantajs.com/?effect=net
- **Efeitos recomendados** para login: `NET`, `WAVES`, `GLOBE`, `RINGS`

### 3.4 Charts

**ApexCharts + ng-apexcharts**
- **NPM**: `npm install apexcharts ng-apexcharts`
- **Docs ApexCharts**: https://apexcharts.com/docs/angular-charts/
- **Docs ng-apexcharts**: https://github.com/apexcharts/ng-apexcharts
- **Demos**: https://apexcharts.com/angular-chart-demos/

### 3.5 Utilities

**@ngx-translate (i18n)**
- **NPM**: `npm install @ngx-translate/core @ngx-translate/http-loader`
- **Docs**: https://github.com/ngx-translate/core

**date-fns**
- **NPM**: `npm install date-fns`
- **Docs**: https://date-fns.org/

**ngx-toastr**
- **NPM**: `npm install ngx-toastr`
- **Docs**: https://github.com/scttcper/ngx-toastr

**ngx-mask**
- **NPM**: `npm install ngx-mask`
- **Docs**: https://github.com/JsDaddy/ngx-mask

### 3.6 Testes

**Jest**
- **NPM**: `npm install --save-dev jest @types/jest jest-preset-angular`
- **Docs**: https://jestjs.io/docs/getting-started
- **Setup Angular**: https://github.com/thymikee/jest-preset-angular

**Cypress**
- **NPM**: `npm install --save-dev cypress @cypress/schematic`
- **Docs**: https://docs.cypress.io/
- **Angular Setup**: https://docs.cypress.io/guides/component-testing/angular/overview

**Testing Library**
- **NPM**: `npm install --save-dev @testing-library/angular @testing-library/jest-dom`
- **Docs**: https://testing-library.com/docs/angular-testing-library/intro/

### 3.7 Fontes (Google Fonts)

Adicione no `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
```

- **Bebas Neue**: https://fonts.google.com/specimen/Bebas+Neue
- **Inter**: https://fonts.google.com/specimen/Inter
- **JetBrains Mono**: https://fonts.google.com/specimen/JetBrains+Mono
- **Playfair Display**: https://fonts.google.com/specimen/Playfair+Display

### 3.8 Ferramentas de Desenvolvimento (Opcionais)

- **VS Code**: https://code.visualstudio.com/
- **Angular Language Service (Extensão)**: `angular.ng-template`
- **ESLint**: https://eslint.org/
- **Prettier**: https://prettier.io/
- **Postman** (testar API): https://www.postman.com/
- **Insomnia** (alternativa ao Postman): https://insomnia.rest/

---

## <a name="arquitetura-modular"></a>4. Arquitetura Modular

### 4.1 Padrão: Modular Monolítico + Lazy Loading

O projeto é dividido em **módulos independentes**, cada um carregado sob demanda (lazy loading). Isso garante:
- ✅ Performance ótima em mobile (bundle inicial pequeno)
- ✅ Separação clara de responsabilidades
- ✅ Facilidade de manutenção
- ✅ Preparado para futura migração para micro-frontends

### 4.2 Diagrama de Módulos

```
┌─────────────────────────────────────────────┐
│           AppModule (Root)                  │
│  ┌───────────────────────────────────────┐  │
│  │  CoreModule (singletons: auth, api)   │  │
│  │  SharedModule (componentes reutilizáveis)│  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │  Auth   │ │Dashboard│ │  Fleet  │
    │ Module  │ │ Module  │ │ Module  │
    └─────────┘ └─────────┘ └─────────┘
                     │
         ┌───────────┼───────────┬───────────┐
         │           │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼─────┐ ┌───▼─────┐
    │  Trips  │ │Refuelings│ │Maintenance│ │Incidents│
    │ Module  │ │ Module   │ │  Module   │ │ Module  │
    └─────────┘ └──────────┘ └───────────┘ └─────────┘
```

### 4.3 Módulos Detalhados

| Módulo | Rotas | Papéis | Descrição |
|--------|-------|--------|-----------|
| **CoreModule** | — | Todos | AuthGuard, HttpInterceptor, ErrorHandler |
| **SharedModule** | — | Todos | Componentes reutilizáveis (buttons, cards, modals) |
| **AuthModule** | `/auth/*` | Público | Login e recuperar senha (não há cadastro público) |
| **DashboardModule** | `/dashboard` | Todos | KPIs, gráficos, resumo executivo |
| **FleetModule** | `/fleet/*` | ADMIN, FLEET_MANAGER (leitura de veículos também libera **DRIVER**, ver §7.2) | Veículos, motoristas |
| **TripsModule** | `/trips/*` | Todos | Viagens (criar, iniciar, finalizar) |
| **RefuelingsModule** | `/refuelings/*` | Todos | Abastecimentos |
| **MaintenanceModule** | `/maintenance/*` | ADMIN, FLEET_MANAGER | Manutenções agendadas |
| **IncidentsModule** | `/incidents/*` | Todos | Incidentes com upload de foto |
| **AnalyticsModule** | `/analytics/*` | ADMIN, FLEET_MANAGER | Relatórios avançados |
| **AdminModule** | `/admin/*` | Por permission efetiva (`USER_VIEW`, `USER_CREATE`, troca de role só ADMIN — ver §7.2) | Usuários (criar, listar, trocar role, reemitir chave), configurações |

> **Fora de escopo (v1)**: os recursos reais `permissions` (catálogo/delegação de permissão) e `audit-logs` (trilha de auditoria) existem na API mas não têm módulo/tela nesta versão do front — não foi esquecimento, é decisão consciente de escopo (ver nota em §1.3).

---

## <a name="estrutura-de-pastas"></a>5. Estrutura de Pastas

```
velocityfleet-frontend/
├── .cypress/                          # Testes E2E
├── src/
│   ├── app/
│   │   ├── core/                      # Serviços globais
│   │   │   ├── guards/
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── permissao.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts
│   │   │   │   └── error.interceptor.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── api.service.ts
│   │   │   │   ├── theme.service.ts
│   │   │   │   └── notification.service.ts
│   │   │   └── core.module.ts
│   │   ├── shared/                    # Componentes reutilizáveis
│   │   │   ├── components/
│   │   │   │   ├── button/
│   │   │   │   ├── card/
│   │   │   │   ├── modal/
│   │   │   │   ├── kpi-card/
│   │   │   │   ├── data-table/
│   │   │   │   ├── theme-toggle/
│   │   │   │   ├── sidebar/
│   │   │   │   └── bottom-tab/
│   │   │   ├── directives/
│   │   │   │   └── gsap-animation.directive.ts
│   │   │   ├── pipes/
│   │   │   │   ├── currency-brl.pipe.ts
│   │   │   │   └── plate-format.pipe.ts
│   │   │   └── shared.module.ts
│   │   ├── features/                  # Módulos de features (lazy)
│   │   │   ├── auth/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── forgot-password/
│   │   │   │   ├── services/
│   │   │   │   ├── auth-routing.module.ts
│   │   │   │   └── auth.module.ts
│   │   │   ├── dashboard/
│   │   │   ├── fleet/
│   │   │   │   ├── vehicles/
│   │   │   │   └── drivers/
│   │   │   ├── trips/
│   │   │   ├── refuelings/
│   │   │   ├── maintenance/
│   │   │   ├── incidents/
│   │   │   ├── analytics/
│   │   │   └── admin/
│   │   ├── layouts/
│   │   │   ├── main-layout/           # Layout com sidebar/bottom-tab
│   │   │   └── auth-layout/           # Layout do login (fullscreen)
│   │   ├── app-routing.module.ts
│   │   ├── app.component.ts
│   │   └── app.module.ts
│   ├── assets/
│   │   ├── images/
│   │   │   ├── logo/
│   │   │   └── illustrations/
│   │   ├── icons/                     # SVGs customizados
│   │   ├── i18n/
│   │   │   ├── pt-BR.json
│   │   │   └── en-US.json
│   │   └── fonts/                     # Fontes locais (backup)
│   ├── environments/
│   │   ├── environment.ts             # Dev (localhost:3000)
│   │   ├── environment.prod.ts        # Produção
│   │   └── environment.staging.ts     # Staging
│   ├── styles/
│   │   ├── tokens/
│   │   │   ├── _colors.scss
│   │   │   ├── _typography.scss
│   │   │   ├── _spacing.scss
│   │   │   └── _shadows.scss
│   │   ├── themes/
│   │   │   ├── _light.scss
│   │   │   └── _dark.scss
│   │   ├── components/
│   │   │   ├── _buttons.scss
│   │   │   ├── _cards.scss
│   │   │   └── _forms.scss
│   │   ├── utilities/
│   │   │   ├── _animations.scss
│   │   │   └── _responsive.scss
│   │   └── styles.scss                # Entry point
│   ├── index.html
│   └── main.ts
├── .gitignore
├── angular.json
├── package.json
├── tsconfig.json
├── jest.config.js
├── cypress.config.ts
├── README.md
└── LICENSE
```

---

## <a name="setup-inicial"></a>6. Setup Inicial

### 6.1 Pré-requisitos

- Node.js 18 LTS+ (https://nodejs.org)
- npm 9+ ou yarn 1.22+
- Git (https://git-scm.com)
- VS Code recomendado

### 6.2 Criar o Projeto

```bash
# 1. Instalar Angular CLI globalmente
npm install -g @angular/cli

# 2. Criar novo projeto
ng new velocityfleet-frontend --routing --style=scss --strict

# 3. Entrar no diretório
cd velocityfleet-frontend
```

### 6.3 Instalar Todas as Dependências

```bash
# UI Libraries
npm install bootstrap @popperjs/core @ng-bootstrap/ng-bootstrap
npm install lucide-angular

# Animações
npm install gsap
npm install three vanta

# Charts
npm install apexcharts ng-apexcharts

# Utilities
npm install @ngx-translate/core @ngx-translate/http-loader
npm install date-fns
npm install ngx-toastr
npm install ngx-mask

# Dev Dependencies (Testes)
npm install --save-dev jest @types/jest jest-preset-angular
npm install --save-dev cypress @cypress/schematic
npm install --save-dev @testing-library/angular @testing-library/jest-dom
```

### 6.4 Configurar Angular.json

Adicionar Bootstrap CSS/JS no `angular.json`:

```json
{
  "styles": [
    "node_modules/bootstrap/dist/css/bootstrap.min.css",
    "node_modules/ngx-toastr/toastr.css",
    "src/styles/styles.scss"
  ],
  "scripts": [
    "node_modules/@popperjs/core/dist/umd/popper.min.js",
    "node_modules/bootstrap/dist/js/bootstrap.min.js"
  ]
}
```

### 6.5 Configurar environments/

**`src/environments/environment.ts` (Dev):**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',  // Backend NestJS local
  appName: 'VelocityFleet',
  version: '1.0.0'
};
```

**`src/environments/environment.prod.ts`:**
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.velocityfleet.com',
  appName: 'VelocityFleet',
  version: '1.0.0'
};
```

### 6.6 Configurar Jest (substituir Karma)

```bash
# 1. Adicionar preset
npx ng add jest-preset-angular

# 2. Remover Karma
npm uninstall karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter jasmine-core @types/jasmine
```

### 6.7 Configurar Cypress

```bash
# 1. Adicionar Cypress
ng add @cypress/schematic

# 2. Abrir Cypress
npx cypress open
```

### 6.8 Rodar o Projeto

```bash
# Desenvolvimento
ng serve

# Acessar: http://localhost:4200
```

---

## <a name="módulos-e-rotas"></a>7. Módulos e Rotas

### 7.1 Rotas Principais

```typescript
// app-routing.module.ts
const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule),
    canActivate: [PublicOnlyGuard]
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.module').then(m => m.DashboardModule)
      },
      {
        // Sem PermissaoGuard aqui no nível do módulo: a API real libera GET /vehicles
        // e GET /vehicles/:id pros 3 papéis (DRIVER também precisa ver veículos
        // AVAILABLE pra criar uma viagem, ver TripsModule). O PermissaoGuard entra
        // dentro do fleet-routing.module.ts, só nas rotas de escrita
        // (vehicles/new, vehicles/:id/edit) e em TODAS as rotas de /fleet/drivers
        // — detalhe completo em §7.2.
        path: 'fleet',
        loadChildren: () => import('./features/fleet/fleet.module').then(m => m.FleetModule)
      },
      {
        path: 'trips',
        loadChildren: () => import('./features/trips/trips.module').then(m => m.TripsModule)
      },
      {
        path: 'refuelings',
        loadChildren: () => import('./features/refuelings/refuelings.module').then(m => m.RefuelingsModule)
      },
      {
        path: 'maintenance',
        loadChildren: () => import('./features/maintenance/maintenance.module').then(m => m.MaintenanceModule),
        canActivate: [PermissaoGuard],
        data: { algumaPermissao: ['MAINTENANCE_VIEW_ALL'] }
      },
      {
        path: 'incidents',
        loadChildren: () => import('./features/incidents/incidents.module').then(m => m.IncidentsModule)
      },
      {
        path: 'analytics',
        loadChildren: () => import('./features/analytics/analytics.module').then(m => m.AnalyticsModule),
        canActivate: [PermissaoGuard],
        data: { algumaPermissao: ['ANALYTICS_VIEW'] }
      },
      {
        // Minha conta: perfil, senha e troca da própria API key (todos os papéis).
        path: 'account',
        loadChildren: () => import('./features/account/account.module').then(m => m.AccountModule)
      },
      {
        // Entra quem tem alguma permission efetiva de gestão de usuários.
        // Cada sub-rota de admin-routing.module.ts repete o PermissaoGuard com a
        // permission exata (USER_VIEW na lista, USER_CREATE em /users/new, ADMIN
        // em /users/:id/role e /settings) — detalhe em §7.2.
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
        canActivate: [PermissaoGuard],
        data: { algumaPermissao: ['USER_VIEW', 'USER_CREATE'] }
      }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
```

### 7.2 Rotas por Módulo

> A partir daqui, cada rota Angular vem seguida da rota real do back-end que ela consome (método HTTP + path), entre parênteses. Isso vale pra toda a seção 8 também.

#### AuthModule (`/auth`)
- `/auth/login` — Tela de login (`POST /auth/login`; **sem cadastro público** — ver fluxo completo em §8.1 e §9.2)
- `/auth/forgot-password` — Recuperar senha (futuro, sem endpoint no back-end hoje)

#### DashboardModule (`/dashboard`)
- `/dashboard` — Overview de KPIs. Fontes de dados por role (ver §8.2): `GET /trips` (viagens/km), `GET /incidents` (incidentes), `GET /vehicles?status=...` (frota por status), `GET /analytics/fleet/fuel-consumption` (consumo/custo), `GET /health` (uptime, só ADMIN)

#### FleetModule (`/fleet`)
- `/fleet/vehicles` — Lista de veículos (`GET /vehicles`) — **ADMIN, FLEET_MANAGER, DRIVER** (leitura liberada pros 3 papéis na API real)
- `/fleet/vehicles/new` — Criar veículo (`POST /vehicles`) — **ADMIN, FLEET_MANAGER** (PermissaoGuard com `VEHICLE_CREATE`)
- `/fleet/vehicles/:id` — Detalhes do veículo (`GET /vehicles/:id`) — **ADMIN, FLEET_MANAGER, DRIVER**
- `/fleet/vehicles/:id/edit` — Editar veículo (`PATCH /vehicles/:id`; não existe `PUT`) — **ADMIN, FLEET_MANAGER** (PermissaoGuard com `VEHICLE_UPDATE`)
- `/fleet/drivers` — Lista de motoristas (`GET /drivers`) — **ADMIN, FLEET_MANAGER** (exige a permission `DRIVER_VIEW`, que o papel DRIVER não tem por padrão — PermissaoGuard nesta rota e em todas as de `/fleet/drivers`)
- Não existe `/fleet/drivers/new`: o motorista é criado junto com o usuário em `/admin/users/new` (`POST /users`, role DRIVER + CNH — §8.9)
- `/fleet/drivers/:id` — Detalhes (`GET /drivers/:id`) — **ADMIN, FLEET_MANAGER**

#### TripsModule (`/trips`)
- `/trips` — Lista de viagens (`GET /trips` — regra OWN: **motorista só vê as próprias viagens**, o back-end ignora qualquer filtro `driverId` da query e força a listagem pro motorista logado; ver §1.4)
- `/trips/new` — Criar viagem, **sem km** (`POST /trips`; usa `GET /vehicles/not-in-use?status=AVAILABLE` e `GET /drivers` para os autocompletes — ver §8.4)
- `/trips/:id` — Detalhes (`GET /trips/:id`), com botões: Iniciar, sem modal de hodômetro — `PATCH /trips/:id/start` não recebe corpo (§8.5), Finalizar, que abre o modal de km rodados (`PATCH /trips/:id/end`, body `{ endKm, endLocation }`), Cancelar (`PATCH /trips/:id/cancel`), Excluir soft (`DELETE /trips/:id`, permission `TRIP_DELETE`)

#### RefuelingsModule (`/refuelings`)
- `/refuelings` — Lista (`GET /refuelings` — regra OWN: **motorista só vê os próprios abastecimentos**, mesmo mecanismo de `/trips`; ver §1.4)
- `/refuelings/new` — Registrar abastecimento (`POST /refuelings`)
- `/refuelings/:id` — Detalhes (`GET /refuelings/:id`)

#### MaintenanceModule (`/maintenance`)
- `/maintenance` — Lista de manutenções (`GET /maintenances`, filtros `status`/`vehicleId`) — **ADMIN, FLEET_MANAGER**
- `/maintenance/new` — Agendar manutenção (`POST /maintenances`) — **ADMIN, FLEET_MANAGER**
- `/maintenance/:id` — Detalhes (`GET /maintenances/:id`), com botão "Concluir" (`PATCH /maintenances/:id` com `status: 'COMPLETED'`) — ver tela completa em §8.8

#### IncidentsModule (`/incidents`)
- `/incidents` — Lista (`GET /incidents` — regra OWN: **motorista só vê os próprios incidentes**, mesmo mecanismo de `/trips`; ver §1.4)
- `/incidents/new` — Registrar, com upload de foto (`POST /incidents`, `multipart/form-data`, campo do arquivo `photo`)
- `/incidents/:id` — Detalhes (`GET /incidents/:id`)

#### AnalyticsModule (`/analytics`)
Reescrito para bater com os **5 endpoints reais** de `GET /analytics/*` (todos ADMIN + FLEET_MANAGER, permission `ANALYTICS_VIEW`) — ver telas em §8.7:
- `/analytics/fleet` — Indicadores agregados da frota (`GET /analytics/fleet/fuel-consumption`, `GET /analytics/fleet/daily-distance`)
- `/analytics/vehicles/:id` — Eficiência de um veículo específico (`GET /analytics/vehicle/:id/efficiency`)
- `/analytics/drivers/:id` — Estatísticas de viagens de um motorista (`GET /analytics/driver/:id/trips`)
- `/analytics/incidents` — Incidentes por severidade (`GET /analytics/incidents/severity`, filtro opcional `status`)

> A rota `/analytics/costs` (custos por categoria) foi **removida**: não existe endpoint de custo agregado por categoria na API hoje (ver §8.7).

#### AdminModule (`/admin`)
- `/admin/users` — Lista de usuários (`GET /users`) — exige a permission efetiva **`USER_VIEW`** (ADMIN por papel; gerente só por delegação). Aba "Removidos" (`GET /users/deleted/all`, `USER_RESTORE`) — §8.11
- `/admin/users/new` — Criar usuário (`GET /roles` + `POST /users`) — permission **`USER_CREATE`** (ADMIN e FLEET_MANAGER; o gerente só oferece a role `DRIVER`) — §8.9
- `/admin/users/:id/role` — Promover role (`PATCH /users/:id/role`, só sobe) — **ADMIN** (+ `USER_ROLE_PROMOTE`) — §8.10
- `/admin/users/:id/edit` — Editar usuário (`PATCH /users/:id`, só `fullName` e `isActive`, sem select de role; não existe `PUT`) — `USER_UPDATE` (ADMIN por padrão); conta ADMIN só editável por ADMIN — §8.11
- `/admin/settings` — Configurações globais — **ADMIN**
- Excluir (soft, `DELETE /users/:id`, `USER_DELETE`), restaurar (`PATCH /users/:id/restore`, `USER_RESTORE`), excluir definitivamente (`DELETE /users/:id/permanent`, só ADMIN) e reemitir API key (`POST /users/:id/regenerate-api-key`, só ADMIN — §8.13) ficam na lista de usuários.

#### AccountModule (`/account`)
- `/account` — Minha conta, todos os papéis: perfil (`GET /users/me`, `PATCH /users/me`), senha (`PATCH /users/me/password`) e troca da própria API key (`PATCH /auth/regenerate-key`, com senha — §8.12)

### 7.3 PermissaoGuard (guard de rota pela permission efetiva)

O guard não compara `role`; pergunta ao `AuthStateService` (§10.2), que consulta `user.permissions` (efetivas, vindas da API), se o usuário tem **alguma** das permissions listadas em `data.algumaPermissao` da rota:

```typescript
@Injectable({ providedIn: 'root' })
export class PermissaoGuard implements CanActivate {
  constructor(private estadoAuth: AuthStateService, private router: Router) {}

  canActivate(rota: ActivatedRouteSnapshot): boolean {
    const exigidas: string[] = rota.data['algumaPermissao'] || [];
    if (this.estadoAuth.temAlgumaPermissao(exigidas)) {
      return true;
    }
    this.router.navigate(['/dashboard']);
    return false;
  }
}
```

Rotas exclusivas do ADMIN (troca de role, `/admin/settings`, exclusão definitiva) usam `data: { papel: 'ADMIN' }` num guard de papel simples (`estadoAuth.hasRole('ADMIN')`), porque a API também checa o papel nelas.

---

## <a name="especificação-das-telas"></a>8. Especificação das Telas

### 8.1 Tela de Login (Premium)

#### Layout
```
┌────────────────────────────────────────────────┐
│  [VantaJS NET background — vermelho + preto]  │
│                                                │
│       ┌──────────────────────────────┐        │
│       │                              │        │
│       │      [LOGO VelocityFleet]    │        │
│       │                              │        │
│       │  ─────────────────────────   │        │
│       │  ACESSO RESTRITO             │        │
│       │  Sistema exclusivo dos       │        │
│       │  funcionários VelocityFleet  │        │
│       │  ─────────────────────────   │        │
│       │                              │        │
│       │  📧 E-mail                   │        │
│       │  [__________________]        │        │
│       │                              │        │
│       │  🔒 Senha                    │        │
│       │  [__________________] 👁️     │        │
│       │                              │        │
│       │  🔑 API Key                  │        │
│       │  [__________________] 👁️     │        │
│       │  Pré-preenchida se já salva  │        │
│       │  neste navegador             │        │
│       │                              │        │
│       │  [ ENTRAR ]                  │        │
│       │                              │        │
│       │  Sem conta? Peça ao gestor   │        │
│       │                              │        │
│       └──────────────────────────────┘        │
│                                                │
│   Esqueceu sua senha?  |  © 2026 VelocityFleet │
└────────────────────────────────────────────────┘
```

#### Componentes
- **Background**: VantaJS `NET` (cores: vermelho corporativo + preto)
- **Card Central**: Bootstrap card com `backdrop-filter: blur(10px)`, borda vermelha superior
- **Logo**: Animação GSAP scale + fadeIn (delay 300ms)
- **Título**: "ACESSO RESTRITO" em Bebas Neue 32px, vermelho corporativo
- **Subtítulo**: "Sistema exclusivo dos funcionários VelocityFleet Ltda" em Inter 14px
- **Formulário**: Stagger animation GSAP (inputs aparecem em sequência)
- **Campo API Key**: a chave é entregue pelo ADMIN/gerente que criou a conta (§8.9). Se existir uma chave em `localStorage` (`api_key`, gravada após um login bem-sucedido neste navegador), o campo já vem preenchido; senão fica vazio e o usuário cola a chave que recebeu. Tem toggle de visibilidade (👁️) igual ao campo senha
- **Botão Login**: Primary red com hover elevation + pulse quando idle
- **Sem cadastro público**: não há link nem modal de cadastro; abaixo do botão só o texto "Sem conta? Peça o cadastro a um administrador ou gerente"
- **Link "Esqueceu sua senha?"**: Rota `/auth/forgot-password`

#### Fluxo de autenticação completo (com API key)

O back-end real exige **3 informações** pra logar — e-mail, senha e a API key do usuário — e **não existe cadastro público**. O fluxo completo é:

1. **Cadastro feito por um gestor** (`POST /users`, tela §8.9): ADMIN ou FLEET_MANAGER cria a conta; a resposta traz `apiKey` em texto puro, **uma única vez**. O gestor copia e entrega ao usuário por um canal seguro. A tela de criação **não** grava essa chave em `localStorage` (é a chave de outra pessoa).
2. **Primeiro acesso**: o usuário cola a chave no campo "API Key" e faz login. Depois de um login com sucesso, o front grava a chave dele em `localStorage` (`api_key`) só para pré-preencher o campo nesta máquina; se limpar o `localStorage` ou trocar de navegador, precisa colar de novo.
3. **Login** (`POST /auth/login`) — e-mail e senha vão no corpo, a API key vai no header `x-api-key`. Devolve um JWT (`accessToken`).
4. Dali em diante, todas as rotas de negócio usam só `Authorization: Bearer <accessToken>` — a API key só é usada no login (e na troca da própria chave). **Renovação do JWT:** o front chama sozinho `POST /auth/refresh-token` antes de o token expirar (ex.: lê o `exp` do JWT e agenda a chamada quando faltarem poucos minutos) e substitui o `access_token`; se falhar com `401`, volta ao login.
5. **Trocar a própria chave**: `PATCH /auth/regenerate-key` — header `x-api-key` com a chave **atual** e corpo `{ password }` (a senha do usuário; sem ela `400`, senha errada `401`). Resposta `{ newApiKey, message }`, mostrada uma vez (tela §8.12). O JWT em uso continua válido.
6. **Chave perdida**: o usuário pede a um ADMIN, que reemite em `POST /users/:id/regenerate-api-key` (tela §8.13).

### 8.2 Dashboard (Funcional)

#### Layout Desktop
```
┌──────────┬──────────────────────────────────────┐
│          │  🔴 Bom dia, João!  🔔  🌓  👤       │
│ SIDEBAR  ├──────────────────────────────────────┤
│          │                                       │
│ 📊 Dash  │  ┌──────┬──────┬──────┬──────┐      │
│ 🚗 Frota │  │ KPI1 │ KPI2 │ KPI3 │ KPI4 │      │
│ 🗺️  Viag │  └──────┴──────┴──────┴──────┘      │
│ ⛽ Abast │                                       │
│ 🔧 Manut │  ┌─────────────────┐ ┌──────────┐    │
│ ⚠️  Inc  │  │ Consumo Frota   │ │ Status   │    │
│ 📈 Analy │  │ (Linha ApexCh)  │ │ Veículos │    │
│ 👥 Adm   │  └─────────────────┘ └──────────┘    │
│          │                                       │
│ ─────    │  ┌──────────────────────────────┐    │
│ Sair     │  │ Últimas Viagens (Tabela)     │    │
└──────────┴──────────────────────────────────────┘
```

#### Layout Mobile
```
┌──────────────────────────┐
│  ☰  VelocityFleet  🔔  👤│
├──────────────────────────┤
│                          │
│  ┌────────────────────┐  │
│  │ KPI 1              │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ KPI 2              │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ Chart Frota        │  │
│  └────────────────────┘  │
│                          │
├──────────────────────────┤
│  📊  🚗  🗺️  ⛽  👤     │ ← Bottom Tab
└──────────────────────────┘
```

#### KPIs Principais (por role)

**DRIVER:**
- Total de viagens (mês) — `GET /trips` (regra OWN: lista já vem filtrada pro motorista logado, sem `TRIP_VIEW_ALL` — ver §1.4)
- KM percorridos (mês) — calculado no cliente a partir do mesmo `GET /trips` (soma `endKm - startKm` das concluídas no mês)
- Incidentes reportados (mês) — `GET /incidents` (regra OWN, idem — ver §1.4)
- Próxima manutenção do veículo atual — `GET /maintenances?vehicleId=...&status=SCHEDULED` (veículo vem do último `GET /trips` ativo do motorista)

**FLEET_MANAGER:**
- Frota total (veículos disponíveis / em uso / manutenção) — 4 chamadas `GET /vehicles?status=X&pageSize=1`, lendo `pagination.total` de cada uma (ver §8.7, "Distribuição de Status"). Para só "em uso" x "fora de uso": `GET /vehicles/in-use?pageSize=1` e `GET /vehicles/not-in-use?pageSize=1` (`pagination.total` de cada; a soma é o total de `GET /vehicles`)
- Consumo total (litros) — `GET /analytics/fleet/fuel-consumption` (`totalLiters`). **Atenção**: esse endpoint não tem filtro de período — soma tudo desde sempre, não só o mês corrente. Se o KPI precisar ser "do mês", é preciso um endpoint com filtro de data (não existe hoje); por ora, exibir como "consumo total acumulado", sem prometer "mês"
- Custo total mês — **sem endpoint agregado hoje** (ver nota em §8.7, "Custos por Categoria" — fora de escopo)
- Viagens ativas agora — `GET /trips?status=IN_PROGRESS` (com `TRIP_VIEW_ALL`)

**ADMIN:**
- Todos os KPIs do FLEET_MANAGER
- Usuários ativos — `GET /users` (exige `USER_VIEW`; contar `isActive: true` na página, ou usar `pagination.total`)
- Uptime do sistema — `GET /health` (rota pública, sem auth; front só usa o resultado pra exibir o card)

### 8.3 Página de Veículos (`/fleet/vehicles`)

Lista: `GET /vehicles?page=&pageSize=&status=` (total). Abas: **Todos** (`GET /vehicles`), **Em uso** (`GET /vehicles/in-use`, status `IN_USE`; inclui veículo com viagem só planejada, pois `POST /trips` já marca `IN_USE`) e **Fora de uso** (`GET /vehicles/not-in-use`, demais status; aceita `?status=AVAILABLE|IN_MAINTENANCE|OUT_OF_SERVICE`, `IN_USE` dá `400`). Leitura liberada pros 3 papéis (ADMIN, FLEET_MANAGER, DRIVER) — ver §7.2.

#### Filtros
- Status: `AVAILABLE`, `IN_USE`, `IN_MAINTENANCE`, `OUT_OF_SERVICE` (query `status` de `GET /vehicles`)
- Modelo: dropdown (filtro só no cliente — `GET /vehicles` não tem query `model`)
- Ano: range slider (filtro só no cliente — `GET /vehicles` não tem query `year`)
- Busca: por placa (filtro só no cliente — `GET /vehicles` não tem query de busca por texto/placa)

#### Grid Responsive
- **Mobile**: Cards em coluna única, expandidos
- **Tablet**: 2 colunas
- **Desktop**: Tabela com colunas: Placa, Modelo, Ano, Status, KM, Ações
- **TV**: 3-4 colunas de cards

#### Ações por Veículo
- Ver detalhes (`GET /vehicles/:id`)
- Editar (`PATCH /vehicles/:id`, parcial; não existe `PUT`) — ADMIN, FLEET_MANAGER
- Agendar manutenção (`POST /maintenances` com esse `vehicleId`, ver §8.8) — ADMIN, FLEET_MANAGER
- Excluir, soft delete (`DELETE /vehicles/:id`) — permission `VEHICLE_DELETE` (ADMIN, FLEET_MANAGER)
- Aba "Removidos" (`GET /vehicles/deleted/all`) e Restaurar (`PATCH /vehicles/:id/restore`) — permission `VEHICLE_RESTORE` (ADMIN, FLEET_MANAGER). O veículo removido vem com `isActive: false`; o restore volta `true`
- Excluir definitivamente (`DELETE /vehicles/:id/permanent`) — **só ADMIN**; tratar 409 mostrando `detail` (ver §1.5)

### 8.4 Criar Viagem (`/trips/new`)

#### Formulário
```
┌────────────────────────────────────┐
│  ← Nova Viagem                     │
├────────────────────────────────────┤
│                                    │
│  Motorista                         │
│  [Autocomplete de motoristas]  ▼  │
│                                    │
│  Veículo                           │
│  [Autocomplete de veículos disp.]▼│
│  Status atual: 🟢 AVAILABLE         │
│  KM atual: 15.432 (só informativo) │
│                                    │
│  Local de Origem *                 │
│  CEP: [01234567] 🔍 (validar)     │
│  → São Paulo, SP                   │
│                                    │
│  Local de Destino *                │
│  CEP: [30130100] 🔍 (validar)     │
│  → Belo Horizonte, MG              │
│                                    │
│  [ CANCELAR ]  [ CRIAR VIAGEM ]   │
└────────────────────────────────────┘
```

**Fluxo:**
1. Motorista seleciona ele mesmo (pre-fill) — autocomplete alimentado por `GET /drivers` (ADMIN/FLEET_MANAGER) ou, se o usuário logado for DRIVER, pré-preenchido direto (motorista não tem `DRIVER_VIEW`, então não lista outros motoristas — só o próprio). O `driverId` do DRIVER vem de `user.driverId` (guardado no `AuthStateService`, §10.2; origem: `POST /auth/login`, `POST /auth/refresh-token` ou `GET /users/me`). Se for `null`, bloqueie o formulário. Enviar um `driverId` que não seja o dele dá `403` ("driverId must be your own driver profile"); ADMIN/FLEET_MANAGER escolhem qualquer motorista
2. Seleciona veículo (só mostra AVAILABLE) — autocomplete alimentado por `GET /vehicles/not-in-use?status=AVAILABLE` (ou `GET /vehicles?status=AVAILABLE`; liberado pros 3 papéis). O `currentMileage` do veículo não aparece neste formulário: **a criação não tem campo de km** (nem o start — ver §8.5)
3. Digita CEPs (validação em tempo real via API ViaCEP no back-end) — os campos são enviados como `startLocation`/`endLocation` em `POST /trips`; a API valida o CEP contra o ViaCEP real e grava o **endereço resolvido** (ex: "São Paulo, SP"), não o CEP em si. **Erros de CEP em `POST /trips`:** `400` = CEP inválido ou inexistente (mostre o erro no campo do CEP, com `errors[]`/`detail`). `504` (timeout ou rate limit do ViaCEP) e `502` (ViaCEP com erro de servidor ou sem rede) = **serviço de consulta de CEP indisponível**: mostre "Serviço de consulta de CEP indisponível, tente novamente" (não marque o campo como inválido) e mantenha o formulário preenchido para reenviar. Não confunda com o `400`. O `ErrorInterceptor` (§9.2) mostra um toast genérico para 5xx; o componente do formulário deve tratar `504`/`502` de `POST /trips` com a mensagem específica
4. Ao criar (`POST /trips`, corpo `{ driverId, vehicleId, startLocation, endLocation }`): veículo vira `IN_USE`, trip vira `PLANNED`. **Não envie `startKm`** (a API responde `400`): o `startKm` provisório é a quilometragem atual do veículo e o valor real é informado ao iniciar a viagem (§8.5). Veículo inativo (`isActive: false`) volta `409`; `driverId` de outro motorista (só para DRIVER) volta `403`
5. Redirect para detalhes (`GET /trips/:id`)

### 8.5 Detalhes da Viagem (`/trips/:id`)

Tela carregada via `GET /trips/:id`. Se a API responder `404` (viagem inexistente **ou de outro motorista**, para o DRIVER), mostre "Viagem não encontrada" e volte para `/trips`. O mesmo `404` vale para `PATCH /trips/:id/start`, `PATCH /trips/:id/end` e `PATCH /trips/:id/cancel` numa viagem alheia.

**Estados e Botões:**

| Status | Botões Visíveis | Rota chamada |
|--------|-----------------|--------------|
| **PLANNED** | Iniciar Viagem (sem modal, chamada direta — start não recebe corpo), Cancelar | `PATCH /trips/:id/start` (sem corpo), `PATCH /trips/:id/cancel` |
| **IN_PROGRESS** | Finalizar Viagem (abre o modal de km rodados), Cancelar | `PATCH /trips/:id/end` (body `{ endKm, endLocation }`), `PATCH /trips/:id/cancel` |
| **COMPLETED** | Ver Rota (mapa futuro), Excluir (soft) | — (mapa é futuro, sem endpoint), `DELETE /trips/:id` (permission `TRIP_DELETE`) |
| **CANCELLED** | Excluir (soft) | `DELETE /trips/:id` (permission `TRIP_DELETE`) |

> As transições (`start`/`end`/`cancel`) rodam dentro de procedures do banco: erros de negócio (veículo indisponível, motorista com CNH vencida, viagem em status incompatível) voltam como 409, no formato RFC 7807 (ver §9.2/§9.4) — não como 200 com uma flag de erro.

#### Iniciar viagem — sem modal, sem leitura de hodômetro

`PATCH /trips/:id/start` **não recebe corpo**: `StartTripDto` é uma classe vazia e a API tem `forbidNonWhitelisted` — enviar qualquer campo (inclusive um `currentMileage` residual de uma versão antiga do front) dá `400`. Não existe mais leitura de hodômetro nesta etapa.

- O botão "Iniciar Viagem" chama `PATCH /trips/:id/start` direto, sem abrir modal nem pedir nenhum dado.
- O `startKm` **definitivo** da viagem passa a ser a quilometragem atual do veículo (lida no banco, no momento do start) — o hodômetro do veículo **não muda** nesse passo.
- Erros: `409` (mostrar `detail`) se a viagem não estiver `PLANNED`, ou se o veículo estiver inativo/em manutenção/fora de serviço.

#### Modal "Finalizar viagem" (km rodados)

Ao clicar em Finalizar Viagem, o front pede os **quilômetros rodados na viagem** (não é leitura de hodômetro):

```
┌────────────────────────────────────┐
│  Finalizar viagem                  │
│                                    │
│  Km rodados nesta viagem *         │
│  [120_______________]              │
│  Entre 1 e 100.000                 │
│                                    │
│  Local de chegada *                │
│  [Campinas, SP______]              │
│                                    │
│  [ CANCELAR ]  [ FINALIZAR ]       │
└────────────────────────────────────┘
```

- Campo numérico inteiro (`endKm`), **quilômetros rodados na viagem** — não é uma leitura de hodômetro, e pode ser diferente da distância estimada na criação. Faixa: `1` a `100.000`.
- Envia `PATCH /trips/:id/end` com `{ "endKm": 120, "endLocation": "Campinas, SP" }`. O servidor soma `endKm` ao hodômetro atual do veículo.
- Na resposta, `endKm` volta como o **hodômetro final absoluto** (`startKm + km rodados`) — não confundir com o valor enviado no corpo. A distância percorrida vem em `distanceKm` (`= endKm resposta - startKm`), que é o valor a exibir como "distância da viagem".
- Erros: `400` se `endKm` for inválido (`<= 0` ou `> 100.000`), ou se o hodômetro resultante passar de 10.000.000; `409` (mostrar `detail`) se a viagem não estiver `IN_PROGRESS`.

### 8.6 Registro de Incidente (`/incidents/new`)

`CreateIncidentDto` real exige `driverId` (UUID, obrigatório) — o formulário abaixo já inclui esse campo, que faltava numa versão anterior deste documento.

#### Formulário
```
┌────────────────────────────────────┐
│  ⚠️  Registrar Incidente           │
├────────────────────────────────────┤
│                                    │
│  Viagem Associada (opcional)       │
│  [Dropdown]                        │
│                                    │
│  Motorista *                       │
│  [Dropdown ou auto-preenchido]     │
│                                    │
│  Veículo *                         │
│  [Dropdown]                        │
│                                    │
│  Tipo *                            │
│  ○ Acidente                        │
│  ○ Falha Mecânica                  │
│  ○ Outro                           │
│                                    │
│  Severidade *                      │
│  🟢 Baixa  🟡 Média  🔴 Alta      │
│                                    │
│  Descrição *                       │
│  [Textarea máx 1000 chars]         │
│  0/1000                            │
│                                    │
│  📷 Foto do Incidente (opcional)   │
│  [Arraste ou clique para upload]   │
│  JPEG, PNG, PDF (máx 10MB)         │
│                                    │
│  [ CANCELAR ]  [ REGISTRAR ]      │
└────────────────────────────────────┘
```

**Regra do campo Motorista:**
- Usuário logado com role **DRIVER**: campo fica **oculto**, `driverId` é auto-preenchido com `user.driverId` (§10.2; não precisa listar motoristas — o papel DRIVER não tem `DRIVER_VIEW`). Se for `null`, bloqueie o formulário. `POST /incidents` com `driverId` alheio dá `403` ("driverId must be your own driver profile"): mostre o `detail`. `GET /incidents/:id` de incidente alheio dá `404`: mostre "Incidente não encontrado".
- Usuário logado **ADMIN**/**FLEET_MANAGER**: campo aparece como dropdown (`GET /drivers`), pra registrar o incidente em nome do motorista envolvido.
- Se uma **Viagem Associada** for selecionada primeiro (`GET /trips/:id`), o front pode pré-preencher `driverId`/`vehicleId` com os da viagem, mas o campo continua editável.

**Rotas:**
- Dropdown de viagens: `GET /trips`
- Dropdown de veículos: `GET /vehicles`
- Dropdown de motoristas (só ADMIN/FLEET_MANAGER): `GET /drivers`
- Submeter: `POST /incidents`, `multipart/form-data` — campos `tripId?`, `vehicleId`, `driverId`, `type`, `severity`, `description` como partes de texto, e o arquivo (se houver) na parte `photo`

### 8.7 Analytics (`/analytics/fleet`)

Reescrito pra bater com os **5 endpoints reais** de analytics (nenhum outro existe hoje). Todos exigem ADMIN ou FLEET_MANAGER (`ANALYTICS_VIEW`).

#### Charts ApexCharts

- **Consumo da Frota** (KPI card, não mais bar chart por veículo) — `GET /analytics/fleet/fuel-consumption`. Devolve um **objeto único agregado** da frota inteira (`averageLitersPerKm`, `totalLiters`, `totalKm`), não uma lista por veículo — por isso virou card, não bar chart comparativo.
  > **Nota de escopo**: uma comparação de consumo *entre* veículos (o "Consumo por Veículo" original) exigiria N chamadas a `GET /analytics/vehicle/:id/efficiency` (uma por veículo, sem endpoint de lista) — **fora do escopo desta v1**. Se entrar depois, cachear os resultados por veículo (não muda a cada request) em vez de disparar tudo em paralelo numa frota grande.

- **KM percorridos por Mês** (Line chart com área) — `GET /analytics/fleet/daily-distance?days=90` devolve granularidade **diária** (`{ date, totalKm }[]`, não mensal). O front precisa agregar os dias em meses no cliente antes de plotar:
  ```typescript
  // Agrupa {date, totalKm}[] diário em totais por mês (chave "YYYY-MM").
  function agregarPorMes(dados: { date: string; totalKm: number }[]) {
    const totalPorMes = new Map<string, number>();
    for (const item of dados) {
      const chaveDoMes = item.date.slice(0, 7); // "2026-09-20" -> "2026-09"
      const totalAtual = totalPorMes.get(chaveDoMes) ?? 0;
      totalPorMes.set(chaveDoMes, totalAtual + item.totalKm);
    }
    return Array.from(totalPorMes.entries()).map(([mes, totalKm]) => ({ mes, totalKm }));
  }
  ```

- **Custos por Categoria** — **removido desta v1**: não existe endpoint que devolva custo agregado por categoria (combustível/manutenção/incidentes). `fleet/fuel-consumption` só dá litros/km, não custo; manutenção e incidente não têm custo agregado em nenhuma rota de analytics. Se esse chart for prioridade, é preciso um endpoint novo no back-end antes — não implementado aqui.

- **Distribuição de Status** (Radial bar, veículos por status) — sem endpoint de agregação dedicado. Montado no cliente com 4 chamadas a `GET /vehicles?status=X&pageSize=1`, lendo só `pagination.total` de cada uma (mais barato que paginar a frota inteira):
  ```typescript
  const STATUS: VehicleStatus[] = ['AVAILABLE', 'IN_USE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE'];

  function carregarDistribuicaoDeStatus(http: HttpClient, apiUrl: string) {
    const chamadas = STATUS.map(status =>
      http.get<PaginatedResponse<Vehicle>>(`${apiUrl}/vehicles`, {
        params: { status, pageSize: 1 }
      })
    );
    return forkJoin(chamadas).pipe(
      map(respostas => STATUS.map((status, i) => ({ status, total: respostas[i].pagination.total })))
    );
  }
  ```
  > 💡 Melhoria futura sugerida pro back-end (não implementada aqui, só anotada): um endpoint `GET /analytics/fleet/vehicles-by-status` devolvendo essa contagem pronta evitaria as 4 chamadas.

- **Incidentes por Severidade** (Donut ou bar chart) — `GET /analytics/incidents/severity` (filtro opcional `status`). Endpoint real que existia mas não estava documentado em nenhum chart da v1 anterior deste documento.

### 8.8 Manutenções (`/maintenance`)

Módulo que já existia no diagrama de arquitetura (§4.2), na tabela de módulos (§4.3) e no roteamento (§7.1), mas não tinha tela especificada — corrigido aqui. Acesso: **ADMIN, FLEET_MANAGER** (motorista não vê manutenção).

#### Lista (`/maintenance`)

`GET /maintenances?page=&pageSize=&status=&vehicleId=` (paginado, igual padrão `{ data, pagination }` do resto da API).

- Colunas: Veículo, Tipo (`PREVENTIVE`/`CORRECTIVE`/`INSPECTION`), Status (`SCHEDULED`/`IN_PROGRESS`/`COMPLETED`), Data agendada, Custo
- Filtros: Status (dropdown), Veículo (autocomplete)
- Ação "Concluir" na linha, visível quando status ≠ `COMPLETED` (ver abaixo)

#### Agendar Manutenção (`/maintenance/new`)

```
┌────────────────────────────────────┐
│  🔧 Agendar Manutenção             │
├────────────────────────────────────┤
│                                    │
│  Veículo *                         │
│  [Dropdown]                        │
│                                    │
│  Tipo *                            │
│  ○ Preventiva  ○ Corretiva         │
│  ○ Inspeção                        │
│                                    │
│  Data Agendada *                   │
│  [__/__/____]                      │
│                                    │
│  Descrição *                       │
│  [Textarea máx 1000 chars]         │
│                                    │
│  Custo Estimado (R$) *             │
│  [____________]                    │
│                                    │
│  [ CANCELAR ]  [ AGENDAR ]        │
└────────────────────────────────────┘
```

- Dropdown de veículos: `GET /vehicles`
- Submeter: `POST /maintenances` (`vehicleId`, `type`, `scheduledDate`, `description`, `cost`; `status` fica de fora — nasce `SCHEDULED` por padrão)
- Efeito colateral real: se o veículo estiver `AVAILABLE`, ele é marcado `IN_MAINTENANCE` automaticamente pela API — o front não precisa (nem deve) chamar `PATCH /vehicles/:id` à parte pra isso.

#### Detalhes / Concluir (`/maintenance/:id`)

`GET /maintenances/:id`. Botão **"Concluir"** visível quando `status` é `SCHEDULED` ou `IN_PROGRESS`:
- Chama `PATCH /maintenances/:id` com `{ status: 'COMPLETED' }` (`completedDate` é preenchida automaticamente com a data atual se não enviada)
- Efeito colateral real: `vehicles.lastMaintenanceKm` é sincronizado com a KM atual do veículo, e o veículo volta pra `AVAILABLE` automaticamente (se não houver outra manutenção ativa) — de novo, sem chamada extra do front pro recurso de veículo.
- Excluir (soft delete): `DELETE /maintenances/:id` — ADMIN, FLEET_MANAGER
- Excluir definitivamente: `DELETE /maintenances/:id/permanent` — **só ADMIN** (ver §1.5)

### 8.9 Criar usuário (`/admin/users/new`)

Única porta de entrada de contas do sistema. Acesso: permission `USER_CREATE` (ADMIN e FLEET_MANAGER).

```
┌────────────────────────────────────┐
│  ← Novo usuário                    │
├────────────────────────────────────┤
│  Nome completo *   [____________]  │
│  E-mail *          [____________]  │
│  Senha * (8 a 15)  [____________]  │
│  Papel *           [ DRIVER      ▼]│
│                                    │
│  ┌ Dados do motorista (só DRIVER) ┐│
│  │ CNH * (11 dígitos) [__________]││
│  │ Validade da CNH *  [__/__/____]││
│  └────────────────────────────────┘│
│  [ CANCELAR ]  [ CRIAR USUÁRIO ]   │
└────────────────────────────────────┘
```

- **Select de papel:** carregado de `GET /roles` (`id` é o `roleId`, `name`/`description` o rótulo). Se o usuário logado for **ADMIN**, mostra os 3 papéis; se for **FLEET_MANAGER** (ou qualquer não-ADMIN com `USER_CREATE`), mostra **só `DRIVER`** — a API responde `403` para as demais.
- **Bloco de CNH:** aparece ao escolher `DRIVER` e é **obrigatório** nesse caso (`licenseNumber`: 11 dígitos numéricos, sem máscara; `licenseExpiry`: data ISO `YYYY-MM-DD`, não pode estar no passado). Com outro papel o bloco fica oculto e **não é enviado** (a API responde `400` se vier `driver` com papel diferente de DRIVER). A CNH é validada só pelo formato (sem dígitos verificadores).
- **Envio:** `POST /users` com `{ email, password, fullName, roleId, isActive?, driver? }`. Conta e perfil de motorista nascem numa transação só.
- **Erros:** `400` (campo inválido, DRIVER sem bloco `driver`, CNH vencida) mostra `errors[]` nos campos; `403` (papel não permitido) mostra `detail`; `409` (e-mail ou CNH já cadastrados) mostra `detail` no campo.
- **Exibição única da API key:** a resposta `201` traz `apiKey` (texto puro, 64 hex) e `Cache-Control: no-store`. Abra um modal com o campo somente leitura + botão **Copiar** + aviso "Esta chave não será mostrada de novo. Entregue-a ao usuário por um canal seguro" e o botão **Já entreguei** (só então fecha). **Não** grave a chave em `localStorage`, estado global, logs nem URL. Se o modal for fechado sem copiar, a saída é a reemissão (§8.13).

### 8.10 Promover role (`/admin/users/:id/role`)

Somente **ADMIN** (a API exige `@Roles('ADMIN')` + `USER_ROLE_PROMOTE`). Chamada: `PATCH /users/:id/role` com `{ roleId }` — **só promove**, a rota não aceita mais bloco `driver` nem existe rota para rebaixar (a permission `USER_ROLE_DEMOTE` foi removida do catálogo).

- **Ranking:** DRIVER < FLEET_MANAGER < ADMIN. A UI só deve oferecer papéis **acima** do atual (`DRIVER→FLEET_MANAGER`, `DRIVER→ADMIN`, `FLEET_MANAGER→ADMIN`) — não ofereça a role atual nem uma abaixo, embora a API também recuse (`409`).
- **Regras (espelhe na UI, mas a API é a fonte da verdade):** o mesmo papel ou um papel igual/menor que o atual dá `409` (rebaixar não é suportado); mirar um usuário **ADMIN** dá `403` — esconda a ação na linha de um ADMIN; ninguém muda a **própria** role (`409`) — esconda na própria linha; `roleId` inexistente `400`; usuário inexistente ou removido `404`.
- **Virar DRIVER:** não envie bloco `driver` — a rota não aceita mais esse campo. Um usuário sem perfil de motorista que seja promovido a `DRIVER` (teoricamente só desceria, então isso não ocorre no fluxo normal de promoção) não é um caso desta tela.
- **Efeito imediato:** vale já para o JWT emitido (a API lê o papel do banco a cada requisição). Depois do sucesso, recarregue a linha do usuário; o `role` guardado no navegador do usuário afetado só se atualiza no próximo login dele.
- Resposta `200`: dados do usuário. `PATCH /users/:id` **não aceita `roleId`** (`400` se enviado; não existe `PUT`): o papel só muda nesta rota. Por isso o formulário de edição de usuário (§8.11) não tem select de papel; a troca de role é uma tela/ação própria, chamada da lista (§8.11).

### 8.11 Lista de usuários (`/admin/users`)

- **Acesso:** só quem tem `USER_VIEW` efetiva (ADMIN por papel; gerente só por delegação). O item de menu e a rota usam `PermissaoGuard` com `USER_VIEW` (§7.3); um FLEET_MANAGER sem delegação **não vê** essa tela (mas vê "Novo usuário", por `USER_CREATE`).
- **Dados:** `GET /users?page=&pageSize=` (`GET /users/:id` no detalhe). Colunas: nome, e-mail, papel (via `roleId` → `GET /roles`), ativo.
- **Ações por linha:** Promover role (ADMIN, §8.10, `PATCH /users/:id/role`); Reemitir API key (ADMIN, §8.13); Editar (`USER_UPDATE`, `PATCH /users/:id`; não existe `PUT`); Excluir soft (`USER_DELETE`, `DELETE /users/:id`); aba "Removidos" (`GET /users/deleted/all`) com Restaurar (`PATCH /users/:id/restore`), ambos `USER_RESTORE`; Excluir definitivamente (`DELETE /users/:id/permanent`, só ADMIN, 409 mostra `detail`).
- **Formulário de edição (`/admin/users/:id/edit`):** só `fullName` e `isActive`. **Não há select de role**: a role muda pela ação "Promover role" (§8.10). `PATCH /users/:id` aceita só esses dois campos (enviar `roleId` dá `400`); não existe `PUT`.
- **Linhas ADMIN (regras de proteção; a API é a fonte da verdade):**
  - Quem **não** é ADMIN (mesmo com `USER_UPDATE`/`USER_DELETE`/`USER_RESTORE` delegados) não pode editar, desativar, excluir nem restaurar um ADMIN: desabilite as ações na linha (`403` "Only an ADMIN can modify another ADMIN account").
  - Para o ADMIN logado, desabilite **desativar** (`isActive=false`), **excluir (soft)** e **excluir definitivamente** em linhas de **outro** ADMIN (`403`) e na **própria** linha (`409` "You cannot deactivate or delete your own account"). Continuam habilitados: editar o `fullName` de outro ADMIN, reativar e restaurar.
  - Linhas não-ADMIN: ações normais. Reconheça a linha ADMIN pelo papel (`roleId` → `GET /roles`, `name === 'ADMIN'`) e a própria linha por `user.id`.
  - Mesmo com os botões desabilitados, trate `403` e `409` dessas rotas mostrando o `detail` do `ProblemDetails` (toast do `ErrorInterceptor`, §9.2) e recarregando a linha.

### 8.12 Minha conta: trocar a própria API key (`/account`)

Todos os papéis. Formulário com **senha atual**; ao enviar, `PATCH /auth/regenerate-key`:

- Header `x-api-key` com a chave **atual** (o `AuthInterceptor` §9.2 injeta a partir de `localStorage`) **e** corpo `{ "password": "<senha atual>" }`.
- `200`: `{ newApiKey, message }`. Mostre `newApiKey` uma única vez (mesmo modal de §8.9, com Copiar) e atualize `api_key` no `localStorage`. A chave antiga deixa de valer na hora; o JWT em uso **continua válido**.
- `400` sem `password`; `401` com senha errada ou chave inválida (mensagem genérica) — **neste caso o `ErrorInterceptor` não deve deslogar** (ver §9.2). `403` conta inativa. Limite de 5 chamadas por minuto.

### 8.13 Reemitir a API key de outro usuário (só ADMIN)

Na lista de usuários (§8.11), botão "Reemitir API key" com modal de confirmação ("a chave atual deixará de valer"). Chamada: `POST /users/:id/regenerate-api-key` (sem corpo; autenticada só pelo JWT do ADMIN). Resposta `200` `{ newApiKey, message }`, exibida **uma única vez** com Copiar, para o ADMIN entregar ao usuário. `403` se não for ADMIN; `404` se o usuário não existe ou foi removido. Serve também para usuários antigos que ficaram sem API key.

### 8.14 Botões de soft delete e restore por permission

Regra única para todas as listas (users, drivers, vehicles, trips, refuelings, maintenances, incidents):

| Elemento | Chamada | Aparece quando |
|---|---|---|
| Botão "Excluir" (soft) | `DELETE /<recurso>/:id` | `temPermissao('<R>_DELETE')` |
| Aba "Removidos" | `GET /<recurso>/deleted/all` | `temPermissao('<R>_RESTORE')` |
| Botão "Restaurar" | `PATCH /<recurso>/:id/restore` | `temPermissao('<R>_RESTORE')` |
| Botão "Excluir definitivamente" | `DELETE /<recurso>/:id/permanent` | `usuario.role === 'ADMIN'` (não é permission) |

`<R>` = `USER`, `DRIVER`, `VEHICLE`, `TRIP`, `REFUELING`, `MAINTENANCE`, `INCIDENT`. Padrões: ADMIN todos; FLEET_MANAGER só `VEHICLE_`, `MAINTENANCE_` e `INCIDENT_`. Um `403` inesperado (delegação revogada) esconde o botão até o próximo carregamento.

---

## <a name="consumo-da-api-back-end"></a>9. Consumo da API Back-end

### 9.1 URL Base

```typescript
// environment.ts (dev)
apiUrl: 'http://localhost:3000'

// environment.prod.ts
apiUrl: 'https://api.velocityfleet.com'
```

### 9.2 HTTP Interceptors

**AuthInterceptor** (adiciona `Authorization: Bearer` em toda rota autenticada, **e** `x-api-key` só nas 2 rotas que exigem — `POST /auth/login` e `PATCH /auth/regenerate-key`; ver fluxo completo em §8.1):
```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let requisicao = req;

    // Authorization: Bearer <jwt> — vale pra praticamente toda rota de
    // negócio (GET /vehicles, POST /trips, etc.), se já existir um token.
    const token = localStorage.getItem('access_token');
    if (token) {
      requisicao = requisicao.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }

    // x-api-key só entra em 2 rotas: POST /auth/login (troca email + senha +
    // key por um JWT) e PATCH /auth/regenerate-key (troca a key atual por uma
    // nova). Nas demais rotas a API nem olha esse header.
    const precisaDeApiKey =
      (req.method === 'POST' && req.url.endsWith('/auth/login')) ||
      (req.method === 'PATCH' && req.url.endsWith('/auth/regenerate-key'));
    if (precisaDeApiKey) {
      const apiKey = localStorage.getItem('api_key');
      if (apiKey) {
        requisicao = requisicao.clone({
          setHeaders: { 'x-api-key': apiKey }
        });
      }
    }

    return next.handle(requisicao);
  }
}
```

**ErrorInterceptor** (trata o formato real de erro da API — **RFC 7807**, `Content-Type: application/problem+json`, corpo `{ type, title, status, detail, instance, errors?: string[] }`; ver interface `ProblemDetails` em §9.4. **Não é** o formato antigo do Nest `{ message, error, statusCode }`):
```typescript
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private router: Router, private toastr: ToastrService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // error.error é o corpo Problem Details devolvido pela API.
        const problema: ProblemDetails | null = error.error ?? null;

        // Exceção: PATCH /auth/regenerate-key devolve 401 quando a SENHA enviada
        // está errada. Isso não é sessão expirada: não deslogue, só mostre o detail.
        const ehTrocaDeChave = req.url.endsWith('/auth/regenerate-key');
        if (error.status === 401 && !ehTrocaDeChave) {
          localStorage.clear();
          this.router.navigate(['/auth/login']);
          this.toastr.error(problema?.detail ?? 'Sessão expirada. Faça login novamente.');
        } else if (error.status === 403) {
          this.toastr.error(problema?.detail ?? 'Você não tem permissão para essa ação.');
        } else if (error.status >= 500) {
          this.toastr.error('Erro no servidor. Tente novamente.');
        } else if (problema?.detail) {
          // 400/404/409 etc.: usa "detail" como toast genérico. Quando o erro
          // vem do ValidationPipe (formulário), "errors[]" também vem
          // preenchido — isso é tratado no componente, não aqui (ver exemplo
          // de formulário reativo em §9.4).
          this.toastr.error(problema.detail);
        }

        return throwError(() => error);
      })
    );
  }
}
```

#### Tratamento de status específicos (além do toast genérico)

- `404` ao abrir detalhe (`GET /trips/:id`, `GET /refuelings/:id`, `GET /incidents/:id`) ou agir (`PATCH /trips/:id/start|end|cancel`): trate como "não encontrado" e volte para a lista. Para o DRIVER, registro de outro motorista responde `404`, igual a id inexistente.
- `403` em `POST /trips`, `POST /refuelings`, `POST /incidents` com `driverId` alheio: mostre o `detail` ("driverId must be your own driver profile") e reveja o preenchimento a partir de `user.driverId`.
- `403`/`409` ao editar, desativar, excluir ou restaurar usuário ADMIN (§8.11): mostre o `detail`.
- `504` e `502` em `POST /trips` (ViaCEP indisponível) e `POST /vehicles` com `initialLocationCep`: o `ErrorInterceptor` só mostra o toast genérico de servidor; o componente mostra "Serviço de consulta de CEP indisponível, tente novamente" e não marca o CEP como inválido. `400` continua sendo CEP inválido (§8.4).

### 9.3 Services (Padrão)

Cada método abaixo já traz, em comentário, a rota real que ele chama — padrão a seguir em todo service do projeto (não só neste exemplo).

```typescript
@Injectable({ providedIn: 'root' })
export class VehicleService {
  private apiUrl = `${environment.apiUrl}/vehicles`;
  
  constructor(private http: HttpClient) {}
  
  // GET /vehicles?page=&pageSize=&status=
  list(page = 1, pageSize = 10, status?: VehicleStatus): Observable<PaginatedResponse<Vehicle>> {
    return this.http.get<PaginatedResponse<Vehicle>>(this.apiUrl, {
      params: { page, pageSize, ...(status ? { status } : {}) }
    });
  }
  
  // GET /vehicles/:id
  getById(id: string): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.apiUrl}/${id}`);
  }
  
  // POST /vehicles
  create(data: CreateVehicleDto): Observable<Vehicle> {
    return this.http.post<Vehicle>(this.apiUrl, data);
  }
  
  // PATCH /vehicles/:id (parcial)
  update(id: string, data: UpdateVehicleDto): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.apiUrl}/${id}`, data);
  }
  
  // DELETE /vehicles/:id (soft delete)
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
  
  // PATCH /vehicles/:id/restore
  restore(id: string): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.apiUrl}/${id}/restore`, {});
  }
}
```

**AuthService** — precisa existir com essa forma pra `AuthStateService.login()` (§10.2) funcionar de verdade contra o back-end real (envia e-mail+senha no corpo e a API key no header `x-api-key`, via `AuthInterceptor`, §9.2):

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  // POST /auth/login — email/senha no corpo; o AuthInterceptor injeta
  // x-api-key a partir do localStorage automaticamente (ver §9.2). O parâmetro
  // apiKey aqui só existe pra permitir logar com uma key colada manualmente
  // (ex: usuário limpou o localStorage) antes dela ser persistida.
  login(email: string, password: string, apiKey: string): Observable<LoginResponse> {
    if (apiKey) {
      localStorage.setItem('api_key', apiKey);
    }
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password });
  }

  // PATCH /auth/regenerate-key — troca a PRÓPRIA chave. Autenticada pela API
  // key atual (x-api-key, via AuthInterceptor) + a senha no corpo. Devolve
  // { newApiKey, message }; a chave antiga é invalidada na hora.
  regenerateApiKey(password: string): Observable<RegenerarChaveResposta> {
    return this.http.patch<RegenerarChaveResposta>(`${this.apiUrl}/regenerate-key`, { password });
  }

  // POST /auth/refresh-token — autenticado por Bearer (JWT ainda válido);
  // devolve um novo JWT com prazo renovado.
  refreshToken(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh-token`, {});
  }
}
```

**UsuarioService** e **RoleService** — criação de usuário, troca de role e reemissão de chave (telas §8.9 a §8.13):

```typescript
@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  // GET /users?page=&pageSize= — exige USER_VIEW
  listar(page = 1, pageSize = 10): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(this.apiUrl, { params: { page, pageSize } });
  }

  // POST /users — exige USER_CREATE. Devolve a apiKey em texto UMA única vez.
  criar(dados: CriarUsuarioDto): Observable<UsuarioCriado> {
    return this.http.post<UsuarioCriado>(this.apiUrl, dados);
  }

  // PATCH /users/:id/role — ADMIN + USER_ROLE_PROMOTE (só promove; sem bloco driver)
  trocarRole(id: string, dados: TrocarRoleDto): Observable<UsuarioComMotorista> {
    return this.http.patch<UsuarioComMotorista>(`${this.apiUrl}/${id}/role`, dados);
  }

  // POST /users/:id/regenerate-api-key — só ADMIN. Devolve { newApiKey, message }.
  reemitirApiKey(id: string): Observable<RegenerarChaveResposta> {
    return this.http.post<RegenerarChaveResposta>(`${this.apiUrl}/${id}/regenerate-api-key`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  constructor(private http: HttpClient) {}

  // GET /roles — exige USER_CREATE ou USER_UPDATE (ADMIN e FLEET_MANAGER)
  listar(): Observable<Role[]> {
    return this.http.get<Role[]>(`${environment.apiUrl}/roles`);
  }
}
```

#### Mapeamento completo: método do service → rota real

Pra todo módulo que não tem o service inteiro escrito acima, a tabela abaixo é o contrato mínimo (método HTTP + path) que cada service Angular precisa implementar:

| Módulo | Método (sugerido) | Rota real |
|--------|--------------------|-----------|
| Auth | `login()` | `POST /auth/login` (+ header `x-api-key`; devolve `user.permissions` e `user.driverId`) |
| Auth | `regenerateApiKey(password)` | `PATCH /auth/regenerate-key` (+ header `x-api-key` com a chave atual; body `{ password }`) |
| Auth | `refreshToken()` | `POST /auth/refresh-token` (devolve o mesmo `user` do login, com `permissions` e `driverId` atualizados) |
| Vehicles | `list()` | `GET /vehicles?page=&pageSize=&status=` (total) |
| Vehicles | `listInUse()` | `GET /vehicles/in-use?page=&pageSize=` |
| Vehicles | `listNotInUse()` | `GET /vehicles/not-in-use?page=&pageSize=&status=` (`status` exceto `IN_USE`) |
| Vehicles | `listDeleted()` | `GET /vehicles/deleted/all` (`VEHICLE_RESTORE`) |
| Vehicles | `delete()` / `restore()` | `DELETE /vehicles/:id` (`VEHICLE_DELETE`) / `PATCH /vehicles/:id/restore` (`VEHICLE_RESTORE`) |
| Drivers | `list()` | `GET /drivers?page=&pageSize=` |
| Drivers | `getById()` | `GET /drivers/:id` |
| Drivers | `update()` | `PATCH /drivers/:id` (aceita só `licenseExpiry`; não existe `PUT`) |
| Drivers | `delete()` | `DELETE /drivers/:id` (soft, `DRIVER_DELETE`) |
| Drivers | `deletePermanent()` | `DELETE /drivers/:id/permanent` (só ADMIN; 409 com `detail`) |
| Trips | `list()` | `GET /trips?page=&pageSize=&status=&driverId=&vehicleId=` |
| Trips | `getById()` | `GET /trips/:id` (`404` para viagem de outro motorista, se DRIVER) |
| Trips | `create()` | `POST /trips` (body `{ driverId, vehicleId, startLocation, endLocation }` — **sem km**; `400` CEP inválido, `504`/`502` ViaCEP indisponível, `403` `driverId` alheio) |
| Trips | `start()` | `PATCH /trips/:id/start` (sem corpo — `startKm` vira a quilometragem atual do veículo; `404` se viagem alheia) |
| Trips | `end()` | `PATCH /trips/:id/end` (body `{ endKm, endLocation }`, `endKm` = km RODADOS; `404` se viagem alheia) |
| Trips | `cancel()` | `PATCH /trips/:id/cancel` (`404` se viagem alheia) |
| Trips | `delete()` | `DELETE /trips/:id` (soft, `TRIP_DELETE`) |
| Trips | `deletePermanent()` | `DELETE /trips/:id/permanent` (só ADMIN; 409 se houver incidente não `RESOLVED`) |
| Refuelings | `list()` | `GET /refuelings?page=&pageSize=&vehicleId=&driverId=` |
| Refuelings | `getById()` | `GET /refuelings/:id` (`404` para registro de outro motorista, se DRIVER) |
| Refuelings | `create()` | `POST /refuelings` (`403` se `driverId` alheio, para DRIVER) |
| Refuelings | `delete()` | `DELETE /refuelings/:id` (soft, `REFUELING_DELETE`) |
| Refuelings | `deletePermanent()` | `DELETE /refuelings/:id/permanent` (só ADMIN) |
| Incidents | `list()` | `GET /incidents?page=&pageSize=&severity=&status=&vehicleId=&driverId=` |
| Incidents | `getById()` | `GET /incidents/:id` (`404` para registro de outro motorista, se DRIVER) |
| Incidents | `create()` | `POST /incidents` (`multipart/form-data`, campo `photo`; `403` se `driverId` alheio, para DRIVER) |
| Incidents | `updateStatus()` | `PATCH /incidents/:id/status` (ADMIN, FLEET_MANAGER) |
| Incidents | `delete()` | `DELETE /incidents/:id` (soft, `INCIDENT_DELETE`) |
| Incidents | `deletePermanent()` | `DELETE /incidents/:id/permanent` (só ADMIN) |
| Maintenance | `list()` | `GET /maintenances?page=&pageSize=&status=&vehicleId=` |
| Maintenance | `getById()` | `GET /maintenances/:id` |
| Maintenance | `create()` | `POST /maintenances` |
| Maintenance | `complete()` | `PATCH /maintenances/:id` (`{ status: 'COMPLETED' }`) |
| Maintenance | `delete()` | `DELETE /maintenances/:id` (soft, `MAINTENANCE_DELETE`) |
| Maintenance | `deletePermanent()` | `DELETE /maintenances/:id/permanent` (só ADMIN) |
| Analytics | `consumoDaFrota()` | `GET /analytics/fleet/fuel-consumption` |
| Analytics | `distanciaDiaria()` | `GET /analytics/fleet/daily-distance?days=` |
| Analytics | `eficienciaDoVeiculo()` | `GET /analytics/vehicle/:id/efficiency` |
| Analytics | `estatisticasDoMotorista()` | `GET /analytics/driver/:id/trips` |
| Analytics | `incidentesPorSeveridade()` | `GET /analytics/incidents/severity?status=` |
| Roles | `list()` | `GET /roles` (`USER_CREATE` ou `USER_UPDATE`) |
| Users (Admin) | `list()` | `GET /users?page=&pageSize=` (`USER_VIEW`) |
| Users (Admin) | `getById()` | `GET /users/:id` (`USER_VIEW`) |
| Users (Admin) | `create()` | `POST /users` (`USER_CREATE`; devolve `apiKey` uma vez; role DRIVER exige o bloco `driver`) |
| Users (Admin) | `promoteRole()` | `PATCH /users/:id/role` (ADMIN + `USER_ROLE_PROMOTE`, só promove; body `{ roleId }`) |
| Users (Admin) | `reissueApiKey()` | `POST /users/:id/regenerate-api-key` (só ADMIN; devolve `{ newApiKey, message }`) |
| Users (Admin) | `update()` | `PATCH /users/:id` (`USER_UPDATE`; body só `fullName`/`isActive`; `roleId` dá `400`; não existe `PUT`) |
| Users (Admin) | `delete()` / `restore()` | `DELETE /users/:id` (`USER_DELETE`) / `PATCH /users/:id/restore` (`USER_RESTORE`); ADMIN alvo: `403`/`409` conforme §8.11 |
| Users (Admin) | `listDeleted()` | `GET /users/deleted/all` (`USER_RESTORE`) |
| Users (Admin) | `deletePermanent()` | `DELETE /users/:id/permanent` (só ADMIN; 409 com `detail`; `403` para outro ADMIN, `409` para a própria conta) |
| Audit logs | `list()` | `GET /audit-logs` (`changedBy` pode ser `null`; sem tela na v1) |
| Users (perfil próprio) | `getMe()` | `GET /users/me` (devolve também `permissions` e `driverId`) |
| Users (perfil próprio) | `updateMe()` | `PATCH /users/me` |
| Users (perfil próprio) | `changePassword()` | `PATCH /users/me/password` |

Para os demais recursos, `restore()` é sempre `PATCH /<recurso>/:id/restore` e a lista de removidos é `GET /<recurso>/deleted/all`, ambos com a permission `<R>_RESTORE` (§8.14).

### 9.4 Interfaces TypeScript

```typescript
// vehicle.model.ts
export interface Vehicle {
  id: string;
  // Aceita 2 formatos (o back-end valida os dois): Mercosul ("ABC1D23") ou
  // antigo ("ABC1234" / "ABC-1234"). Não assuma só o formato Mercosul numa
  // máscara de input (ngx-mask) ou num regex de validação no front.
  plate: string;
  model: string;
  year: number;
  status: VehicleStatus;
  currentMileage: number;
  lastMaintenanceKm: number;
  // Somente leitura: false quando o veículo está em soft delete. Enviar isActive
  // em PATCH dá 400 (não existe PUT).
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE'
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// trip.model.ts — GET /trips, GET /trips/:id, POST /trips
export interface Trip {
  id: string;
  driverId: string;
  vehicleId: string;
  status: TripStatus;
  // Provisório (km do veículo na criação) enquanto a viagem está PLANNED; vira
  // definitivo (a quilometragem atual do veículo naquele momento — sem input do
  // cliente) em PATCH /trips/:id/start, que não recebe corpo.
  startKm: number;
  // Só preenchido depois de PATCH /trips/:id/end. É o hodômetro FINAL absoluto
  // (startKm + km rodados), não o valor de "endKm" enviado no corpo do end
  // (aquele é só a distância rodada).
  endKm: number | null;
  // Só vem na resposta de PATCH /trips/:id/end (não em GET /trips), = endKm - startKm.
  distanceKm?: number;
  // Endereço RESOLVIDO pelo ViaCEP a partir do CEP enviado na criação
  // (ex: "São Paulo, SP") — não é o CEP cru que o usuário digitou.
  startLocation: string;
  endLocation: string;
  startTime: string;
  endTime: string | null;
  createdBy: string; // id do usuário (não do motorista) que criou a viagem
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum TripStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// driver.model.ts — GET /drivers, GET /drivers/:id (o motorista é criado por POST /users)
export interface Driver {
  id: string;
  userId: string; // vínculo 1:1 com o User dono da conta
  // CNH: sempre 11 dígitos numéricos, sem máscara (validado no back-end).
  licenseNumber: string;
  licenseExpiry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// incident.model.ts — GET /incidents, GET /incidents/:id, POST /incidents
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
  OTHER = 'OTHER'
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum IncidentStatus {
  REPORTED = 'REPORTED',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  RESOLVED = 'RESOLVED'
}

// refueling.model.ts — GET /refuelings, GET /refuelings/:id, POST /refuelings
export interface Refueling {
  id: string;
  vehicleId: string;
  driverId: string;
  mileage: number;
  litersAdded: number;
  costPerLiter: number;
  totalCost: number; // calculado pela API (litersAdded x costPerLiter); nunca enviar no create
  fuelType: FuelType;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum FuelType {
  DIESEL = 'DIESEL',
  GASOLINE = 'GASOLINE',
  ETHANOL = 'ETHANOL',
  HYBRID = 'HYBRID'
}

// maintenance.model.ts — GET /maintenances, GET /maintenances/:id, POST /maintenances
export interface Maintenance {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate: string | null;
  description: string;
  cost: number;
  registeredBy: string;
  isActive: boolean; // somente leitura: false em soft delete
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  INSPECTION = 'INSPECTION'
}

export enum MaintenanceStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

// role.model.ts — GET /roles (roleId do criar usuário e da troca de role)
export interface Role {
  id: string;
  name: string; // "ADMIN" | "DRIVER" | "FLEET_MANAGER"
  description: string;
}

// user.model.ts — GET /users, GET /users/:id (recurso ADMIN) e base de GET /users/me
// (ver PerfilProprio abaixo). Diferente do objeto "user" pequeno de LoginResponse.
export interface User {
  id: string;
  email: string;
  fullName: string;
  roleId: string; // UUID do papel — não o nome ("DRIVER"/"FLEET_MANAGER"/"ADMIN"). obtido de GET /roles (ver §1.5)
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // só em GET /users/deleted/all
}

// GET /users/me: o usuário mais as permissions efetivas e o driverId (campos aditivos)
export interface PerfilProprio extends User {
  permissions: string[]; // efetivas: papel + delegadas
  driverId: string | null; // perfil Driver ativo
}

// corpo de PATCH /users/:id — NÃO tem roleId (400 se enviado). Não existe PUT /users/:id.
export interface AtualizarUsuarioDto {
  fullName?: string;
  isActive?: boolean;
}

// auth.model.ts — corpo de POST /auth/login, POST /auth/refresh-token
export interface LoginResponse {
  accessToken: string;
  // Objeto MENOR que User: já vem com o nome do papel pronto (string), não roleId.
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string; // "DRIVER" | "FLEET_MANAGER" | "ADMIN" — string simples, NÃO objeto
    permissions: string[]; // permissions efetivas (papel + delegadas)
    driverId: string | null; // perfil Driver ativo; null se não houver
  };
}

// user-admin.model.ts — corpos e respostas de POST /users e PATCH /users/:id/role
export interface DadosMotorista {
  licenseNumber: string; // CNH: 11 dígitos numéricos, sem máscara
  licenseExpiry: string; // ISO 8601 (YYYY-MM-DD), não pode estar no passado
}

export interface CriarUsuarioDto {
  email: string;
  password: string; // 8 a 15 caracteres
  fullName: string;
  roleId: string; // vem de GET /roles
  isActive?: boolean; // padrão true
  driver?: DadosMotorista; // OBRIGATÓRIO com role DRIVER; 400 com outra role
}

export interface UsuarioComMotorista extends User {
  driver?: Driver; // presente quando há perfil de motorista
}

// Resposta 201 de POST /users: a apiKey aparece SÓ aqui (texto puro, 64 hex)
export interface UsuarioCriado extends UsuarioComMotorista {
  apiKey: string;
}

// PATCH /users/:id/role — só promove, sem bloco driver
export interface TrocarRoleDto {
  roleId: string;
}

// Resposta de PATCH /auth/regenerate-key e de POST /users/:id/regenerate-api-key
export interface RegenerarChaveResposta {
  newApiKey: string; // texto puro, mostrado uma única vez
  message: string;
}

// PATCH /trips/:id/start NÃO recebe corpo (StartTripDto vazio; forbidNonWhitelisted
// dá 400 em qualquer campo enviado, inclusive um "currentMileage" antigo).

// corpo de PATCH /trips/:id/end
export interface FinalizarViagemDto {
  endKm: number; // km RODADOS na viagem (1 a 100.000), NÃO é leitura de hodômetro
  endLocation: string; // texto livre (não é CEP)
}

// problem-details.model.ts — formato REAL de erro da API (RFC 7807),
// Content-Type: application/problem+json. Usado pelo ErrorInterceptor (§9.2).
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  // Só vem preenchido quando o erro é de validação de campo (ValidationPipe,
  // 400): uma mensagem por campo inválido.
  errors?: string[];
}
```

#### Exemplo: usando `ProblemDetails` num formulário reativo

O `ErrorInterceptor` (§9.2) já mostra um toast genérico com `detail`. Pra popular mensagens de campo (ex: no formulário de Registrar Incidente, §8.6, ou Criar Viagem, §8.4), o componente trata o erro 400 separadamente, sem deixar o interceptor "engolir" o `errors[]`:

```typescript
this.incidentService.create(dados, foto).subscribe({
  next: (incidente) => this.router.navigate(['/incidents', incidente.id]),
  error: (erro: HttpErrorResponse) => {
    const problema: ProblemDetails = erro.error;
    if (erro.status === 400 && problema.errors?.length) {
      // Ex: "type must be one of ..." -> mapeia pro controle certo do form.
      problema.errors.forEach(mensagem => this.aplicarErroNoCampo(mensagem));
    }
    // O toast genérico (problema.detail) já foi disparado pelo ErrorInterceptor.
  }
});
```

---

## <a name="state-management"></a>10. State Management

### 10.1 Padrão: BehaviorSubject + Services

Cada feature tem um `StateService` que gerencia seu próprio estado:

```typescript
@Injectable({ providedIn: 'root' })
export class VehicleStateService {
  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  vehicles$ = this.vehiclesSubject.asObservable();
  
  private selectedSubject = new BehaviorSubject<Vehicle | null>(null);
  selected$ = this.selectedSubject.asObservable();
  
  constructor(private vehicleService: VehicleService) {}
  
  loadVehicles() {
    this.vehicleService.list().subscribe(res => {
      this.vehiclesSubject.next(res.data);
    });
  }
  
  selectVehicle(id: string) {
    this.vehicleService.getById(id).subscribe(vehicle => {
      this.selectedSubject.next(vehicle);
    });
  }
  
  addVehicle(vehicle: Vehicle) {
    const current = this.vehiclesSubject.value;
    this.vehiclesSubject.next([...current, vehicle]);
  }
  
  clear() {
    this.vehiclesSubject.next([]);
    this.selectedSubject.next(null);
  }
}
```

### 10.2 AuthStateService (Global)

`LoginResponse['user']` (§9.4) é o objeto pequeno que `POST /auth/login` devolve — **`role` é string simples** (`"DRIVER"`/`"FLEET_MANAGER"`/`"ADMIN"`), não um objeto `{ name }`. É diferente do recurso `User` do `AdminModule` (que tem `roleId`, um UUID) — por isso o alias `UsuarioAutenticado` abaixo, pra não confundir os dois. O `user` do login também traz `permissions: string[]` (permissions efetivas: papel + delegadas) e `driverId: string | null`; o `AuthStateService` guarda os dois.

```typescript
type UsuarioAutenticado = LoginResponse['user'];

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private userSubject = new BehaviorSubject<UsuarioAutenticado | null>(null);
  user$ = this.userSubject.asObservable();
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  constructor(private authService: AuthService, private router: Router) {}
  
  private hasToken(): boolean {
    return !!localStorage.getItem('access_token');
  }
  
  // authService.login() já grava a api key (se enviada) e chama POST
  // /auth/login com email/senha no corpo — o AuthInterceptor (§9.2) injeta o
  // header x-api-key a partir do que está em localStorage.
  login(email: string, password: string, apiKey: string): Observable<LoginResponse> {
    return this.authService.login(email, password, apiKey).pipe(
      tap(res => {
        localStorage.setItem('access_token', res.accessToken);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.userSubject.next(res.user);
        this.isAuthenticatedSubject.next(true);
      })
    );
  }
  
  logout() {
    localStorage.clear();
    this.userSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/auth/login']);
  }
  
  // Corrigido: `role` já é string ("DRIVER"/"FLEET_MANAGER"/"ADMIN"), não um
  // objeto com `.name` — a versão anterior (`.role.name`) quebrava em runtime.
  hasRole(role: string): boolean {
    return this.userSubject.value?.role === role;
  }

  // Permission EFETIVA (papel + delegadas): vem pronta da API em user.permissions
  // (login, refresh-token e GET /users/me). Não existe mais tabela padrão no front.
  // A API continua decidindo (403).
  temPermissao(codigo: string): boolean {
    const usuario = this.userSubject.value;
    if (!usuario) {
      return false;
    }
    return usuario.permissions.includes(codigo);
  }

  // Id do perfil de motorista ativo (null se não houver). Usado para preencher
  // driverId em viagem, abastecimento e incidente do DRIVER.
  obterDriverId(): string | null {
    const usuario = this.userSubject.value;
    if (!usuario) {
      return null;
    }
    return usuario.driverId;
  }

  temAlgumaPermissao(codigos: string[]): boolean {
    for (const codigo of codigos) {
      if (this.temPermissao(codigo)) {
        return true;
      }
    }
    return false;
  }
}
```

> **Delegação resolvida:** a API devolve `permissions` (efetivas: papel + delegadas) e `driverId` em `POST /auth/login`, `POST /auth/refresh-token` e `GET /users/me`. O `AuthStateService` guarda os dois dentro de `user` (persistido em `localStorage`), o `PermissaoGuard` (§7.3) e os botões usam `user.permissions` via `temPermissao()`, e os formulários do DRIVER usam `obterDriverId()`. Uma delegação concedida ou revogada depois do login só chega ao front em novo login ou em `POST /auth/refresh-token` (que devolve o `user` atualizado; atualize o estado com ele).

---

## <a name="i18n"></a>11. i18n (Internacionalização)

### 11.1 Setup

```typescript
// app.module.ts
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

export function HttpLoaderFactory(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  imports: [
    TranslateModule.forRoot({
      defaultLanguage: 'pt-BR',
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ]
})
export class AppModule {}
```

### 11.2 Arquivos JSON

**`assets/i18n/pt-BR.json`:**
```json
{
  "AUTH": {
    "LOGIN": {
      "TITLE": "Acesso Restrito",
      "SUBTITLE": "Sistema exclusivo dos funcionários VelocityFleet Ltda",
      "EMAIL": "E-mail",
      "PASSWORD": "Senha",
      "SUBMIT": "Entrar",
      "NO_ACCOUNT_HINT": "Sem conta? Peça o cadastro a um administrador ou gerente"
    }
  },
  "DASHBOARD": {
    "TITLE": "Dashboard",
    "GREETING": "Bom dia, {{name}}!"
  }
}
```

### 11.3 Uso em Templates

```html
<h1>{{ 'AUTH.LOGIN.TITLE' | translate }}</h1>
<p>{{ 'DASHBOARD.GREETING' | translate:{ name: userName } }}</p>
```

---

## <a name="testes"></a>12. Testes

### 12.1 Unit Tests (Jest)

**Exemplo — Vehicle Service:**
```typescript
describe('VehicleService', () => {
  let service: VehicleService;
  let httpMock: HttpTestingController;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [VehicleService]
    });
    service = TestBed.inject(VehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  
  it('should list vehicles', () => {
    const mockResponse = {
      data: [{ id: '1', plate: 'ABC1D23', model: 'Fiat', year: 2022 }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
    };
    
    service.list().subscribe(res => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].plate).toBe('ABC1D23');
    });
    
    const req = httpMock.expectOne(`${environment.apiUrl}/vehicles?page=1&pageSize=10`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
```

### 12.2 E2E Tests (Cypress)

**Exemplo — Login Flow:**
```typescript
describe('Login Flow', () => {
  beforeEach(() => {
    cy.visit('/auth/login');
  });
  
  it('should display login form', () => {
    cy.contains('ACESSO RESTRITO').should('be.visible');
    cy.contains('Sistema exclusivo dos funcionários VelocityFleet').should('be.visible');
    cy.get('input[name="email"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
  });
  
  it('should not offer public signup', () => {
    cy.contains('Cadastre-se').should('not.exist');
    cy.contains('Sem conta? Peça o cadastro a um administrador ou gerente').should('be.visible');
  });

  it('should show validation errors', () => {
    cy.get('button[type="submit"]').click();
    cy.contains('E-mail é obrigatório').should('be.visible');
    cy.contains('Senha é obrigatória').should('be.visible');
  });
});
```

### 12.3 Cobertura Mínima

- Unit tests: **80%** de cobertura
- E2E: fluxos críticos (login, criar viagem, registrar abastecimento, incidente)

---

## <a name="roadmap"></a>13. Roadmap de Desenvolvimento

### Fase 1: Setup e Fundação (Semana 1)
- [x] Criar projeto Angular com `ng new`
- [x] Instalar todas as dependências
- [x] Configurar Bootstrap + SCSS
- [x] Configurar tokens de design system
- [x] Configurar environments
- [x] Configurar rotas base
- [x] Configurar HttpInterceptors
- [x] Configurar i18n
- [x] Configurar Theme Service (dark mode)

### Fase 2: Autenticação (Semana 2)
- [ ] AuthModule com login premium (GSAP + VantaJS)
- [ ] Tela de criação de usuário (`/admin/users/new`, `POST /users`) com exibição única da API key
- [ ] AuthGuard e PermissaoGuard (permission efetiva)
- [ ] AuthStateService
- [ ] Integração com back-end (login, refresh-token automático, regenerate-key com senha)

### Fase 3: Layout Principal (Semana 3)
- [ ] MainLayout com sidebar (desktop/tablet)
- [ ] Bottom Tab (mobile)
- [ ] Theme Toggle
- [ ] Notificações
- [ ] User dropdown

### Fase 4: Dashboard (Semana 4)
- [ ] KPI cards com count-up animation
- [ ] Charts ApexCharts
- [ ] Responsive layout (mobile → TV)

### Fase 5: Módulos Operacionais (Semanas 5-7)
- [ ] FleetModule (veículos + motoristas)
- [ ] TripsModule (criar, iniciar, finalizar, cancelar)
- [ ] RefuelingsModule
- [ ] MaintenanceModule
- [ ] IncidentsModule (com upload)

### Fase 6: Analytics + Admin (Semana 8)
- [ ] AnalyticsModule com charts avançados
- [ ] AdminModule (usuários)
- [ ] Relatórios exportáveis

### Fase 7: Polimento e Testes (Semanas 9-10)
- [ ] Unit tests (Jest) — cobertura 80%+
- [ ] E2E tests (Cypress) — fluxos críticos
- [ ] Acessibilidade (WCAG AA)
- [ ] Performance (Lighthouse 90+)
- [ ] Otimização de imagens
- [ ] Documentação README

### Fase 8: Deploy (Futuro)
- [ ] Deploy no Vercel/Netlify
- [ ] CI/CD com GitHub Actions
- [ ] Domain customizado

---

## 📎 Recursos Adicionais

### Documentação Oficial
- **Angular**: https://angular.dev
- **Bootstrap 5**: https://getbootstrap.com/docs/5.3/
- **GSAP**: https://gsap.com/docs/v3/
- **VantaJS**: https://www.vantajs.com/
- **ApexCharts**: https://apexcharts.com/docs/
- **Lucide**: https://lucide.dev/
- **Jest**: https://jestjs.io/
- **Cypress**: https://docs.cypress.io/

### Comunidades
- Angular Discord: https://discord.gg/angular
- Angular Brasil: https://t.me/angularbr
- Stack Overflow: https://stackoverflow.com/questions/tagged/angular

### Cursos Recomendados (Complementares)
- Angular Official Tutorial: https://angular.dev/tutorials
- RxJS: https://rxjs.dev/guide/overview
- Testing Angular: https://testing-angular.com/

---

**Documentação VelocityFleet Front-end**
**Versão:** 1.0.0
**Autoria:** Documento oficial de referência
**Data:** 22/09/2026
