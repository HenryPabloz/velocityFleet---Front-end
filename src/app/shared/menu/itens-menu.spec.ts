import { PERMISSOES_ADMIN, PERMISSOES_DRIVER, PERMISSOES_FLEET_MANAGER } from '../../../testing/dados-reais';
import { ITENS_MENU, ItemMenu, itemEstaAtivo, itensDasPermissoes } from './itens-menu';
import { ligarAnimacaoDoIndicador, posicionarIndicador } from './indicador-menu';

function ids(itens: ItemMenu[]): string[] {
  return itens.map((item) => item.id);
}

function acharItem(id: string): ItemMenu {
  const item = ITENS_MENU.find((candidato) => candidato.id === id);
  if (!item) {
    throw new Error('Item de menu não existe: ' + id);
  }
  return item;
}

describe('menu filtrado por permission', () => {
  it('motorista vê Dashboard, Frota, Viagens, Abastecimentos e Incidentes (sem gestão)', () => {
    expect(ids(itensDasPermissoes(PERMISSOES_DRIVER))).toEqual([
      'dashboard',
      'frota',
      'viagens',
      'abastecimentos',
      'incidentes',
    ]);
  });

  it('gerente ganha Manutenção, Analytics e "Novo usuário", mas não a lista de Usuários', () => {
    const menuDoGerente = ids(itensDasPermissoes(PERMISSOES_FLEET_MANAGER));
    expect(menuDoGerente).toContain('manutencao');
    expect(menuDoGerente).toContain('analytics');
    expect(menuDoGerente).toContain('novo-usuario');
    expect(menuDoGerente).not.toContain('usuarios');
  });

  it('administrador vê todos os itens do menu', () => {
    expect(ids(itensDasPermissoes(PERMISSOES_ADMIN))).toEqual(ids(ITENS_MENU));
  });

  it('gerente com USER_VIEW delegado passa a ver a lista de Usuários', () => {
    const permissoes = [...PERMISSOES_FLEET_MANAGER, 'USER_VIEW'];
    expect(ids(itensDasPermissoes(permissoes))).toContain('usuarios');
  });

  it('sem nenhuma permission só aparecem os itens abertos a todos', () => {
    expect(ids(itensDasPermissoes([]))).toEqual(['dashboard', 'frota']);
  });
});

describe('item ativo do menu', () => {
  it('a Frota fica ativa em /fleet/drivers (mesmo prefixo)', () => {
    expect(itemEstaAtivo(acharItem('frota'), '/fleet/drivers')).toBe(true);
  });

  it('ignora query string e hash', () => {
    expect(itemEstaAtivo(acharItem('viagens'), '/trips?status=IN_PROGRESS#topo')).toBe(true);
  });

  it('prefixo parecido não conta: /tripsxyz não ativa Viagens', () => {
    expect(itemEstaAtivo(acharItem('viagens'), '/tripsxyz')).toBe(false);
  });

  it('/admin/users/new ativa só "Novo usuário", não "Usuários"', () => {
    expect(itemEstaAtivo(acharItem('novo-usuario'), '/admin/users/new')).toBe(true);
    expect(itemEstaAtivo(acharItem('usuarios'), '/admin/users/new')).toBe(false);
  });

  it('/admin/users e o detalhe de um usuário ativam "Usuários"', () => {
    expect(itemEstaAtivo(acharItem('usuarios'), '/admin/users')).toBe(true);
    expect(itemEstaAtivo(acharItem('usuarios'), '/admin/users/0b7e6f3a-51d4')).toBe(true);
  });
});

describe('indicador do menu', () => {
  function montarMenu(comItemAtivo: boolean): HTMLElement {
    const menu = document.createElement('nav');
    const item = document.createElement('a');
    item.className = 'vf-menu__item';
    if (comItemAtivo) {
      item.classList.add('vf-menu__item--ativo');
    }
    menu.appendChild(item);
    return menu;
  }

  it('com item ativo, acende o indicador', () => {
    const menu = montarMenu(true);
    posicionarIndicador(menu);
    expect(menu.style.getPropertyValue('--indicador-opacidade')).toBe('1');
  });

  it('sem item ativo (ex: /minha-conta), apaga o indicador', () => {
    const menu = montarMenu(false);
    posicionarIndicador(menu);
    expect(menu.style.getPropertyValue('--indicador-opacidade')).toBe('0');
  });

  it('só liga a animação no quadro seguinte, para o indicador não "voar" ao abrir', () => {
    const menu = montarMenu(true);
    const espiao = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((funcao) => {
      funcao(0);
      return 1;
    });
    expect(menu.classList.contains('vf-menu--animar')).toBe(false);
    ligarAnimacaoDoIndicador(menu);
    expect(menu.classList.contains('vf-menu--animar')).toBe(true);
    espiao.mockRestore();
  });

  it('sem menu na tela, não quebra', () => {
    expect(() => posicionarIndicador(null)).not.toThrow();
    expect(() => ligarAnimacaoDoIndicador(undefined)).not.toThrow();
  });
});
