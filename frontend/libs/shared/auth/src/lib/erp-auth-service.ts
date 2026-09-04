import { computed, inject, Injectable } from '@angular/core';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';

export interface ErpUserProfile {
  /** Claim `sub` z tokenu Keycloaka — jedyny stabilny identyfikator użytkownika,
   * ten sam, którego backend czyta w `ExecutionContextMiddleware`. */
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

/**
 * Cienka fasada nad `OidcSecurityService` (Authorization Code + PKCE, Keycloak jako IdP —
 * patrz `docs/architecture/security.md` §5-6). Backend NIE zna ról ani uprawnień na tym
 * etapie (Faza 1 — samo uwierzytelnianie); `ErpUserProfile` niesie wyłącznie tożsamość.
 * Role/uprawnienia dojdą w Fazie 3-5 jako osobny `PermissionStore` zasilany przez mikroserwis
 * Identity, nie przez claimy tokenu Keycloaka.
 *
 * Do 2026-08 ten serwis trzymał zamockowany token w `localStorage` i fałszywą rolę
 * (`'Admin' | 'WarehouseManager' | 'SalesRep'`) — usunięte razem z wdrożeniem Keycloaka.
 */
@Injectable({
  providedIn: 'root',
})
export class ErpAuthService {
  private readonly _oidcSecurityService = inject(OidcSecurityService);

  /** Memoizacja pojedynczego wywołania `checkAuth()` — patrz `checkAuth()` niżej. */
  private _authCheckPromise: Promise<LoginResponse[]> | null = null;

  /** `true`, gdy sesja OIDC jest aktywna. Odczytywane jako sygnał — bez subskrypcji ręcznej. */
  public readonly $isAuthenticated = computed(() => this._oidcSecurityService.authenticated().isAuthenticated);

  public readonly $currentUser = computed<ErpUserProfile | null>(() => {
    const userData = this._oidcSecurityService.userData().userData as KeycloakUserData | null;

    if (!userData?.sub) {
      return null;
    }

    return {
      id: userData.sub,
      fullName: userData.name ?? userData.preferred_username ?? userData.email ?? userData.sub,
      email: userData.email ?? '',
      avatarUrl: undefined,
    };
  });

  /** Przekierowuje do hostowanej strony logowania Keycloaka (Authorization Code + PKCE) —
   * hasło NIGDY nie dotyka kodu SPA, patrz uzasadnienie w `docs/architecture/security.md` §1. */
  public login(): void {
    this._oidcSecurityService.authorize();
  }

  /** Wylogowuje z Keycloaka (kończy sesję SSO) i czyści lokalny stan tokenu. */
  public async logout(): Promise<void> {
    await firstValueFrom(this._oidcSecurityService.logoff());
  }

  /** Bieżący access token — do użycia poza interceptorem (np. `accessTokenFactory` SignalR). */
  public getAccessToken(): Promise<string> {
    return firstValueFrom(this._oidcSecurityService.getAccessToken());
  }

  /**
   * Uruchamia `checkAuth()` biblioteki DOKŁADNIE RAZ (kolejne wywołania dostają tę samą
   * zapamiętaną obietnicę) i zwraca obietnicę jego PRAWDZIWEGO zakończenia.
   *
   * Zastępuje `withAppInitializerAuthCheck()` z `angular-auth-oidc-client` — ten wariant sam
   * rejestruje `APP_INITIALIZER`, ale nie eksponuje NIGDZIE wyniku/zakończenia tego wywołania,
   * więc `STARTUP.ts` (osobny `provideAppInitializer`, biegnący RÓWNOLEGLE — Angular nie
   * serializuje initializerów) nie miał jak na nie poczekać. Zamiast tego czekał na
   * `isAuthenticated$`, a to jest `BehaviorSubject` (`AuthStateService.authenticatedInternal$`)
   * zainicjalizowany na `{isAuthenticated: false}` — subskrybując go PRZED zakończeniem
   * `checkAuth()` (co przy ŚWIEŻYM logowaniu, wymagającym realnej wymiany `code`→token przez
   * sieć, jest regułą, nie wyjątkiem — inicjalizatory startują w tym samym takcie), `firstValueFrom`
   * łapał ten JESZCZE nietknięty stan startowy natychmiast (mikrotask, nie realne zakończenie
   * sprawdzenia), a nie wynik faktycznego sprawdzenia. Efekt: `STARTUP()` widział
   * `$isAuthenticated() === false` i przerywał start (menu nigdy się nie budowało — puste,
   * naprawiał to dopiero reload, bo przy nim `checkAuth()` może rozstrzygnąć się w pełni
   * synchronicznie z danych w `sessionStorage`, bez sieci).
   *
   * `checkAuth()` tutaj czeka na REALNE zakończenie `checkAuthMultiple()` — cała asynchroniczna
   * praca (well-known, wymiana kodu, JWKS) musi się zakończyć, zanim obietnica się rozstrzygnie,
   * niezależnie od tego, ile trwa. Ten sam serwis rejestruje initializer w `app.config.ts`
   * (`provideAppInitializer(() => inject(ErpAuthService).checkAuth())`), więc obie strony
   * (initializer biblioteki-zastępczy i `STARTUP()`) czekają na TĘ SAMĄ obietnicę.
   */
  public checkAuth(): Promise<LoginResponse[]> {
    this._authCheckPromise ??= firstValueFrom(this._oidcSecurityService.checkAuthMultiple());
    return this._authCheckPromise;
  }

  /**
   * Czeka, aż `checkAuth()` (patrz wyżej) faktycznie się zakończy — w odróżnieniu od
   * poprzedniej implementacji (subskrypcja `isAuthenticated$`) to jest gwarancja PRAWDZIWEGO
   * zakończenia, nie odczyt aktualnej (możliwie jeszcze nierozstrzygniętej) wartości.
   */
  public async waitUntilAuthReady(): Promise<void> {
    await this.checkAuth();
  }
}

interface KeycloakUserData {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
}
