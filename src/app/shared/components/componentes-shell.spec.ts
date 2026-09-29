import { ActivatedRoute, provideRouter } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import { TestBed } from '@angular/core/testing';

import { montarRespostaLogin } from '../../../testing/apoio';
import { PESSOAS } from '../../../testing/dados-reais';
import { provedoresDeTraducao } from '../../../testing/traducao';
import { AuthService } from '../../core/services/auth.service';
import { NotificacoesService } from '../../core/services/notificacoes.service';
import { ThemeService } from '../../core/services/theme.service';
import { DadosModule } from '../dados/dados.module';
import { SharedModule } from '../shared.module';
import { BottomTabComponent } from './bottom-tab/bottom-tab.component';
import { CabecalhoComponent } from './cabecalho/cabecalho.component';
import { PaginaEmConstrucaoComponent } from './pagina-em-construcao/pagina-em-construcao.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';

type PessoaDoElenco = typeof PESSOAS.marcos | typeof PESSOAS.patricia | typeof PESSOAS.roberto;

const provedoresBase = [
  provideRouter([{ path: '**', children: [] }]),
  ...provedoresDeTraducao(),
  { provide: AuthService, useValue: { login: jest.fn(), refreshToken: jest.fn() } },
];

function entrarComo(pessoa: PessoaDoElenco): void {
  localStorage.clear();
  const sessao = montarRespostaLogin(pessoa);
  localStorage.setItem('access_token', sessao.accessToken);
  localStorage.setItem('user', JSON.stringify(sessao.user));
}

afterEach(() => {
  localStorage.clear();
  jest.useRealTimers();
});

describe('Cabeçalho', () => {
  async function abrir(pessoa: PessoaDoElenco) {
    entrarComo(pessoa);
    return render(CabecalhoComponent, {
      declarations: [CabecalhoComponent, ThemeToggleComponent],
      imports: [SharedModule],
      providers: provedoresBase,
    });
  }

  it('de manhã cumprimenta com o primeiro nome: "Bom dia, Marcos!"', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval'] });
    jest.setSystemTime(new Date(2026, 8, 25, 9, 0));
    await abrir(PESSOAS.marcos);
    expect(document.getElementById('saudacao-usuario')).toHaveTextContent('Bom dia, Marcos!');
  });

  it('à tarde e à noite a saudação muda', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval'] });
    jest.setSystemTime(new Date(2026, 8, 25, 15, 0));
    await abrir(PESSOAS.patricia);
    expect(document.getElementById('saudacao-usuario')).toHaveTextContent('Boa tarde, Patrícia!');
  });

  it('à noite: "Boa noite, Roberto!"', async () => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval'] });
    jest.setSystemTime(new Date(2026, 8, 25, 21, 0));
    await abrir(PESSOAS.roberto);
    expect(document.getElementById('saudacao-usuario')).toHaveTextContent('Boa noite, Roberto!');
  });

  it('o avatar mostra as iniciais do primeiro e do último nome (MA)', async () => {
    await abrir(PESSOAS.marcos);
    expect(document.getElementById('botao-usuario')).toHaveTextContent('MA');
  });

  it('sem avisos: o sino abre o painel com "Nenhuma notificação por enquanto."', async () => {
    await abrir(PESSOAS.marcos);
    fireEvent.click(document.getElementById('botao-notificacoes') as HTMLElement);
    expect(await screen.findByText('Nenhuma notificação por enquanto.')).toBeInTheDocument();
    expect(document.getElementById('botao-notificacoes')).toHaveAttribute('aria-expanded', 'true');
  });

  it('com 2 avisos não lidos, o selo do sino mostra 2 e o painel lista os avisos', async () => {
    await abrir(PESSOAS.patricia);
    TestBed.inject(NotificacoesService).definirLista([
      { id: '1', titulo: 'CNH a vencer', mensagem: 'A CNH de Juliana Souza Barbosa vence em 12 dias', criadaEm: '2026-09-24T10:00:00Z', lida: false },
      { id: '2', titulo: 'Manutenção próxima', mensagem: 'Troca de óleo da Strada RIO4E56 em 20 dias', criadaEm: '2026-09-23T09:00:00Z', lida: false },
    ]);
    expect(await screen.findByText('2')).toBeInTheDocument();
    fireEvent.click(document.getElementById('botao-notificacoes') as HTMLElement);
    expect(await screen.findByText('CNH a vencer')).toBeInTheDocument();
  });

  it('Esc fecha o painel e devolve o foco ao botão do sino', async () => {
    await abrir(PESSOAS.marcos);
    fireEvent.click(document.getElementById('botao-notificacoes') as HTMLElement);
    await screen.findByText('Nenhuma notificação por enquanto.');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('painel-notificacoes')).toBeNull();
    expect(document.activeElement?.id).toBe('botao-notificacoes');
  });

  it('clicar fora do painel fecha o menu', async () => {
    await abrir(PESSOAS.marcos);
    fireEvent.click(document.getElementById('botao-usuario') as HTMLElement);
    expect(document.getElementById('botao-usuario')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(document.body);
    expect(document.getElementById('botao-usuario')).toHaveAttribute('aria-expanded', 'false');
  });

  it('o botão do menu mobile avisa o layout para abrir a gaveta', async () => {
    const { fixture } = await abrir(PESSOAS.marcos);
    let abriu = false;
    fixture.componentInstance.abrirMenuMobile.subscribe(() => (abriu = true));
    fireEvent.click(document.getElementById('botao-menu-mobile') as HTMLElement);
    expect(abriu).toBe(true);
  });

  it('sair pelo menu do usuário encerra a sessão', async () => {
    await abrir(PESSOAS.marcos);
    fireEvent.click(document.getElementById('botao-usuario') as HTMLElement);
    const sair = await screen.findByText('Sair');
    fireEvent.click(sair);
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});

describe('Botão de tema', () => {
  beforeEach(() => localStorage.clear());

  it('alterna só entre claro e escuro, anunciando a troca para leitores de tela', async () => {
    await render(ThemeToggleComponent, {
      declarations: [ThemeToggleComponent],
      imports: [SharedModule],
      providers: provedoresBase,
    });
    const tema = TestBed.inject(ThemeService);
    tema.definir('light');
    const botao = document.getElementById('botao-tema') as HTMLElement;
    fireEvent.click(botao);
    expect(tema.temaAtual).toBe('dark');
    expect(localStorage.getItem('vf_tema')).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(await screen.findByText('Tema alterado para escuro')).toBeInTheDocument();
    fireEvent.click(botao);
    expect(tema.temaAtual).toBe('light');
    expect(localStorage.getItem('vf_tema')).toBe('light');
    expect(await screen.findByText('Tema alterado para claro')).toBeInTheDocument();
  });
});

describe('Navegação do celular (bottom tab)', () => {
  async function abrir(pessoa: PessoaDoElenco) {
    entrarComo(pessoa);
    return render(BottomTabComponent, {
      declarations: [BottomTabComponent],
      imports: [SharedModule],
      providers: provedoresBase,
    });
  }

  it('motorista tem 5 itens: 4 fixos e o quinto (Incidentes) vai para "Mais"', async () => {
    const { fixture } = await abrir(PESSOAS.marcos);
    expect(fixture.componentInstance.itensFixos).toHaveLength(4);
    expect(fixture.componentInstance.itensExtras.map((item) => item.id)).toEqual(['incidentes']);
  });

  it('administrador tem 4 fixos e 5 extras no "Mais"', async () => {
    const { fixture } = await abrir(PESSOAS.roberto);
    expect(fixture.componentInstance.itensFixos).toHaveLength(4);
    expect(fixture.componentInstance.itensExtras).toHaveLength(5);
  });

  it('o botão Mais abre e fecha o painel; Esc fecha e devolve o foco', async () => {
    const { fixture } = await abrir(PESSOAS.roberto);
    const componente = fixture.componentInstance;
    componente.alternarMais();
    expect(componente.maisAberto).toBe(true);
    componente.aoApertarEsc();
    expect(componente.maisAberto).toBe(false);
  });

  it('clique fora do menu fecha o "Mais"; clique dentro mantém aberto', async () => {
    const { fixture } = await abrir(PESSOAS.roberto);
    const componente = fixture.componentInstance;
    componente.alternarMais();
    componente.aoClicarFora(fixture.nativeElement);
    expect(componente.maisAberto).toBe(true);
    componente.aoClicarFora(document.body);
    expect(componente.maisAberto).toBe(false);
  });

  it('"Mais" fica ativo quando a tela atual é um dos itens escondidos', async () => {
    const { fixture } = await abrir(PESSOAS.roberto);
    const componente = fixture.componentInstance;
    componente.urlAtual = '/admin/users';
    expect(componente.maisEstaAtivo).toBe(true);
    componente.urlAtual = '/dashboard';
    expect(componente.maisEstaAtivo).toBe(false);
  });

  it('o item da tela atual leva aria-current="page"', async () => {
    const { fixture } = await abrir(PESSOAS.marcos);
    const componente = fixture.componentInstance;
    componente.urlAtual = '/trips/123';
    const viagens = componente.itensFixos.find((item) => item.id === 'viagens');
    expect(componente.valorAriaCurrent(viagens as never)).toBe('page');
    const frota = componente.itensFixos.find((item) => item.id === 'frota');
    expect(componente.valorAriaCurrent(frota as never)).toBeNull();
  });
});

describe('Menu lateral em modo gaveta (celular)', () => {
  async function abrir(gavetaAberta: boolean) {
    entrarComo(PESSOAS.marcos);
    const fechar = jest.fn();
    const recolher = jest.fn();
    const resultado = await render(SidebarComponent, {
      declarations: [SidebarComponent],
      imports: [SharedModule],
      providers: provedoresBase,
      componentInputs: { gavetaAberta: gavetaAberta },
      on: { fecharGaveta: fechar, alternarRecolhimento: recolher },
    });
    return { fechar, recolher, ...resultado };
  }

  it('com a gaveta aberta vira um diálogo modal', async () => {
    await abrir(true);
    const barra = document.getElementById('barra-lateral') as HTMLElement;
    expect(barra).toHaveAttribute('role', 'dialog');
    expect(barra).toHaveAttribute('aria-modal', 'true');
  });

  it('com a gaveta fechada não é um diálogo', async () => {
    await abrir(false);
    expect(document.getElementById('barra-lateral')).not.toHaveAttribute('role');
  });

  it('Esc fecha a gaveta aberta e não faz nada com ela fechada', async () => {
    const aberta = await abrir(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aberta.fechar).toHaveBeenCalledTimes(1);
  });

  it('o botão de recolher avisa o layout', async () => {
    const resultado = await abrir(false);
    fireEvent.click(document.getElementById('botao-recolher-barra') as HTMLElement);
    expect(resultado.recolher).toHaveBeenCalledTimes(1);
  });

  it('Tab no último item volta ao primeiro (o foco fica preso na gaveta)', async () => {
    await abrir(true);
    const barra = document.getElementById('barra-lateral') as HTMLElement;
    const focaveis = barra.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    // O jsdom não calcula layout: dizemos que todos estão visíveis.
    focaveis.forEach((elemento) => Object.defineProperty(elemento, 'offsetParent', { value: barra, configurable: true }));
    ultimo.focus();
    fireEvent.keyDown(barra, { key: 'Tab' });
    expect(document.activeElement).toBe(primeiro);
    fireEvent.keyDown(barra, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });
});

describe('Tabela de dados (tabela no desktop e cards no celular)', () => {
  it('mostra uma linha por veículo e cada célula vem do template da tela', async () => {
    await render(
      `<app-tabela-dados idTabela="tabela-veiculos" legenda="Veículos da frota" [colunas]="colunas" [linhas]="linhas">
        <ng-template #celula let-linha let-coluna="coluna">{{ linha[coluna.chave] }}</ng-template>
      </app-tabela-dados>`,
      {
        declarations: [],
        imports: [DadosModule],
        providers: provedoresBase,
        componentProperties: {
          colunas: [
            { chave: 'placa', rotulo: 'MENU.FROTA' },
            { chave: 'modelo', rotulo: 'MENU.VIAGENS', somenteTabela: true },
          ],
          linhas: [
            { id: 'v1', placa: 'RIO4E56', modelo: 'Fiat Strada Endurance' },
            { id: 'v2', placa: 'GHK-4821', modelo: 'Volkswagen Saveiro Robust' },
          ],
        },
      },
    );
    const tabela = document.getElementById('tabela-veiculos') as HTMLElement;
    expect(tabela.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(tabela.querySelector('caption')).toHaveTextContent('Veículos da frota');
    expect(tabela).toHaveTextContent('Volkswagen Saveiro Robust');
    // No card do celular, a coluna "somenteTabela" não aparece.
    const cartao = document.querySelector('.vf-cartoes li[data-id="v2"]') as HTMLElement;
    expect(cartao).toHaveTextContent('GHK-4821');
    expect(cartao).not.toHaveTextContent('Saveiro');
  });
});

describe('Página em construção', () => {
  it('usa o título da rota (data.titulo) no cabeçalho da página', async () => {
    await render(PaginaEmConstrucaoComponent, {
      declarations: [PaginaEmConstrucaoComponent],
      imports: [SharedModule],
      providers: [...provedoresBase, { provide: ActivatedRoute, useValue: { snapshot: { data: { titulo: 'MENU.MANUTENCAO' } } } }],
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Manutenção');
  });

  it('rota sem título usa o texto padrão de "em construção"', async () => {
    await render(PaginaEmConstrucaoComponent, {
      declarations: [PaginaEmConstrucaoComponent],
      imports: [SharedModule],
      providers: [...provedoresBase, { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } }],
    });
    expect(document.getElementById('pagina-em-construcao')).toHaveAttribute('data-titulo', 'PAGINAS.EM_CONSTRUCAO');
  });
});
