# VelocityFleet — Front-end

Front-end do sistema de gestão de frotas VelocityFleet. Angular 21 (NgModules, standalone desligado),
SCSS e Bootstrap customizado, consumindo a API NestJS do projeto `avaliacaoBackEnd/fleet-management`.

## Visão geral

O VelocityFleet controla veículos, motoristas, viagens, abastecimentos, manutenções e incidentes de
uma frota corporativa, com três papéis (`DRIVER`, `FLEET_MANAGER`, `ADMIN`) e um sistema de permissões
efetivas (papel + delegações individuais) que a API decide e o front apenas reflete na interface.

Não existe cadastro público: contas nascem no módulo de administração, e o primeiro acesso usa uma
`API key` entregue pelo administrador ou gerente, junto com e-mail e senha.

## Requisitos

- Node.js 20+ e npm 10+
- Angular CLI 21 (`npm i -g @angular/cli` ou use `npx ng`)
- Back-end `fleet-management` rodando em `http://localhost:3000` (ver repositório do back-end)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

O projeto usa os arquivos de `src/environments/` (não `.env`), trocados pelo Angular CLI por
`fileReplacements` conforme a configuração de build:

| Arquivo | Usado em | `apiUrl` |
|---|---|---|
| `environment.ts` | `ng serve` / build `development` | `http://localhost:3000` |
| `environment.staging.ts` | build `staging` | ajuste para o ambiente de homologação |
| `environment.prod.ts` | build `production` | ajuste para o ambiente de produção |

Nenhum segredo (chaves, senhas) fica nesses arquivos: a `API key` de cada usuário é digitada na tela
de login e guardada só no `localStorage` do navegador dele.

## Scripts

| Script | O que faz |
|---|---|
| `npm start` | `ng serve` — sobe o front em `http://localhost:4200` |
| `npm run build` | build de produção (`ng build`) |
| `npm test` | roda os testes unitários com Jest |
| `npm run test:cobertura` | roda o Jest com relatório de cobertura |
| `npm run cypress:abrir` | abre o Cypress em modo interativo (E2E) |
| `npm run cypress:rodar` | roda os specs do Cypress no terminal (headless) |

## Arquitetura de pastas

```
src/app/
  core/            # serviços singleton, guards, interceptors, models — só importado no AppModule
  shared/          # peças reaproveitáveis nas telas (sidebar, cabeçalho, pipes, validadores...)
    dados/         # DadosModule: tabela, paginação, modais, formulário — só nos módulos lazy
  layouts/         # AuthLayout (tela cheia) e MainLayout (sidebar + cabeçalho)
  features/        # um módulo por área de negócio (auth, dashboard, fleet, trips, refuelings,
                    # maintenance, incidents, analytics, admin, account), cada um com lazy loading
src/environments/  # environment.ts, environment.staging.ts, environment.prod.ts
src/testing/       # elenco de dados fixos para os testes (dados-reais.ts), helpers e traduções
public/assets/i18n # pt-BR.json e en-US.json (ngx-translate)
cypress/           # specs E2E, fixtures e comandos customizados (cy.entrar, cy.jwtAdmin...)
```

Cada feature é um `NgModule` com lazy loading (`loadChildren`) e sua própria `*-routing.module.ts`.
`core/` só é importado uma vez, no `AppModule`; `shared/` entra em qualquer módulo que precise de
sidebar, cabeçalho ou pipes; `shared/dados/` (o `DadosModule`) fica de fora do bundle inicial e só
carrega junto com as telas de dados (listas, formulários, modais).

## Permissões e papéis

Três papéis (`DRIVER`, `FLEET_MANAGER`, `ADMIN`), mas o front nunca decide acesso só pelo `role`:
ele consulta a lista de `permissions` efetivas que a API devolve no login (papel + delegações
individuais feitas por um ADMIN). O `AuthStateService` guarda essa lista; o `PermissaoGuard` e o menu
lateral (`itens-menu.ts`) a consultam para liberar rotas e itens de menu. A API continua sendo a
única fonte de verdade: um 403 dela sempre pode acontecer mesmo com o botão visível.

`PapelGuard` existe à parte para as poucas rotas que checam o papel puro (ex: promover outro usuário,
configurações), sem passar pela camada de permission.

## Fluxo de autenticação

1. Login (`POST /auth/login`): e-mail, senha e a `API key` (primeiro acesso) vão no corpo/headers.
   A API key só é enviada nessa rota e em `PATCH /auth/regenerate-key` — o `AuthInterceptor` decide
   isso olhando o método e a URL exata da requisição, nunca "toda rota que começa com /auth".
2. A resposta traz o JWT e o usuário (com `permissions` e `driverId`); ambos ficam no `localStorage`
   junto com a `API key`, para o próximo login já vir preenchida.
3. O `AuthInterceptor` acrescenta `Authorization: Bearer <jwt>` em toda chamada para a nossa API
   (nunca para domínios externos, como o ViaCEP).
4. Perto do vencimento do token, o `AuthStateService` chama `POST /auth/refresh-token` sozinho, em
   segundo plano.
5. O `ErrorInterceptor` trata os erros padrão (RFC 7807): um 401 comum desloga e volta ao login; já um
   401 em `/auth/login` ou `/auth/regenerate-key` é só "senha errada" e não desloga ninguém.

Não existe tela de cadastro: contas são criadas só pelo administrador (ou por um gerente, que só pode
criar contas `DRIVER`) em `/admin/users/new`.

## Soft delete vs. exclusão definitiva

Os sete recursos com histórico (`users`, `drivers`, `vehicles`, `trips`, `refuelings`, `maintenances`,
`incidents`) têm duas camadas de remoção:

- **Soft delete** (`DELETE /:id`) e **restore** (`PATCH /:id/restore`): delegáveis por permission
  (`<RECURSO>_DELETE` / `<RECURSO>_RESTORE`). O registro some da lista normal e aparece na aba
  "Removidos"; o botão só existe na tela de quem tem a permission — sem permission, ele nem aparece
  (não fica desabilitado).
- **Exclusão definitiva** (`DELETE /:id/permanent`): exclusiva do papel `ADMIN`, checada pelo papel e
  não por permission — não é delegável. `DRIVER` nunca vê nenhum dos três botões.

## Avisos de segurança

- A `API key` de um usuário novo (ou reemitida) é mostrada **uma única vez**, num modal sem botão de
  fechar por engano (sem Esc, sem clique fora): a tela avisa para copiá-la e entregá-la por um canal
  seguro antes de fechar.
- Nenhum segredo (senha, API key, token) é commitado: `cypress.env.json` (credenciais de teste) está
  no `.gitignore` — use `cypress.env.example.json` como modelo.
- O `AuthInterceptor` nunca manda `Authorization` nem `x-api-key` para um domínio que não seja o da
  nossa API (ex: o ViaCEP, usado só para preencher o endereço a partir do CEP).

## Como rodar os testes

### Jest (unitários)

```bash
npm test                 # roda a suíte
npm run test:cobertura   # roda com relatório de cobertura (texto no terminal)
```

Configuração em `jest.config.js` + `setup-jest.ts`, com `jest-preset-angular` em modo **zoneless**
(`provideZonelessChangeDetection`, o mesmo modo do app em produção — este projeto não usa `zone.js`).
Os testes usam um elenco fixo de dados realistas (nomes, e-mails, placas, CNH, valores em reais) em
`src/testing/dados-reais.ts`, reaproveitado em todos os specs — nada de `teste@teste.com` ou `foo`.

### Cypress (E2E)

```bash
npm run cypress:abrir    # modo interativo, com o Chrome/Electron do Cypress
npm run cypress:rodar    # modo headless, para CI
```

Pré-requisitos: back-end em `http://localhost:3000` e front em `http://localhost:4200` (`npm start`)
rodando, e um `cypress.env.json` na raiz do projeto (git-ignorado) com credenciais reais de um
ambiente de teste — copie `cypress.env.example.json` e preencha:

```json
{
  "apiUrl": "http://localhost:3000",
  "adminEmail": "...", "adminSenha": "...", "adminApiKey": "...",
  "gerenteEmail": "...", "gerenteSenha": "...", "gerenteApiKey": "...",
  "motoristaEmail": "...", "motoristaSenha": "...", "motoristaApiKey": "..."
}
```

O comando `cy.entrar(papel)` loga direto pela API (evita repetir o formulário em todo spec) e grava a
sessão no `localStorage`, do mesmo jeito que o app faz depois de um login real. Os specs criam dados
com placas/e-mails únicos por execução (sufixo aleatório) e os removem no `afterEach`, com exclusão
definitiva via API usando um JWT de `ADMIN`.

## Decisões de versão

- **Angular 21**: versão mais recente no início do projeto, já roda sem `zone.js` por padrão
  (`provideZonelessChangeDetection`) — motivo de o app e os testes serem zoneless desde o início.
- **`@lucide/angular`**: biblioteca de ícones SVG leve e com tree-shaking (só os ícones usados entram
  no bundle), em vez de uma fonte de ícones inteira.
- **`@ng-bootstrap/ng-bootstrap` 20**: componentes de UI (modal, etc.) acessíveis por padrão e sem
  depender do JavaScript do Bootstrap/jQuery, compatíveis com o Angular 21.
- **`ngx-mask` 21**: máscaras de campo (CEP, placa) mantendo o valor real do formulário sincronizado
  com o que aparece na tela.

## Estado da suíte de testes

Ver `scratchpad/relatorio-v11-etapa5.md` (relatório da etapa de testes) para o número de specs,
cobertura por pasta e pendências conhecidas.
