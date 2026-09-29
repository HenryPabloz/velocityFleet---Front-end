import { EnvironmentProviders, Provider } from '@angular/core';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { of } from 'rxjs';

import ptBR from '../../public/assets/i18n/pt-BR.json';

// Usa o pt-BR.json de verdade: os testes leem os mesmos textos que o usuário lê.
export function provedoresDeTraducao(): Array<Provider | EnvironmentProviders> {
  return [
    provideTranslateService({
      lang: 'pt-BR',
      fallbackLang: 'pt-BR',
      loader: { provide: TranslateLoader, useValue: { getTranslation: () => of(ptBR) } },
    }),
  ];
}
