import { NgModule } from '@angular/core';

import { DadosModule } from '../../shared/dados/dados.module';
import { AbasFrotaComponent } from './components/abas-frota/abas-frota.component';
import { FleetRoutingModule } from './fleet-routing.module';
import { MotoristaDetalheComponent } from './pages/motorista-detalhe/motorista-detalhe.component';
import { MotoristasListaComponent } from './pages/motoristas-lista/motoristas-lista.component';
import { VeiculoDetalheComponent } from './pages/veiculo-detalhe/veiculo-detalhe.component';
import { VeiculoFormComponent } from './pages/veiculo-form/veiculo-form.component';
import { VeiculosListaComponent } from './pages/veiculos-lista/veiculos-lista.component';

// Área Frota: veículos (todos os papéis leem) e motoristas (só com DRIVER_VIEW).
@NgModule({
  declarations: [
    AbasFrotaComponent,
    VeiculosListaComponent,
    VeiculoDetalheComponent,
    VeiculoFormComponent,
    MotoristasListaComponent,
    MotoristaDetalheComponent,
  ],
  imports: [DadosModule, FleetRoutingModule],
})
export class FleetModule {}
