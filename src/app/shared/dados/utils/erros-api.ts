import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { ProblemDetails } from '../../../core/models';

// Mensagens conhecidas da API (em inglês) e a chave PT-BR de cada uma.
// "prefixo: true" serve para mensagens que terminam com um número.
const MENSAGENS_CONHECIDAS: { texto: string; chave: string; prefixo: boolean }[] = [
  { texto: 'Vehicle is in use', chave: 'VEICULO_EM_USO', prefixo: false },
  { texto: 'Vehicle is under maintenance', chave: 'VEICULO_EM_MANUTENCAO', prefixo: false },
  { texto: 'Vehicle is out of service', chave: 'VEICULO_FORA_SERVICO', prefixo: false },
  { texto: 'Vehicle is not available', chave: 'VEICULO_INDISPONIVEL', prefixo: true },
  { texto: 'Vehicle already has an active trip', chave: 'VEICULO_COM_VIAGEM', prefixo: false },
  { texto: 'Vehicle has an active trip', chave: 'VEICULO_COM_VIAGEM', prefixo: true },
  { texto: 'Vehicle not found', chave: 'VEICULO_NAO_ENCONTRADO', prefixo: false },
  { texto: 'Cannot delete a vehicle that is currently in use', chave: 'VEICULO_EM_USO_EXCLUIR', prefixo: true },
  { texto: 'Driver license expired', chave: 'CNH_VENCIDA', prefixo: false },
  { texto: 'Driver is not active', chave: 'MOTORISTA_INATIVO', prefixo: false },
  { texto: 'Driver user is not active', chave: 'MOTORISTA_INATIVO', prefixo: false },
  { texto: 'Driver already has an active trip', chave: 'MOTORISTA_COM_VIAGEM', prefixo: false },
  { texto: 'Driver not found', chave: 'MOTORISTA_NAO_ENCONTRADO', prefixo: false },
  { texto: 'Trip not found or not in PLANNED status', chave: 'VIAGEM_NAO_PLANEJADA', prefixo: false },
  { texto: 'Trip not found or not in IN_PROGRESS status', chave: 'VIAGEM_NAO_EM_ANDAMENTO', prefixo: false },
  { texto: 'Trip cannot be cancelled', chave: 'VIAGEM_NAO_CANCELAVEL', prefixo: true },
  { texto: 'Trip not found', chave: 'VIAGEM_NAO_ENCONTRADA', prefixo: false },
  { texto: 'Cannot delete an active trip', chave: 'VIAGEM_ATIVA_EXCLUIR', prefixo: true },
  { texto: 'End mileage cannot be less than start mileage', chave: 'KM_FINAL_MENOR_INICIAL', prefixo: false },
  { texto: 'End mileage cannot be less than vehicle current mileage', chave: 'KM_FINAL_MENOR_VEICULO', prefixo: true },
  { texto: 'Start km cannot be less than vehicle current mileage', chave: 'KM_INICIAL_MENOR_VEICULO', prefixo: true },
  { texto: 'Current mileage cannot be less than', chave: 'KM_ATUAL_MENOR', prefixo: true },
  { texto: 'Mileage cannot decrease', chave: 'KM_NAO_PODE_DIMINUIR', prefixo: false },
  { texto: 'IN_USE is set only by trips', chave: 'STATUS_EM_USO_SO_VIAGEM', prefixo: false },
  { texto: 'Plate already registered', chave: 'PLACA_JA_CADASTRADA', prefixo: false },
  { texto: 'License number already registered', chave: 'CNH_JA_CADASTRADA', prefixo: false },
  { texto: 'User already has a driver', chave: 'USUARIO_JA_MOTORISTA', prefixo: false },
  { texto: 'userId does not exist', chave: 'USUARIO_NAO_EXISTE', prefixo: false },
  { texto: 'licenseExpiry cannot be in the past', chave: 'VALIDADE_NO_PASSADO', prefixo: false },
  { texto: 'Refueling not found', chave: 'ABASTECIMENTO_NAO_ENCONTRADO', prefixo: false },
  { texto: 'Maintenance not found', chave: 'MANUTENCAO_NAO_ENCONTRADA', prefixo: false },
  { texto: 'Incident not found', chave: 'INCIDENTE_NAO_ENCONTRADO', prefixo: false },
  { texto: 'completedDate cannot be before scheduledDate', chave: 'MANUTENCAO_CONCLUIR_ANTES', prefixo: true },
  { texto: 'vehicleId does not exist', chave: 'VEICULO_NAO_ENCONTRADO', prefixo: false },
  { texto: 'Cannot change incident status', chave: 'INCIDENTE_STATUS_SO_AVANCA', prefixo: true },
  { texto: 'Cannot permanently delete', chave: 'REGISTRO_REFERENCIADO', prefixo: true },
  { texto: 'Invalid file type', chave: 'FOTO_TIPO', prefixo: true },
  { texto: 'Upload error', chave: 'FOTO_RECUSADA', prefixo: true },
  { texto: 'Plate must be in Mercosul format', chave: 'PLACA_FORMATO', prefixo: true },
  { texto: 'Only an ADMIN can modify another ADMIN account', chave: 'ADMIN_SO_ADMIN_MODIFICA', prefixo: false },
  { texto: 'You cannot deactivate or delete your own account', chave: 'NAO_DESATIVAR_PROPRIA_CONTA', prefixo: false },
  { texto: 'An ADMIN account cannot be deactivated or deleted', chave: 'ADMIN_NAO_DESATIVA', prefixo: false },
  { texto: 'You cannot change your own role', chave: 'NAO_MUDAR_PROPRIO_PAPEL', prefixo: false },
  { texto: 'User already has this role', chave: 'USUARIO_JA_TEM_PAPEL', prefixo: false },
  { texto: 'An ADMIN cannot be demoted', chave: 'ADMIN_NAO_REBAIXA', prefixo: false },
  { texto: 'Roles can only be raised', chave: 'PAPEL_SO_SOBE', prefixo: true },
  { texto: 'Email already registered', chave: 'EMAIL_JA_CADASTRADO', prefixo: false },
  { texto: 'Email or license number already registered', chave: 'EMAIL_OU_CNH_JA_CADASTRADOS', prefixo: false },
  { texto: 'User not found', chave: 'USUARIO_NAO_ENCONTRADO', prefixo: false },
  { texto: 'Current password is incorrect', chave: 'SENHA_ATUAL_INCORRETA', prefixo: false },
];

export function lerProblema(erro: unknown): ProblemDetails | null {
  if (erro instanceof HttpErrorResponse) {
    const corpo = erro.error;
    if (corpo && typeof corpo === 'object' && 'detail' in corpo) {
      return corpo as ProblemDetails;
    }
  }
  return null;
}

export function statusDoErro(erro: unknown): number {
  if (erro instanceof HttpErrorResponse) {
    return erro.status;
  }
  return 0;
}

// Troca a mensagem da API por um texto em português quando a conhecemos.
export function traduzirMensagemApi(mensagem: string, traducao: TranslateService): string {
  for (const item of MENSAGENS_CONHECIDAS) {
    let bate = mensagem === item.texto;
    if (item.prefixo && mensagem.startsWith(item.texto)) {
      bate = true;
    }
    if (bate) {
      return traducao.instant('ERROS_NEGOCIO.' + item.chave);
    }
  }
  return mensagem;
}

// Texto final para mostrar na tela: detail do RFC 7807 (traduzido) ou uma frase por status.
export function textoDoErro(erro: unknown, traducao: TranslateService): string {
  const status = statusDoErro(erro);
  if (status === 0) {
    return traducao.instant('ERROS_API.SEM_CONEXAO');
  }
  if (status === 403) {
    // 403 mostra o detail da API quando existe (ex: conta ADMIN protegida).
    const problema403 = lerProblema(erro);
    if (problema403 && problema403.detail) {
      return traduzirMensagemApi(problema403.detail, traducao);
    }
    return traducao.instant('ERROS_API.SEM_PERMISSAO');
  }
  if (status === 429) {
    return traducao.instant('ERROS_API.LIMITE');
  }
  if (status === 502 || status === 504) {
    return traducao.instant('ERROS_NEGOCIO.VIACEP_INDISPONIVEL');
  }
  if (status >= 500) {
    return traducao.instant('ERROS_API.SERVIDOR');
  }
  const problema = lerProblema(erro);
  if (problema && problema.detail) {
    return traduzirMensagemApi(problema.detail, traducao);
  }
  // Erro de upload (multer) não vem em RFC 7807: o texto está em "message".
  if (erro instanceof HttpErrorResponse && erro.error && typeof erro.error.message === 'string') {
    return traduzirMensagemApi(erro.error.message, traducao);
  }
  return traducao.instant('ERROS_API.SERVIDOR');
}

// Coloca cada mensagem de errors[] no campo certo (a mensagem começa com o nome do campo da API).
// Devolve as mensagens que não acharam campo, para mostrar num aviso geral.
export function aplicarErrosNosCampos(
  erro: unknown,
  formulario: FormGroup,
  mapaCampos: Record<string, string>,
  traducao: TranslateService,
  tratarEspecial?: (mensagem: string) => boolean,
): string[] {
  const problema = lerProblema(erro);
  const sobras: string[] = [];
  if (!problema || !problema.errors) {
    return sobras;
  }
  for (const mensagem of problema.errors) {
    // Mensagem que a tela quer tratar sozinha (ex: CEP, que não começa com o nome do campo).
    if (tratarEspecial && tratarEspecial(mensagem)) {
      continue;
    }
    const controle = acharControle(mensagem, formulario, mapaCampos);
    const texto = traduzirMensagemApi(mensagem, traducao);
    if (controle) {
      controle.setErrors({ ...(controle.errors ?? {}), servidor: texto });
      controle.markAsTouched();
    } else {
      sobras.push(texto);
    }
  }
  return sobras;
}

function acharControle(
  mensagem: string,
  formulario: FormGroup,
  mapaCampos: Record<string, string>,
): AbstractControl | null {
  const minuscula = mensagem.toLowerCase();
  for (const campoApi of Object.keys(mapaCampos)) {
    if (minuscula.startsWith(campoApi.toLowerCase() + ' ')) {
      return formulario.get(mapaCampos[campoApi]);
    }
  }
  return null;
}
