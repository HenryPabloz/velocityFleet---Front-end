import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

// Wrapper do ngx-toastr: se um dia trocarmos a biblioteca, só este arquivo muda.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private toastr: ToastrService) {}

  sucesso(mensagem: string, titulo?: string): void {
    this.toastr.success(mensagem, titulo);
  }

  erro(mensagem: string, titulo?: string): void {
    this.toastr.error(mensagem, titulo);
  }

  aviso(mensagem: string, titulo?: string): void {
    this.toastr.warning(mensagem, titulo);
  }

  info(mensagem: string, titulo?: string): void {
    this.toastr.info(mensagem, titulo);
  }
}
