// Formato de erro da API (RFC 7807, application/problem+json).
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  // Só vem em erro de validação (400): uma mensagem por campo inválido.
  errors?: string[];
}
