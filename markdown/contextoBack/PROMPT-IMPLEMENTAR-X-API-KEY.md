> **Histórico:** já aplicado, veja o DESIGN seção 7 (`2025-01-FROTA-DESIGN.md`).

# 🔐 PROMPT PARA CLAUDE CODE
## Implementar X-API-KEY + JWT em Camadas de Autenticação

> **Copie e cole este prompt inteiro no Claude Code**

---

```
Você é um especialista em autenticação e segurança em NestJS.

CONTEXTO:
Projeto: Gestão de Frota Corporativa (AV-07-FROTA)
Stack: NestJS + TypeScript + PostgreSQL + Prisma 7.10.0
Status Atual: Auth (JWT) implementado, NENHUMA resource de models criada ainda
Requisito: Implementar X-API-KEY em camadas + manter JWT existente

OBJETIVO:
Implementar fluxo de autenticação em 2 camadas:
1. X-API-KEY: Para operações iniciais (criar user, fazer login)
2. JWT: Para operações autorizadas (com role + permission)

FLUXO ESPERADO:
1. POST /auth/signup (PÚBLICA, sem autenticação)
   Request: { email, password, fullName, roleId }
   Response: { userId, apiKey, message: "Login with this API key" }
   
2. POST /auth/login (PROTEGIDO por X-API-KEY)
   Header: x-api-key: <apiKey>
   Request: { email, password }
   Response: { accessToken (JWT), user { id, email, fullName, role } }
   
3. GET /trips (PROTEGIDO por JWT)
   Header: Authorization: Bearer <accessToken>
   Response: [ trips com paginação ]
   
4. PATCH /auth/regenerate-key (PROTEGIDO por X-API-KEY ou JWT)
   Header: x-api-key: <apiKey>
   Response: { newApiKey }


SCHEMA NECESSÁRIO:

1. Adicionar em User model (prisma/schema.prisma):
   
   model User {
     id            String   @id @default(uuid())
     email         String   @unique
     password      String   // bcrypt hash
     fullName      String
     roleId        String
     role          Role     @relation(fields: [roleId], references: [id])
     isActive      Boolean  @default(true)
     
     // ✅ NOVO: API Key para autenticação em camadas
     apiKey        String?  @unique @db.VarChar(255)
     apiKeyCreatedAt DateTime? @default(now())
     apiKeyLastUsedAt DateTime?
     
     // Relacionamentos existentes
     driver        Driver?
     createdTrips  Trip[]   @relation("createdBy")
     refuelings    Refueling[] @relation("registeredBy")
     maintenances  Maintenance[] @relation("registeredBy")
     incidents     Incident[] @relation("registeredBy")
     auditLogs     AuditLog[] @relation("changedBy")
     
     createdAt     DateTime @default(now())
     updatedAt     DateTime @updatedAt
     
     @@index([apiKey])
   }

   MIGRATION:
   - Adicionar coluna: apiKey VARCHAR(255) UNIQUE NULLABLE
   - Adicionar coluna: apiKeyCreatedAt TIMESTAMP DEFAULT NOW()
   - Adicionar coluna: apiKeyLastUsedAt TIMESTAMP NULLABLE
   - Criar índice: CREATE INDEX idx_users_api_key ON users(api_key);


DTOs NECESSÁRIOS:

1. src/auth/dto/signup.dto.ts
   ```typescript
   export class SignupDto {
     @IsEmail()
     email: string;
     
     @IsString()
     @MinLength(8)
     password: string;
     
     @IsString()
     fullName: string;
     
     @IsUUID()
     roleId: string; // Deve ser DRIVER por padrão
   }
   ```

2. src/auth/dto/signup-response.dto.ts
   ```typescript
   export class SignupResponseDto {
     userId: string;
     apiKey: string;
     email: string;
     message: string;
   }
   ```

3. src/auth/dto/login-with-api-key.dto.ts
   ```typescript
   export class LoginWithApiKeyDto {
     email: string;
     password: string;
   }
   ```

4. src/auth/dto/regenerate-api-key-response.dto.ts
   ```typescript
   export class RegenerateApiKeyResponseDto {
     newApiKey: string;
     message: string;
   }
   ```


GUARDS NECESSÁRIOS:

1. src/auth/guards/api-key.guard.ts
   
   Lógica:
   - Extrair x-api-key do header
   - Validar se não está vazio
   - Buscar user com esse apiKey
   - Se não encontrar → 401 Unauthorized "Invalid API key"
   - Se user.isActive = false → 403 Forbidden "User account is inactive"
   - Adicionar user ao request.user para usar em controller/service
   - Atualizar user.apiKeyLastUsedAt = NOW()
   
   Implementar:
   ```typescript
   @Injectable()
   export class ApiKeyGuard implements CanActivate {
     constructor(private prisma: PrismaService) {}
     
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const request = context.switchToHttp().getRequest();
       const apiKey = request.headers['x-api-key'];
       
       if (!apiKey) {
         throw new UnauthorizedException('API key required');
       }
       
       const user = await this.prisma.user.findUnique({
         where: { apiKey },
         include: { role: true }
       });
       
       if (!user) {
         throw new UnauthorizedException('Invalid API key');
       }
       
       if (!user.isActive) {
         throw new ForbiddenException('User account is inactive');
       }
       
       // Atualizar last used
       await this.prisma.user.update({
         where: { id: user.id },
         data: { apiKeyLastUsedAt: new Date() }
       });
       
       request.user = {
         userId: user.id,
         email: user.email,
         roleId: user.roleId,
         apiKey: true // Marcar que autenticado por API key
       };
       
       return true;
     }
   }
   ```


SERVIÇO MODIFICADO:

Modificar: src/auth/auth.service.ts

Adicionar métodos:

1. signup(signupDto: SignupDto): Promise<SignupResponseDto>
   - Validar se email já existe → 409 Conflict
   - Hash password com bcrypt
   - Gerar apiKey único (usar crypto.randomBytes(32).toString('hex'))
   - Criar user com role = roleId (geralmente DRIVER para signup público)
   - Retornar { userId, apiKey, email, message: "Save your API key securely" }

2. loginWithApiKey(dto: LoginWithApiKeyDto, apiKey: string): Promise<LoginResponseDto>
   - Buscar user por email
   - Validar password com bcrypt
   - Gerar JWT token
   - Retornar { accessToken, user { id, email, fullName, role } }

3. regenerateApiKey(userId: string): Promise<RegenerateApiKeyResponseDto>
   - Gerar novo apiKey único
   - Atualizar user.apiKey
   - Retornar { newApiKey, message: "Old key is now invalid" }

4. validateApiKey(apiKey: string): Promise<User | null>
   - Buscar user por apiKey
   - Validar que user.isActive = true
   - Retornar user ou null

5. generateApiKey(): string
   - Gerar usando crypto.randomBytes(32).toString('hex')
   - Garantir unicidade


CONTROLLER MODIFICADO:

Modificar: src/auth/auth.controller.ts

Adicionar rotas:

1. POST /auth/signup (PÚBLICA)
   @Post('signup')
   @HttpCode(201)
   async signup(@Body() signupDto: SignupDto): Promise<SignupResponseDto> {
     return this.authService.signup(signupDto);
   }
   
   Testes:
   - ✅ POST /auth/signup com email válido → 201 + apiKey
   - ❌ POST /auth/signup com email duplicado → 409 Conflict
   - ❌ POST /auth/signup com password < 8 chars → 400 Bad Request
   - ❌ POST /auth/signup com email inválido → 400 Bad Request

2. POST /auth/login (PROTEGIDO por X-API-KEY)
   @Post('login')
   @UseGuards(ApiKeyGuard)
   @HttpCode(200)
   async loginWithApiKey(
     @Body() dto: LoginWithApiKeyDto,
     @Request() req
   ): Promise<LoginResponseDto> {
     return this.authService.loginWithApiKey(dto, req.user.apiKey);
   }
   
   Testes:
   - ✅ POST /auth/login com x-api-key + credenciais válidas → 200 + JWT
   - ❌ POST /auth/login sem x-api-key → 401 Unauthorized
   - ❌ POST /auth/login com x-api-key inválida → 401 Unauthorized
   - ❌ POST /auth/login com password errada → 401 Unauthorized
   - ❌ POST /auth/login com user inativo → 403 Forbidden

3. PATCH /auth/regenerate-key (PROTEGIDO por X-API-KEY)
   @Patch('regenerate-key')
   @UseGuards(ApiKeyGuard)
   @HttpCode(200)
   async regenerateApiKey(@Request() req): Promise<RegenerateApiKeyResponseDto> {
     return this.authService.regenerateApiKey(req.user.userId);
   }
   
   Testes:
   - ✅ PATCH /auth/regenerate-key com x-api-key válida → 200 + nova key
   - ✅ Antiga x-api-key deixa de funcionar após regeneração
   - ❌ PATCH /auth/regenerate-key sem x-api-key → 401 Unauthorized


MODIFICAÇÕES NO AUTH MODULE:

Adicionar em src/auth/auth.module.ts:

providers: [
  AuthService,
  JwtStrategy,
  + ApiKeyGuard,
]

exports: [
  AuthService,
  + ApiKeyGuard,
]


DOCUMENTAÇÃO DE ROTAS:

✅ ROTAS PÚBLICAS (sem autenticação):
   POST /auth/signup

🔑 ROTAS PROTEGIDAS POR X-API-KEY (header: x-api-key):
   POST /auth/login
   PATCH /auth/regenerate-key

🔐 ROTAS PROTEGIDAS POR JWT (header: Authorization: Bearer <token>):
   GET /trips (quando criada)
   POST /trips (quando criada)
   ... (todas as demais rotas de negócio)


VALIDAÇÕES CRÍTICAS:

✅ Email válido (format + unique)
✅ Password com bcrypt (nunca plain text)
✅ API key gerada com crypto.randomBytes (seguro)
✅ API key armazenada como unique index
✅ User.isActive antes de login
✅ Atualizar apiKeyLastUsedAt (para auditoria)
✅ JWT expiração mantida (24h)
✅ Mensagens de erro não revelam se user existe


TESTES E2E:

Criar: test/auth-api-key.e2e-spec.ts

1. Test: Signup flow
   - POST /auth/signup → 201 + apiKey
   - Validar que apiKey é única
   - Validar que password é hasheado

2. Test: Login with API key
   - Usar apiKey do signup
   - POST /auth/login → 200 + JWT

3. Test: API key validation
   - API key inválida → 401
   - Sem x-api-key header → 401

4. Test: Regenerate API key
   - PATCH /auth/regenerate-key → 200 + nova key
   - Velha key deixa de funcionar
   - Chamar login com velha key → 401

5. Test: JWT não funcionan para rotas de auth
   - Tentar usar JWT em POST /auth/login → 401
   - JWT é apenas para rotas de negócio (futuro)


MIGRATIONS NECESSÁRIAS:

1. Criar: prisma/migrations/[timestamp]_add_api_key_to_users/migration.sql
   
   ```sql
   ALTER TABLE users ADD COLUMN api_key VARCHAR(255) UNIQUE;
   ALTER TABLE users ADD COLUMN api_key_created_at TIMESTAMP DEFAULT NOW();
   ALTER TABLE users ADD COLUMN api_key_last_used_at TIMESTAMP;
   
   CREATE INDEX idx_users_api_key ON users(api_key);
   ```

2. Executar: npx prisma migrate deploy


SAÍDA ESPERADA:

1. Files criados:
   - src/auth/guards/api-key.guard.ts
   - src/auth/dto/signup.dto.ts
   - src/auth/dto/signup-response.dto.ts
   - src/auth/dto/login-with-api-key.dto.ts
   - src/auth/dto/regenerate-api-key-response.dto.ts

2. Files modificados:
   - src/auth/auth.service.ts (adicionar 5 métodos)
   - src/auth/auth.controller.ts (adicionar 3 rotas)
   - src/auth/auth.module.ts (exportar ApiKeyGuard)
   - prisma/schema.prisma (adicionar apiKey fields)
   - test/auth-api-key.e2e-spec.ts (criar 5 testes)

3. Migration criada:
   - prisma/migrations/[timestamp]_add_api_key_to_users/migration.sql

4. Confirmação:
   - ✅ Todos os DTOs criados
   - ✅ ApiKeyGuard implementado
   - ✅ 5 métodos no service
   - ✅ 3 rotas no controller
   - ✅ 5 testes passando
   - ✅ Migration aplicada
   - ✅ Fluxo documentado


⚠️ IMPORTANTE:

1. API key deve ser gerada com crypto.randomBytes (seguro)
2. API key NUNCA deve ser retornada em GET (apenas em POST signup e PATCH regenerate)
3. Quando user faz regenerate, velha key DEVE parar de funcionar imediatamente
4. apiKeyLastUsedAt é apenas para auditoria (opcional logar)
5. Validar que não há vazamento de informação (401 vs 403 corretos)
6. Manter JWT existente funcionando (não quebrar)


Começar agora! Implementar X-API-KEY em camadas conforme fluxo acima.
```

---

## 📋 Como Usar Este Prompt

1. **Copie o prompt inteiro** (entre as 3 aspas)
2. **Abra Claude Code** 
3. **Cole o prompt** na conversa
4. **Claude Code irá:**
   - Criar guards (ApiKeyGuard)
   - Criar DTOs (Signup, LoginWithApiKey, etc)
   - Modificar AuthService (5 novos métodos)
   - Modificar AuthController (3 novas rotas)
   - Criar migration
   - Criar testes E2E
   - Fornecer checklist

---

## 🔐 Fluxo Visual

```
1. POST /auth/signup (PÚBLICA)
   ↓
   Response: { userId, apiKey }
   ↓

2. Usuário salva apiKey com segurança
   ↓

3. POST /auth/login (com x-api-key header)
   ↓
   Response: { accessToken (JWT), user {...} }
   ↓

4. Usuário usa JWT para acessar recursos
   GET /trips (com Authorization: Bearer <token>)
   ↓
   Response: [ trips ] (com role + permission check)
   ↓

5. Quando precisa nova apiKey:
   PATCH /auth/regenerate-key (com x-api-key header)
   ↓
   Response: { newApiKey }
   ↓
   Velha apiKey para de funcionar imediatamente
```

---

## ✅ Checklist após Implementar

- [ ] POST /auth/signup (PÚBLICA) funciona
- [ ] POST /auth/login (x-api-key) funciona
- [ ] PATCH /auth/regenerate-key funciona
- [ ] Velha apiKey para de funcionar após regenerar
- [ ] ApiKeyGuard bloqueia sem x-api-key
- [ ] User.isActive = false bloqueia login
- [ ] Todos os 5 testes E2E passam
- [ ] JWT existente continua funcionando
- [ ] Migration aplicada com sucesso
- [ ] Nenhum apiKey é retornado em GET

---

**Pronto! Copie e cole no Claude Code 🚀**

