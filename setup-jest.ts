import '@testing-library/jest-dom';
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

// O app não usa zone.js: os testes também rodam sem ele.
setupZonelessTestEnv();

// O jsdom não tem matchMedia: criamos um simples (sem "movimento reduzido" nem tema escuro).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (consulta: string) => ({
    matches: false,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }),
});

// O jsdom não desenha WebGL: dizemos que não existe, e o login usa o fundo simples.
HTMLCanvasElement.prototype.getContext = () => null;
