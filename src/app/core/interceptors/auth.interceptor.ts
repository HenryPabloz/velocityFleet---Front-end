import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let requisicao = req;

    // Só falamos com a nossa API: a credencial nunca vai para sites de terceiros (ex: ViaCEP).
    if (!req.url.startsWith(`${environment.apiUrl}/`)) {
      return next.handle(requisicao);
    }

    // Authorization: Bearer <jwt> em toda rota de negócio, se já existir credencial.
    const credencial = localStorage.getItem('access_token');
    if (credencial) {
      requisicao = requisicao.clone({
        setHeaders: { Authorization: `Bearer ${credencial}` },
      });
    }

    // x-api-key só entra no login: é a chave fixa da aplicação, igual para todo mundo.
    const ehLogin = req.method === 'POST' && req.url.endsWith('/auth/login');
    if (ehLogin) {
      requisicao = requisicao.clone({
        setHeaders: { 'x-api-key': environment.apiKey },
      });
    }

    return next.handle(requisicao);
  }
}
