import { Component, EventEmitter, Input, Output } from '@angular/core';

import { SituacaoBloco } from '../../dashboard.model';

// Um card de indicador. Mostra esqueleto, erro, "sem acesso" ou o valor (com contagem animada).
@Component({
  selector: 'app-kpi-card',
  standalone: false,
  templateUrl: './kpi-card.component.html',
})
export class KpiCardComponent {
  // Vai para data-kpi (o JS usa para achar o card).
  @Input({ required: true }) chave = '';
  @Input({ required: true }) rotulo = '';
  @Input() icone = 'dashboard';
  @Input() situacao: SituacaoBloco = 'carregando';
  // Use valorNumero para números (contagem animada) ou valorTexto para texto livre.
  @Input() valorNumero: number | null = null;
  @Input() valorTexto: string | null = null;
  @Input() casasDecimais = 0;
  @Input() unidade = '';
  @Input() dica = '';
  @Input() mensagemSemAcesso = '';
  @Output() tentarNovamente = new EventEmitter<void>();
}
