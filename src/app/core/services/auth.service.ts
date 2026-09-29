import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  // POST /auth/login — a x-api-key é fixa da aplicação; o AuthInterceptor já anexa sozinho.
  login(email: string, senha: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password: senha });
  }

  // POST /auth/refresh-token — renova o JWT que ainda está válido e devolve o user atualizado.
  refreshToken(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh-token`, {});
  }
}
