import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { montarRespostaLogin } from '../../../../../testing/apoio';
import { ENDERECOS, PESSOAS, VEICULOS, VIAGEM } from '../../../../../testing/dados-reais';
import { provedoresDeTraducao } from '../../../../../testing/traducao';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { DadosModule } from '../../../../shared/dados/dados.module';
import { ConfirmacaoService } from '../../../../shared/dados/components/modal-confirmar/modal-confirmar.component';
import { ReferenciasService } from '../../../../shared/dados/services/referencias.service';
import { ViagensService } from '../../services/viagens.service';
import { ViagemFormComponent } from './viagem-form.component';

describe('Formulário de nova viagem', () => {
  let criar: jest.Mock;
  let confirmarAcao: jest.Mock;
  let notificacao: { sucesso: jest.Mock; erro: jest.Mock };
  let authService: { login: jest.Mock; refreshToken: jest.Mock };

  const veiculoStrada = {
    id: VEICULOS.strada.id,
    plate: VEICULOS.strada.placa,
    model: VEICULOS.strada.modelo,
    status: 'AVAILABLE',
    currentMileage: VEICULOS.strada.kmAtual,
  };

  const motoristaMarcos = {
    id: PESSOAS.marcos.driverId,
    userId: PESSOAS.marcos.id,
    fullName: PESSOAS.marcos.nomeCompleto,
    licenseNumber: PESSOAS.marcos.cnh,
    licenseExpiry: PESSOAS.marcos.validadeCnh,
    isActive: true,
  };

  // Motorista com CNH vencida: a API recusaria a viagem, então não pode aparecer na lista.
  const motoristaComCnhVencida = {
    id: PESSOAS.juliana.driverId,
    userId: PESSOAS.juliana.id,
    fullName: PESSOAS.juliana.nomeCompleto,
    licenseNumber: PESSOAS.juliana.cnh,
    licenseExpiry: '2024-01-10',
    isActive: true,
  };

  async function abrir(): Promise<void> {
    criar = jest.fn().mockReturnValue(of({ id: VIAGEM.id }));
    confirmarAcao = jest.fn().mockResolvedValue(true);
    notificacao = { sucesso: jest.fn(), erro: jest.fn() };
    authService = { login: jest.fn(), refreshToken: jest.fn() };

    await render(ViagemFormComponent, {
      declarations: [ViagemFormComponent],
      imports: [DadosModule],
      providers: [
        provideRouter([]),
        ...provedoresDeTraducao(),
        { provide: AuthService, useValue: authService },
        { provide: ViagensService, useValue: { criar: criar } },
        { provide: ConfirmacaoService, useValue: { confirmarAcao: confirmarAcao } },
        { provide: NotificationService, useValue: notificacao },
        {
          provide: ReferenciasService,
          useValue: {
            veiculosDisponiveis: () => of([veiculoStrada]),
            motoristas: () => of([motoristaMarcos, motoristaComCnhVencida]),
          },
        },
      ],
    });
  }

  // Simula o login antes de abrir a tela.
  async function abrirLogado(pessoa: typeof PESSOAS.marcos | typeof PESSOAS.patricia, sobrescrever = {}): Promise<void> {
    localStorage.clear();
    const resposta = montarRespostaLogin(pessoa, sobrescrever);
    localStorage.setItem('access_token', resposta.accessToken);
    localStorage.setItem('user', JSON.stringify(resposta.user));
    await abrir();
  }

  function digitar(id: string, valor: string): void {
    const campo = document.getElementById(id) as HTMLInputElement;
    fireEvent.input(campo, { target: { value: valor } });
  }

  function escolherOpcao(id: string, valor: string): void {
    const campo = document.getElementById(id) as HTMLSelectElement;
    fireEvent.change(campo, { target: { value: valor } });
  }

  function botaoCriar(): HTMLButtonElement {
    return document.getElementById('botao-criar-viagem') as HTMLButtonElement;
  }

  function esperarVeiculosCarregados(): Promise<void> {
    return waitFor(() =>
      expect(document.querySelectorAll('#campo-viagem-veiculo option')).toHaveLength(2),
    );
  }

  afterEach(() => {
    TestBed.inject(AuthStateService).limparSessao();
    localStorage.clear();
  });

  it('motorista sem perfil de motorista ativo (driverId nulo) vê o aviso e o botão fica bloqueado', async () => {
    await abrirLogado(PESSOAS.marcos, { driverId: null });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(document.getElementById('aviso-sem-motorista')).toBeInTheDocument();
    expect(botaoCriar()).toBeDisabled();
  });

  it('formulário bloqueado nem tenta enviar quando o driverId é nulo', async () => {
    await abrirLogado(PESSOAS.marcos, { driverId: null });
    await screen.findByRole('alert');
    fireEvent.submit(document.getElementById('formulario-viagem') as HTMLFormElement);
    expect(confirmarAcao).not.toHaveBeenCalled();
    expect(criar).not.toHaveBeenCalled();
  });

  it('motorista com perfil não vê o aviso e o campo de motorista mostra o próprio nome, sem select', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    expect(document.getElementById('aviso-sem-motorista')).toBeNull();
    expect(botaoCriar()).toBeEnabled();
    expect(screen.getByText(PESSOAS.marcos.nomeCompleto)).toBeInTheDocument();
    expect(document.querySelector('select[formcontrolname="motorista"]')).toBeNull();
  });

  it('enviar vazio mostra erros de CEP e veículo e não abre confirmação', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    fireEvent.click(botaoCriar());
    await waitFor(() => expect(document.getElementById('campo-viagem-cep-origem')).toHaveAttribute('aria-invalid', 'true'));
    expect(document.getElementById('campo-viagem-veiculo')).toHaveAttribute('aria-invalid', 'true');
    expect(confirmarAcao).not.toHaveBeenCalled();
    expect(criar).not.toHaveBeenCalled();
  });

  it('CEP ganha máscara enquanto digita', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    digitar('campo-viagem-cep-origem', '01310100');
    expect((document.getElementById('campo-viagem-cep-origem') as HTMLInputElement).value).toBe('01310-100');
  });

  it('escolher um veículo mostra a placa, o status e o km atual dele', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    escolherOpcao('campo-viagem-veiculo', VEICULOS.strada.id);
    expect(await screen.findByText(/18\.450 km/)).toBeInTheDocument();
  });

  it('motorista cria viagem: pede confirmação e envia o próprio driverId, veículo e CEPs só com números, sem startKm', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    const navegar = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    escolherOpcao('campo-viagem-veiculo', VEICULOS.strada.id);
    digitar('campo-viagem-cep-origem', ENDERECOS.avenidaPaulista.cep);
    digitar('campo-viagem-cep-destino', ENDERECOS.pracaSete.cep);
    fireEvent.click(botaoCriar());

    await waitFor(() => expect(criar).toHaveBeenCalledTimes(1));
    expect(confirmarAcao).toHaveBeenCalledTimes(1);
    expect(criar).toHaveBeenCalledWith({
      driverId: PESSOAS.marcos.driverId,
      vehicleId: VEICULOS.strada.id,
      startLocation: '01310100',
      endLocation: '30130010',
    });
    expect(notificacao.sucesso).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/trips', VIAGEM.id]);
  });

  it('cancelar na confirmação NÃO envia nada à API', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    confirmarAcao.mockResolvedValue(false);

    escolherOpcao('campo-viagem-veiculo', VEICULOS.strada.id);
    digitar('campo-viagem-cep-origem', ENDERECOS.avenidaPaulista.cep);
    digitar('campo-viagem-cep-destino', ENDERECOS.pracaSete.cep);
    fireEvent.click(botaoCriar());

    await waitFor(() => expect(confirmarAcao).toHaveBeenCalledTimes(1));
    expect(criar).not.toHaveBeenCalled();
  });

  it('erro 409 da API (veículo em uso) aparece no aviso da tela em português', async () => {
    await abrirLogado(PESSOAS.marcos);
    await esperarVeiculosCarregados();
    criar.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Vehicle is in use' } })));

    escolherOpcao('campo-viagem-veiculo', VEICULOS.strada.id);
    digitar('campo-viagem-cep-origem', ENDERECOS.avenidaPaulista.cep);
    digitar('campo-viagem-cep-destino', ENDERECOS.pracaSete.cep);
    fireEvent.click(botaoCriar());

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('O veículo já está em uso em outra viagem.');
  });

  it('gerente escolhe o motorista pelo select, e motorista com CNH vencida não aparece na lista', async () => {
    await abrirLogado(PESSOAS.patricia, { permissions: ['TRIP_CREATE', 'TRIP_VIEW_ALL', 'DRIVER_VIEW'] });
    await waitFor(() => expect(document.querySelector('select[formcontrolname="motorista"]')).toBeInTheDocument());
    const opcoes = Array.from(document.querySelectorAll('select[formcontrolname="motorista"] option'))
      .map((opcao) => opcao as HTMLOptionElement)
      .filter((opcao) => opcao.value !== '')
      .map((opcao) => opcao.textContent?.trim());
    expect(opcoes).toEqual(['Marcos Vinícius Andrade — CNH 04821736590']);
  });

  it('gerente que não escolhe motorista não pode enviar a viagem (campo obrigatório)', async () => {
    await abrirLogado(PESSOAS.patricia, { permissions: ['TRIP_CREATE', 'TRIP_VIEW_ALL', 'DRIVER_VIEW'] });
    await waitFor(() => expect(document.querySelector('select[formcontrolname="motorista"]')).toBeInTheDocument());
    fireEvent.click(botaoCriar());
    await waitFor(() => expect(document.getElementById('campo-viagem-motorista')).toHaveAttribute('aria-invalid', 'true'));
    expect(criar).not.toHaveBeenCalled();
  });
});
