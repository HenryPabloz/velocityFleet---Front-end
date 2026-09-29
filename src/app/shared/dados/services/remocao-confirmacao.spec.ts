import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { montarRespostaLogin } from '../../../../testing/apoio';
import { PESSOAS, VEICULOS } from '../../../../testing/dados-reais';
import { AuthService } from '../../../core/services/auth.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ConfirmacaoService } from '../components/modal-confirmar/modal-confirmar.component';
import { RemocaoService } from './remocao.service';

const API = environment.apiUrl;

// Tradutor que junta a chave com os parâmetros, para conferir o texto montado.
const traducao = {
  instant: (chave: string, parametros?: Record<string, string>) => {
    if (parametros) {
      return chave + '|' + JSON.stringify(parametros);
    }
    return chave;
  },
};

describe('ConfirmacaoService', () => {
  let abrir: jest.Mock;

  function criarServico(resultado: Promise<unknown>): { servico: ConfirmacaoService; instancia: { opcoes?: unknown } } {
    const instancia: { opcoes?: unknown } = {};
    abrir = jest.fn().mockReturnValue({ componentInstance: instancia, result: resultado });
    TestBed.configureTestingModule({
      providers: [
        { provide: NgbModal, useValue: { open: abrir } },
        { provide: TranslateService, useValue: traducao },
      ],
    });
    return { servico: TestBed.inject(ConfirmacaoService), instancia };
  }

  it('confirmarAcao devolve true quando o usuário clica no botão de confirmar', async () => {
    const { servico } = criarServico(Promise.resolve('confirmou'));
    const resposta = await servico.confirmarAcao('Criar veículo', 'Cadastrar a Strada RIO4E56?', 'Criar');
    expect(resposta).toBe(true);
  });

  it('confirmarAcao devolve false quando cancela, aperta Esc ou clica fora', async () => {
    const { servico } = criarServico(Promise.reject('cancelou'));
    const resposta = await servico.confirmarAcao('Criar veículo', 'Cadastrar a Strada RIO4E56?', 'Criar');
    expect(resposta).toBe(false);
  });

  it('monta as opções do modal com título, texto, verbo e botão Cancelar traduzido', async () => {
    const { servico, instancia } = criarServico(Promise.resolve(true));
    await servico.confirmarAcao('Excluir veículo', 'Excluir a Saveiro GHK-4821?', 'Excluir', true);
    expect(instancia.opcoes).toEqual({
      titulo: 'Excluir veículo',
      mensagem: 'Excluir a Saveiro GHK-4821?',
      textoConfirmar: 'Excluir',
      textoCancelar: 'COMUM.CANCELAR',
      perigo: true,
    });
  });

  it('por padrão a ação não é de perigo (botão não fica vermelho)', async () => {
    const { servico, instancia } = criarServico(Promise.resolve(true));
    await servico.confirmarAcao('Salvar', 'Salvar alterações?', 'Salvar');
    expect((instancia.opcoes as { perigo: boolean }).perigo).toBe(false);
  });

  it('o modal abre centralizado e com os ids de acessibilidade do título e do texto', async () => {
    const { servico } = criarServico(Promise.resolve(true));
    await servico.confirmarAcao('Salvar', 'Salvar alterações?', 'Salvar');
    const configuracao = abrir.mock.calls[0][1];
    expect(configuracao.centered).toBe(true);
    expect(configuracao.ariaLabelledBy).toBe('titulo-modal-confirmar');
    expect(configuracao.ariaDescribedBy).toBe('texto-modal-confirmar');
  });
});

describe('RemocaoService', () => {
  let servico: RemocaoService;
  let controle: HttpTestingController;
  let confirmar: jest.Mock;
  let authService: { login: jest.Mock };
  let estado: AuthStateService;

  function entrarComo(pessoa: typeof PESSOAS.marcos | typeof PESSOAS.patricia | typeof PESSOAS.roberto): void {
    authService.login.mockReturnValue(of(montarRespostaLogin(pessoa)));
    estado.login(pessoa.email, 'Frota@2026', 'vf_live_chave').subscribe();
  }

  beforeEach(() => {
    localStorage.clear();
    confirmar = jest.fn().mockResolvedValue(true);
    authService = { login: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: ConfirmacaoService, useValue: { confirmar: confirmar } },
        { provide: TranslateService, useValue: traducao },
      ],
    });
    servico = TestBed.inject(RemocaoService);
    controle = TestBed.inject(HttpTestingController);
    estado = TestBed.inject(AuthStateService);
  });

  afterEach(() => {
    controle.verify();
    estado.limparSessao();
    localStorage.clear();
  });

  it('gerente pode excluir e restaurar veículo, mas não viagem (só ADMIN)', () => {
    entrarComo(PESSOAS.patricia);
    expect(servico.podeExcluir('VEHICLE')).toBe(true);
    expect(servico.podeRestaurar('VEHICLE')).toBe(true);
    expect(servico.podeExcluir('TRIP')).toBe(false);
    expect(servico.podeRestaurar('TRIP')).toBe(false);
  });

  it('motorista não pode excluir nem restaurar nada', () => {
    entrarComo(PESSOAS.marcos);
    expect(servico.podeExcluir('VEHICLE')).toBe(false);
    expect(servico.podeRestaurar('INCIDENT')).toBe(false);
    expect(servico.podeExcluirDefinitivo()).toBe(false);
  });

  it('administrador pode tudo, inclusive a exclusão definitiva', () => {
    entrarComo(PESSOAS.roberto);
    expect(servico.podeExcluir('TRIP')).toBe(true);
    expect(servico.podeRestaurar('USER')).toBe(true);
    expect(servico.podeExcluirDefinitivo()).toBe(true);
  });

  it('exclusão definitiva vai para DELETE /<recurso>/:id/permanent', () => {
    servico.excluirDefinitivamente('vehicles', VEICULOS.strada.id).subscribe();
    const requisicao = controle.expectOne({ method: 'DELETE', url: API + '/vehicles/' + VEICULOS.strada.id + '/permanent' });
    requisicao.flush(null);
  });

  it('o 409 da API (veículo com viagens) chega intacto à tela', () => {
    let status = 0;
    servico.excluirDefinitivamente('vehicles', VEICULOS.saveiro.id).subscribe({ error: (erro) => (status = erro.status) });
    controle
      .expectOne(API + '/vehicles/' + VEICULOS.saveiro.id + '/permanent')
      .flush({ detail: 'Cannot permanently delete vehicle with trips' }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });

  it('confirmação irreversível usa botão de perigo e cita o nome do registro', async () => {
    const resposta = await servico.confirmarExclusaoDefinitiva('Saveiro GHK-4821');
    expect(resposta).toBe(true);
    const opcoes = confirmar.mock.calls[0][0];
    expect(opcoes.perigo).toBe(true);
    expect(opcoes.mensagem).toBe('REMOCAO.DEFINITIVA_TEXTO|{"nome":"Saveiro GHK-4821"}');
    expect(opcoes.textoCancelar).toBe('COMUM.CANCELAR');
  });

  it('aviso extra é acrescentado ao texto da confirmação', async () => {
    await servico.confirmarExclusaoDefinitiva('Marcos Vinícius Andrade', 'As viagens dele também serão apagadas.');
    const opcoes = confirmar.mock.calls[0][0];
    expect(opcoes.mensagem.endsWith(' As viagens dele também serão apagadas.')).toBe(true);
  });

  it('se o usuário cancelar, devolve false e nada é apagado', async () => {
    confirmar.mockResolvedValue(false);
    expect(await servico.confirmarExclusaoDefinitiva('Roberto Carvalho Neto')).toBe(false);
  });
});
