import { statusDoErro } from '../../../shared/dados/utils/erros-api';
import { SituacaoBloco } from '../../dashboard/dashboard.model';

// Traduz o erro da API na situação do bloco: 429 = muitas chamadas, 403 = sem acesso.
export function situacaoDoErro(erro: unknown): SituacaoBloco {
  const status = statusDoErro(erro);
  if (status === 429) {
    return 'limite';
  }
  if (status === 403) {
    return 'sem-acesso';
  }
  return 'erro';
}

// Número no formato do idioma atual (ex: 1.234,5 em pt-BR).
export function formatarNumeroNoIdioma(valor: number, casas: number, idioma: string): string {
  const formatador = new Intl.NumberFormat(idioma, {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return formatador.format(valor);
}

// Ex: "2026-09" vira "set/26". Usa só o texto da chave, sem fuso horário.
export function rotuloDoMes(chave: string, idioma: string): string {
  const ano = Number(chave.slice(0, 4));
  const mes = Number(chave.slice(5, 7));
  const data = new Date(ano, mes - 1, 1);
  const nomeDoMes = new Intl.DateTimeFormat(idioma, { month: 'short' }).format(data).replace('.', '');
  return nomeDoMes + '/' + String(ano).slice(2);
}
