import { computed, inject, Injectable } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
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
 * patrz `docs/backend/identity-authz.md` §5-6). Backend NIE zna ról ani uprawnień na tym
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
   * hasło NIGDY nie dotyka kodu SPA, patrz uzasadnienie w `docs/backend/identity-authz.md` §1. */
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
}

interface KeycloakUserData {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
}
