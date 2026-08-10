import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';

export interface ErpUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'Admin' | 'WarehouseManager' | 'SalesRep';
  avatarUrl?: string;
}

const TOKEN_STORAGE_KEY = 'access_token';

@Injectable({
  providedIn: 'root',
})
export class ErpAuthService {
  private _$currentUser: WritableSignal<ErpUserProfile | null> = signal(null);
  public $currentUser = this._$currentUser.asReadonly();
  private _router = inject(Router);

  public login(user: ErpUserProfile): void {
    this._$currentUser.set(user);
  }

  private _$token: WritableSignal<string | null> = signal(null);

  public get $token(): Signal<string | null> {
    return this._$token.asReadonly();
  }

  /**
   * Zapisuje token dostępowy.
   * @param token Token JWT.
   * @param persistent Gdy `true` (domyślnie) token przetrwa zamknięcie przeglądarki (localStorage),
   *                   gdy `false` żyje tylko do końca sesji karty (sessionStorage).
   */
  public setToken(token: string, persistent = true): void {
    this._$token.set(token);

    const target = persistent ? localStorage : sessionStorage;
    const other = persistent ? sessionStorage : localStorage;

    target.setItem(TOKEN_STORAGE_KEY, token);
    other.removeItem(TOKEN_STORAGE_KEY);
  }

  public loadTokenFromStorage(): void {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) {
      this._$token.set(savedToken);
    }
  }

  public logout(): void {
    this._$token.set(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    this._router.navigate(['/login']);
  }
}
