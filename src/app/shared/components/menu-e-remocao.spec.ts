import { provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';

import { montarRespostaLogin } from '../../../testing/apoio';
import { PESSOAS } from '../../../testing/dados-reais';
import { provedoresDeTraducao } from '../../../testing/traducao';
import { AuthService } from '../../core/services/auth.service';
import { AcoesRemocaoComponent } from '../dados/components/acoes-remocao/acoes-remocao.component';
import { ConfirmacaoService } from '../dados/components/modal-confirmar/modal-confirmar.component';
import { DadosModule } from '../dados/dados.module';
import { SidebarComponent } from './sidebar/sidebar.component';
import { SharedModule } from '../shared.module';

type PessoaDoElenco = typeof PESSOAS.marcos | typeof PESSOAS.patricia | typeof PESSOAS.roberto;

function entrarComo(pessoa: PessoaDoElenco): void {
  localStorage.clear();
  const sessao = montarRespostaLogin(pessoa);
  localStorage.setItem('access_token', sessao.accessToken);
  localStorage.setItem('user', JSON.stringify(sessao.user));
}

const provedoresBase = [
  provideRouter([{ path: '**', children: [] }]),
  ...provedoresDeTraducao(),
  { provide: AuthService, useValue: { login: jest.fn(), refreshToken: jest.fn() } },
  { provide: ConfirmacaoService, useValue: { confirmar: jest.fn() } },
];

afterEach(() => {
  localStorage.clear();
});

describe('Menu lateral filtrado por permission', () => {
  async function abrirMenu(pessoa: PessoaDoElenco): Promise<string[]> {
    entrarComo(pessoa);
    await render(SidebarComponent, {
      declarations: [SidebarComponent],
      imports: [SharedModule],
      providers: provedoresBase,
    });
    const links = document.querySelectorAll('#menu-principal a[data-item]');
    return Array.from(links).map((link) => link.getAttribute('data-item') as string);
  }

  it('motorista vê Dashboard, Frota, Viagens, Abastecimentos e Incidentes', async () => {
    expect(await abrirMenu(PESSOAS.marcos)).toEqual(['dashboard', 'frota', 'viagens', 'abastecimentos', 'incidentes']);
  });

  it('gerente vê também Manutenção, Analytics e Novo usuário, mas não a lista de Usuários', async () => {
    const itens = await abrirMenu(PESSOAS.patricia);
    expect(itens).toEqual(expect.arrayContaining(['manutencao', 'analytics', 'novo-usuario']));
    expect(itens).not.toContain('usuarios');
  });

  it('administrador vê o menu completo, incluindo Usuários', async () => {
    const itens = await abrirMenu(PESSOAS.roberto);
    expect(itens).toContain('usuarios');
    expect(itens).toHaveLength(9);
  });

  it('o texto de cada item vem do idioma pt-BR', async () => {
    await abrirMenu(PESSOAS.marcos);
    expect(screen.getByRole('link', { name: /Abastecimentos/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Manutenção/ })).toBeNull();
  });

  it('o botão Sair encerra a sessão e apaga o token', async () => {
    await abrirMenu(PESSOAS.marcos);
    fireEvent.click(document.getElementById('botao-sair') as HTMLButtonElement);
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('Ações de remoção nas linhas das listas', () => {
  async function abrirAcoes(pessoa: PessoaDoElenco, removido: boolean, recurso = 'VEHICLE'): Promise<{ excluir: jest.Mock; restaurar: jest.Mock; definitivo: jest.Mock }> {
    entrarComo(pessoa);
    const excluir = jest.fn();
    const restaurar = jest.fn();
    const definitivo = jest.fn();
    await render(AcoesRemocaoComponent, {
      declarations: [AcoesRemocaoComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { recurso: recurso, removido: removido },
      on: { excluir: excluir, restaurar: restaurar, excluirDefinitivo: definitivo },
    });
    return { excluir, restaurar, definitivo };
  }

  function botao(acao: string): HTMLElement | null {
    return document.querySelector('[data-acao="' + acao + '"]');
  }

  it('motorista não vê nenhum botão de remoção', async () => {
    await abrirAcoes(PESSOAS.marcos, false);
    expect(botao('excluir')).toBeNull();
    expect(botao('restaurar')).toBeNull();
    expect(botao('excluir-definitivo')).toBeNull();
  });

  it('gerente vê "Excluir" de veículo, mas não a exclusão definitiva', async () => {
    await abrirAcoes(PESSOAS.patricia, false);
    expect(botao('excluir')).not.toBeNull();
    expect(botao('excluir-definitivo')).toBeNull();
  });

  it('gerente não vê "Excluir" de viagem (TRIP_DELETE é do ADMIN)', async () => {
    await abrirAcoes(PESSOAS.patricia, false, 'TRIP');
    expect(botao('excluir')).toBeNull();
  });

  it('na aba Removidos o gerente vê "Restaurar" e não "Excluir"', async () => {
    await abrirAcoes(PESSOAS.patricia, true);
    expect(botao('restaurar')).not.toBeNull();
    expect(botao('excluir')).toBeNull();
  });

  it('administrador vê Excluir na lista ativa, mas Excluir definitivamente só aparece nos Removidos', async () => {
    await abrirAcoes(PESSOAS.roberto, false);
    expect(botao('excluir')).not.toBeNull();
    expect(botao('excluir-definitivo')).toBeNull();
  });

  it('na aba Removidos o administrador vê Excluir definitivamente', async () => {
    await abrirAcoes(PESSOAS.roberto, true);
    expect(botao('excluir-definitivo')).not.toBeNull();
  });

  it('clicar em Excluir avisa a tela (e só ela decide a confirmação)', async () => {
    const saidas = await abrirAcoes(PESSOAS.roberto, false);
    fireEvent.click(botao('excluir') as HTMLElement);
    expect(saidas.excluir).toHaveBeenCalledTimes(1);
    expect(saidas.definitivo).not.toHaveBeenCalled();
  });

  it('botão bloqueado (conta ADMIN protegida) não dispara nada e explica o motivo', async () => {
    entrarComo(PESSOAS.roberto);
    const excluir = jest.fn();
    await render(AcoesRemocaoComponent, {
      declarations: [AcoesRemocaoComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: {
        recurso: 'USER',
        removido: false,
        bloquearExcluir: true,
        motivoBloqueio: 'Não é possível excluir a própria conta',
      },
      on: { excluir: excluir },
    });
    const botaoExcluir = botao('excluir') as HTMLElement;
    expect(botaoExcluir).toHaveAttribute('aria-disabled', 'true');
    expect(botaoExcluir).toHaveAttribute('title', 'Não é possível excluir a própria conta');
    fireEvent.click(botaoExcluir);
    expect(excluir).not.toHaveBeenCalled();
  });

  it('viagem ativa não pode ser excluída: o botão nem aparece', async () => {
    entrarComo(PESSOAS.roberto);
    await render(AcoesRemocaoComponent, {
      declarations: [AcoesRemocaoComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { recurso: 'TRIP', removido: false, permitirExcluir: false },
    });
    expect(botao('excluir')).toBeNull();
  });
});
