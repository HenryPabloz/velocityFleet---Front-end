// Substituto do Vanta nos testes: não desenha nada.
export default function vantaFalso(): { options: object; destroy: () => void } {
  return { options: {}, destroy: () => {} };
}
