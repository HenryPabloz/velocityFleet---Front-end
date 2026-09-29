import {
  HttpContextToken,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, Observable, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ProblemDetails } from '../models';
import { AuthStateService } from '../services/auth-state.service';
import { NotificationService } from '../services/notification.service';

// Marca a requisição cujo erro (exceto 401) a própria tela mostra: sem toast global.
export const ERRO_TRATADO_NA_TELA = new HttpContextToken<boolean>(() => false);

// Trata o erro padrão da API (RFC 7807) e mostra um aviso na tela.
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private router: Router,
    private notificacao: NotificationService,
    private estadoAutenticacao: AuthStateService,
    private injetor: Injector,
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Erros de sites de terceiros (ex: ViaCEP) não devem derrubar a sessão.
    if (!req.url.startsWith(`${environment.apiUrl}/`)) {
      return next.handle(req);
    }

    return next.handle(req).pipe(
      catchError((erro: HttpErrorResponse) => {
        // Pegamos o TranslateService só aqui: injetar no construtor cria ciclo com o HttpClient.
        const traducao = this.injetor.get(TranslateService);
        const problema: ProblemDetails | null = erro.error ?? null;
        const ehLogin = req.url.endsWith('/auth/login');
        const telaTrataErro = req.context.get(ERRO_TRATADO_NA_TELA);

        // Login mostra o próprio erro na tela (401, 403, 429...): sem toast e sem deslogar.
        if (ehLogin) {
          return throwError(() => erro);
        }

        // Troca de senha: 401 "Current password is incorrect" é senha atual errada, não sessão expirada.
        const ehTrocaDeSenha = req.url.endsWith('/users/me/password');
        if (ehTrocaDeSenha && erro.status === 401 && problema?.detail === 'Current password is incorrect') {
          return throwError(() => erro);
        }

        // Sessão expirada (401) sempre é tratada aqui; nos outros erros a tela decide.
        if (telaTrataErro && erro.status !== 401) {
          return throwError(() => erro);
        }

        if (erro.status === 401) {
          this.estadoAutenticacao.limparSessao();
          this.router.navigate(['/auth/login']);
          this.notificacao.erro(problema?.detail ?? traducao.instant('ERROS_API.SESSAO_EXPIRADA'));
        } else if (erro.status === 403) {
          this.notificacao.erro(problema?.detail ?? traducao.instant('ERROS_API.SEM_PERMISSAO'));
        } else if (erro.status === 502 || erro.status === 504) {
          // Serviço externo (ex: ViaCEP) fora do ar. A tela pode trocar a mensagem por uma mais específica.
          this.notificacao.erro(traducao.instant('ERROS_API.SERVICO_EXTERNO'));
        } else if (erro.status >= 500) {
          this.notificacao.erro(traducao.instant('ERROS_API.SERVIDOR'));
        } else if (erro.status === 0) {
          this.notificacao.erro(traducao.instant('ERROS_API.SEM_CONEXAO'));
        } else if (problema?.detail) {
          // 400/404/409: toast genérico. O errors[] de formulário é tratado no componente.
          this.notificacao.erro(problema.detail);
        }

        return throwError(() => erro);
      }),
    );
  }
}
