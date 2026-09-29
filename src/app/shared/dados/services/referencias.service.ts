import { HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { Driver, PaginatedResponse, User, Vehicle, VehicleStatus } from '../../../core/models';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';

const TAMANHO_MAXIMO = 100;

// Buscas de apoio (nomes de motorista, placas, listas de escolha). Pega só os 100 primeiros
// registros e, se a chamada falhar (ex: sem permissão), devolve lista vazia sem barulho.
@Injectable({ providedIn: 'root' })
export class ReferenciasService {
  constructor(
    private api: ApiService,
    private estadoAutenticacao: AuthStateService,
  ) {}

  veiculos(status: VehicleStatus | '' = ''): Observable<Vehicle[]> {
    let parametros = new HttpParams().set('page', 1).set('pageSize', TAMANHO_MAXIMO);
    if (status) {
      parametros = parametros.set('status', status);
    }
    return this.api.get<PaginatedResponse<Vehicle>>('/vehicles', parametros, true).pipe(
      map((resposta) => resposta.data),
      catchError(() => of([] as Vehicle[])),
    );
  }

  // Veículos livres para uma viagem: GET /vehicles/not-in-use?status=AVAILABLE (liberado aos 3 papéis).
  veiculosDisponiveis(): Observable<Vehicle[]> {
    const parametros = new HttpParams()
      .set('page', 1)
      .set('pageSize', TAMANHO_MAXIMO)
      .set('status', VehicleStatus.AVAILABLE);
    return this.api.get<PaginatedResponse<Vehicle>>('/vehicles/not-in-use', parametros, true).pipe(
      map((resposta) => resposta.data),
      catchError(() => of([] as Vehicle[])),
    );
  }

  motoristas(): Observable<Driver[]> {
    const parametros = new HttpParams().set('page', 1).set('pageSize', TAMANHO_MAXIMO);
    return this.api.get<PaginatedResponse<Driver>>('/drivers', parametros, true).pipe(
      map((resposta) => resposta.data),
      catchError(() => of([] as Driver[])),
    );
  }

  // Um usuário só (exige USER_VIEW). Sem permissão ou sem registro: devolve null.
  usuario(id: string): Observable<User | null> {
    return this.api.get<User>('/users/' + id, undefined, true).pipe(catchError(() => of(null)));
  }

  // GET /users exige USER_VIEW (só ADMIN por padrão). Sem essa permissão nem tenta.
  usuarios(): Observable<User[]> {
    if (!this.estadoAutenticacao.temPermissao('USER_VIEW')) {
      return of([] as User[]);
    }
    const parametros = new HttpParams().set('page', 1).set('pageSize', TAMANHO_MAXIMO);
    return this.api.get<PaginatedResponse<User>>('/users', parametros, true).pipe(
      map((resposta) => resposta.data),
      catchError(() => of([] as User[])),
    );
  }
}

// Monta { idDoMotorista: nome completo }. GET /drivers já traz o fullName pronto.
export function montarNomesDosMotoristas(motoristas: Driver[]): Record<string, string> {
  const nomes: Record<string, string> = {};
  for (const motorista of motoristas) {
    if (motorista.fullName) {
      nomes[motorista.id] = motorista.fullName;
    }
  }
  return nomes;
}
