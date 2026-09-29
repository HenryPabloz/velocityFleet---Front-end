import { FormGroup } from '@angular/forms';

// Marca todos os campos como tocados (para mostrar os erros) e devolve se o formulário é válido.
export function validarTudo(formulario: FormGroup): boolean {
  // Erros que vieram da API são apagados: assim dá para tentar enviar de novo sem mexer no campo.
  for (const controle of Object.values(formulario.controls)) {
    controle.updateValueAndValidity();
  }
  formulario.markAllAsTouched();
  return formulario.valid;
}

// Leva o foco para o primeiro campo com erro, para quem usa teclado ou leitor de tela.
export function focarPrimeiroInvalido(raiz: HTMLElement | null): void {
  if (!raiz) {
    return;
  }
  const campo = raiz.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (campo) {
    campo.focus();
  }
}
