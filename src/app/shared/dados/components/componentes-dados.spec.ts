import { FormControl, Validators } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';

import { PESSOAS } from '../../../../testing/dados-reais';
import { provedoresDeTraducao } from '../../../../testing/traducao';
import { AuthService } from '../../../core/services/auth.service';
import { montarRespostaLogin } from '../../../../testing/apoio';
import { DadosModule } from '../dados.module';
import { AbasRemovidosComponent } from './abas-removidos/abas-removidos.component';
import { ModalConfirmarComponent } from './modal-confirmar/modal-confirmar.component';
import { EstadoPaginaComponent } from './estado-pagina/estado-pagina.component';
import { GrupoOpcoesComponent } from './grupo-opcoes/grupo-opcoes.component';
import { PaginacaoComponent } from './paginacao/paginacao.component';

const provedoresBase = [
  provideRouter([]),
  ...provedoresDeTraducao(),
  { provide: AuthService, useValue: { login: jest.fn(), refreshToken: jest.fn() } },
];

function entrarComo(pessoa: typeof PESSOAS.marcos | typeof PESSOAS.patricia | typeof PESSOAS.roberto): void {
  localStorage.clear();
  const sessao = montarRespostaLogin(pessoa);
  localStorage.setItem('access_token', sessao.accessToken);
  localStorage.setItem('user', JSON.stringify(sessao.user));
}

afterEach(() => localStorage.clear());

describe('Paginação', () => {
  async function abrir(pagina: number, totalPaginas: number, total: number) {
    const paginaMudou = jest.fn();
    await render(PaginacaoComponent, {
      declarations: [PaginacaoComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { paginacao: { page: pagina, pageSize: 10, total: total, totalPages: totalPaginas } },
      on: { paginaMudou: paginaMudou },
    });
    return paginaMudou;
  }

  it('mostra "Página 2 de 5 · 47 registros" e navega para a próxima e a anterior', async () => {
    const paginaMudou = await abrir(2, 5, 47);
    expect(screen.getByText('Página 2 de 5 · 47 registros')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Próxima'));
    expect(paginaMudou).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByText('Anterior'));
    expect(paginaMudou).toHaveBeenLastCalledWith(1);
  });

  it('na primeira página o "Anterior" fica desabilitado e não emite nada', async () => {
    const paginaMudou = await abrir(1, 3, 25);
    const anterior = document.querySelector('[data-acao="pagina-anterior"]') as HTMLButtonElement;
    expect(anterior).toBeDisabled();
    fireEvent.click(anterior);
    expect(paginaMudou).not.toHaveBeenCalled();
  });

  it('na última página o "Próxima" fica desabilitado', async () => {
    await abrir(3, 3, 25);
    expect(document.querySelector('[data-acao="pagina-proxima"]')).toBeDisabled();
  });

  it('lista sem registros não desenha a barra', async () => {
    await abrir(1, 0, 0);
    expect(document.querySelector('nav')).toBeNull();
  });
});

describe('Abas Ativos e Removidos', () => {
  async function abrir(pessoa: typeof PESSOAS.marcos | typeof PESSOAS.patricia, removidos: boolean) {
    entrarComo(pessoa);
    const mudou = jest.fn();
    await render(AbasRemovidosComponent, {
      declarations: [AbasRemovidosComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { recurso: 'VEHICLE', removidos: removidos, rotuloAtivos: 'Ativos', rotuloRemovidos: 'Removidos' },
      on: { mudou: mudou },
    });
    return mudou;
  }

  it('motorista (sem VEHICLE_RESTORE) não vê as abas', async () => {
    await abrir(PESSOAS.marcos, false);
    expect(document.getElementById('abas-removidos')).toBeNull();
  });

  it('gerente vê as abas e ao clicar em "Removidos" a tela é avisada', async () => {
    const mudou = await abrir(PESSOAS.patricia, false);
    fireEvent.click(document.getElementById('aba-removidos') as HTMLElement);
    expect(mudou).toHaveBeenCalledWith(true);
  });

  it('clicar na aba que já está aberta não emite nada', async () => {
    const mudou = await abrir(PESSOAS.patricia, true);
    fireEvent.click(document.getElementById('aba-removidos') as HTMLElement);
    expect(mudou).not.toHaveBeenCalled();
    expect(document.getElementById('aba-removidos')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Estado da página', () => {
  it('carregando: mostra o esqueleto com aria-busy e o texto para leitor de tela', async () => {
    await render(EstadoPaginaComponent, {
      declarations: [EstadoPaginaComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { estado: 'carregando', linhasEsqueleto: 3 },
    });
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Carregando…')).toBeInTheDocument();
    expect(document.querySelectorAll('.vf-estado-esqueleto__linha')).toHaveLength(3);
  });

  it('erro: mostra a mensagem e "Tentar de novo" pede nova tentativa', async () => {
    const tentarNovamente = jest.fn();
    await render(EstadoPaginaComponent, {
      declarations: [EstadoPaginaComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { estado: 'erro', mensagemErro: 'Sem conexão com o servidor.' },
      on: { tentarNovamente: tentarNovamente },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com o servidor.');
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(tentarNovamente).toHaveBeenCalledTimes(1);
  });

  it('vazio: mostra título e texto de "nenhum veículo"', async () => {
    await render(EstadoPaginaComponent, {
      declarations: [EstadoPaginaComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: { estado: 'vazio', tituloVazio: 'Nenhum veículo cadastrado', textoVazio: 'Cadastre a primeira placa.' },
    });
    expect(screen.getByText('Nenhum veículo cadastrado')).toBeInTheDocument();
    expect(screen.getByText('Cadastre a primeira placa.')).toBeInTheDocument();
  });
});

describe('Grupo de opções (cartões de rádio)', () => {
  const opcoes = [
    { valor: 'PREVENTIVE', rotulo: 'Preventiva' },
    { valor: 'CORRECTIVE', rotulo: 'Corretiva' },
    { valor: 'INSPECTION', rotulo: 'Inspeção' },
  ];

  async function abrir(controle: FormControl<string | null>) {
    await render(GrupoOpcoesComponent, {
      declarations: [GrupoOpcoesComponent],
      imports: [DadosModule],
      providers: provedoresBase,
      componentInputs: {
        idCampo: 'campo-manutencao-tipo',
        legenda: 'Tipo de manutenção',
        ajuda: 'Escolha o tipo.',
        obrigatorio: true,
        opcoes: opcoes,
        controle: controle,
        mensagens: { required: 'ERROS_CAMPO.OBRIGATORIO' },
      },
    });
  }

  it('escolher um cartão grava o valor no formulário', async () => {
    const controle = new FormControl<string | null>(null, Validators.required);
    await abrir(controle);
    fireEvent.click(screen.getByLabelText('Corretiva'));
    expect(controle.value).toBe('CORRECTIVE');
    expect(controle.touched).toBe(true);
  });

  it('a opção que já está no formulário aparece marcada', async () => {
    await abrir(new FormControl<string | null>('INSPECTION'));
    expect(screen.getByLabelText('Inspeção')).toBeChecked();
    expect(screen.getByLabelText('Preventiva')).not.toBeChecked();
  });

  it('sem escolha e depois de tocar, mostra "Campo obrigatório." e marca aria-invalid', async () => {
    const controle = new FormControl<string | null>(null, Validators.required);
    controle.markAsTouched();
    await abrir(controle);
    expect(screen.getByText('Campo obrigatório.')).toBeInTheDocument();
    expect(screen.getByLabelText('Preventiva')).toHaveAttribute('aria-invalid', 'true');
  });

  it('o erro que veio do servidor tem prioridade sobre as mensagens da tela', async () => {
    const controle = new FormControl<string | null>('PREVENTIVE');
    controle.setErrors({ servidor: 'Tipo não permitido para este veículo' });
    controle.markAsTouched();
    await abrir(controle);
    expect(screen.getByText('Tipo não permitido para este veículo')).toBeInTheDocument();
  });
});

describe('Modal de confirmação', () => {
  async function abrir(perigo: boolean) {
    const modal = { close: jest.fn(), dismiss: jest.fn() };
    await render(ModalConfirmarComponent, {
      declarations: [ModalConfirmarComponent],
      imports: [DadosModule],
      providers: [...provedoresBase, { provide: NgbActiveModal, useValue: modal }],
      componentProperties: {
        opcoes: {
          titulo: 'Excluir veículo',
          mensagem: 'Excluir a Saveiro GHK-4821?',
          textoConfirmar: 'Excluir',
          textoCancelar: 'Cancelar',
          perigo: perigo,
        },
      },
    });
    return modal;
  }

  it('ação comum: o foco começa no botão de confirmar', async () => {
    await abrir(false);
    expect(document.activeElement?.id).toBe('botao-confirmar');
  });

  it('ação de perigo: o foco começa em "Cancelar" (evita apagar sem querer com Enter)', async () => {
    await abrir(true);
    expect(document.activeElement?.id).toBe('botao-cancelar-modal');
  });

  it('confirmar e cancelar fecham o modal do jeito certo', async () => {
    const modal = await abrir(true);
    fireEvent.click(document.getElementById('botao-confirmar') as HTMLElement);
    expect(modal.close).toHaveBeenCalledWith(true);
    fireEvent.click(document.getElementById('botao-cancelar-modal') as HTMLElement);
    expect(modal.dismiss).toHaveBeenCalled();
  });

  it('o texto da confirmação cita o registro afetado', async () => {
    await abrir(true);
    expect(screen.getByText('Excluir a Saveiro GHK-4821?')).toBeInTheDocument();
  });
});
