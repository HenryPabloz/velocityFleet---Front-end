// Funções simples de formatação usadas nas telas e nos pipes.

// Placa antiga vira ABC-1234; Mercosul (ABC1D23) fica como está.
export function formatarPlaca(placa: string | null | undefined): string {
  if (!placa) {
    return '';
  }
  const limpa = placa.replace('-', '').toUpperCase().trim();
  if (/^[A-Z]{3}[0-9]{4}$/.test(limpa)) {
    return limpa.slice(0, 3) + '-' + limpa.slice(3);
  }
  return limpa;
}

// Placa como o usuário digitou: maiúscula, sem espaços e sem hífen (o back aceita os dois).
export function normalizarPlaca(texto: string): string {
  return texto.replace(/[\s-]/g, '').toUpperCase();
}

// Pega só AAAA-MM-DD da data da API e evita mudar o dia por causa do fuso horário.
export function dataCurta(valor: string | null | undefined): string {
  if (!valor) {
    return '—';
  }
  const partes = valor.slice(0, 10).split('-');
  if (partes.length !== 3) {
    return valor;
  }
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

export function dataHoraCurta(valor: string | null | undefined): string {
  if (!valor) {
    return '—';
  }
  const data = new Date(valor);
  if (isNaN(data.getTime())) {
    return valor;
  }
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return formatador.format(data);
}

export function formatarNumero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('pt-BR').format(valor);
}

// Quantos dias faltam para a CNH vencer (negativo = já venceu).
export function diasParaVencer(validade: string): number {
  const partes = validade.slice(0, 10).split('-');
  const dataValidade = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diferenca = dataValidade.getTime() - hoje.getTime();
  return Math.round(diferenca / 86400000);
}

export type SituacaoCnh = 'VENCIDA' | 'VENCENDO' | 'VALIDA';

export const DIAS_AVISO_CNH = 30;

export function situacaoDaCnh(validade: string): SituacaoCnh {
  const dias = diasParaVencer(validade);
  if (dias < 0) {
    return 'VENCIDA';
  }
  if (dias <= DIAS_AVISO_CNH) {
    return 'VENCENDO';
  }
  return 'VALIDA';
}

// CEP com máscara 12345-678 a partir do que o usuário digitou.
export function mascararCep(texto: string): string {
  const numeros = texto.replace(/\D/g, '').slice(0, 8);
  if (numeros.length > 5) {
    return numeros.slice(0, 5) + '-' + numeros.slice(5);
  }
  return numeros;
}

// Valor em reais: R$ 1.234,50.
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  const numero = Number(valor);
  if (isNaN(numero)) {
    return '—';
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
}

// Preço por litro pede até 4 casas (a API guarda assim).
export function formatarPrecoLitro(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') {
    return '—';
  }
  const numero = Number(valor);
  if (isNaN(numero)) {
    return '—';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(numero);
}

// Tamanho do arquivo em texto simples: 2,3 MB.
export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  }
  if (bytes < 1024 * 1024) {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(bytes / 1024) + ' KB';
  }
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024)) + ' MB';
}
