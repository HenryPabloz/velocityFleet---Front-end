// Move o indicador vermelho até o item ativo (a animação é uma transition do CSS).
export function posicionarIndicador(menu: HTMLElement | null | undefined): void {
  if (!menu) {
    return;
  }
  const ativo = menu.querySelector<HTMLElement>('.vf-menu__item--ativo');
  if (!ativo) {
    menu.style.setProperty('--indicador-opacidade', '0');
    return;
  }
  menu.style.setProperty('--indicador-x', ativo.offsetLeft + 'px');
  menu.style.setProperty('--indicador-y', ativo.offsetTop + 'px');
  menu.style.setProperty('--indicador-l', ativo.offsetWidth + 'px');
  menu.style.setProperty('--indicador-a', ativo.offsetHeight + 'px');
  menu.style.setProperty('--indicador-opacidade', '1');
}

// Só liga a transition depois da primeira posição, para o indicador não "voar" ao abrir.
export function ligarAnimacaoDoIndicador(menu: HTMLElement | null | undefined): void {
  if (!menu) {
    return;
  }
  requestAnimationFrame(() => {
    menu.classList.add('vf-menu--animar');
  });
}
