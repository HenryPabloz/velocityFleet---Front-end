// Elenco fixo dos testes: as mesmas pessoas, veículos e endereços em todos os specs.
// O Cypress usa o espelho em cypress/fixtures/elenco.json (mantenha os dois iguais).

export const SENHA_VALIDA = 'Frota@2026';

// Permissions padrão de cada papel (as que as telas do front conferem).
export const PERMISSOES_DRIVER = [
  'TRIP_VIEW_OWN',
  'TRIP_CREATE',
  'REFUELING_VIEW_OWN',
  'REFUELING_CREATE',
  'INCIDENT_VIEW_OWN',
  'INCIDENT_CREATE',
];

export const PERMISSOES_FLEET_MANAGER = [
  ...PERMISSOES_DRIVER,
  'TRIP_VIEW_ALL',
  'REFUELING_VIEW_ALL',
  'INCIDENT_VIEW_ALL',
  'MAINTENANCE_VIEW_ALL',
  'MAINTENANCE_CREATE',
  'MAINTENANCE_UPDATE',
  'VEHICLE_CREATE',
  'VEHICLE_UPDATE',
  'VEHICLE_DELETE',
  'VEHICLE_RESTORE',
  'DRIVER_VIEW',
  'ANALYTICS_VIEW',
  'USER_CREATE',
];

export const PERMISSOES_ADMIN = [
  ...PERMISSOES_FLEET_MANAGER,
  'USER_VIEW',
  'USER_UPDATE',
  'USER_DELETE',
  'USER_RESTORE',
  'USER_ROLE_PROMOTE',
  'TRIP_DELETE',
  'TRIP_RESTORE',
  'DRIVER_DELETE',
  'DRIVER_RESTORE',
];

export const PAPEIS = {
  driver: { id: '5a1c0d62-8e0b-4b0e-9a55-3f0c2a7d1001', nome: 'DRIVER' },
  gerente: { id: '5a1c0d62-8e0b-4b0e-9a55-3f0c2a7d1002', nome: 'FLEET_MANAGER' },
  admin: { id: '5a1c0d62-8e0b-4b0e-9a55-3f0c2a7d1003', nome: 'ADMIN' },
};

export const PESSOAS = {
  marcos: {
    id: '0b7e6f3a-51d4-4c0a-8a31-9d2e4f6a0001',
    nomeCompleto: 'Marcos Vinícius Andrade',
    email: 'marcos.andrade@velocityfleet.com.br',
    papel: 'DRIVER',
    driverId: '3c9a1e70-72b5-4f7d-b8a2-6e1d0c5b0001',
    cnh: '04821736590',
    validadeCnh: '2031-03-18',
  },
  patricia: {
    id: '0b7e6f3a-51d4-4c0a-8a31-9d2e4f6a0002',
    nomeCompleto: 'Patrícia Lemos Figueiredo',
    email: 'patricia.figueiredo@velocityfleet.com.br',
    papel: 'FLEET_MANAGER',
    driverId: null,
  },
  roberto: {
    id: '0b7e6f3a-51d4-4c0a-8a31-9d2e4f6a0003',
    nomeCompleto: 'Roberto Carvalho Neto',
    email: 'roberto.carvalho@velocityfleet.com.br',
    papel: 'ADMIN',
    driverId: null,
  },
  juliana: {
    id: '0b7e6f3a-51d4-4c0a-8a31-9d2e4f6a0004',
    nomeCompleto: 'Juliana Souza Barbosa',
    email: 'juliana.barbosa@velocityfleet.com.br',
    papel: 'DRIVER',
    driverId: '3c9a1e70-72b5-4f7d-b8a2-6e1d0c5b0002',
    cnh: '07394528164',
    validadeCnh: '2030-11-02',
  },
};

// Veículos reais do mercado: Mercosul (2019 em diante) e placa antiga (antes disso).
export const VEICULOS = {
  strada: {
    id: '7f2d4a90-3c1e-4d8b-a6f5-1b9e0d7c0001',
    placa: 'RIO4E56',
    modelo: 'Fiat Strada Endurance',
    ano: 2023,
    kmAtual: 18450,
  },
  saveiro: {
    id: '7f2d4a90-3c1e-4d8b-a6f5-1b9e0d7c0002',
    placa: 'GHK4821',
    placaFormatada: 'GHK-4821',
    modelo: 'Volkswagen Saveiro Robust',
    ano: 2018,
    kmAtual: 96210,
  },
  master: {
    id: '7f2d4a90-3c1e-4d8b-a6f5-1b9e0d7c0003',
    placa: 'BRA2E19',
    modelo: 'Renault Master Furgão',
    ano: 2021,
    kmAtual: 61830,
  },
};

// CEPs reais e as ruas que o ViaCEP devolve para eles.
export const ENDERECOS = {
  avenidaPaulista: {
    cep: '01310-100',
    cepSemMascara: '01310100',
    texto: 'Avenida Paulista, Bela Vista, São Paulo - SP',
  },
  pracaSete: {
    cep: '30130-010',
    cepSemMascara: '30130010',
    texto: 'Praça Sete de Setembro, Centro, Belo Horizonte - MG',
  },
};

// Viagem São Paulo até Belo Horizonte: cerca de 586 km rodados.
export const VIAGEM = {
  id: '9e4b7c15-6a2d-4e39-8f10-5c3a1b8d0001',
  kmRodados: 586,
  criadaEm: '2026-09-21T11:40:00.000Z',
  iniciadaEm: '2026-09-22T08:00:00.000Z',
  finalizadaEm: '2026-09-22T18:25:00.000Z',
};

// Gasolina a R$ 6,29 o litro, tanque de 55 L: 42 L custam R$ 264,18.
export const ABASTECIMENTO = {
  litros: 42,
  precoLitro: 6.29,
  total: 264.18,
  combustivel: 'GASOLINE',
};

export const MANUTENCAO = {
  tipo: 'PREVENTIVE',
  descricao: 'Troca de óleo e filtros aos 20.000 km',
  custo: 480,
  agendadaPara: '2026-10-15',
};

export const INCIDENTE = {
  tipo: 'MECHANICAL_FAILURE',
  severidade: 'MEDIUM',
  descricao: 'Pneu dianteiro direito estourado na BR-116, km 214, sem feridos',
};

// Resposta de login de cada pessoa do elenco (sem token: veja montarRespostaLogin em apoio.ts).
export const PERMISSOES_POR_PAPEL: Record<string, string[]> = {
  DRIVER: PERMISSOES_DRIVER,
  FLEET_MANAGER: PERMISSOES_FLEET_MANAGER,
  ADMIN: PERMISSOES_ADMIN,
};
