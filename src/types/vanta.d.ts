// A biblioteca vanta não traz tipos. Aqui declaramos só o que usamos do efeito NET.
declare module 'vanta/dist/vanta.net.min' {
  export interface EfeitoVanta {
    destroy(): void;
    resize(): void;
    // "speed" controla a velocidade da animação (1 = normal).
    options: { speed?: number };
  }

  const criarEfeitoNet: (opcoes: Record<string, unknown>) => EfeitoVanta;
  export default criarEfeitoNet;
}

// O three não tem tipos instalados; só repassamos o módulo ao Vanta.
declare module 'three';
