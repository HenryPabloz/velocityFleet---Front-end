import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router, provideRouter } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { Subject } from 'rxjs';

import { montarRespostaLogin } from '../../../../../testing/apoio';
import { PESSOAS, SENHA_VALIDA } from '../../../../../testing/dados-reais';
import { provedoresDeTraducao } from '../../../../../testing/traducao';
import { LoginResponse } from '../../../../core/models';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { LoginComponent } from './login.component';

describe('Tela de login', () => {
  let estadoAuth: { login: jest.Mock };
  let respostaDoLogin: Subject<LoginResponse>;

  async function abrirLogin(): Promise<void> {
    respostaDoLogin = new Subject<LoginResponse>();
    estadoAuth = { login: jest.fn().mockReturnValue(respostaDoLogin) };
    await render(LoginComponent, {
      declarations: [LoginComponent],
      imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
      providers: [
        provideRouter([]),
        ...provedoresDeTraducao(),
        { provide: AuthStateService, useValue: estadoAuth },
      ],
    });
  }

  function campoEmail(): HTMLInputElement {
    return screen.getByLabelText('E-mail') as HTMLInputElement;
  }

  function campoSenha(): HTMLInputElement {
    return screen.getByLabelText('Senha') as HTMLInputElement;
  }

  function botaoEntrar(): HTMLButtonElement {
    return document.getElementById('botao-entrar') as HTMLButtonElement;
  }

  function preencher(email: string, senha: string): void {
    fireEvent.input(campoEmail(), { target: { value: email } });
    fireEvent.input(campoSenha(), { target: { value: senha } });
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('não tem link de cadastro: só avisa que a conta vem de um administrador ou gerente', async () => {
    await abrirLogin();
    expect(screen.getByText('Sem conta? Peça o cadastro a um administrador ou gerente.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /cadastr|criar conta|registr/i })).toBeNull();
  });

  it('não pede API key: a tela só tem e-mail e senha (a chave é fixa da aplicação, embutida no build)', async () => {
    await abrirLogin();
    expect(screen.queryByLabelText('API key')).toBeNull();
  });

  it('enviar vazio mostra os dois erros obrigatórios e não chama a API', async () => {
    await abrirLogin();
    fireEvent.click(botaoEntrar());
    expect(await screen.findByText('E-mail é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Senha é obrigatória')).toBeInTheDocument();
    expect(estadoAuth.login).not.toHaveBeenCalled();
    expect(campoEmail()).toHaveAttribute('aria-invalid', 'true');
  });

  it('e-mail sem domínio é recusado com a dica de formato', async () => {
    await abrirLogin();
    preencher('marcos.andrade@velocityfleet', SENHA_VALIDA);
    fireEvent.click(botaoEntrar());
    expect(await screen.findByText('Informe um e-mail válido, como nome@empresa.com.br')).toBeInTheDocument();
    expect(estadoAuth.login).not.toHaveBeenCalled();
  });

  it('login enviado: botão fica desabilitado e "Entrando…" enquanto espera a resposta', async () => {
    await abrirLogin();
    preencher('  ' + PESSOAS.marcos.email + ' ', SENHA_VALIDA);
    fireEvent.click(botaoEntrar());

    expect(estadoAuth.login).toHaveBeenCalledTimes(1);
    // O e-mail vai sem espaço nas pontas; a senha vai como foi digitada.
    expect(estadoAuth.login).toHaveBeenCalledWith(PESSOAS.marcos.email, SENHA_VALIDA);
    await waitFor(() => expect(botaoEntrar()).toBeDisabled());
    expect(botaoEntrar()).toHaveAttribute('aria-busy', 'true');
    expect(botaoEntrar()).toHaveTextContent('Entrando…');
  });

  it('segundo clique durante o envio não dispara outro login', async () => {
    await abrirLogin();
    preencher(PESSOAS.marcos.email, SENHA_VALIDA);
    fireEvent.click(botaoEntrar());
    fireEvent.submit(document.getElementById('formulario-login') as HTMLFormElement);
    expect(estadoAuth.login).toHaveBeenCalledTimes(1);
  });

  it('401 mostra "E-mail ou senha não conferem." e libera o botão de novo', async () => {
    await abrirLogin();
    preencher(PESSOAS.marcos.email, 'SenhaErrada1');
    fireEvent.click(botaoEntrar());
    respostaDoLogin.error(new HttpErrorResponse({ status: 401 }));

    expect(await screen.findByText('E-mail ou senha não conferem.')).toBeInTheDocument();
    expect(botaoEntrar()).toBeEnabled();
    expect(botaoEntrar()).toHaveTextContent('Entrar');
  });

  it.each([
    [403, 'Conta desativada. Fale com o administrador.'],
    [429, 'Muitas tentativas. Aguarde 1 minuto.'],
    [0, 'Sem conexão com o servidor. Tente novamente.'],
    [500, 'Não foi possível entrar agora. Tente novamente.'],
  ])('erro %i mostra a mensagem certa', async (status, mensagem) => {
    await abrirLogin();
    preencher(PESSOAS.marcos.email, SENHA_VALIDA);
    fireEvent.click(botaoEntrar());
    respostaDoLogin.error(new HttpErrorResponse({ status: status }));
    expect(await screen.findByText(mensagem)).toBeInTheDocument();
  });

  it('login com sucesso leva ao /dashboard', async () => {
    // Quem pediu menos movimento navega na hora, sem esperar a animação.
    const original = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    await abrirLogin();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    preencher(PESSOAS.marcos.email, SENHA_VALIDA);
    fireEvent.click(botaoEntrar());
    respostaDoLogin.next(montarRespostaLogin());

    await waitFor(() => expect(navegar).toHaveBeenCalledWith(['/dashboard']));
    window.matchMedia = original;
  });

  it('o botão do olho alterna a senha entre escondida e visível', async () => {
    await abrirLogin();
    expect(campoSenha()).toHaveAttribute('type', 'password');
    fireEvent.click(document.getElementById('botao-ver-senha') as HTMLButtonElement);
    expect(campoSenha()).toHaveAttribute('type', 'text');
    expect(document.getElementById('botao-ver-senha')).toHaveAttribute('aria-pressed', 'true');
  });
});
