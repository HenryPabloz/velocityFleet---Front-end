import { Component, Input, ViewEncapsulation } from '@angular/core';

export type TipoSelo =
  | 'veiculo'
  | 'viagem'
  | 'cnh'
  | 'ativo'
  | 'manutencao'
  | 'incidente'
  | 'severidade';
type Tom = 'neutro' | 'andamento' | 'ok' | 'aviso' | 'perigo';

interface ConfiguracaoSelo {
  tom: Tom;
  icone: string;
  chave: string;
}

// Cada status tem ícone + texto + tom de cor (nunca só cor).
const SELOS: Record<TipoSelo, Record<string, ConfiguracaoSelo>> = {
  veiculo: {
    AVAILABLE: { tom: 'ok', icone: 'ok', chave: 'STATUS_VEICULO.AVAILABLE' },
    IN_USE: { tom: 'andamento', icone: 'viagens', chave: 'STATUS_VEICULO.IN_USE' },
    IN_MAINTENANCE: { tom: 'aviso', icone: 'manutencao', chave: 'STATUS_VEICULO.IN_MAINTENANCE' },
    OUT_OF_SERVICE: { tom: 'perigo', icone: 'proibido', chave: 'STATUS_VEICULO.OUT_OF_SERVICE' },
  },
  viagem: {
    PLANNED: { tom: 'neutro', icone: 'calendario', chave: 'STATUS_VIAGEM.PLANNED' },
    IN_PROGRESS: { tom: 'andamento', icone: 'viagens', chave: 'STATUS_VIAGEM.IN_PROGRESS' },
    COMPLETED: { tom: 'ok', icone: 'ok', chave: 'STATUS_VIAGEM.COMPLETED' },
    CANCELLED: { tom: 'perigo', icone: 'proibido', chave: 'STATUS_VIAGEM.CANCELLED' },
  },
  cnh: {
    VALIDA: { tom: 'ok', icone: 'ok', chave: 'STATUS_CNH.VALIDA' },
    VENCENDO: { tom: 'aviso', icone: 'relogio', chave: 'STATUS_CNH.VENCENDO' },
    VENCIDA: { tom: 'perigo', icone: 'alerta', chave: 'STATUS_CNH.VENCIDA' },
  },
  manutencao: {
    SCHEDULED: { tom: 'neutro', icone: 'calendario', chave: 'STATUS_MANUTENCAO.SCHEDULED' },
    IN_PROGRESS: { tom: 'andamento', icone: 'manutencao', chave: 'STATUS_MANUTENCAO.IN_PROGRESS' },
    COMPLETED: { tom: 'ok', icone: 'ok', chave: 'STATUS_MANUTENCAO.COMPLETED' },
  },
  incidente: {
    REPORTED: { tom: 'aviso', icone: 'alerta', chave: 'STATUS_INCIDENTE.REPORTED' },
    UNDER_INVESTIGATION: { tom: 'andamento', icone: 'busca', chave: 'STATUS_INCIDENTE.UNDER_INVESTIGATION' },
    RESOLVED: { tom: 'ok', icone: 'ok', chave: 'STATUS_INCIDENTE.RESOLVED' },
  },
  severidade: {
    LOW: { tom: 'neutro', icone: 'info', chave: 'SEVERIDADE.LOW' },
    MEDIUM: { tom: 'aviso', icone: 'alerta', chave: 'SEVERIDADE.MEDIUM' },
    HIGH: { tom: 'perigo', icone: 'octogono', chave: 'SEVERIDADE.HIGH' },
  },
  ativo: {
    ATIVO: { tom: 'ok', icone: 'ok', chave: 'STATUS_MOTORISTA.ATIVO' },
    INATIVO: { tom: 'neutro', icone: 'proibido', chave: 'STATUS_MOTORISTA.INATIVO' },
  },
};

const PADRAO: ConfiguracaoSelo = { tom: 'neutro', icone: 'info', chave: '' };

// Selo de status: sempre ícone + rótulo, com a cor só como reforço.
@Component({
  selector: 'app-selo-status',
  standalone: false,
  templateUrl: './selo-status.component.html',
  styleUrl: './selo-status.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class SeloStatusComponent {
  @Input() tipo: TipoSelo = 'veiculo';
  @Input() valor = '';

  get configuracao(): ConfiguracaoSelo {
    const lista = SELOS[this.tipo];
    if (lista && lista[this.valor]) {
      return lista[this.valor];
    }
    return PADRAO;
  }
}
