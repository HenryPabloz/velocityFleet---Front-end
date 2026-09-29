import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ConfirmacaoService } from '../components/modal-confirmar/modal-confirmar.component';

// Regras únicas de excluir (soft), restaurar e excluir definitivamente (spec §1.5 e §8.14).
// "recurso" é o prefixo da permission: USER, DRIVER, VEHICLE, TRIP, REFUELING, MAINTENANCE, INCIDENT.
@Injectable({ providedIn: 'root' })
export class RemocaoService {
  constructor(
    private api: ApiService,
    private estadoAutenticacao: AuthStateService,
    private confirmacao: ConfirmacaoService,
    private traducao: TranslateService,
  ) {}

  podeExcluir(recurso: string): boolean {
    return this.estadoAutenticacao.temPermissao(recurso + '_DELETE');
  }

  // Vale para a aba "Removidos" e para o botão "Restaurar" (mesma permission).
  podeRestaurar(recurso: string): boolean {
    return this.estadoAutenticacao.temPermissao(recurso + '_RESTORE');
  }

  // Exclusão definitiva não é permission: é só do papel ADMIN.
  podeExcluirDefinitivo(): boolean {
    return this.estadoAutenticacao.hasRole('ADMIN');
  }

  // DELETE /<caminho>/:id/permanent. O 409 da API chega ao erro para a tela mostrar o detail.
  excluirDefinitivamente(caminho: string, id: string): Observable<void> {
    return this.api.delete<void>('/' + caminho + '/' + id + '/permanent', true);
  }

  // Modal de confirmação irreversível. "aviso" é um trecho extra (ex: regra das viagens).
  confirmarExclusaoDefinitiva(nome: string, aviso = ''): Promise<boolean> {
    let mensagem = this.traducao.instant('REMOCAO.DEFINITIVA_TEXTO', { nome: nome });
    if (aviso) {
      mensagem = mensagem + ' ' + aviso;
    }
    return this.confirmacao.confirmar({
      titulo: this.traducao.instant('REMOCAO.DEFINITIVA_TITULO'),
      mensagem: mensagem,
      textoConfirmar: this.traducao.instant('REMOCAO.DEFINITIVA_CONFIRMAR'),
      textoCancelar: this.traducao.instant('COMUM.CANCELAR'),
      perigo: true,
    });
  }
}
