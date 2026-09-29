# ViaCEP Service — Implementação Completa

> **Requisito:** Usar HttpService para consumir API externa (ViaCEP)
> **Status:** Pronto para copiar/colar nos arquivos do projeto

> **Histórico — divergências conhecidas em relação ao código final (aplicado, não atualizado aqui):**
> - Arquivos reais: `src/external/viacep/via-cep.service.ts` e `via-cep.module.ts` (não `viacep.service.ts`/`viacep.module.ts`), DTO único `dto/via-cep-endereco.dto.ts` e `interfaces/via-cep-resposta.interface.ts` (não os 3 DTOs + interface deste rascunho).
> - Classe/métodos reais: `ViaCepService.buscarPorCep()` e `.cepEhValido()` (não `searchByCep`/`isCepValid`/`validateMultipleCeps`/`searchMultipleCeps`, que não existem no código).
> - `CreateVehicleDto.initialLocationCep` é opcional e **não persistido** no banco (só enriquece a resposta); `CreateTripDto` não tem `startLocation`/`endLocation` com `@IsValidCep`. `VehiclesService`/`TripsService` reais não seguem o exemplo simplificado das Seções 7 e usam procedures (`create_trip`), não `prisma.vehicle.create` direto.
> - Os testes e2e reais que cobrem ViaCEP ficam em `test/vehicles-maintenances.e2e-spec.ts` e `test/trips-refuelings-incidents.e2e-spec.ts` (não existe `test/viacep.e2e-spec.ts`).
> - Use este arquivo só como referência do desenho original; para o comportamento atual, leia o código em `src/external/viacep/`.

---

## 📁 Arquivos a Criar

```
src/
├── external/
│   └── viacep/
│       ├── viacep.service.ts        ← Serviço principal
│       ├── viacep.module.ts         ← Módulo
│       ├── dto/
│       │   ├── viacep-address.dto.ts
│       │   ├── viacep-search.dto.ts
│       │   └── viacep-error.dto.ts
│       └── interfaces/
│           └── viacep-response.interface.ts
├── common/
│   └── validators/
│       └── is-valid-cep.validator.ts
└── app.module.ts (importar ViaCepModule)
```

---

## 1. DTOs

### `src/external/viacep/dto/viacep-address.dto.ts`

```typescript
/**
 * Resposta da API ViaCEP para um CEP encontrado
 * https://viacep.com.br/ws/01310100/json/
 */
export class ViaCepAddressDto {
  cep: string; // "01310100"
  logradouro: string; // "Avenida Paulista"
  complemento?: string; // "até 1000"
  bairro: string; // "Cerqueira César"
  localidade: string; // "São Paulo"
  uf: string; // "SP"
  ibge: string; // "3550308"
  gia?: string; // ""
  ddd: string; // "11"
  siafi: string; // "7107"

  // Campos enriquecidos
  fullAddress?: string; // "São Paulo, SP"
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}
```

### `src/external/viacep/dto/viacep-error.dto.ts`

```typescript
/**
 * Resposta da API ViaCEP quando CEP não é encontrado
 */
export class ViaCepErrorDto {
  erro: true;
}
```

### `src/external/viacep/dto/viacep-search.dto.ts`

```typescript
/**
 * Request DTO para buscar CEP
 * (usado em services, não em controllers diretos)
 */
export class ViaCepSearchDto {
  cep: string; // Com ou sem máscara: "01310-100" ou "01310100"
}
```

---

## 2. Interfaces

### `src/external/viacep/interfaces/viacep-response.interface.ts`

```typescript
/**
 * Union type para resposta da API ViaCEP
 */
export type ViaCepResponse = ViaCepSuccessResponse | ViaCepErrorResponse;

export interface ViaCepSuccessResponse {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia?: string;
  ddd: string;
  siafi: string;
  erro?: never;
}

export interface ViaCepErrorResponse {
  erro: true;
}
```

---

## 3. Serviço Principal

### `src/external/viacep/viacep.service.ts`

```typescript
import {
  Injectable,
  BadRequestException,
  GatewayTimeoutException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';
import { ViaCepAddressDto } from './dto/viacep-address.dto';
import { ViaCepResponse } from './interfaces/viacep-response.interface';

/**
 * ViaCEP Service — Integração com API de CEP do Brasil
 * 
 * Funcionalidades:
 * - Buscar endereço por CEP
 * - Validar CEP
 * - Tratamento robusto de erros
 * - Logging estruturado
 * 
 * API: https://viacep.com.br/ws/{cep}/json/
 * Documentação: https://viacep.com.br/
 */
@Injectable()
export class ViaCepService {
  private readonly logger = new Logger(ViaCepService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('CEP_API_URL') || 'https://viacep.com.br/ws';
    this.timeoutMs = this.configService.get('CEP_TIMEOUT_MS') || 10000; // 10s default
    
    this.logger.log(`ViaCEP Service initialized with base URL: ${this.baseUrl}`);
  }

  /**
   * Buscar endereço por CEP
   * 
   * @param cep - CEP com ou sem máscara (01310100 ou 01310-100)
   * @returns Dados de endereço enriquecidos
   * 
   * @throws BadRequestException
   *   - CEP inválido (formato incorreto)
   *   - CEP não encontrado (erro: true)
   * 
   * @throws GatewayTimeoutException
   *   - Timeout na requisição (>10s)
   *   - Rate limit da API (429)
   * 
   * @throws InternalServerErrorException
   *   - Erro de conexão (ECONNREFUSED, ENOTFOUND)
   *   - Erro genérico na API (500)
   */
  async searchByCep(cep: string): Promise<ViaCepAddressDto> {
    // 1. Validar input
    const cleanCep = this.cleanCep(cep);

    if (!this.isValidCepFormat(cleanCep)) {
      this.logger.warn(`Invalid CEP format: ${cep}`);
      throw new BadRequestException(
        `Invalid CEP format. Expected 8 digits (e.g., 01310-100 or 01310100), received: ${cep}`,
      );
    }

    // 2. Fazer requisição HTTP
    try {
      this.logger.debug(`Searching address for CEP: ${cleanCep}`);

      const response = await firstValueFrom(
        this.httpService
          .get<ViaCepResponse>(`${this.baseUrl}/${cleanCep}/json/`, {
            headers: {
              'User-Agent': 'NestJS-FleetAPI/1.0',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
            },
          })
          .pipe(
            timeout(this.timeoutMs),
            catchError((error: AxiosError) => {
              throw error;
            }),
          ),
      );

      // 3. Verificar se CEP foi encontrado
      if ((response.data as any).erro === true) {
        this.logger.warn(`CEP not found: ${cleanCep}`);
        throw new BadRequestException(`CEP ${cep} not found in Brazil`);
      }

      // 4. Enriquecer resposta
      const data = response.data as any;
      const enriched = this.enrichAddress(data);

      this.logger.log(`CEP ${cleanCep} found: ${enriched.fullAddress}`);
      return enriched;
    } catch (error) {
      // Re-lançar BadRequestException (CEP não encontrado, formato inválido)
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Timeout
      if (error?.name === 'TimeoutError') {
        this.logger.error(`ViaCEP API timeout (${this.timeoutMs}ms)`);
        throw new GatewayTimeoutException(
          `ViaCEP API timeout exceeded (${this.timeoutMs}ms). Try again later.`,
        );
      }

      // Erro de rede / conexão
      const axiosError = error as AxiosError;
      if (
        axiosError?.code === 'ECONNREFUSED' ||
        axiosError?.code === 'ENOTFOUND' ||
        axiosError?.code === 'ETIMEDOUT'
      ) {
        this.logger.error(`Cannot connect to ViaCEP API: ${axiosError?.code}`);
        throw new InternalServerErrorException(
          'Cannot connect to ViaCEP API. Service may be unavailable.',
        );
      }

      // Rate limit (429)
      if (axiosError?.response?.status === 429) {
        this.logger.warn('ViaCEP API rate limited');
        throw new GatewayTimeoutException(
          'ViaCEP API rate limit exceeded. Please try again later.',
        );
      }

      // Erro de servidor (5xx)
      if (axiosError?.response?.status >= 500) {
        this.logger.error(`ViaCEP API server error: ${axiosError.response.status}`);
        throw new InternalServerErrorException(
          `ViaCEP API server error (${axiosError.response.status})`,
        );
      }

      // Erro genérico
      this.logger.error(`Unexpected error from ViaCEP API: ${error?.message}`);
      throw new InternalServerErrorException(
        `Unexpected error while searching CEP: ${error?.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Validar se um CEP é válido (retorna boolean)
   * Útil para custom validators e verificações rápidas
   * 
   * @param cep - CEP com ou sem máscara
   * @returns true se CEP é válido, false caso contrário
   */
  async isCepValid(cep: string): Promise<boolean> {
    try {
      await this.searchByCep(cep);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validar múltiplos CEPs simultaneamente
   * (Útil para validar múltiplas localizações de uma trip)
   * 
   * @param ceps - Array de CEPs
   * @returns Object mapeando CEP → válido/não-válido
   */
  async validateMultipleCeps(
    ceps: string[],
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      ceps.map(async (cep) => {
        results[cep] = await this.isCepValid(cep);
      }),
    );

    return results;
  }

  /**
   * Buscar endereços para múltiplos CEPs
   * (Útil para trips com múltiplos pontos)
   * 
   * @param ceps - Array de CEPs
   * @returns Array de endereços (ou erro se algum CEP for inválido)
   */
  async searchMultipleCeps(ceps: string[]): Promise<ViaCepAddressDto[]> {
    return Promise.all(ceps.map((cep) => this.searchByCep(cep)));
  }

  /**
   * Limpar máscara de CEP
   * "01310-100" → "01310100"
   */
  private cleanCep(cep: string): string {
    return cep.replace(/\D/g, ''); // Remove tudo que não é dígito
  }

  /**
   * Validar formato de CEP (8 dígitos)
   */
  private isValidCepFormat(cep: string): boolean {
    return /^\d{8}$/.test(cep);
  }

  /**
   * Enriquecer dados de endereço retornados pela ViaCEP
   */
  private enrichAddress(data: any): ViaCepAddressDto {
    return {
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento || undefined,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
      ibge: data.ibge,
      gia: data.gia || undefined,
      ddd: data.ddd,
      siafi: data.siafi,
      // Enriquecimentos
      fullAddress: `${data.localidade}, ${data.uf}`,
      // coordinates: será adicionado quando integrar com Google Maps
    };
  }
}
```

---

## 4. Módulo

### `src/external/viacep/viacep.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ViaCepService } from './viacep.service';

@Module({
  imports: [HttpModule],
  providers: [ViaCepService],
  exports: [ViaCepService],
})
export class ViaCepModule {}
```

---

## 5. Validador Customizado

### `src/common/validators/is-valid-cep.validator.ts`

```typescript
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { ViaCepService } from 'src/external/viacep/viacep.service';

/**
 * Constraint que valida CEP contra ViaCEP API
 * Executa async durante validação de DTO
 */
@ValidatorConstraint({ name: 'IsValidCep', async: true })
@Injectable()
export class IsValidCepConstraint implements ValidatorConstraintInterface {
  constructor(private viaCepService: ViaCepService) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    if (!value) {
      return true; // @IsOptional() vai tratar null/undefined
    }

    return this.viaCepService.isCepValid(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `CEP "${args.value}" is invalid or not found in Brazil`;
  }
}

/**
 * Decorator para usar no DTO
 * @example
 * export class CreateVehicleDto {
 *   @IsValidCep()
 *   initialLocationCep: string;
 * }
 */
export function IsValidCep(validationOptions?: ValidationOptions) {
  return function (target: Object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCepConstraint,
    });
  };
}
```

---

## 6. Integração com DTOs

### `src/vehicles/dto/create-vehicle.dto.ts`

```typescript
import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { IsValidCep } from 'src/common/validators/is-valid-cep.validator';

export class CreateVehicleDto {
  @IsString()
  plate: string; // "ABC-1234"

  @IsString()
  model: string; // "Fiat Ducato"

  @IsInt()
  @Min(1900)
  @Max(2099)
  year: number; // 2023

  @IsInt()
  @Min(0)
  currentMileage: number; // 1000

  @IsOptional()
  @IsString()
  @IsValidCep() // ✓ Valida CEP contra ViaCEP antes de criar
  initialLocationCep?: string; // "01310-100"
}
```

### `src/trips/dto/create-trip.dto.ts`

```typescript
import { IsString, IsInt, Min } from 'class-validator';
import { IsValidCep } from 'src/common/validators/is-valid-cep.validator';

export class CreateTripDto {
  @IsString()
  driverId: string; // UUID

  @IsString()
  vehicleId: string; // UUID

  @IsInt()
  @Min(0)
  startKm: number;

  @IsString()
  @IsValidCep() // ✓ Valida CEP
  startLocation: string; // "01310-100"

  @IsString()
  @IsValidCep() // ✓ Valida CEP
  endLocation: string; // "01310-100"
}
```

---

## 7. Integração com Services

### `src/vehicles/vehicles.service.ts` (parcial)

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ViaCepService } from 'src/external/viacep/viacep.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private prisma: PrismaService,
    private viaCepService: ViaCepService,
  ) {}

  async create(dto: CreateVehicleDto) {
    let locationData = null;

    // Se CEP foi fornecido, buscar localização
    if (dto.initialLocationCep) {
      locationData = await this.viaCepService.searchByCep(dto.initialLocationCep);
    }

    // Criar veículo
    const vehicle = await this.prisma.vehicle.create({
      data: {
        plate: dto.plate,
        model: dto.model,
        year: dto.year,
        currentMileage: dto.currentMileage,
        status: 'AVAILABLE',
      },
    });

    // Retornar com localização enriquecida (opcional)
    return {
      ...vehicle,
      initialLocation: locationData,
    };
  }
}
```

### `src/trips/trips.service.ts` (parcial)

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ViaCepService } from 'src/external/viacep/viacep.service';
import { CreateTripDto } from './dto/create-trip.dto';

@Injectable()
export class TripsService {
  constructor(
    private prisma: PrismaService,
    private viaCepService: ViaCepService,
  ) {}

  async createTrip(dto: CreateTripDto, userId: string) {
    // Validar existência de driver e vehicle
    const driver = await this.prisma.driver.findUnique({
      where: { id: dto.driverId },
    });
    if (!driver) throw new BadRequestException('Driver not found');

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) throw new BadRequestException('Vehicle not found');

    // Buscar localização de início (ViaCEP)
    const startLocationData = await this.viaCepService.searchByCep(dto.startLocation);

    // Buscar localização de fim (ViaCEP)
    const endLocationData = await this.viaCepService.searchByCep(dto.endLocation);

    // Chamar procedure com localização enriquecida
    // A procedure e o set_config rodam na MESMA transação (o set_config diz quem está agindo, para a auditoria).
    // Os dois NULL no fim ocupam os parâmetros OUT (id, status).
    const result = await this.prisma.$transaction(async (transacao) => {
      await transacao.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
      return transacao.$queryRaw`
        CALL create_trip(
          ${dto.driverId}::uuid,
          ${dto.vehicleId}::uuid,
          ${dto.startKm}::int,
          ${startLocationData.fullAddress}::text,
          ${endLocationData.fullAddress}::text,
          ${userId}::uuid,
          NULL,
          NULL
        )
      `;
    });

    return result;
  }
}
```

---

## 8. Integração no AppModule

### `src/app.module.ts` (parcial)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ViaCepModule } from './external/viacep/viacep.module';
// ... outros imports

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),
    DatabaseModule,
    ViaCepModule, // ✓ Adicionar aqui
    AuthModule,
    // ... outros módulos
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

---

## 9. Configuração .env

### `.env`

```env
# Database
DATABASE_URL="postgresql://postgres:root@localhost:5433/fleet_db"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRATION="24h"

# Application
PORT=3000
NODE_ENV=development

# ViaCEP API
CEP_API_URL="https://viacep.com.br/ws"
CEP_TIMEOUT_MS=10000

# (Outros...)
```

### `.env.example`

```env
# ViaCEP API
CEP_API_URL="https://viacep.com.br/ws"
CEP_TIMEOUT_MS=10000
```

---

## 10. Testes E2E

### `test/viacep.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ViaCepService } from './../src/external/viacep/viacep.service';

describe('ViaCEP Integration (e2e)', () => {
  let app: INestApplication;
  let viaCepService: ViaCepService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    viaCepService = moduleFixture.get<ViaCepService>(ViaCepService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ViaCepService.searchByCep', () => {
    // Test 9.1: Buscar CEP válido → sucesso
    it('should search for a valid CEP and return address', async () => {
      const result = await viaCepService.searchByCep('01310-100');

      expect(result).toBeDefined();
      expect(result.cep).toBe('01310100');
      expect(result.localidade).toBe('São Paulo');
      expect(result.uf).toBe('SP');
      expect(result.fullAddress).toBe('São Paulo, SP');
    });

    // Test 9.2: CEP com máscara → remoção automática
    it('should handle CEP with mask (01310-100)', async () => {
      const result = await viaCepService.searchByCep('01310-100');
      expect(result.cep).toBe('01310100');
    });

    // Test 9.3: CEP sem máscara → sucesso
    it('should handle CEP without mask (01310100)', async () => {
      const result = await viaCepService.searchByCep('01310100');
      expect(result.cep).toBe('01310100');
    });

    // Test 9.4: CEP inválido (não encontrado) → BadRequestException
    it('should throw BadRequestException for invalid CEP', async () => {
      try {
        await viaCepService.searchByCep('00000-000');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('not found');
      }
    });

    // Test 9.5: CEP com formato errado → BadRequestException
    it('should throw BadRequestException for wrong CEP format', async () => {
      try {
        await viaCepService.searchByCep('ABC-DEFG');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Invalid CEP format');
      }
    });

    // Test 9.6: Timeout simulado → GatewayTimeoutException
    // (Requer mock do HttpService ou timeout de teste)
    it('should handle timeout gracefully', async () => {
      // TODO: Mock HttpService para simular timeout
      // Verificar que GatewayTimeoutException é lançada
    });

    // Test 9.7: Validação com isCepValid → boolean
    it('should validate CEP and return boolean', async () => {
      const validResult = await viaCepService.isCepValid('01310-100');
      expect(validResult).toBe(true);

      const invalidResult = await viaCepService.isCepValid('00000-000');
      expect(invalidResult).toBe(false);
    });

    // Test 9.8: Múltiplos CEPs → array de endereços
    it('should search multiple CEPs', async () => {
      const ceps = ['01310-100', '20040020'];
      const results = await viaCepService.searchMultipleCeps(ceps);

      expect(results).toHaveLength(2);
      expect(results[0].localidade).toBe('São Paulo');
      expect(results[1].localidade).toBe('Rio de Janeiro');
    });

    // Test 9.9: Integração com DTO (CreateVehicleDto com @IsValidCep)
    it('should validate CEP in DTO with @IsValidCep decorator', async () => {
      // Fazer POST /vehicles com CEP válido → 201
      const response = await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          plate: 'ABC-1234',
          model: 'Fiat Ducato',
          year: 2023,
          currentMileage: 1000,
          initialLocationCep: '01310-100',
        })
        .expect(201);

      expect(response.body.initialLocation).toBeDefined();
      expect(response.body.initialLocation.localidade).toBe('São Paulo');
    });

    // Test 9.10: Integração com CreateTripDto (@IsValidCep em startLocation e endLocation)
    it('should validate CEPs in CreateTripDto', async () => {
      // Fazer POST /trips com CEPs válidos → 201
      const response = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          driverId: '...',
          vehicleId: '...',
          startKm: 0,
          startLocation: '01310-100',
          endLocation: '20040020',
        })
        .expect(201);

      expect(response.body.status).toBe('PLANNED');
    });
  });

  describe('Error Handling', () => {
    // Test 9.11: CEP não encontrado → 400
    it('should return 400 for CEP not found', async () => {
      try {
        await viaCepService.searchByCep('00000-000');
      } catch (error) {
        expect(error.getStatus()).toBe(400);
      }
    });

    // Test 9.12: API timeout → 504
    // (Requer mock)

    // Test 9.13: API erro de rede → 503
    // (Requer mock)
  });
});
```

---

## 11. Instalação de Dependências

```bash
# ViaCEP usa HttpService (já incluído)
npm install @nestjs/axios

# Se ainda não tem:
npm install axios

# Pronto! Nenhuma dependência extra necessária.
```

---

## 12. Checklist de Implementação

- [ ] Criar pasta `src/external/viacep/`
- [ ] Criar DTOs (viacep-address.dto.ts, viacep-error.dto.ts, viacep-search.dto.ts)
- [ ] Criar interfaces (viacep-response.interface.ts)
- [ ] Criar serviço (viacep.service.ts)
- [ ] Criar módulo (viacep.module.ts)
- [ ] Criar validador (is-valid-cep.validator.ts)
- [ ] Adicionar @IsValidCep() em CreateVehicleDto
- [ ] Adicionar @IsValidCep() em CreateTripDto
- [ ] Integrar ViaCepService em VehiclesService
- [ ] Integrar ViaCepService em TripsService
- [ ] Importar ViaCepModule em AppModule
- [ ] Adicionar variáveis ao .env (CEP_API_URL, CEP_TIMEOUT_MS)
- [ ] Rodar testes (npm test)
- [ ] Validar que testes 9.1-9.10 passam

---

**Pronto para implementar! 🚀**

