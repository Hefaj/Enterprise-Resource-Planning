import { Injectable, signal, WritableSignal } from '@angular/core';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _$currentUser: WritableSignal<User | null> = signal(null);
  private _$wqe = 1;

  public $currentUser = this._$currentUser.asReadonly();

  public login(user: User): void {
    this._$currentUser.set(user);
  }
}
