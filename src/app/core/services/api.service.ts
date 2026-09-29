import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ERRO_TRATADO_NA_TELA } from '../interceptors/error.interceptor';

// Base para os services das features: monta a URL e chama a API.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // erroTratadoNaTela = true: a tela mostra o erro sozinha, então o toast global não aparece.
  get<T>(caminho: string, parametros?: HttpParams, erroTratadoNaTela = false): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${caminho}`, {
      params: parametros,
      context: this.montarContexto(erroTratadoNaTela),
    });
  }

  post<T>(caminho: string, corpo: unknown, erroTratadoNaTela = false): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${caminho}`, corpo, {
      context: this.montarContexto(erroTratadoNaTela),
    });
  }

  patch<T>(caminho: string, corpo: unknown, erroTratadoNaTela = false): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${caminho}`, corpo, {
      context: this.montarContexto(erroTratadoNaTela),
    });
  }

  delete<T>(caminho: string, erroTratadoNaTela = false): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${caminho}`, {
      context: this.montarContexto(erroTratadoNaTela),
    });
  }

  private montarContexto(erroTratadoNaTela: boolean): HttpContext {
    return new HttpContext().set(ERRO_TRATADO_NA_TELA, erroTratadoNaTela);
  }
}
