import { FormControl, FormGroup, Validators } from '@angular/forms';

import { PESSOAS } from '../../../../testing/dados-reais';
import { focarPrimeiroInvalido, validarTudo } from './formularios';

describe('validarTudo', () => {
  function montarFormulario(email: string): FormGroup {
    return new FormGroup({
      email: new FormControl(email, [Validators.required, Validators.email]),
      nome: new FormControl(PESSOAS.patricia.nomeCompleto, Validators.required),
    });
  }

  it('formulário completo é válido', () => {
    expect(validarTudo(montarFormulario(PESSOAS.patricia.email))).toBe(true);
  });

  it('formulário com e-mail vazio é inválido e mostra os erros (campos tocados)', () => {
    const formulario = montarFormulario('');
    expect(validarTudo(formulario)).toBe(false);
    expect(formulario.get('email')?.touched).toBe(true);
  });

  it('apaga o erro que veio da API, para poder enviar de novo sem mexer no campo', () => {
    const formulario = montarFormulario(PESSOAS.patricia.email);
    formulario.get('email')?.setErrors({ servidor: 'Email already registered' });
    expect(validarTudo(formulario)).toBe(true);
  });
});

describe('focarPrimeiroInvalido', () => {
  it('leva o foco ao primeiro campo com aria-invalid', () => {
    document.body.innerHTML =
      '<form id="raiz"><input id="ok" aria-invalid="false"><input id="ruim" aria-invalid="true"><input id="ruim2" aria-invalid="true"></form>';
    focarPrimeiroInvalido(document.getElementById('raiz'));
    expect(document.activeElement?.id).toBe('ruim');
  });

  it('sem raiz ou sem campo inválido, não faz nada', () => {
    document.body.innerHTML = '<form id="raiz"><input id="ok"></form>';
    expect(() => focarPrimeiroInvalido(null)).not.toThrow();
    focarPrimeiroInvalido(document.getElementById('raiz'));
    expect(document.activeElement?.id).not.toBe('ok');
  });
});
