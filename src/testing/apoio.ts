import { LoginResponse } from '../app/core/models';
import { PERMISSOES_POR_PAPEL, PESSOAS } from './dados-reais';

// Monta um JWT falso só com o "exp" (em segundos), suficiente para o app ler o vencimento.
export function montarTokenFalso(expiraEmSegundos: number): string {
  const cabecalho = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const carga = btoa(JSON.stringify({ exp: expiraEmSegundos }));
  return cabecalho + '.' + carga + '.assinatura';
}

interface PessoaLogin {
  id: string;
  nomeCompleto: string;
  email: string;
  papel: string;
  driverId: string | null;
}

// Resposta de POST /auth/login de uma pessoa do elenco (por padrão, o motorista Marcos).
export function montarRespostaLogin(
  pessoa: PessoaLogin = PESSOAS.marcos,
  sobrescrever: Partial<LoginResponse['user']> = {},
): LoginResponse {
  const validoPorUmaHora = Math.floor(Date.now() / 1000) + 3600;
  return {
    accessToken: montarTokenFalso(validoPorUmaHora),
    user: {
      id: pessoa.id,
      email: pessoa.email,
      fullName: pessoa.nomeCompleto,
      role: pessoa.papel,
      permissions: PERMISSOES_POR_PAPEL[pessoa.papel],
      driverId: pessoa.driverId,
      ...sobrescrever,
    },
  };
}

// Tradutor de mentira: devolve a própria chave (não precisa carregar o JSON).
export const traducaoFalsa = {
  instant: (chave: string) => chave,
};
