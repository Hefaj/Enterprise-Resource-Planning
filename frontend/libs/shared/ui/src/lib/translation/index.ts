import { Provider, Injectable, isDevMode, EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { provideTranslocoScope, Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTaiga } from '@taiga-ui/core';
import { erpClientIdInterceptor } from '@erp/shared/data-access';
import { ErpModalService } from '../atoms/erp-modal/erp-modal.service';

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

export interface RemoteDevSupportOptions {
  modulePrefix?: string;
  remoteModalIds?: string[];
  registerModals?: () => Promise<any[]>;
  getModalProviders?: () => Promise<any[]>;
  contractLoader?: () => Promise<any>;
}

export function provideRemoteDevSupport(options?: RemoteDevSupportOptions): (Provider | EnvironmentProviders)[] {
  const providers: (Provider | EnvironmentProviders)[] = [
    // Ten sam zestaw interceptorów co w hoście — remote uruchomiony samodzielnie w dev
    // musi identyfikować się backendowi tak samo, inaczej zadania zlecone z jego modali
    // nie doczekają się powiadomienia o zakończeniu.
    provideHttpClient(withInterceptors([erpClientIdInterceptor])),
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

  if (options?.modulePrefix) {
    providers.push(
      provideAppInitializer(async () => {
        const modalService = inject(ErpModalService);
        modalService.setDefaultDevModule(options.modulePrefix!);

        if (options.contractLoader) {
          modalService.registerContractLoader(options.modulePrefix!, options.contractLoader);
          try {
            const contract = await options.contractLoader();
            if (contract?.remoteModalIds) {
              modalService.registerModalIds(options.modulePrefix!, contract.remoteModalIds);
            }
          } catch (err) {
            console.warn(`[RemoteDevSupport] Failed to load contract for "${options.modulePrefix}"`, err);
          }
        } else {
          modalService.registerContractLoader(options.modulePrefix!, async () => ({
            remoteModalIds: options.remoteModalIds ?? [],
            registerModals: options.registerModals ?? (async () => []),
            getModalProviders: options.getModalProviders ?? (async () => []),
          }));
          if (options.remoteModalIds) {
            modalService.registerModalIds(options.modulePrefix!, options.remoteModalIds);
          }
        }
      })
    );
  }

  return providers;
}

