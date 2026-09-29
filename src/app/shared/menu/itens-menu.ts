// Um item do menu principal (usado na sidebar e no bottom tab).
export interface ItemMenu {
  id: string;
  icone: string; // nome do ícone em app-icone
  chaveRotulo: string;
  chaveRotuloCurto: string; // rótulo curto para o bottom tab (cabe em 320px)
  rota: string;
  prefixo: string; // a rota fica "ativa" para qualquer URL que comece assim
  excluirPrefixo?: string; // ...menos para as URLs que começam com este outro prefixo
  // O item aparece se o usuário tiver ALGUMA destas permissions. Lista vazia = todo logado vê.
  algumaPermissao: string[];
}

export const ITENS_MENU: ItemMenu[] = [
  { id: 'dashboard', icone: 'dashboard', chaveRotulo: 'MENU.DASHBOARD', chaveRotuloCurto: 'MENU.DASHBOARD', rota: '/dashboard', prefixo: '/dashboard', algumaPermissao: [] },
  // Leitura de veículos é liberada aos 3 papéis (a API usa @Roles, não permission).
  { id: 'frota', icone: 'frota', chaveRotulo: 'MENU.FROTA', chaveRotuloCurto: 'MENU.FROTA', rota: '/fleet/vehicles', prefixo: '/fleet', algumaPermissao: [] },
  { id: 'viagens', icone: 'viagens', chaveRotulo: 'MENU.VIAGENS', chaveRotuloCurto: 'MENU.VIAGENS', rota: '/trips', prefixo: '/trips', algumaPermissao: ['TRIP_VIEW_OWN', 'TRIP_VIEW_ALL'] },
  { id: 'abastecimentos', icone: 'abastecimentos', chaveRotulo: 'MENU.ABASTECIMENTOS', chaveRotuloCurto: 'MENU.ABASTECIMENTOS_CURTO', rota: '/refuelings', prefixo: '/refuelings', algumaPermissao: ['REFUELING_VIEW_OWN', 'REFUELING_VIEW_ALL'] },
  { id: 'manutencao', icone: 'manutencao', chaveRotulo: 'MENU.MANUTENCAO', chaveRotuloCurto: 'MENU.MANUTENCAO', rota: '/maintenance', prefixo: '/maintenance', algumaPermissao: ['MAINTENANCE_VIEW_ALL'] },
  { id: 'incidentes', icone: 'incidentes', chaveRotulo: 'MENU.INCIDENTES', chaveRotuloCurto: 'MENU.INCIDENTES', rota: '/incidents', prefixo: '/incidents', algumaPermissao: ['INCIDENT_VIEW_OWN', 'INCIDENT_VIEW_ALL'] },
  { id: 'analytics', icone: 'analytics', chaveRotulo: 'MENU.ANALYTICS', chaveRotuloCurto: 'MENU.ANALYTICS', rota: '/analytics', prefixo: '/analytics', algumaPermissao: ['ANALYTICS_VIEW'] },
  // "Usuários" só com USER_VIEW; "Novo usuário" com USER_CREATE (o gerente vê só este).
  { id: 'usuarios', icone: 'usuarios', chaveRotulo: 'MENU.USUARIOS', chaveRotuloCurto: 'MENU.USUARIOS', rota: '/admin/users', prefixo: '/admin/users', excluirPrefixo: '/admin/users/new', algumaPermissao: ['USER_VIEW'] },
  { id: 'novo-usuario', icone: 'usuario', chaveRotulo: 'MENU.NOVO_USUARIO', chaveRotuloCurto: 'MENU.NOVO_USUARIO_CURTO', rota: '/admin/users/new', prefixo: '/admin/users/new', algumaPermissao: ['USER_CREATE'] },
];

// Devolve só os itens que as permissions efetivas do usuário permitem.
export function itensDasPermissoes(permissoes: string[]): ItemMenu[] {
  const permitidos: ItemMenu[] = [];
  for (const item of ITENS_MENU) {
    if (item.algumaPermissao.length === 0) {
      permitidos.push(item);
      continue;
    }
    for (const codigo of item.algumaPermissao) {
      if (permissoes.includes(codigo)) {
        permitidos.push(item);
        break;
      }
    }
  }
  return permitidos;
}

// Diz se a URL atual pertence ao item (ex: /fleet/drivers pertence a Frota).
export function itemEstaAtivo(item: ItemMenu, url: string): boolean {
  const caminho = url.split('?')[0].split('#')[0];
  if (item.excluirPrefixo) {
    if (caminho === item.excluirPrefixo || caminho.startsWith(item.excluirPrefixo + '/')) {
      return false;
    }
  }
  if (caminho === item.prefixo) {
    return true;
  }
  return caminho.startsWith(item.prefixo + '/');
}
