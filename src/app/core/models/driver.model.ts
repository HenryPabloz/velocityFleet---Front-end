// GET /drivers, GET /drivers/:id
export interface Driver {
  id: string;
  userId: string; // vínculo 1:1 com o usuário dono da conta
  fullName: string; // nome completo do motorista, já vem pronto da API
  licenseNumber: string; // CNH: 11 dígitos, sem máscara
  licenseExpiry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Corpo de PATCH /drivers/:id: a API só aceita a validade da CNH.
export interface AtualizarMotoristaDto {
  licenseExpiry: string; // AAAA-MM-DD, não pode estar no passado
}
