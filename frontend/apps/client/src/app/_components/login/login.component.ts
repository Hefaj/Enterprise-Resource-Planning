import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';

import { AuthService } from '@auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, CheckboxModule, InputTextModule, ButtonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  public checked1 = signal<boolean>(true);

  // private _fb = inject(FormBuilder);
  private _authService = inject(AuthService);
  private _router = inject(Router);

  public onClick(): void {
    this._authService.setToken('ey...przykladowy.token.jwt...');
    this._router.navigate(['/dashboard']);
  }

  // // Zmienna do obsługi stanu ładowania przycisku (możesz ją podpiąć pod p-button [loading]="isLoading")
  // public isLoading = false;

  // // Definicja formularza z walidacją
  // public loginForm = this._fb.group({
  //   email: ['', [Validators.required, Validators.email]],
  //   password: ['', Validators.required],
  // });

  // public onSubmit(): void {
  //   if (this.loginForm.invalid) {
  //     this.loginForm.markAllAsTouched();
  //     return;
  //   }

  //   this.isLoading = true;
  //   const { email, password } = this.loginForm.value;

  //   // Tutaj normalnie wywołałbyś serwis HTTP z logowaniem.
  //   // Dla przykładu symulujemy zapytanie:
  //   setTimeout(() => {
  //     // Zakładamy, że API zwróciło poprawny token
  //     const fakeTokenFromApi = 'ey...przykladowy.token.jwt...';

  //     // 1. Zapisujemy token we współdzielonym stanie!
  //     this._authService.setToken(fakeTokenFromApi);

  //     this.isLoading = false;

  //     // 2. Przekierowujemy do aplikacji Remote (np. Dashboard)
  //     this._router.navigate(['/remote1']);
  //   }, 1000);
  // }
}
