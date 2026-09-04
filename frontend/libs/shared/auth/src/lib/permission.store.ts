import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IDENTITY_PERMISSIONS_API_BASE_URL } from './identity-permissions-api-base-url';

/**
 * Efektywny zbiór uprawnień bieżącego użytkownika — ładowany raz przy starcie appki
 * (`STARTUP.ts`, `GET /me/permissions`) i odświeżany na sygnaturę SignalR `identity.user`
 * dla własnego `userId` (patrz docs/architecture/security.md §6). Front tylko chowa UI na
 * jej podstawie — realne źródło prawdy zostaje na backendzie (`Permissions(...)` na
 * endpointach), więc błąd ładowania jest fail-closed: pusty zbiór, nie wyjątek, żeby nie
 * wywrócić startu appki i nie pokazać przypadkiem czegoś, na co nie ma zgody.
 */
@Injectable({ providedIn: 'root' })
export class PermissionStore {
  private readonly _http = inject(HttpClient);
  private readonly _baseUrl = inject(IDENTITY_PERMISSIONS_API_BASE_URL);

  private readonly _permissions = signal<ReadonlySet<string>>(new Set());
  private readonly _loaded = signal(false);

  public readonly $loaded = this._loaded.asReadonly();

  /** Pojedyncza próba — bez retry. Do odświeżeń w trakcie życia sesji (np. po zdarzeniu
   * SignalR `identity.user`), gdzie token jest już od dawna gotowy. */
  public async load(): Promise<void> {
    await this._fetchOnce();
  }

  /**
   * Retry z krótkim odstępem na `401` — do wywołania przy starcie appki (`STARTUP.ts`).
   * Główny wyścig „token jeszcze nie gotowy mimo `isAuthenticated === true`" jest już
   * usunięty u źródła: `STARTUP.ts` czeka na `ErpAuthService.waitUntilAuthReady()`, które
   * czeka na PRAWDZIWE zakończenie `checkAuth()` (nie na pierwszą wartość `isAuthenticated$`
   * — patrz komentarz przy `ErpAuthService.checkAuth()` po pełną historię), a token trafia do
   * storage PRZED opublikowaniem tego stanu. Ten retry zostaje jako siatka bezpieczeństwa na
   * inne źródła rozjazdu w czasie (np. realna wolność backendu Identity przy starcie), nie
   * jako podstawowa obrona. W odróżnieniu od `load()`, retry-uje TYLKO `401` (rozjazd tokenu
   * w czasie), nie inne błędy (np. 403/5xx — tam retry niczego by nie naprawił) — po
   * wyczerpaniu prób i tak zostaje fail-closed jak w `load()`.
   */
  public async loadWithRetry(maxAttempts = 10, delayMs = 500): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this._fetchOnce();

      if (result === 'ok' || result === 'error') {
        return;
      }

      if (attempt === maxAttempts) {
        console.warn(`[PermissionStore] /me/permissions dalej 401 po ${maxAttempts} próbach — zakładam pusty zbiór.`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  public has(code: string): boolean {
    return this._permissions().has(code);
  }

  private async _fetchOnce(): Promise<'ok' | 'unauthorized' | 'error'> {
    try {
      const codes = await firstValueFrom(this._http.get<string[]>(`${this._baseUrl}/me/permissions`));
      this._permissions.set(new Set(codes));
      this._loaded.set(true);
      return 'ok';
    } catch (error) {
      this._permissions.set(new Set());
      this._loaded.set(true);

      if (error instanceof HttpErrorResponse && error.status === 401) {
        return 'unauthorized';
      }

      console.error('[PermissionStore] Nie udało się pobrać uprawnień — zakładam pusty zbiór.', error);
      return 'error';
    }
  }
}
