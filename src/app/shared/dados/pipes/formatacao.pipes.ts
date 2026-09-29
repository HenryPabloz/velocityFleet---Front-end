import { Pipe, PipeTransform } from '@angular/core';

import {
  dataCurta,
  dataHoraCurta,
  formatarMoeda,
  formatarNumero,
  formatarPlaca,
  formatarPrecoLitro,
} from '../utils/formatacao';

// Mostra a placa no formato certo: ABC1D23 (Mercosul) ou ABC-1234 (antiga).
@Pipe({ name: 'placa', standalone: false })
export class PlacaPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return formatarPlaca(valor);
  }
}

// Número com separador de milhar brasileiro: 15.432.
@Pipe({ name: 'numero', standalone: false })
export class NumeroPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatarNumero(valor);
  }
}

// Data sem hora, como dd/mm/aaaa (não muda o dia por causa do fuso).
@Pipe({ name: 'dataCurta', standalone: false })
export class DataCurtaPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return dataCurta(valor);
  }
}

@Pipe({ name: 'dataHoraCurta', standalone: false })
export class DataHoraCurtaPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return dataHoraCurta(valor);
  }
}

// Valor em reais (R$ 1.234,50).
@Pipe({ name: 'moeda', standalone: false })
export class MoedaPipe implements PipeTransform {
  transform(valor: number | string | null | undefined): string {
    return formatarMoeda(valor);
  }
}

// Preço por litro, com até 4 casas.
@Pipe({ name: 'precoLitro', standalone: false })
export class PrecoLitroPipe implements PipeTransform {
  transform(valor: number | string | null | undefined): string {
    return formatarPrecoLitro(valor);
  }
}
