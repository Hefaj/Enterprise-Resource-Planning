import { ApplicationConfig, LOCALE_ID, inject, isDevMode, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { appRoutes } from '@erp/client/contract';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { STARTUP } from './STARTUP';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { provideTransloco } from '@jsverse/transloco';
import { provideSharedTranslations, TranslocoInlineLoader } from '@erp/shared/ui';
import { remoteApiProviders } from './remote-api.providers';
import { erpPermissionErrorInterceptor } from './erp-permission-error.interceptor';
import { provideTaiga } from '@taiga-ui/core';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { ErpLanguageService, AppLanguage, erpClientIdInterceptor, erpRequestIdInterceptor, SIGNALR_ACCESS_TOKEN_FACTORY, ERP_LOGOUT_HANDLER } from '@erp/shared/data-access';
import { erpAuthInterceptor, ErpAuthService } from '@erp/shared/auth';
import { provideAuth } from 'angular-auth-oidc-client';


registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideTaiga(),
    provideSharedTranslations(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
      withViewTransitions({
        skipInitialTransition: true, // Opcjonalne: pomija animację przy pierwszym ładowaniu
      }),
    ),
    // X-Client-Id na każdym żądaniu — bez niego zadania masowe powstają bez adresata
    // i powiadomienie o ich zakończeniu nie ma dokąd trafić (patrz erpClientIdInterceptor).
    // erpAuthInterceptor dokłada `Authorization: Bearer` wyłącznie do żądań pasujących do
    // `secureRoutes` niżej — bez tokenu backend odrzuca każde wywołanie (patrz ErpAuthExtensions).
    // erpRequestIdInterceptor dokłada X-Request-Id wyłącznie żądaniom wysłanym wewnątrz
    // `withRequestId(...)` — to klucz idempotencji, po którym backend rozpoznaje ponowienie
    // tej samej operacji zapisu i nie wykonuje jej drugi raz.
    provideHttpClient(
      withInterceptors([
        erpAuthInterceptor,
        erpClientIdInterceptor,
        erpRequestIdInterceptor,
        erpPermissionErrorInterceptor,
      ]),
    ),
    // Authorization Code + PKCE przeciw Keycloakowi — patrz docs/backend/identity-authz.md §5-6.
    provideAuth({
      config: {
        authority: 'http://localhost:8080/realms/erp',
        clientId: 'erp-client',
        scope: 'openid profile email',
        responseType: 'code',
        // Ze slashem na końcu — realm-erp.json dopuszcza `http://localhost:4200/*`,
        // a Keycloak nie dopasowuje tego wzorca do gołego originu bez ścieżki.
        redirectUrl: `${window.location.origin}/`,
        postLogoutRedirectUri: `${window.location.origin}/`,
        silentRenew: true,
        useRefreshToken: true,
        // Token dołączany tylko do naszych mikroserwisów — nigdy do Keycloaka samego
        // (odświeżanie tokenu, endpoint /token) ani do zewnętrznych zasobów.
        secureRoutes: ['http://localhost:5149', 'http://localhost:5250', 'http://localhost:5280'],
      },
    }),
    // Zastępuje `withAppInitializerAuthCheck()` z `angular-auth-oidc-client` — tamten wariant
    // sam rejestruje `APP_INITIALIZER` wywołujący `checkAuth()`, ale NIE eksponuje nigdzie
    // wyniku/zakończenia, więc `STARTUP.ts` (osobny `provideAppInitializer`, biegnący
    // RÓWNOLEGLE — Angular nie serializuje initializerów) nie miał jak poczekać na jego
    // PRAWDZIWE zakończenie (patrz `ErpAuthService.checkAuth()`/`waitUntilAuthReady()` —
    // pełne uzasadnienie i historia wyścigu, którego to naprawia). `ErpAuthService.checkAuth()`
    // memoizuje wywołanie, więc ten initializer i `STARTUP()` czekają na TĘ SAMĄ obietnicę —
    // `checkAuth()` odpala się raz, niezależnie który z nich pierwszy go wywoła. Guardy
    // (`erpAuthGuard`/`erpGuestGuard`) nadal czekają na `isAuthenticated$`, co jest bezpieczne:
    // Angular Router odkłada nawigację startową do czasu ukończenia WSZYSTKICH initializerów
    // (w tym tego), więc guardy nigdy nie widzą stanu sprzed zakończenia `checkAuth()`.
    provideAppInitializer(() => inject(ErpAuthService).checkAuth()),
    // SyncHub wymaga [Authorize] (patrz backend/modules/Notification/Notification.Api/Hubs/SyncHub.cs) —
    // bez tego providera negocjacja SignalR dostaje 401 mimo zalogowanego użytkownika, bo
    // `SignalrSyncService` w @erp/shared/data-access nie może zależeć od @erp/shared/auth
    // (granice warstw), więc dostawcę tokenu podstawia host.
    {
      provide: SIGNALR_ACCESS_TOKEN_FACTORY,
      useFactory: (authService: ErpAuthService) => () => authService.getAccessToken(),
      deps: [ErpAuthService],
    },
    // Analogiczny most jak wyżej — `erp-settings-menu` (ShellLayoutComponent, warstwa
    // `feature`) nie może zależeć od `@erp/shared/auth`, więc wywołanie `logoff()` Keycloaka
    // podstawia host. `logoff()` kończy też sesję SSO (nie tylko lokalny token).
    {
      provide: ERP_LOGOUT_HANDLER,
      useFactory: (authService: ErpAuthService) => () => authService.logout(),
      deps: [ErpAuthService],
    },
    provideZonelessChangeDetection(),
    provideAppInitializer(STARTUP),
    { provide: LOCALE_ID, useValue: 'pl-PL' },
    {
      provide: TUI_LANGUAGE,
      useFactory: (service: ErpLanguageService) => service.tuiLanguage,
      deps: [ErpLanguageService],
    },
    ...remoteApiProviders,
    provideTransloco({
      config: {
        availableLangs: ['pl-PL', 'en-US'] as AppLanguage[],
        defaultLang: 'pl-PL' as AppLanguage,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          logMissingKey: false,
        },
      },
      loader: TranslocoInlineLoader,
    }),
  ],
};


