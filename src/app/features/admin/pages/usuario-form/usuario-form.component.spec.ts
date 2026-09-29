import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { of } from 'rxjs';

import { montarRespostaLogin } from '../../../../../testing/apoio';
import { PAPEIS, PESSOAS, SENHA_VALIDA } from '../../../../../testing/dados-reais';
import { provedoresDeTraducao } from '../../../../../testing/traducao';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { DadosModule } from '../../../../shared/dados/dados.module';
import { UsuariosService } from '../../services/usuarios.service';
import { UsuarioFormComponent } from './usuario-form.component';

describe('Formulário de novo usuário', () => {
  let criar: jest.Mock;
  let confirmarAcao: jest.Mock;

  const papeis = [
    { id: PAPEIS.admin.id, name: 'ADMIN', description: 'Administrador' },
    { id: PAPEIS.gerente.id, name: 'FLEET_MANAGER', description: 'Gerente de frota' },
    { id: PAPEIS.driver.id, name: 'DRIVER', description: 'Motorista' },
  ];

  // Entra como uma pessoa do elenco e abre a tela.
  async function abrirComo(pessoa: typeof PESSOAS.patricia | typeof PESSOAS.roberto): Promise<void> {
    localStorage.clear();
    const sessao = montarRespostaLogin(pessoa);
    localStorage.setItem('access_token', sessao.accessToken);
    localStorage.setItem('user', JSON.stringify(sessao.user));
    criar = jest.fn().mockReturnValue(of({ id: 'novo', fullName: 'x' }));
    confirmarAcao = jest.fn().mockResolvedValue(true);

    await render(UsuarioFormComponent, {
      declarations: [UsuarioFormComponent],
      imports: [DadosModule],
      providers: [
        provideRouter([]),
        ...provedoresDeTraducao(),
        { provide: AuthService, useValue: { login: jest.fn(), refreshToken: jest.fn() } },
        { provide: UsuariosService, useValue: { listarPapeis: () => of(papeis), criar: criar } },
        { provide: ConfirmacaoService, useValue: { confirmarAcao: confirmarAcao } },
        { provide: NotificationService, useValue: { sucesso: jest.fn(), erro: jest.fn() } },
      ],
    });
    await waitFor(() => expect(document.getElementById('campo-usuario-papel')).toBeInTheDocument());
  }

  function campo(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
  }

  function digitar(id: string, valor: string): void {
    fireEvent.input(campo(id), { target: { value: valor } });
  }

  function escolherPapel(idDoPapel: string): void {
    fireEvent.change(campo('campo-usuario-papel'), { target: { value: idDoPapel } });
  }

  function preencherBasico(pessoa: typeof PESSOAS.juliana, senha: string): void {
    digitar('campo-usuario-nome', pessoa.nomeCompleto);
    digitar('campo-usuario-email', pessoa.email);
    digitar('campo-usuario-senha', senha);
  }

  function enviar(): void {
    fireEvent.click(document.getElementById('botao-criar-usuario') as HTMLButtonElement);
  }

  afterEach(() => {
    TestBed.inject(AuthStateService).limparSessao();
    localStorage.clear();
  });

  it('administrador escolhe entre os 3 papéis, na ordem motorista, gerente e admin', async () => {
    await abrirComo(PESSOAS.roberto);
    const opcoes = Array.from(campo('campo-usuario-papel').querySelectorAll('option')).map((opcao) => opcao.textContent?.trim());
    expect(opcoes.slice(1)).toEqual(['Motorista', 'Gestor de frota', 'Administrador']);
  });

  it('gerente só pode criar motorista: a única opção já vem escolhida e o bloco de CNH aparece', async () => {
    await abrirComo(PESSOAS.patricia);
    const opcoesReais = Array.from(campo('campo-usuario-papel').querySelectorAll('option')).filter((opcao) => opcao.value !== '');
    expect(opcoesReais).toHaveLength(1);
    expect(campo('campo-usuario-papel').value).toBe(PAPEIS.driver.id);
    expect(await screen.findByRole('group')).toBeInTheDocument();
    expect(document.getElementById('bloco-dados-motorista')).toBeInTheDocument();
  });

  it('o bloco de CNH só aparece para o papel DRIVER', async () => {
    await abrirComo(PESSOAS.roberto);
    expect(document.getElementById('bloco-dados-motorista')).toBeNull();
    escolherPapel(PAPEIS.driver.id);
    await waitFor(() => expect(document.getElementById('bloco-dados-motorista')).toBeInTheDocument());
    escolherPapel(PAPEIS.gerente.id);
    await waitFor(() => expect(document.getElementById('bloco-dados-motorista')).toBeNull());
  });

  it('senha com 7 caracteres é recusada e nada é enviado (mínimo 8)', async () => {
    await abrirComo(PESSOAS.roberto);
    escolherPapel(PAPEIS.gerente.id);
    preencherBasico(PESSOAS.patricia as never, 'Frota@2');
    enviar();
    await waitFor(() => expect(campo('campo-usuario-senha')).toHaveAttribute('aria-invalid', 'true'));
    expect(confirmarAcao).not.toHaveBeenCalled();
    expect(criar).not.toHaveBeenCalled();
  });

  it('campo de senha não deixa passar de 15 caracteres', async () => {
    await abrirComo(PESSOAS.roberto);
    expect(campo('campo-usuario-senha')).toHaveAttribute('maxlength', '15');
  });

  it('CNH aceita só números: letras e pontos digitados são removidos na hora', async () => {
    await abrirComo(PESSOAS.patricia);
    await screen.findByRole('group');
    digitar('campo-usuario-cnh', '048.217.365-90');
    expect(campo('campo-usuario-cnh').value).toBe('04821736590');
  });

  it('CNH com 10 dígitos é recusada para motorista', async () => {
    await abrirComo(PESSOAS.patricia);
    await screen.findByRole('group');
    preencherBasico(PESSOAS.juliana, SENHA_VALIDA);
    digitar('campo-usuario-cnh', '0739452816');
    digitar('campo-usuario-validade-cnh', PESSOAS.juliana.validadeCnh);
    enviar();
    await waitFor(() => expect(campo('campo-usuario-cnh')).toHaveAttribute('aria-invalid', 'true'));
    expect(criar).not.toHaveBeenCalled();
  });

  it('validade da CNH no passado é recusada', async () => {
    await abrirComo(PESSOAS.patricia);
    await screen.findByRole('group');
    preencherBasico(PESSOAS.juliana, SENHA_VALIDA);
    digitar('campo-usuario-cnh', PESSOAS.juliana.cnh);
    digitar('campo-usuario-validade-cnh', '2024-01-10');
    enviar();
    await waitFor(() => expect(campo('campo-usuario-validade-cnh')).toHaveAttribute('aria-invalid', 'true'));
    expect(criar).not.toHaveBeenCalled();
  });

  it('cria motorista: confirma, envia o bloco driver e vai para /admin/users', async () => {
    await abrirComo(PESSOAS.roberto);
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    escolherPapel(PAPEIS.driver.id);
    await screen.findByRole('group');
    preencherBasico(PESSOAS.juliana, SENHA_VALIDA);
    digitar('campo-usuario-cnh', PESSOAS.juliana.cnh);
    digitar('campo-usuario-validade-cnh', PESSOAS.juliana.validadeCnh);
    enviar();

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    expect(confirmarAcao).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith({
      email: 'juliana.barbosa@velocityfleet.com.br',
      password: 'Frota@2026',
      fullName: 'Juliana Souza Barbosa',
      roleId: PAPEIS.driver.id,
      driver: { licenseNumber: '07394528164', licenseExpiry: '2030-11-02' },
    });
    await waitFor(() => expect(navegar).toHaveBeenCalledWith(['/admin/users']));
  });

  it('cria gerente: o corpo vai SEM o bloco driver e o e-mail em minúsculas', async () => {
    await abrirComo(PESSOAS.roberto);
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    escolherPapel(PAPEIS.gerente.id);
    digitar('campo-usuario-nome', ' Patrícia Lemos Figueiredo ');
    digitar('campo-usuario-email', 'Patricia.Figueiredo@VelocityFleet.com.br');
    digitar('campo-usuario-senha', SENHA_VALIDA);
    enviar();

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    const corpo = criar.mock.calls[0][0];
    expect('driver' in corpo).toBe(false);
    expect(corpo.email).toBe('patricia.figueiredo@velocityfleet.com.br');
    expect(corpo.fullName).toBe('Patrícia Lemos Figueiredo');
    expect(corpo.roleId).toBe(PAPEIS.gerente.id);
  });

  it('cancelar na confirmação NÃO cria o usuário', async () => {
    await abrirComo(PESSOAS.roberto);
    confirmarAcao.mockResolvedValue(false);
    escolherPapel(PAPEIS.gerente.id);
    preencherBasico(PESSOAS.juliana, SENHA_VALIDA);
    enviar();
    await waitFor(() => expect(confirmarAcao).toHaveBeenCalledTimes(1));
    expect(criar).not.toHaveBeenCalled();
  });
});
