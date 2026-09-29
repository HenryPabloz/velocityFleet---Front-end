# 🚀 VELOCITYFLEET FRONT-END — DOCUMENTAÇÃO TÉCNICA COMPLETA

> **Plataforma de Gestão de Frota Corporativa**
> Angular + Bootstrap 5 + GSAP + VantaJS + ApexCharts
>
> Versão: 1.0.0 | Data: 22/09/2026

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

> ⚠️ **Nota sobre RBAC**: o `RoleGuard` do Angular (§7.1) decide o acesso só pelo `role` do usuário (`DRIVER`/`FLEET_MANAGER`/`ADMIN`). Isso é uma simplificação: o back-end real também suporta **delegação granular de permissão por usuário** — um usuário pode receber (ou perder) permissões individuais extras além das do seu papel, via `GET /permissions` (catálogo) e `POST`/`DELETE /users/:id/permissions` (conceder/revogar), todas ADMIN-only. Essa v1 do front não tem tela para gerenciar isso — só é preciso ter em mente que o `RoleGuard` (baseado em papel) pode, em casos raros, ser mais restritivo ou mais permissivo do que o que a API de fato libera para um usuário específico com permissões delegadas. Ver matriz completa e a regra de escopo "OWN" em **§1.4**.

### 1.4 Matriz de Permissões por Papel

Esta seção detalha, recurso por recurso, o que cada papel pode fazer **por padrão** — e deixa explícita a diferença entre as 2 camadas de autorização que o back-end real usa. Conferido contra `prisma/seed.ts` (29 permissions reais) e os decorators `@Roles`/`@Permissions` de cada controller.

#### As 2 camadas: papel vs. permissão delegada

1. **Papel (`role`)** — fixo, definido no cadastro do usuário (`DRIVER`, `FLEET_MANAGER` ou `ADMIN`). Cada papel já nasce com um conjunto de permissões padrão (tabela abaixo).
2. **Permissão individual delegada (`UserPermission`)** — um ADMIN pode conceder (`POST /users/:id/permissions`, body `{ permissionCode }`) ou revogar (`DELETE /users/:id/permissions/:code`) uma permissão específica pra um usuário, **além** do que o papel dele já dá. Não tem prazo de validade — vale até ser revogada.

O back-end calcula o conjunto efetivo de permissões de um usuário somando as duas camadas (função real `obterCodigosEfetivos`, usada por `trips`, `refuelings`, `incidents`, etc. pra decidir se o usuário vê "tudo" ou só "o que é dele" — ver regra OWN abaixo). Isso importa pro front porque o `RoleGuard`, que só olha `role`, não enxerga a segunda camada.

**Exemplo prático**: um `FLEET_MANAGER` não tem `USER_CREATE` por padrão (só ADMIN tem, ver matriz). Mas um ADMIN pode conceder `USER_CREATE` a um `FLEET_MANAGER` específico via `POST /users/:id/permissions`. A partir daí, a API deixa esse usuário criar usuários — mesmo ele continuando com `role: FLEET_MANAGER`. Se o front decidir esconder o botão "Novo Usuário" só checando `role === 'ADMIN'` (em vez de checar a permissão efetiva, que só a API sabe de verdade), esse gerente com permissão delegada fica sem o botão, mesmo podendo usar a rota diretamente.

#### Matriz por módulo (permissões padrão de cada papel)

| Módulo / Recurso | Ação | Rota | `DRIVER` | `FLEET_MANAGER` | `ADMIN` |
|---|---|---|:---:|:---:|:---:|
| **Fleet / Vehicles** | Ver | `GET /vehicles`, `GET /vehicles/:id` | ✅ (por `@Roles`, não por permission) | ✅ | ✅ |
| | Criar | `POST /vehicles` (`VEHICLE_CREATE`) | ❌ | ✅ | ✅ |
| | Editar | `PATCH`/`PUT /vehicles/:id` (`VEHICLE_UPDATE`) | ❌ | ✅ | ✅ |
| | Remover | `DELETE /vehicles/:id` (por `@Roles`) | ❌ | ✅ | ✅ |
| **Drivers** | Ver | `GET /drivers`, `GET /drivers/:id` (`DRIVER_VIEW`) | ❌ | ✅ | ✅ |
| | Criar | `POST /drivers` (`DRIVER_CREATE`) | ❌ | ✅ | ✅ |
| | Editar | `PATCH`/`PUT /drivers/:id` (`DRIVER_UPDATE`) | ❌ | ✅ | ✅ |
| | Remover | `DELETE /drivers/:id` (por `@Roles`) | ❌ | ❌ | ✅ |
| **Trips** | Criar | `POST /trips` (`TRIP_CREATE`) | ✅ | ✅ | ✅ |
| | Ver | `GET /trips` — **só as próprias** (`TRIP_VIEW_OWN`) | ✅ (OWN) | ✅ (`TRIP_VIEW_ALL` — vê tudo) | ✅ (`TRIP_VIEW_ALL`) |
| | Iniciar/Finalizar | `PATCH /trips/:id/start`, `/end` (por `@Roles`) | ✅ | ✅ | ✅ |
| | Cancelar | `PATCH /trips/:id/cancel` (`TRIP_CANCEL_OWN`) | ✅ (a própria) | ✅ | ✅ |
| | Remover | `DELETE /trips/:id` (por `@Roles`) | ❌ | ❌ | ✅ |
| **Refuelings** | Criar | `POST /refuelings` (`REFUELING_CREATE`) | ✅ | ✅ | ✅ |
| | Ver | `GET /refuelings` — **só os próprios** (`REFUELING_VIEW_OWN`) | ✅ (OWN) | ✅ (`REFUELING_VIEW_ALL`) | ✅ (`REFUELING_VIEW_ALL`) |
| | Remover | `DELETE /refuelings/:id` (por `@Roles`) | ❌ | ❌ | ✅ |
| **Incidents** | Criar | `POST /incidents` (`INCIDENT_CREATE`) | ✅ | ✅ | ✅ |
| | Ver | `GET /incidents` — **só os próprios** (`INCIDENT_VIEW_OWN`) | ✅ (OWN) | ✅ (`INCIDENT_VIEW_ALL`) | ✅ (`INCIDENT_VIEW_ALL`) |
| | Mudar status | `PATCH /incidents/:id/status` (por `@Roles`) | ❌ | ✅ | ✅ |
| | Remover | `DELETE /incidents/:id` (por `@Roles`) | ❌ | ✅ | ✅ |
| **Maintenance** | Ver / Criar / Editar | `GET`/`POST`/`PATCH /maintenances` (`MAINTENANCE_VIEW_ALL`/`_CREATE`/`_UPDATE`) | ❌ | ✅ | ✅ |
| | Remover | `DELETE /maintenances/:id` (por `@Roles`) | ❌ | ✅ | ✅ |
| **Analytics** | Ver (todos os 5 indicadores) | `GET /analytics/*` (`ANALYTICS_VIEW`) | ❌ | ✅ | ✅ |
| **Users / Admin** | Ver lista | `GET /users` (por `@Roles`) | ❌ | ✅ | ✅ |
| | Ver próprio perfil | `GET /users/me` (`PROFILE_VIEW`) | ✅ | ✅ | ✅ |
| | Editar próprio perfil / senha | `PATCH /users/me`, `/me/password` (`PROFILE_UPDATE_OWN`, `PASSWORD_CHANGE_OWN`) | ✅ | ✅ | ✅ |
| | Criar / Editar / Remover usuário | `POST /users`, `PATCH/PUT/DELETE /users/:id` (`USER_CREATE`/`_UPDATE`/`_DELETE`) | ❌ | ❌ | ✅ |
| **Permissions** | Catálogo, listar/conceder/revogar | `GET /permissions`, `GET`/`POST /users/:id/permissions`, `DELETE /users/:id/permissions/:code` (todas por `@Roles`) | ❌ | ❌ | ✅ |
| **Audit Logs** | Ver | `GET /audit-logs` (`AUDIT_VIEW`) | ❌ | ❌ | ✅ |

> Onde a tabela diz "por `@Roles`" (em vez de citar um código de permission), é porque a rota real checa o papel direto (`@Roles('ADMIN', ...)`), sem passar pela camada de permission — nesses casos específicos, **delegação individual não muda o acesso** (só ADMIN pode conceder permission, mas a rota nem olha permission ali).

#### 🔒 Regra OWN — motorista só vê o que é dele (leia antes de implementar QUALQUER listagem de Trips/Refuelings/Incidents)

> **`DRIVER` sem `TRIP_VIEW_ALL`/`REFUELING_VIEW_ALL`/`INCIDENT_VIEW_ALL` só enxerga os próprios registros — nunca os de outro motorista. E isso é GARANTIDO PELO BACK-END, não é um filtro que o front escolhe aplicar.**
>
> - `GET /trips`: o motorista vê as viagens que ele **já realizou** (`COMPLETED`), **está realizando** (`IN_PROGRESS`), **vai realizar** (`PLANNED`) e as que **cancelou** (`CANCELLED`) — mas só as dele. Se o front mandar `?driverId=<uuid-de-outro-motorista>`, a API **ignora esse valor** e força o filtro pro motorista logado mesmo assim (o service resolve isso via `resolver-driver-proprio.util.ts`, comentário real no código: *"sem TRIP_VIEW_ALL, o filtro driverId da query é ignorado e forçado para o motorista logado"*).
> - **O mesmo vale para `GET /refuelings` e `GET /incidents`**: sem `REFUELING_VIEW_ALL`/`INCIDENT_VIEW_ALL`, qualquer `driverId` enviado na query é substituído pelo do usuário logado (mesmo mecanismo, confirmado em `refuelings.service.ts`).
> - **O front NÃO precisa (e não deveria) reimplementar esse filtro no cliente.** Não filtre `res.data` por `driverId === usuarioLogado.id` depois de receber a resposta — a API já devolve só o que o motorista pode ver. Mandar ou não `driverId` na query não muda nada pro `DRIVER`.
> - `FLEET_MANAGER` e `ADMIN` (que têm `TRIP_VIEW_ALL`/`REFUELING_VIEW_ALL`/`INCIDENT_VIEW_ALL`) veem **tudo** por padrão, e podem **opcionalmente filtrar por motorista** — `GET /trips?driverId=<uuid>`, `GET /refuelings?driverId=<uuid>`, `GET /incidents?driverId=<uuid>` — pra ver as viagens/abastecimentos/incidentes de um motorista específico. Sem esse filtro, a listagem vem com todo mundo.

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
| **AuthModule** | `/auth/*` | Público | Login, cadastro, recuperar senha |
| **DashboardModule** | `/dashboard` | Todos | KPIs, gráficos, resumo executivo |
| **FleetModule** | `/fleet/*` | ADMIN, FLEET_MANAGER (leitura de veículos também libera **DRIVER**, ver §7.2) | Veículos, motoristas |
| **TripsModule** | `/trips/*` | Todos | Viagens (criar, iniciar, finalizar) |
| **RefuelingsModule** | `/refuelings/*` | Todos | Abastecimentos |
| **MaintenanceModule** | `/maintenance/*` | ADMIN, FLEET_MANAGER | Manutenções agendadas |
| **IncidentsModule** | `/incidents/*` | Todos | Incidentes com upload de foto |
| **AnalyticsModule** | `/analytics/*` | ADMIN, FLEET_MANAGER | Relatórios avançados |
| **AdminModule** | `/admin/*` | ADMIN (leitura de usuários também libera **FLEET_MANAGER**, ver §7.2) | Usuários, configurações |

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
│   │   │   │   └── role.guard.ts
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
│   │   │   │   ├── components/
│   │   │   │   │   └── register-modal/
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
        // Sem RoleGuard aqui no nível do módulo: a API real libera GET /vehicles
        // e GET /vehicles/:id pros 3 papéis (DRIVER também precisa ver veículos
        // AVAILABLE pra criar uma viagem, ver TripsModule). O RoleGuard entra
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
        canActivate: [RoleGuard],
        data: { roles: ['ADMIN', 'FLEET_MANAGER'] }
      },
      {
        path: 'incidents',
        loadChildren: () => import('./features/incidents/incidents.module').then(m => m.IncidentsModule)
      },
      {
        path: 'analytics',
        loadChildren: () => import('./features/analytics/analytics.module').then(m => m.AnalyticsModule),
        canActivate: [RoleGuard],
        data: { roles: ['ADMIN', 'FLEET_MANAGER'] }
      },
      {
        // roles aqui cobre a LEITURA de /admin/users (GET /users real libera
        // ADMIN e FLEET_MANAGER). As rotas de escrita (criar/editar/excluir
        // usuário) e /admin/settings continuam ADMIN-only, reforçado por
        // RoleGuard dentro do admin-routing.module.ts — detalhe em §7.2.
        path: 'admin',
        loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule),
        canActivate: [RoleGuard],
        data: { roles: ['ADMIN', 'FLEET_MANAGER'] }
      }
    ]
  },
  { path: '**', redirectTo: '/dashboard' }
];
```

### 7.2 Rotas por Módulo

> A partir daqui, cada rota Angular vem seguida da rota real do back-end que ela consome (método HTTP + path), entre parênteses. Isso vale pra toda a seção 8 também.

#### AuthModule (`/auth`)
- `/auth/login` — Tela de login com modal de cadastro (`POST /auth/signup` no modal; `POST /auth/login` no formulário principal — ver fluxo completo em §8.1 e §9.2)
- `/auth/forgot-password` — Recuperar senha (futuro, sem endpoint no back-end hoje)

#### DashboardModule (`/dashboard`)
- `/dashboard` — Overview de KPIs. Fontes de dados por role (ver §8.2): `GET /trips` (viagens/km), `GET /incidents` (incidentes), `GET /vehicles?status=...` (frota por status), `GET /analytics/fleet/fuel-consumption` (consumo/custo), `GET /health` (uptime, só ADMIN)

#### FleetModule (`/fleet`)
- `/fleet/vehicles` — Lista de veículos (`GET /vehicles`) — **ADMIN, FLEET_MANAGER, DRIVER** (leitura liberada pros 3 papéis na API real)
- `/fleet/vehicles/new` — Criar veículo (`POST /vehicles`) — **ADMIN, FLEET_MANAGER** (RoleGuard nesta rota)
- `/fleet/vehicles/:id` — Detalhes do veículo (`GET /vehicles/:id`) — **ADMIN, FLEET_MANAGER, DRIVER**
- `/fleet/vehicles/:id/edit` — Editar veículo (`PATCH /vehicles/:id` ou `PUT /vehicles/:id`) — **ADMIN, FLEET_MANAGER** (RoleGuard nesta rota)
- `/fleet/drivers` — Lista de motoristas (`GET /drivers`) — **ADMIN, FLEET_MANAGER** (exige a permission `DRIVER_VIEW`, que o papel DRIVER não tem por padrão — RoleGuard nesta rota e em todas as de `/fleet/drivers`)
- `/fleet/drivers/new` — Criar motorista (`POST /drivers`) — **ADMIN, FLEET_MANAGER**
- `/fleet/drivers/:id` — Detalhes (`GET /drivers/:id`) — **ADMIN, FLEET_MANAGER**

#### TripsModule (`/trips`)
- `/trips` — Lista de viagens (`GET /trips` — regra OWN: **motorista só vê as próprias viagens**, o back-end ignora qualquer filtro `driverId` da query e força a listagem pro motorista logado; ver §1.4)
- `/trips/new` — Criar viagem (`POST /trips`; usa `GET /vehicles?status=AVAILABLE` e `GET /drivers` para os autocompletes — ver §8.4)
- `/trips/:id` — Detalhes (`GET /trips/:id`), com botões: Iniciar (`PATCH /trips/:id/start`), Finalizar (`PATCH /trips/:id/end`), Cancelar (`PATCH /trips/:id/cancel`), Excluir soft (`DELETE /trips/:id`, ADMIN)

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
- `/admin/users` — Gerenciamento de usuários (`GET /users`) — **ADMIN, FLEET_MANAGER** podem listar/ver; criar (`POST /users`), editar (`PATCH`/`PUT /users/:id`) e excluir (`DELETE /users/:id`) são **ADMIN-only** (RoleGuard nessas sub-rotas)
- `/admin/settings` — Configurações globais — **ADMIN**

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
│       │  Pré-preenchida se você já   │        │
│       │  salvou no cadastro          │        │
│       │                              │        │
│       │  [ ENTRAR ]                  │        │
│       │                              │        │
│       │  Não tem conta? Cadastre-se  │        │
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
- **Campo API Key**: se existir uma chave salva em `localStorage` (`api_key`, gravada no cadastro — ver modal abaixo), o campo já vem preenchido; senão fica vazio e o usuário cola a chave que guardou. Tem toggle de visibilidade (👁️) igual ao campo senha
- **Botão Login**: Primary red com hover elevation + pulse quando idle
- **Link Cadastro**: Abre modal (não redireciona) com formulário de cadastro
- **Link "Esqueceu sua senha?"**: Rota `/auth/forgot-password`

#### Fluxo de autenticação completo (com API key)

O back-end real exige **3 informações** pra logar — e-mail, senha e a API key do usuário — não só e-mail/senha. O fluxo completo é:

1. **Cadastro** (`POST /auth/signup`, só nome/e-mail/senha) → devolve uma API key em texto puro, **que só aparece nessa resposta** (o banco guarda só o hash dela).
2. O front grava a key em `localStorage` (`api_key`) automaticamente pra pré-preencher o login nesta mesma máquina/navegador, **e** exibe pro usuário pra ele copiar/guardar em outro lugar seguro (1Password, etc.) — se limpar o `localStorage` ou trocar de navegador, ele precisa colar a key manualmente.
3. **Login** (`POST /auth/login`) — e-mail e senha vão no corpo, a API key vai no header `x-api-key`. Devolve um JWT (`accessToken`).
4. Dali em diante, todas as rotas de negócio usam só `Authorization: Bearer <accessToken>` — a API key não é mais necessária até a sessão expirar e for preciso logar de novo, ou até o usuário perder a key e precisar gerar uma nova.
5. **Recuperação de key perdida**: `PATCH /auth/regenerate-key` (autenticado com a key atual em `x-api-key`, sem precisar de JWT) invalida a key antiga e devolve uma nova, na hora. Sem UI própria nesta v1 — fica disponível como ação futura em "Minha Conta", documentado aqui só pra não ficar sem contrato: body vazio, resposta `{ apiKey: string }` (nova key em texto puro).

#### Modal de Cadastro

```
┌──────────────────────────────────┐
│  [X]  Solicitar Cadastro         │
│                                  │
│  Somente funcionários            │
│  VelocityFleet devem se cadastrar│
│                                  │
│  Nome Completo                   │
│  [_______________________]       │
│                                  │
│  E-mail Corporativo              │
│  [_______________________]       │
│                                  │
│  Senha                           │
│  [_______________________]       │
│  (mín. 8 caracteres)             │
│                                  │
│  Confirmar Senha                 │
│  [_______________________]       │
│                                  │
│  [ SOLICITAR ACESSO ]            │
│                                  │
│  Já tenho acesso: Voltar         │
└──────────────────────────────────┘
```

**Tela de sucesso (após submeter, substitui o formulário no mesmo modal):**

```
┌──────────────────────────────────┐
│  ✅  Cadastro realizado           │
│                                  │
│  🔑 Sua API Key (guarde agora,   │
│  ela NÃO será mostrada de novo): │
│                                  │
│  [ 5f1c9a2b...e5f60718  📋 ]     │
│  (campo somente leitura, com     │
│   botão "Copiar")                │
│                                  │
│  Essa chave é necessária, junto  │
│  com e-mail e senha, pra fazer   │
│  login. Já está pré-preenchida   │
│  neste navegador — se trocar de  │
│  dispositivo, cole ela aqui.     │
│                                  │
│  [ JÁ GUARDEI, IR PRO LOGIN ]    │
└──────────────────────────────────┘
```

**Comportamento:**
- Overlay com `backdrop-filter: blur(4px)`
- GSAP scale + fade animation
- Ao submeter: chamada para `POST /auth/signup`
- Sucesso (201): mostra a tela acima com a API key em destaque (dourado), campo copiável e aviso explícito de que ela não aparece de novo. O front grava a key em `localStorage` (`api_key`) pra já vir preenchida na tela de login.
- Erro 409 (e-mail já cadastrado) ou 400 (campo inválido): usa o `ProblemDetailsDto` de erro (ver §9.2/§9.4) pra mostrar a mensagem certa no formulário, sem sair do modal.

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
- Frota total (veículos disponíveis / em uso / manutenção) — 4 chamadas `GET /vehicles?status=X&pageSize=1`, lendo `pagination.total` de cada uma (ver §8.7, "Distribuição de Status")
- Consumo total (litros) — `GET /analytics/fleet/fuel-consumption` (`totalLiters`). **Atenção**: esse endpoint não tem filtro de período — soma tudo desde sempre, não só o mês corrente. Se o KPI precisar ser "do mês", é preciso um endpoint com filtro de data (não existe hoje); por ora, exibir como "consumo total acumulado", sem prometer "mês"
- Custo total mês — **sem endpoint agregado hoje** (ver nota em §8.7, "Custos por Categoria" — fora de escopo)
- Viagens ativas agora — `GET /trips?status=IN_PROGRESS` (com `TRIP_VIEW_ALL`)

**ADMIN:**
- Todos os KPIs do FLEET_MANAGER
- Usuários ativos — `GET /users` (contar `isActive: true` na página, ou usar `pagination.total`)
- Uptime do sistema — `GET /health` (rota pública, sem auth; front só usa o resultado pra exibir o card)

### 8.3 Página de Veículos (`/fleet/vehicles`)

Lista: `GET /vehicles?page=&pageSize=&status=`. Leitura liberada pros 3 papéis (ADMIN, FLEET_MANAGER, DRIVER) — ver §7.2.

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
- Editar (`PATCH /vehicles/:id` parcial, ou `PUT /vehicles/:id` completo) — ADMIN, FLEET_MANAGER
- Agendar manutenção (`POST /maintenances` com esse `vehicleId`, ver §8.8) — ADMIN, FLEET_MANAGER
- Excluir, soft delete (`DELETE /vehicles/:id`) — ADMIN, FLEET_MANAGER

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
│  KM atual: 15.432                  │
│                                    │
│  KM inicial *                      │
│  [15.432___________]               │
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
1. Motorista seleciona ele mesmo (pre-fill) — autocomplete alimentado por `GET /drivers` (ADMIN/FLEET_MANAGER) ou, se o usuário logado for DRIVER, pré-preenchido direto (motorista não tem `DRIVER_VIEW`, então não lista outros motoristas — só o próprio, resolvido a partir do usuário logado)
2. Seleciona veículo (só mostra AVAILABLE) — autocomplete alimentado por `GET /vehicles?status=AVAILABLE` (liberado pros 3 papéis)
3. Digita CEPs (validação em tempo real via API ViaCEP no back-end) — os campos são enviados como `startLocation`/`endLocation` em `POST /trips`; a API valida o CEP contra o ViaCEP real e grava o **endereço resolvido** (ex: "São Paulo, SP"), não o CEP em si
4. Ao criar (`POST /trips`): veículo vira `IN_USE`, trip vira `PLANNED`
5. Redirect para detalhes (`GET /trips/:id`)

### 8.5 Detalhes da Viagem (`/trips/:id`)

Tela carregada via `GET /trips/:id`.

**Estados e Botões:**

| Status | Botões Visíveis | Rota chamada |
|--------|-----------------|--------------|
| **PLANNED** | Iniciar Viagem, Cancelar | `PATCH /trips/:id/start`, `PATCH /trips/:id/cancel` |
| **IN_PROGRESS** | Finalizar Viagem, Cancelar | `PATCH /trips/:id/end`, `PATCH /trips/:id/cancel` |
| **COMPLETED** | Ver Rota (mapa futuro), Excluir (soft) | — (mapa é futuro, sem endpoint), `DELETE /trips/:id` (ADMIN) |
| **CANCELLED** | Excluir (soft) | `DELETE /trips/:id` (ADMIN) |

> As transições (`start`/`end`/`cancel`) rodam dentro de procedures do banco: erros de negócio (veículo indisponível, motorista com CNH vencida, viagem em status incompatível) voltam como 409, no formato RFC 7807 (ver §9.2/§9.4) — não como 200 com uma flag de erro.

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
- Usuário logado com role **DRIVER**: campo fica **oculto**, `driverId` é auto-preenchido com o motorista vinculado ao usuário logado (não precisa listar motoristas — o papel DRIVER não tem `DRIVER_VIEW`).
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

        if (error.status === 401) {
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

  // POST /auth/signup — público, sem token nem api key. Devolve a API key em
  // texto puro (só nesta resposta).
  signup(data: SignupDto): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.apiUrl}/signup`, data);
  }

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

  // PATCH /auth/regenerate-key — autenticado pela API key atual (x-api-key,
  // via AuthInterceptor); invalida a key antiga e devolve uma nova.
  regenerateApiKey(): Observable<{ apiKey: string }> {
    return this.http.patch<{ apiKey: string }>(`${this.apiUrl}/regenerate-key`, {});
  }

  // POST /auth/refresh-token — autenticado por Bearer (JWT ainda válido);
  // devolve um novo JWT com prazo renovado.
  refreshToken(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh-token`, {});
  }
}
```

#### Mapeamento completo: método do service → rota real

Pra todo módulo que não tem o service inteiro escrito acima, a tabela abaixo é o contrato mínimo (método HTTP + path) que cada service Angular precisa implementar:

| Módulo | Método (sugerido) | Rota real |
|--------|--------------------|-----------|
| Auth | `signup()` | `POST /auth/signup` |
| Auth | `login()` | `POST /auth/login` (+ header `x-api-key`) |
| Auth | `regenerateApiKey()` | `PATCH /auth/regenerate-key` (+ header `x-api-key`) |
| Auth | `refreshToken()` | `POST /auth/refresh-token` |
| Drivers | `list()` | `GET /drivers?page=&pageSize=` |
| Drivers | `getById()` | `GET /drivers/:id` |
| Drivers | `create()` | `POST /drivers` |
| Drivers | `update()` | `PATCH /drivers/:id` (ou `PUT /drivers/:id`) |
| Drivers | `delete()` | `DELETE /drivers/:id` (soft, ADMIN) |
| Trips | `list()` | `GET /trips?page=&pageSize=&status=&driverId=&vehicleId=` |
| Trips | `getById()` | `GET /trips/:id` |
| Trips | `create()` | `POST /trips` |
| Trips | `start()` | `PATCH /trips/:id/start` |
| Trips | `end()` | `PATCH /trips/:id/end` |
| Trips | `cancel()` | `PATCH /trips/:id/cancel` |
| Trips | `delete()` | `DELETE /trips/:id` (soft, ADMIN) |
| Refuelings | `list()` | `GET /refuelings?page=&pageSize=&vehicleId=&driverId=` |
| Refuelings | `getById()` | `GET /refuelings/:id` |
| Refuelings | `create()` | `POST /refuelings` |
| Refuelings | `delete()` | `DELETE /refuelings/:id` (soft, ADMIN) |
| Incidents | `list()` | `GET /incidents?page=&pageSize=&severity=&status=&vehicleId=&driverId=` |
| Incidents | `getById()` | `GET /incidents/:id` |
| Incidents | `create()` | `POST /incidents` (`multipart/form-data`, campo `photo`) |
| Incidents | `updateStatus()` | `PATCH /incidents/:id/status` (ADMIN, FLEET_MANAGER) |
| Incidents | `delete()` | `DELETE /incidents/:id` (soft, ADMIN/FLEET_MANAGER) |
| Maintenance | `list()` | `GET /maintenances?page=&pageSize=&status=&vehicleId=` |
| Maintenance | `getById()` | `GET /maintenances/:id` |
| Maintenance | `create()` | `POST /maintenances` |
| Maintenance | `complete()` | `PATCH /maintenances/:id` (`{ status: 'COMPLETED' }`) |
| Maintenance | `delete()` | `DELETE /maintenances/:id` (soft) |
| Analytics | `consumoDaFrota()` | `GET /analytics/fleet/fuel-consumption` |
| Analytics | `distanciaDiaria()` | `GET /analytics/fleet/daily-distance?days=` |
| Analytics | `eficienciaDoVeiculo()` | `GET /analytics/vehicle/:id/efficiency` |
| Analytics | `estatisticasDoMotorista()` | `GET /analytics/driver/:id/trips` |
| Analytics | `incidentesPorSeveridade()` | `GET /analytics/incidents/severity?status=` |
| Users (Admin) | `list()` | `GET /users?page=&pageSize=` (ADMIN, FLEET_MANAGER) |
| Users (Admin) | `getById()` | `GET /users/:id` (ADMIN, FLEET_MANAGER) |
| Users (Admin) | `create()` | `POST /users` (ADMIN) |
| Users (Admin) | `update()` | `PATCH /users/:id` (ADMIN) |
| Users (Admin) | `delete()` | `DELETE /users/:id` (ADMIN) |
| Users (perfil próprio) | `getMe()` | `GET /users/me` |
| Users (perfil próprio) | `updateMe()` | `PATCH /users/me` |
| Users (perfil próprio) | `changePassword()` | `PATCH /users/me/password` |

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
  startKm: number;
  endKm: number | null; // só preenchido depois de PATCH /trips/:id/end
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

// driver.model.ts — GET /drivers, GET /drivers/:id, POST /drivers
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

// user.model.ts — GET /users, GET /users/:id, GET /users/me (recurso ADMIN/perfil,
// diferente do objeto "user" pequeno devolvido dentro de LoginResponse abaixo)
export interface User {
  id: string;
  email: string;
  fullName: string;
  roleId: string; // UUID do papel — não o nome ("DRIVER"/"FLEET_MANAGER"/"ADMIN")
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // só em GET /users/deleted/all
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
  };
}

// corpo de POST /auth/signup
export interface SignupResponse {
  userId: string;
  apiKey: string; // texto puro, só aparece aqui
  email: string;
  message: string;
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

`LoginResponse['user']` (§9.4) é o objeto pequeno que `POST /auth/login` devolve — **`role` é string simples** (`"DRIVER"`/`"FLEET_MANAGER"`/`"ADMIN"`), não um objeto `{ name }`. É diferente do recurso `User` do `AdminModule` (que tem `roleId`, um UUID) — por isso o alias `UsuarioAutenticado` abaixo, pra não confundir os dois.

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
}
```

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
      "REGISTER_LINK": "Não tem conta? Cadastre-se"
    },
    "REGISTER": {
      "TITLE": "Solicitar Cadastro",
      "SUBTITLE": "Somente funcionários VelocityFleet devem se cadastrar"
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
  
  it('should open register modal', () => {
    cy.contains('Não tem conta? Cadastre-se').click();
    cy.get('.modal-content').should('be.visible');
    cy.contains('Solicitar Cadastro').should('be.visible');
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
- [ ] Modal de cadastro
- [ ] AuthGuard e RoleGuard
- [ ] AuthStateService
- [ ] Integração com back-end (login, signup, refresh-token)

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
