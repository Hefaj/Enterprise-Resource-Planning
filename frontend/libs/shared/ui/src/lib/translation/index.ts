import { Provider, Injectable } from '@angular/core';
import { provideTranslocoScope, Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

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
