// Corpo de POST /auth/login e POST /auth/refresh-token.
export interface LoginResponse {
  accessToken: string;
  // Objeto menor que User: "role" já vem como texto (DRIVER, FLEET_MANAGER ou ADMIN).
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    // Permissions efetivas (papel + delegadas). A API continua sendo a fonte da verdade (403).
    permissions: string[];
    // Id do perfil de motorista ativo, ou null se não houver.
    driverId: string | null;
  };
}

// Usuário logado (o objeto pequeno que o login devolve).
export type UsuarioAutenticado = LoginResponse['user'];
