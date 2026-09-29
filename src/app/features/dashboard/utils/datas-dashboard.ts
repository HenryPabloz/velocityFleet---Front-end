import { KmPorDia, KmPorMes } from '../dashboard.model';

// Primeiro instante do mês atual (hora local).
export function inicioDoMesAtual(): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1);
}

// Diz se o texto de data (ISO) cai dentro do mês atual.
export function estaNoMesAtual(dataIso: string | null): boolean {
  if (!dataIso) {
    return false;
  }
  const data = new Date(dataIso);
  const agora = new Date();
  if (data.getFullYear() !== agora.getFullYear()) {
    return false;
  }
  return data.getMonth() === agora.getMonth();
}

// Agrupa {date, totalKm}[] diário em totais por mês (chave "AAAA-MM"). Spec §8.7.
export function agregarPorMes(dados: KmPorDia[]): KmPorMes[] {
  const totalPorMes = new Map<string, number>();
  for (const item of dados) {
    const chaveDoMes = item.date.slice(0, 7);
    const totalAtual = totalPorMes.get(chaveDoMes) ?? 0;
    totalPorMes.set(chaveDoMes, totalAtual + item.totalKm);
  }
  return Array.from(totalPorMes.entries()).map(([mes, totalKm]) => ({ mes, totalKm }));
}

// Completa com zero os meses sem km entre o primeiro e o último mês (a soma não muda).
export function preencherLacunas(dados: KmPorMes[]): KmPorMes[] {
  const ordenados = [...dados].sort((a, b) => a.mes.localeCompare(b.mes));
  if (ordenados.length === 0) {
    return [];
  }
  const resultado: KmPorMes[] = [];
  let ano = Number(ordenados[0].mes.slice(0, 4));
  let mes = Number(ordenados[0].mes.slice(5, 7));
  const ultimo = ordenados[ordenados.length - 1].mes;
  let chave = ordenados[0].mes;
  while (chave <= ultimo) {
    const achado = ordenados.find((item) => item.mes === chave);
    if (achado) {
      resultado.push(achado);
    } else {
      resultado.push({ mes: chave, totalKm: 0 });
    }
    mes = mes + 1;
    if (mes > 12) {
      mes = 1;
      ano = ano + 1;
    }
    chave = ano + '-' + String(mes).padStart(2, '0');
  }
  return resultado;
}
