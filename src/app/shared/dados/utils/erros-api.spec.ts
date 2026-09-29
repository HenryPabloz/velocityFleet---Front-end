import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { traducaoFalsa } from '../../../../testing/apoio';
import {
  aplicarErrosNosCampos,
  lerProblema,
  statusDoErro,
  textoDoErro,
  traduzirMensagemApi,
} from './erros-api';

const traducao = traducaoFalsa as unknown as TranslateService;

function erroHttp(status: number, corpo: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status: status, error: corpo });
}

describe('leitura do erro da API', () => {
  it('lerProblema devolve o corpo RFC 7807 quando ele tem "detail"', () => {
    const problema = lerProblema(erroHttp(409, { detail: 'Plate already registered', status: 409 }));
    expect(problema?.detail).toBe('Plate already registered');
  });

  it('lerProblema devolve null para corpo sem detail e para erro que não é HTTP', () => {
    expect(lerProblema(erroHttp(500, 'texto solto'))).toBeNull();
    expect(lerProblema(new Error('falhou'))).toBeNull();
  });

  it('statusDoErro devolve 0 para erro desconhecido', () => {
    expect(statusDoErro(erroHttp(404, null))).toBe(404);
    expect(statusDoErro('qualquer coisa')).toBe(0);
  });
});

describe('traduzirMensagemApi', () => {
  it('traduz mensagem exata conhecida', () => {
    expect(traduzirMensagemApi('Plate already registered', traducao)).toBe('ERROS_NEGOCIO.PLACA_JA_CADASTRADA');
  });

  it('traduz mensagens que terminam com um número (prefixo)', () => {
    expect(traduzirMensagemApi('Vehicle is not available: IN_MAINTENANCE', traducao)).toBe(
      'ERROS_NEGOCIO.VEICULO_INDISPONIVEL',
    );
  });

  it('mensagem exata não casa por prefixo: "Vehicle is in use agora" fica como veio', () => {
    expect(traduzirMensagemApi('Vehicle is in use agora', traducao)).toBe('Vehicle is in use agora');
  });

  it('mensagem desconhecida volta sem mudar', () => {
    expect(traduzirMensagemApi('Algo inesperado', traducao)).toBe('Algo inesperado');
  });
});

describe('textoDoErro (o que aparece na tela)', () => {
  it('sem conexão (status 0)', () => {
    expect(textoDoErro(erroHttp(0, null), traducao)).toBe('ERROS_API.SEM_CONEXAO');
  });

  it('403 com detail mostra o detail traduzido (conta ADMIN protegida)', () => {
    const erro = erroHttp(403, { detail: 'An ADMIN account cannot be deactivated or deleted' });
    expect(textoDoErro(erro, traducao)).toBe('ERROS_NEGOCIO.ADMIN_NAO_DESATIVA');
  });

  it('403 sem detail usa a frase de sem permissão', () => {
    expect(textoDoErro(erroHttp(403, null), traducao)).toBe('ERROS_API.SEM_PERMISSAO');
  });

  it('429 fala de limite de chamadas', () => {
    expect(textoDoErro(erroHttp(429, null), traducao)).toBe('ERROS_API.LIMITE');
  });

  it('502 e 504 falam do ViaCEP fora do ar', () => {
    expect(textoDoErro(erroHttp(502, null), traducao)).toBe('ERROS_NEGOCIO.VIACEP_INDISPONIVEL');
    expect(textoDoErro(erroHttp(504, null), traducao)).toBe('ERROS_NEGOCIO.VIACEP_INDISPONIVEL');
  });

  it('500 fala de erro de servidor', () => {
    expect(textoDoErro(erroHttp(500, null), traducao)).toBe('ERROS_API.SERVIDOR');
  });

  it('400/404/409 mostram o detail da API traduzido', () => {
    const erro = erroHttp(404, { detail: 'Trip not found' });
    expect(textoDoErro(erro, traducao)).toBe('ERROS_NEGOCIO.VIAGEM_NAO_ENCONTRADA');
  });

  it('erro de upload (multer) vem em "message", não em RFC 7807', () => {
    const erro = erroHttp(400, { message: 'Invalid file type: image/gif' });
    expect(textoDoErro(erro, traducao)).toBe('ERROS_NEGOCIO.FOTO_TIPO');
  });

  it('erro sem nada útil cai na frase de servidor', () => {
    expect(textoDoErro(erroHttp(400, null), traducao)).toBe('ERROS_API.SERVIDOR');
  });
});

describe('aplicarErrosNosCampos (erro 400 de validação em cada campo)', () => {
  const mapa = { email: 'email', password: 'senha', 'driver.licenseNumber': 'cnh' };

  function montarFormulario(): FormGroup {
    return new FormGroup({
      email: new FormControl('marcos.andrade@velocityfleet.com.br'),
      senha: new FormControl(''),
      cnh: new FormControl('0482173659'),
    });
  }

  it('coloca cada mensagem no campo certo e marca como tocado', () => {
    const formulario = montarFormulario();
    const erro = erroHttp(400, {
      detail: 'Validation failed',
      errors: [
        'password must be longer than or equal to 8 characters',
        'driver.licenseNumber must be exactly 11 digits',
      ],
    });

    const sobras = aplicarErrosNosCampos(erro, formulario, mapa, traducao);

    expect(sobras).toEqual([]);
    expect(formulario.get('senha')?.errors).toEqual({ servidor: 'password must be longer than or equal to 8 characters' });
    expect(formulario.get('cnh')?.touched).toBe(true);
    expect(formulario.get('email')?.errors).toBeNull();
  });

  it('mensagem sem campo conhecido vira sobra para o aviso geral', () => {
    const erro = erroHttp(400, { detail: 'x', errors: ['Plate already registered', 'algo inesperado'] });
    const sobras = aplicarErrosNosCampos(erro, montarFormulario(), mapa, traducao);
    expect(sobras).toEqual(['ERROS_NEGOCIO.PLACA_JA_CADASTRADA', 'algo inesperado']);
  });

  it('tratarEspecial pode assumir a mensagem (ex: CEP)', () => {
    const erro = erroHttp(400, { detail: 'x', errors: ['CEP 01310100 not found'] });
    const sobras = aplicarErrosNosCampos(erro, montarFormulario(), mapa, traducao, (mensagem) => mensagem.startsWith('CEP'));
    expect(sobras).toEqual([]);
  });

  it('erro sem errors[] não devolve nada', () => {
    expect(aplicarErrosNosCampos(erroHttp(400, { detail: 'x' }), montarFormulario(), mapa, traducao)).toEqual([]);
  });
});
