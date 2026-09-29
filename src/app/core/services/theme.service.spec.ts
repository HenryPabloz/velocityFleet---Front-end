import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

// Simula o tema do sistema (claro ou escuro) e guarda o ouvinte para avisar quando mudar.
function simularSistema(escuro: boolean): { avisarMudanca: (novoEscuro: boolean) => void } {
  let ouvinte: ((evento: { matches: boolean }) => void) | null = null;
  window.matchMedia = jest.fn().mockImplementation(() => ({
    matches: escuro,
    addEventListener: (_tipo: string, funcao: (evento: { matches: boolean }) => void) => {
      ouvinte = funcao;
    },
    removeEventListener: () => {},
  }));
  return {
    avisarMudanca: (novoEscuro: boolean) => {
      if (ouvinte) {
        ouvinte({ matches: novoEscuro });
      }
    },
  };
}

describe('ThemeService', () => {
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-bs-theme');
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
    localStorage.clear();
  });

  it('sem escolha salva, segue o sistema escuro e fica em modo automático', () => {
    simularSistema(true);
    const servico = TestBed.inject(ThemeService);
    expect(servico.temaAtual).toBe('dark');
    expect(servico.modoAtual).toBe('auto');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('sem escolha salva e sistema claro, começa claro', () => {
    simularSistema(false);
    expect(TestBed.inject(ThemeService).temaAtual).toBe('light');
  });

  it('a escolha salva do usuário vale mais que o sistema', () => {
    simularSistema(true);
    localStorage.setItem('vf_tema', 'light');
    const servico = TestBed.inject(ThemeService);
    expect(servico.temaAtual).toBe('light');
    expect(servico.modoAtual).toBe('light');
  });

  it('valor salvo inválido é ignorado', () => {
    simularSistema(false);
    localStorage.setItem('vf_tema', 'roxo');
    expect(TestBed.inject(ThemeService).modoAtual).toBe('auto');
  });

  it('alternar troca claro por escuro, aplica no <html> e salva a escolha', () => {
    simularSistema(false);
    const servico = TestBed.inject(ThemeService);
    servico.alternar();
    expect(servico.temaAtual).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('vf_tema')).toBe('dark');
    servico.alternar();
    expect(servico.temaAtual).toBe('light');
    expect(localStorage.getItem('vf_tema')).toBe('light');
  });

  it('modo automático apaga a escolha salva e volta a seguir o sistema', () => {
    simularSistema(true);
    localStorage.setItem('vf_tema', 'light');
    const servico = TestBed.inject(ThemeService);
    servico.definirModo('auto');
    expect(localStorage.getItem('vf_tema')).toBeNull();
    expect(servico.modoAtual).toBe('auto');
    expect(servico.temaAtual).toBe('dark');
  });

  it('em modo automático acompanha o sistema quando ele muda', () => {
    const sistema = simularSistema(false);
    const servico = TestBed.inject(ThemeService);
    sistema.avisarMudanca(true);
    expect(servico.temaAtual).toBe('dark');
    sistema.avisarMudanca(false);
    expect(servico.temaAtual).toBe('light');
  });

  it('com escolha manual, a mudança do sistema não troca o tema', () => {
    const sistema = simularSistema(false);
    const servico = TestBed.inject(ThemeService);
    servico.definirModo('light');
    sistema.avisarMudanca(true);
    expect(servico.temaAtual).toBe('light');
  });

  it('sem localStorage (modo privado) o tema ainda muda na sessão', () => {
    simularSistema(false);
    const servico = TestBed.inject(ThemeService);
    const espiao = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    servico.definir('dark');
    expect(servico.temaAtual).toBe('dark');
    espiao.mockRestore();
  });
});
