import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { gsap } from 'gsap';
import type { EfeitoVanta } from 'vanta/dist/vanta.net.min';
import { Subscription } from 'rxjs';

import { AuthStateService } from '../../../../core/services/auth-state.service';

// Regex simples: algo@algo.algo, sem espaços.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONSULTA_MOVIMENTO_REDUZIDO = '(prefers-reduced-motion: reduce)';

function emailValido(controle: AbstractControl): ValidationErrors | null {
  const valor = String(controle.value ?? '').trim();
  if (valor === '') {
    return null;
  }
  if (REGEX_EMAIL.test(valor)) {
    return null;
  }
  return { emailInvalido: true };
}

// Tela de login "a ignição": e-mail e senha bastam, ENTRAR é a partida.
@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('raizLogin', { static: true }) raizLogin!: ElementRef<HTMLElement>;
  @ViewChild('fundoVanta', { static: true }) fundoVanta!: ElementRef<HTMLElement>;
  @ViewChild('cartaoLogin', { static: true }) cartaoLogin!: ElementRef<HTMLElement>;
  @ViewChild('botaoEntrar', { static: true }) botaoEntrar!: ElementRef<HTMLElement>;
  @ViewChild('arcoProgresso', { static: true }) arcoProgresso!: ElementRef<SVGPathElement>;

  formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, emailValido],
    }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  enviado = false;
  carregando = false;
  verSenha = false;
  chaveErro = '';

  private mm: gsap.MatchMedia | null = null;
  private contexto: gsap.Context | null = null;
  private pulso: gsap.core.Tween | null = null;
  private efeitoVanta: EfeitoVanta | null = null;
  private assinaturaLogin: Subscription | null = null;
  private destruido = false;

  constructor(
    private estadoAutenticacao: AuthStateService,
    private router: Router,
    private zona: NgZone,
    private detector: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    // Animações fora do Angular: o ticker do GSAP não deve disparar detecção de mudanças.
    this.zona.runOutsideAngular(() => {
      this.contexto = gsap.context(() => {}, this.raizLogin.nativeElement);
      this.iniciarEntrada();
      this.iniciarVanta();
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.assinaturaLogin?.unsubscribe();
    this.pulso?.kill();
    this.mm?.revert();
    this.contexto?.revert();
    if (this.efeitoVanta) {
      gsap.killTweensOf(this.efeitoVanta.options);
      this.efeitoVanta.destroy();
      this.efeitoVanta = null;
    }
  }

  // ---------- Formulário ----------

  // Devolve a chave de tradução do erro do campo, ou '' se estiver tudo certo.
  erroDoCampo(nome: 'email' | 'senha'): string {
    const controle = this.formulario.controls[nome];
    if (!controle.invalid) {
      return '';
    }
    if (!controle.touched && !this.enviado) {
      return '';
    }
    if (controle.hasError('required')) {
      if (nome === 'email') {
        return 'AUTH.ERROS.EMAIL_OBRIGATORIO';
      }
      return 'AUTH.ERROS.SENHA_OBRIGATORIA';
    }
    return 'AUTH.ERROS.EMAIL_INVALIDO';
  }

  temErro(nome: 'email' | 'senha'): boolean {
    return this.erroDoCampo(nome) !== '';
  }

  // Só aponta para a mensagem de erro quando ela existe na tela.
  descricaoDoCampo(nome: 'email' | 'senha'): string | null {
    if (this.temErro(nome)) {
      return 'erro-' + nome;
    }
    return null;
  }

  get tipoSenha(): string {
    if (this.verSenha) {
      return 'text';
    }
    return 'password';
  }

  alternarSenha(): void {
    this.verSenha = !this.verSenha;
  }

  // Ao focar um campo o botão para de pulsar.
  aoFocarCampo(): void {
    if (this.pulso) {
      this.pulso.kill();
      this.pulso = null;
      gsap.set(this.botaoEntrar.nativeElement, { clearProps: 'boxShadow' });
    }
  }

  entrar(): void {
    if (this.carregando) {
      return;
    }
    this.enviado = true;
    this.chaveErro = '';

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.focarPrimeiroInvalido();
      return;
    }

    this.carregando = true;
    this.varrerArco();
    const valores = this.formulario.getRawValue();

    this.assinaturaLogin = this.estadoAutenticacao
      .login(valores.email.trim(), valores.senha)
      .subscribe({
        next: () => this.aoLogar(),
        error: (erro: HttpErrorResponse) => this.aoFalhar(erro),
      });
  }

  // ---------- Resultado do login ----------

  private aoLogar(): void {
    this.zona.runOutsideAngular(() => {
      if (this.movimentoReduzido()) {
        this.zona.run(() => this.router.navigate(['/dashboard']));
        return;
      }
      // Sucesso: rede acelera, arco fecha, card sai e só então navega.
      this.contexto?.add(() => {
        const linha = gsap.timeline({
          onComplete: () => this.zona.run(() => this.router.navigate(['/dashboard'])),
        });
        linha.to(this.arcoProgresso.nativeElement, { strokeDashoffset: 0, duration: 0.3 }, 0);
        if (this.efeitoVanta) {
          linha.to(this.efeitoVanta.options, { speed: 6, duration: 0.6, ease: 'power2.in' }, 0);
        }
        linha.to(
          this.cartaoLogin.nativeElement,
          { y: -24, autoAlpha: 0, duration: 0.4, ease: 'power2.in' },
          0.25,
        );
      });
    });
  }

  private aoFalhar(erro: HttpErrorResponse): void {
    this.carregando = false;
    if (erro.status === 401) {
      this.chaveErro = 'AUTH.ERROS.CREDENCIAIS';
    } else if (erro.status === 403) {
      this.chaveErro = 'AUTH.ERROS.CONTA_INATIVA';
    } else if (erro.status === 429) {
      this.chaveErro = 'AUTH.ERROS.MUITAS_TENTATIVAS';
    } else if (erro.status === 0) {
      this.chaveErro = 'AUTH.ERROS.SEM_CONEXAO';
    } else {
      this.chaveErro = 'AUTH.ERROS.GENERICO';
    }

    // O app não usa zone.js: avisamos o Angular para redesenhar a tela.
    this.detector.detectChanges();
    this.zona.runOutsideAngular(() => this.animarErro());
    document.getElementById('campo-email')?.focus();
  }

  private focarPrimeiroInvalido(): void {
    const ordem: Array<'email' | 'senha'> = ['email', 'senha'];
    const ids = { email: 'campo-email', senha: 'campo-senha' };
    for (const nome of ordem) {
      if (this.formulario.controls[nome].invalid) {
        document.getElementById(ids[nome])?.focus();
        return;
      }
    }
  }

  // ---------- Movimento (GSAP) ----------

  private movimentoReduzido(): boolean {
    return window.matchMedia(CONSULTA_MOVIMENTO_REDUZIDO).matches;
  }

  // Entrada em uma timeline só, e pulso do botão. Nada disso roda com movimento reduzido.
  private iniciarEntrada(): void {
    this.mm = gsap.matchMedia(this.raizLogin.nativeElement);
    this.mm.add('(prefers-reduced-motion: no-preference)', () => {
      const linha = gsap.timeline({ defaults: { ease: 'power3.out' } });
      linha
        .from('.vf-login__logo', { scale: 0.6, autoAlpha: 0, duration: 0.6 }, 0.3)
        .from('.vf-login__titulo', { y: 16, autoAlpha: 0, duration: 0.5 }, '>-0.25')
        .from('.vf-login__aviso', { y: 12, autoAlpha: 0, duration: 0.4 }, '>-0.3')
        .from(
          '.vf-login__campo',
          { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.08, clearProps: 'all' },
          '>-0.2',
        )
        .from('.vf-login__partida', { y: 14, autoAlpha: 0, duration: 0.45, clearProps: 'all' }, '>-0.25');

      linha.call(() => {
        this.pulso = gsap.to(this.botaoEntrar.nativeElement, {
          boxShadow: '0 12px 30px -8px rgba(255, 77, 87, 0.6)',
          duration: 1.4,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
        });
      });
    });
  }

  private varrerArco(): void {
    if (this.movimentoReduzido()) {
      return;
    }
    this.zona.runOutsideAngular(() => {
      this.contexto?.add(() => {
        gsap.fromTo(
          this.arcoProgresso.nativeElement,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0.25, duration: 1.1, ease: 'power2.out', overwrite: true },
        );
      });
    });
  }

  // Erro: card treme rápido e o arco volta a zero.
  private animarErro(): void {
    if (this.movimentoReduzido()) {
      return;
    }
    this.contexto?.add(() => {
      gsap.to(this.arcoProgresso.nativeElement, {
        strokeDashoffset: 1,
        duration: 0.35,
        ease: 'power2.in',
        overwrite: true,
      });
      gsap.fromTo(
        this.cartaoLogin.nativeElement,
        { x: 0 },
        { keyframes: { x: [-10, 10, -6, 6, 0] }, duration: 0.4, ease: 'none', overwrite: true },
      );
    });
  }

  // ---------- Vanta (fundo) ----------

  private podeUsarVanta(): boolean {
    if (this.movimentoReduzido()) {
      return false;
    }
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      return false;
    }
    const tela = document.createElement('canvas');
    const contexto = tela.getContext('webgl') ?? tela.getContext('experimental-webgl');
    if (!contexto) {
      return false;
    }
    return true;
  }

  // three e vanta são carregados só aqui (import dinâmico), fora do bundle inicial.
  private async iniciarVanta(): Promise<void> {
    if (!this.podeUsarVanta()) {
      return;
    }
    try {
      const [three, vanta] = await Promise.all([import('three'), import('vanta/dist/vanta.net.min')]);
      if (this.destruido) {
        return;
      }
      const temMouse = window.matchMedia('(pointer: fine)').matches;
      this.efeitoVanta = vanta.default({
        el: this.fundoVanta.nativeElement,
        // Três r186 não tem mais VertexColors; o Vanta usa essa constante nas linhas.
        THREE: { ...three, VertexColors: true },
        mouseControls: temMouse,
        touchControls: false,
        gyroControls: false,
        color: 0xe11d2e,
        backgroundColor: 0x0b0c0f,
        points: 9,
        maxDistance: 22,
        spacing: 18,
        showDots: true,
        speed: 1,
      });
    } catch {
      // Sem Vanta, o gradiente estático do CSS continua no fundo.
    }
  }
}
