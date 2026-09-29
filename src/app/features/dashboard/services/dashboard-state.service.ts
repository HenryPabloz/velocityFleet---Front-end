import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { Trip } from '../../../core/models';
import { AuthStateService } from '../../../core/services/auth-state.service';
import {
  ConsumoFrota,
  ContagemStatusVeiculo,
  EstadoBloco,
  IncidentesPorSeveridade,
  KmPorDia,
  ProximaManutencao,
  ResumoIncidentesMes,
  ResumoUsuarios,
  ResumoViagensMes,
  SaudeSistema,
} from '../dashboard.model';
import { DashboardService } from './dashboard.service';

function novoBloco<T>(): BehaviorSubject<EstadoBloco<T>> {
  return new BehaviorSubject<EstadoBloco<T>>({ situacao: 'carregando', dados: null });
}

// Guarda o estado de cada bloco do painel. Fica preso ao componente: sair da rota cancela tudo.
@Injectable()
export class DashboardStateService implements OnDestroy {
  private viagensMesSubject = novoBloco<ResumoViagensMes>();
  private incidentesMesSubject = novoBloco<ResumoIncidentesMes>();
  private proximaManutencaoSubject = novoBloco<ProximaManutencao>();
  private frotaStatusSubject = novoBloco<ContagemStatusVeiculo[]>();
  private consumoTotalSubject = novoBloco<ConsumoFrota>();
  private viagensAtivasSubject = novoBloco<number>();
  private usuariosAtivosSubject = novoBloco<ResumoUsuarios>();
  private saudeSistemaSubject = novoBloco<SaudeSistema>();
  private kmPorDiaSubject = novoBloco<KmPorDia[]>();
  private severidadeSubject = novoBloco<IncidentesPorSeveridade[]>();
  private ultimasViagensSubject = novoBloco<Trip[]>();

  viagensMes$ = this.viagensMesSubject.asObservable();
  incidentesMes$ = this.incidentesMesSubject.asObservable();
  proximaManutencao$ = this.proximaManutencaoSubject.asObservable();
  frotaStatus$ = this.frotaStatusSubject.asObservable();
  consumoTotal$ = this.consumoTotalSubject.asObservable();
  viagensAtivas$ = this.viagensAtivasSubject.asObservable();
  usuariosAtivos$ = this.usuariosAtivosSubject.asObservable();
  saudeSistema$ = this.saudeSistemaSubject.asObservable();
  kmPorDia$ = this.kmPorDiaSubject.asObservable();
  severidade$ = this.severidadeSubject.asObservable();
  ultimasViagens$ = this.ultimasViagensSubject.asObservable();

  private atualizadoEmSubject = new BehaviorSubject<Date | null>(null);
  atualizadoEm$ = this.atualizadoEmSubject.asObservable();

  // Uma assinatura por bloco: recarregar um bloco cancela a chamada anterior dele.
  private assinaturas = new Map<string, Subscription>();

  constructor(
    private servico: DashboardService,
    private estadoAutenticacao: AuthStateService,
  ) {}

  ngOnDestroy(): void {
    this.assinaturas.forEach((assinatura) => assinatura.unsubscribe());
    this.assinaturas.clear();
  }

  // Modo motorista: vê só as próprias viagens (TRIP_VIEW_OWN sem TRIP_VIEW_ALL).
  get ehMotorista(): boolean {
    const auth = this.estadoAutenticacao;
    return auth.temPermissao('TRIP_VIEW_OWN') && !auth.temPermissao('TRIP_VIEW_ALL');
  }

  // Modo gestão: cards e gráficos de analytics.
  get ehGestao(): boolean {
    return this.estadoAutenticacao.temPermissao('ANALYTICS_VIEW');
  }

  get verViagens(): boolean {
    return this.estadoAutenticacao.temAlgumaPermissao(['TRIP_VIEW_OWN', 'TRIP_VIEW_ALL']);
  }

  get verIncidentes(): boolean {
    return this.estadoAutenticacao.temAlgumaPermissao(['INCIDENT_VIEW_OWN', 'INCIDENT_VIEW_ALL']);
  }

  // Usuários ativos: exige USER_VIEW.
  get verUsuarios(): boolean {
    return this.estadoAutenticacao.temPermissao('USER_VIEW');
  }

  // Saúde do sistema (GET /health): só o papel ADMIN.
  get verSaude(): boolean {
    return this.estadoAutenticacao.hasRole('ADMIN');
  }

  // Carrega só os blocos que as permissions do usuário permitem.
  carregarTudo(): void {
    if (this.verViagens) {
      this.carregar('ultimasViagens');
    }
    if (this.ehMotorista) {
      this.carregar('viagensMes');
      this.carregar('proximaManutencao');
      if (this.verIncidentes) {
        this.carregar('incidentesMes');
      }
    }
    if (this.ehGestao) {
      this.carregar('frotaStatus');
      this.carregar('consumoTotal');
      this.carregar('viagensAtivas');
      this.carregar('kmPorDia');
      this.carregar('severidade');
    }
    if (this.verUsuarios) {
      this.carregar('usuariosAtivos');
    }
    if (this.verSaude) {
      this.carregar('saudeSistema');
    }
    this.atualizadoEmSubject.next(new Date());
  }

  // Também é o que o botão "Tentar de novo" chama.
  carregar(nome: string): void {
    if (nome === 'viagensMes') {
      this.executar(nome, this.viagensMesSubject, this.servico.buscarViagensDoMes());
    } else if (nome === 'incidentesMes') {
      this.executar(nome, this.incidentesMesSubject, this.servico.buscarIncidentesDoMes());
    } else if (nome === 'proximaManutencao') {
      this.executar(nome, this.proximaManutencaoSubject, this.servico.buscarProximaManutencao());
    } else if (nome === 'frotaStatus') {
      this.executar(nome, this.frotaStatusSubject, this.servico.buscarFrotaPorStatus());
    } else if (nome === 'consumoTotal') {
      this.executar(nome, this.consumoTotalSubject, this.servico.buscarConsumoTotal());
    } else if (nome === 'viagensAtivas') {
      this.executar(nome, this.viagensAtivasSubject, this.servico.buscarViagensAtivas());
    } else if (nome === 'usuariosAtivos') {
      this.executar(nome, this.usuariosAtivosSubject, this.servico.buscarUsuariosAtivos());
    } else if (nome === 'saudeSistema') {
      this.executar(nome, this.saudeSistemaSubject, this.servico.buscarSaudeDoSistema());
    } else if (nome === 'kmPorDia') {
      this.executar(nome, this.kmPorDiaSubject, this.servico.buscarKmPorDia());
    } else if (nome === 'severidade') {
      this.executar(nome, this.severidadeSubject, this.servico.buscarIncidentesPorSeveridade());
    } else if (nome === 'ultimasViagens') {
      this.executar(nome, this.ultimasViagensSubject, this.servico.buscarUltimasViagens());
    }
  }

  // Liga a chamada ao bloco: carregando -> pronto, erro ou sem-acesso (403).
  private executar<T>(
    nome: string,
    bloco: BehaviorSubject<EstadoBloco<T>>,
    chamada: Observable<T>,
  ): void {
    this.assinaturas.get(nome)?.unsubscribe();
    bloco.next({ situacao: 'carregando', dados: null });

    const assinatura = chamada.subscribe({
      next: (dados) => bloco.next({ situacao: 'pronto', dados }),
      error: (erro: HttpErrorResponse) => {
        if (erro.status === 403) {
          bloco.next({ situacao: 'sem-acesso', dados: null });
        } else if (erro.status === 429) {
          bloco.next({ situacao: 'limite', dados: null });
        } else {
          bloco.next({ situacao: 'erro', dados: null });
        }
      },
    });
    this.assinaturas.set(nome, assinatura);
  }
}
