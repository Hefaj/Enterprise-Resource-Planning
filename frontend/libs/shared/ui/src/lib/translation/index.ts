import { Provider, Injectable, isDevMode, EnvironmentProviders } from '@angular/core';
import { provideTranslocoScope, Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideTaiga } from '@taiga-ui/core';

export { SHARED_KEYS } from './keys';

@Injectable({ providedIn: 'root' })
export class TranslocoInlineLoader implements TranslocoLoader {
  public getTranslation(lang: string): Observable<Translation> {
    return of({});
  }
}

export function provideSharedTranslations(): Provider {
  return provideTranslocoScope({
    scope: 'shared',
    alias: 'shared',
    loader: {
      'pl-PL': () => import('./pl-PL.json'),
      'en-US': () => import('./en-US.json'),
    },
  });
}

export function provideRemoteDevSupport(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideTaiga(),
    provideTransloco({
      config: {
        availableLangs: ['pl-PL', 'en-US'],
        defaultLang: 'pl-PL',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoInlineLoader,
    }),
    provideSharedTranslations(),
  ];
}

