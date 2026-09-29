// GET /users, GET /users/:id, GET /users/me (recurso de admin/perfil).
export interface User {
  id: string;
  email: string;
  fullName: string;
  roleId: string; // UUID do papel, não o nome
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null; // só em GET /users/deleted/all
}

// GET /roles: o "id" é o roleId enviado nas rotas de usuário; "name" é ADMIN, FLEET_MANAGER ou DRIVER.
export interface Role {
  id: string;
  name: string;
  description: string;
}

// Bloco de motorista de POST /users (só para o papel DRIVER).
export interface DadosMotoristaDto {
  licenseNumber: string; // 11 dígitos, sem máscara
  licenseExpiry: string; // AAAA-MM-DD, não pode estar no passado
}

// Corpo de POST /users.
export interface CriarUsuarioDto {
  email: string;
  password: string; // 8 a 15 caracteres
  fullName: string;
  roleId: string;
  isActive?: boolean;
  driver?: DadosMotoristaDto;
}

// Corpo de PATCH /users/:id: só estes dois campos (roleId dá 400).
export interface AtualizarUsuarioDto {
  fullName?: string;
  isActive?: boolean;
}

// Corpo de PATCH /users/me/password.
export interface TrocarSenhaDto {
  currentPassword: string;
  newPassword: string; // 8 a 15 caracteres
}

// Resposta de POST /users (201): mesmo formato de User (+ driver quando houver).
export type UsuarioCriado = User;

// Resposta de GET /users/me.
export interface MeuPerfil extends User {
  permissions: string[];
  driverId: string | null;
}
