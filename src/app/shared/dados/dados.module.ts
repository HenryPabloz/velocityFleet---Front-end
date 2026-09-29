import { NgModule } from '@angular/core';

import { SharedModule } from '../shared.module';
import { AbasRemovidosComponent } from './components/abas-removidos/abas-removidos.component';
import { AcoesRemocaoComponent } from './components/acoes-remocao/acoes-remocao.component';
import { CabecalhoPaginaComponent } from './components/cabecalho-pagina/cabecalho-pagina.component';
import {
  CampoEntradaDirective,
  CampoFormularioComponent,
} from './components/campo-formulario/campo-formulario.component';
import { GrupoOpcoesComponent } from './components/grupo-opcoes/grupo-opcoes.component';
import { EstadoPaginaComponent } from './components/estado-pagina/estado-pagina.component';
import { ModalConfirmarComponent } from './components/modal-confirmar/modal-confirmar.component';
import { PaginacaoComponent } from './components/paginacao/paginacao.component';
import { PlacaComponent } from './components/placa/placa.component';
import { SeloStatusComponent } from './components/selo-status/selo-status.component';
import { TabelaDadosComponent } from './components/tabela-dados/tabela-dados.component';
import {
  DataCurtaPipe,
  DataHoraCurtaPipe,
  MoedaPipe,
  PrecoLitroPipe,
  NumeroPipe,
  PlacaPipe,
} from './pipes/formatacao.pipes';

const PECAS = [
  AbasRemovidosComponent,
  AcoesRemocaoComponent,
  CabecalhoPaginaComponent,
  CampoFormularioComponent,
  CampoEntradaDirective,
  EstadoPaginaComponent,
  GrupoOpcoesComponent,
  ModalConfirmarComponent,
  PaginacaoComponent,
  PlacaComponent,
  SeloStatusComponent,
  TabelaDadosComponent,
  PlacaPipe,
  NumeroPipe,
  DataCurtaPipe,
  DataHoraCurtaPipe,
  MoedaPipe,
  PrecoLitroPipe,
];

// Peças das telas de dados (tabela, paginação, selos, formulário, modal). Fica separado do
// SharedModule de propósito: só entra nos módulos lazy, sem pesar o bundle inicial.
@NgModule({
  declarations: PECAS,
  imports: [SharedModule],
  exports: [SharedModule, ...PECAS],
})
export class DadosModule {}
