# 🚀 Quick Start Guide — Começar em 5 Minutos

> **Leia isto PRIMEIRO se quiser começar imediatamente**

---

## 📋 Pré-requisitos

- [ ] Node.js 18+
- [ ] npm 9+
- [ ] Docker + Docker Compose (para PostgreSQL)
- [ ] Git

```bash
# Verificar versões
node --version    # v18+ ✓
npm --version     # 9+ ✓
docker --version  # ✓
```

---

## ⚡ 5-Minuto Setup

### 1. Criar Projeto (1 min)

```bash
nest new fleet-management
cd fleet-management
```

### 2. Instalar Dependências (2 min)

```bash
npm install \
  @nestjs/config \
  @nestjs/jwt \
  @nestjs/passport \
  @nestjs/swagger \
  @nestjs/axios \
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

npm install -D \
  @types/node \
  @types/express \
  @types/bcrypt \
  @types/passport-jwt \
  @types/pg
```

### 3. PostgreSQL com Docker (2 min)

```bash
# Criar docker-compose.yml (igual à Task 1.3 do Implementation Plan)
cat > docker-compose.yml << 'EOF'

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
EOF

# Iniciar
docker compose up -d

# Aguardar healthcheck (10 segundos)
sleep 10

# Testar conexão
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "SELECT 1;"
# Expected: 1
```

---

## 🎯 Próximos Passos (Escolha Um)

### Opção A: Seguir Implementation Plan (Recomendado)

```
📖 Arquivo: 2025-01-FROTA-IMPLEMENTATION.md

Começar com FASE 1:
├─ Task 1.1: NestJS (✓ já feito acima)
├─ Task 1.2: Dependências (✓ já feito acima)
├─ Task 1.3: PostgreSQL (✓ já feito acima)
├─ Task 1.4: .env + Config
├─ Task 1.5: Prisma setup
└─ Task 2.1-2.5: Schema + Migrations

Usar skill: subagent-driven-development
Executar task-by-task até Task 6.3
```

### Opção B: Entender Arquitetura Primeiro

```
📖 Arquivo: 2025-01-FROTA-DESIGN.md

Ler em ordem:
├─ Seção 1: Visão Geral (5 min)
├─ Seção 2: Requisitos (5 min)
├─ Seção 3: Arquitetura (10 min)
├─ Seção 4: Entidades (10 min)
└─ Seção 9: ViaCEP (5 min)

Total: 35 min
```

### Opção C: Começar com ViaCEP

```
📖 Arquivos: 2025-01-FROTA-DESIGN.md (Seção 9) e 2025-01-FROTA-VIACEP-SERVICE.md

1. Entender ViaCEP (Design, Seção 9) (5 min)
2. Ler Integration Plan (Implementation, Task 5.4) (5 min)
3. Copiar ViaCEP Service (10 min)
4. Testes (10 min)
5. Integrar com DTOs (10 min)

Total: 40 min

Depois voltar para Fase 1-6 completa
```

---

## 📂 Estrutura Mínima para Começar

```
fleet-management/
├── src/
│   ├── main.ts           ← Pronto (nest new)
│   ├── app.module.ts     ← Modificar (adicionar ConfigModule, DatabaseModule, AuthModule)
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── config/
│   │   └── configuration.ts ← Criar (Task 1.4)
│   └── database/
│       ├── database.module.ts ← Criar (Task 3.1)
│       └── prisma.service.ts  ← Criar (Task 3.1)
├── prisma/
│   ├── schema.prisma  ← Criar (Task 2.1)
│   ├── seed.ts        ← Criar (Task 3.4)
│   └── migrations/    ← 17 migrations já existem no repositório
├── prisma.config.ts   ← Criado pelo `npx prisma init` (Task 1.5)
├── docker-compose.yml ← Criar (Task 1.3)
├── .env               ← Criar (Task 1.4)
├── .env.example       ← Criar (Task 1.4)
├── package.json
├── tsconfig.json
└── nest-cli.json
```

---

## 🔑 Primeiros Comandos

```bash
# 1. Verificar que app roda
npm run start:dev
# Expected: "Listening on port 3000"

# 2. Criar arquivo .env
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:root@localhost:5433/fleet_db?schema=public"
JWT_SECRET="troque-por-uma-senha-aleatoria-de-32-caracteres"
JWT_EXPIRATION="1h"
PORT=3000
NODE_ENV=development
CEP_API_URL="https://viacep.com.br/ws"
CEP_TIMEOUT_MS=10000
ADMIN_EMAIL="admin@fleet.com"
ADMIN_INITIAL_PASSWORD="Admin@123"
EOF
# JWT_EXPIRATION precisa de número + unidade (1h, 30m, 7d, 3600s); senão o app não sobe

# 3. Inicializar Prisma
npx prisma init --datasource-provider postgresql
# Expected: "✓ Your Prisma schema was created at prisma/schema.prisma"

# 4. Validar Prisma
npx prisma validate
# Expected: "✓ Validation successful"

# 5. Testar conexão DB
docker exec -i fleet_postgres psql -U postgres -d fleet_db -c "SELECT NOW();"
# Expected: timestamp
```

---

## 🎓 Documentação por Função

| Seu Papel | Ler | Tempo |
|-----------|-----|-------|
| **Arquiteto** | Design Doc (Seções 1-6) | 30 min |
| **Dev Backend** | Implementation Plan | 20 min |
| **Dev ViaCEP** | ViaCEP Service + Resumo | 20 min |
| **QA/Tester** | Validation Checklist + Tests | 30 min |
| **DevOps/Infra** | Design (Seção 15) + Docker | 20 min |
| **Tech Lead** | Índice Completo | 15 min |

---

## ❓ "Mas e agora?"

### ✅ Se instalação funcionou

```
→ Ir para Implementation Plan (Task 1.4)
→ Começar a criar config
```

### ❌ Se PostgreSQL não conecta

```bash
# Verificar container rodando
docker ps
# Expected: postgres container status "Up"

# Ver logs
docker logs fleet_postgres

# Testar conexão direto
docker exec -it fleet_postgres psql -U postgres -d fleet_db -c "SELECT 1;"
```

### ❌ Se npm install falha

```bash
# Limpar cache
npm cache clean --force

# Remover node_modules e package-lock
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

### ❌ Se NestJS não inicia

```bash
# Verificar que main.ts existe
cat src/main.ts

# Recriar se necessário
nest generate app fleet-management
```

---

## 📞 Recursos Rápidos

| Problema | Solução | Arquivo |
|----------|---------|---------|
| "Qual é a arquitetura?" | Ler Seção 3 do Design Doc | `2025-01-FROTA-DESIGN.md` |
| "Como implementar ViaCEP?" | Ler Task 5.4 do Implementation | `2025-01-FROTA-IMPLEMENTATION.md` |
| "Evitar gaps anteriores?" | Ler Validation Checklist | `2025-01-FROTA-VALIDATION-CHECKLIST.md` |
| "Copiar código ViaCEP?" | Ler ViaCEP Service | `2025-01-FROTA-VIACEP-SERVICE.md` |
| "Índice de tudo?" | Ler Índice | `INDICE-PROJETO-FROTA.md` |

---

## 🎯 Milestones da Primeira Semana

| Dia | Meta | Checkpoint |
|-----|------|-----------|
| **1-2** | Fase 1 + 2 (Setup + Migrações) | `npx prisma validate` ✓, procedures funcionam |
| **2-3** | Fase 3 (Auth) | JWT login funciona |
| **3-4** | Fase 4 (Resources) | CRUD completo |
| **4-5** | Fase 5 (Features) | **ViaCEP funciona**, paginação, indicadores |
| **5** | Fase 6 (Testes) | Todos os 10 testes passam, `npm run build` ✓ |

---

## 🚀 Executar Agora Mesmo

**Opção 1: Skill subagent-driven-development**
```
Usar para: Executar tasks sequencialmente com validação
Começar: Task 1.4 (próxima depois do setup manual)
Duração: 5 dias, 40+ tasks
```

**Opção 2: Skill executing-plans**
```
Usar para: Executar Implementation Plan como um plano estruturado
Começar: Fase 1, Task 1.4
Duração: 5 dias, com checkpoints
```

**Opção 3: Eu mesmo**
```
Usar para: Implementar manualmente seguindo documentação
Leia: Implementation Plan
Tempo: 5-7 dias, depende de experiência
```

---

## 💡 Dicas Importantes

### 1. Sempre Validar

```bash
# Após cada fase
npx prisma validate
npm run build
npm test (quando houver)
```

### 2. Usar Git

```bash
# Commit frequente
git add .
git commit -m "Task 1.4: Configure .env and ConfigModule"
```

### 3. Logs são Amigos

```bash
# Ativar debug logging
DEBUG=* npm run start:dev

# Ver queries Prisma
export NODE_ENV=development
npm run start:dev
```

### 4. Testar Manualmente

```bash
# Antes de rodar testes, testar via curl/Postman
curl -X GET http://localhost:3000

# Depois de cada task, testar endpoint criado
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@fleet.com", "password": "Admin@123"}'
```

### 5. Banco Limpo = Testes Claros

```bash
# Dropar banco antes de testar
docker compose down -v
docker compose up -d
sleep 10
npx prisma migrate deploy
npm run seed
npm test
```

---

## 🎓 Aprender Enquanto Implementa

| Conceito | Onde Aprender | Fase |
|----------|---------------|------|
| NestJS Basics | Implementation Task 1.1 | 1 |
| Prisma + PostgreSQL | Implementation Task 1.5 + 2 | 1-2 |
| JWT + Autenticação | Implementation Task 3.2 | 3 |
| RBAC + Guards | Implementation Task 3.2-3.4 | 3 |
| Procedures PostgreSQL | Design Seção 5 | 2 |
| Triggers PostgreSQL | Design Seção 6 | 2 |
| HttpService (ViaCEP) | ViaCEP Service | 5 |
| Class-Validator | Validators.ts files | 3-5 |
| Testing E2E | Implementation Task 6.1 | 6 |

---

## 🏁 Checklist Final Before Going "Production"

- [ ] `npm run build` sem erros
- [ ] `npx prisma validate` ✓ Validation successful
- [ ] `npm test` — 10/10 testes passam
- [ ] Dropped banco e recriar do zero:
  - [ ] `docker compose down -v`
  - [ ] `docker compose up -d`
  - [ ] `npx prisma migrate deploy`
  - [ ] `npm run seed`
  - [ ] Testes passam novamente
- [ ] Nenhum trigger órfão:
  - [ ] `docker exec fleet_postgres psql -U postgres -d fleet_db -c "SELECT COUNT(*) FROM pg_trigger WHERE NOT tgisinternal;"` → 12 (procedures: 6; CHECKs: 26)
- [ ] audit_logs não foi deletada:
  - [ ] `docker exec fleet_postgres psql -U postgres -d fleet_db -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs');"` → true
- [ ] README.md completo
- [ ] .env.example sem segredos

---

## 🎬 Ready? Let's Go!

```bash
# Status: Você completou Quick Start (5 min)
# Próximo: Implementation Plan, Task 1.4

# Confirmação:
docker ps                    # ✓ PostgreSQL rodando
npm list @nestjs/common      # ✓ Dependências OK
npx prisma --version        # ✓ Prisma 7.10.0
node --version              # ✓ Node 18+

# Começar:
cd fleet-management
npm run start:dev

# Em outro terminal:
curl http://localhost:3000  # ✓ Deve retornar algo
```

---

**Status: ✅ Pronto para começar!**

Próximo arquivo: `2025-01-FROTA-IMPLEMENTATION.md` (Task 1.4)

