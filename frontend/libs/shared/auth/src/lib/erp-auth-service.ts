import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';

export interface ErpUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: 'Admin' | 'WarehouseManager' | 'SalesRep';
  avatarUrl?: string;
}

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

  public setToken(token: string): void {
    this._$token.set(token);
    localStorage.setItem('access_token', token);
  }

  public loadTokenFromStorage(): void {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      this._$token.set(savedToken);
    }
  }

  public logout(): void {
    this._$token.set(null);
    localStorage.removeItem('access_token');
    this._router.navigate(['/login']);
  }
}
