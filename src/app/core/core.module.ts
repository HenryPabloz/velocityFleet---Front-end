import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideToastr } from 'ngx-toastr';

import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';

// Serviços globais: HTTP com interceptors, i18n e toasts. Importe só no AppModule.
@NgModule({
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    provideTranslateService({
      lang: 'pt-BR',
      fallbackLang: 'pt-BR',
      loader: provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    }),
    provideToastr({
      positionClass: 'toast-top-right',
      timeOut: 5000,
      closeButton: true,
      preventDuplicates: true,
    }),
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() moduloPai: CoreModule) {
    if (moduloPai) {
      throw new Error('CoreModule já foi carregado. Importe apenas no AppModule.');
    }
  }
}
