import { Component, Input } from '@angular/core';

// Ícones SVG do layout (desenhos do Lucide, licença ISC). Só os usados, para o bundle ficar leve.
@Component({
  selector: 'app-icone',
  standalone: false,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.stroke-width]="espessura"
      [attr.width]="tamanho"
      [attr.height]="tamanho"
      aria-hidden="true"
      focusable="false"
    >
      @switch (nome) {
        @case ('dashboard') {
          <svg:rect width="7" height="9" x="3" y="3" rx="1" />
          <svg:rect width="7" height="5" x="14" y="3" rx="1" />
          <svg:rect width="7" height="9" x="14" y="12" rx="1" />
          <svg:rect width="7" height="5" x="3" y="16" rx="1" />
        }
        @case ('frota') {
          <svg:path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <svg:path d="M15 18H9" />
          <svg:path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <svg:circle cx="17" cy="18" r="2" />
          <svg:circle cx="7" cy="18" r="2" />
        }
        @case ('viagens') {
          <svg:circle cx="6" cy="19" r="3" />
          <svg:path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <svg:circle cx="18" cy="5" r="3" />
        }
        @case ('abastecimentos') {
          <svg:path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5" />
          <svg:path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16" />
          <svg:path d="M2 21h13" />
          <svg:path d="M3 9h11" />
        }
        @case ('manutencao') {
          <svg:path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
        }
        @case ('incidentes') {
          <svg:path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <svg:path d="M12 9v4" />
          <svg:path d="M12 17h.01" />
        }
        @case ('analytics') {
          <svg:path d="M3 3v16a2 2 0 0 0 2 2h16" />
          <svg:path d="m19 9-5 5-4-4-3 3" />
        }
        @case ('admin') {
          <svg:path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <svg:path d="m9 12 2 2 4-4" />
        }
        @case ('sino') {
          <svg:path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <svg:path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        }
        @case ('sino-mudo') {
          <svg:path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <svg:path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742" />
          <svg:path d="m2 2 20 20" />
          <svg:path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" />
        }
        @case ('seta-baixo') {
          <svg:path d="m6 9 6 6 6-6" />
        }
        @case ('mais') {
          <svg:circle cx="12" cy="12" r="1" />
          <svg:circle cx="19" cy="12" r="1" />
          <svg:circle cx="5" cy="12" r="1" />
        }
        @case ('sair') {
          <svg:path d="m16 17 5-5-5-5" />
          <svg:path d="M21 12H9" />
          <svg:path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        }
        @case ('menu') {
          <svg:path d="M4 5h16" />
          <svg:path d="M4 12h16" />
          <svg:path d="M4 19h16" />
        }
        @case ('monitor') {
          <svg:rect width="20" height="14" x="2" y="3" rx="2" />
          <svg:line x1="8" x2="16" y1="21" y2="21" />
          <svg:line x1="12" x2="12" y1="17" y2="21" />
        }
        @case ('lua') {
          <svg:path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
        }
        @case ('recolher') {
          <svg:rect width="18" height="18" x="3" y="3" rx="2" />
          <svg:path d="M9 3v18" />
          <svg:path d="m16 15-3-3 3-3" />
        }
        @case ('expandir') {
          <svg:rect width="18" height="18" x="3" y="3" rx="2" />
          <svg:path d="M9 3v18" />
          <svg:path d="m14 9 3 3-3 3" />
        }
        @case ('sol') {
          <svg:circle cx="12" cy="12" r="4" />
          <svg:path d="M12 2v2" />
          <svg:path d="M12 20v2" />
          <svg:path d="m4.93 4.93 1.41 1.41" />
          <svg:path d="m17.66 17.66 1.41 1.41" />
          <svg:path d="M2 12h2" />
          <svg:path d="M20 12h2" />
          <svg:path d="m6.34 17.66-1.41 1.41" />
          <svg:path d="m19.07 4.93-1.41 1.41" />
        }
        @case ('usuario') {
          <svg:circle cx="12" cy="8" r="5" />
          <svg:path d="M20 21a8 8 0 0 0-16 0" />
        }
        @case ('usuarios') {
          <svg:path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <svg:circle cx="9" cy="7" r="4" />
          <svg:path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <svg:path d="M16 3.13a4 4 0 0 1 0 7.75" />
        }
        @case ('pulso') {
          <svg:path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
        }
        @case ('calendario') {
          <svg:path d="M8 2v4" />
          <svg:path d="M16 2v4" />
          <svg:rect width="18" height="18" x="3" y="4" rx="2" />
          <svg:path d="M3 10h18" />
        }
        @case ('tabela') {
          <svg:path d="M12 3v18" />
          <svg:rect width="18" height="18" x="3" y="3" rx="2" />
          <svg:path d="M3 9h18" />
          <svg:path d="M3 15h18" />
        }
        @case ('atualizar') {
          <svg:path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <svg:path d="M21 3v5h-5" />
          <svg:path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <svg:path d="M8 16H3v5" />
        }
        @case ('cadeado') {
          <svg:rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <svg:path d="M7 11V7a5 5 0 0 1 10 0v4" />
        }
        @case ('ok') {
          <svg:circle cx="12" cy="12" r="10" />
          <svg:path d="m9 12 2 2 4-4" />
        }
        @case ('proibido') {
          <svg:circle cx="12" cy="12" r="10" />
          <svg:path d="m4.9 4.9 14.2 14.2" />
        }
        @case ('velocimetro') {
          <svg:path d="m12 14 4-4" />
          <svg:path d="M3.34 19a10 10 0 1 1 17.32 0" />
        }
        @case ('alerta') {
          <svg:circle cx="12" cy="12" r="10" />
          <svg:line x1="12" x2="12" y1="8" y2="12" />
          <svg:line x1="12" x2="12.01" y1="16" y2="16" />
        }
        @case ('info') {
          <svg:circle cx="12" cy="12" r="10" />
          <svg:path d="M12 16v-4" />
          <svg:path d="M12 8h.01" />
        }
        @case ('octogono') {
          <svg:path d="M12 16h.01" />
          <svg:path d="M12 8v4" />
          <svg:path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z" />
        }
        @case ('editar') {
          <svg:path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
          <svg:path d="m15 5 4 4" />
        }
        @case ('lixeira') {
          <svg:path d="M3 6h18" />
          <svg:path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <svg:path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <svg:path d="M10 11v6" />
          <svg:path d="M14 11v6" />
        }
        @case ('apagar-definitivo') {
          <svg:path d="M3 6h18" />
          <svg:path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <svg:path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <svg:path d="m9.5 11 5 5" />
          <svg:path d="m14.5 11-5 5" />
        }
        @case ('adicionar') {
          <svg:path d="M5 12h14" />
          <svg:path d="M12 5v14" />
        }
        @case ('seta-esquerda') {
          <svg:path d="m12 19-7-7 7-7" />
          <svg:path d="M19 12H5" />
        }
        @case ('seta-direita') {
          <svg:path d="M5 12h14" />
          <svg:path d="m12 5 7 7-7 7" />
        }
        @case ('chevron-esquerda') {
          <svg:path d="m15 18-6-6 6-6" />
        }
        @case ('chevron-direita') {
          <svg:path d="m9 18 6-6-6-6" />
        }
        @case ('busca') {
          <svg:circle cx="11" cy="11" r="8" />
          <svg:path d="m21 21-4.3-4.3" />
        }
        @case ('restaurar') {
          <svg:path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <svg:path d="M3 3v5h5" />
        }
        @case ('olho') {
          <svg:path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <svg:circle cx="12" cy="12" r="3" />
        }
        @case ('iniciar') {
          <svg:path d="M6 3 20 12 6 21z" />
        }
        @case ('bandeira') {
          <svg:path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <svg:path d="M4 22v-7" />
        }
        @case ('pino') {
          <svg:path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <svg:circle cx="12" cy="10" r="3" />
        }
        @case ('relogio') {
          <svg:circle cx="12" cy="12" r="10" />
          <svg:path d="M12 6v6l4 2" />
        }
        @case ('upload') {
          <svg:path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <svg:path d="m17 8-5-5-5 5" />
          <svg:path d="M12 3v12" />
        }
        @case ('arquivo') {
          <svg:path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <svg:path d="M14 2v4a2 2 0 0 0 2 2h4" />
        }
        @case ('imagem') {
          <svg:rect width="18" height="18" x="3" y="3" rx="2" />
          <svg:circle cx="9" cy="9" r="2" />
          <svg:path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        }
        @case ('engrenagem') {
          <svg:path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <svg:circle cx="12" cy="12" r="3" />
        }
        @case ('copiar') {
          <svg:rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <svg:path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        }
        @case ('chave') {
          <svg:path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
          <svg:path d="m21 2-9.6 9.6" />
          <svg:circle cx="7.5" cy="15.5" r="5.5" />
        }
        @case ('subir') {
          <svg:path d="m5 12 7-7 7 7" />
          <svg:path d="M12 19V5" />
        }
        @case ('fechar') {
          <svg:path d="M18 6 6 18" />
          <svg:path d="m6 6 12 12" />
        }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; flex: none; } svg { display: block; }'],
})
export class IconeComponent {
  @Input() nome = '';
  @Input() tamanho = 22;
  @Input() espessura = 1.75;
}
