import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IDENTITY_PERMISSIONS_API_BASE_URL } from './identity-permissions-api-base-url';

/**
 * Efektywny zbiór uprawnień bieżącego użytkownika — ładowany raz przy starcie appki
 * (`STARTUP.ts`, `GET /me/permissions`) i odświeżany na sygnaturę SignalR `identity.user`
 * dla własnego `userId` (patrz docs/backend/identity-authz.md §6). Front tylko chowa UI na
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

  public async load(): Promise<void> {
    try {
      const codes = await firstValueFrom(this._http.get<string[]>(`${this._baseUrl}/me/permissions`));
      this._permissions.set(new Set(codes));
    } catch (error) {
      console.error('[PermissionStore] Nie udało się pobrać uprawnień — zakładam pusty zbiór.', error);
      this._permissions.set(new Set());
    } finally {
      this._loaded.set(true);
    }
  }

  public has(code: string): boolean {
    return this._permissions().has(code);
  }
}
