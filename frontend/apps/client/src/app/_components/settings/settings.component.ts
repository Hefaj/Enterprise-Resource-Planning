import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  standalone: true,
  selector: 'app-user-settings',
  imports: [ReactiveFormsModule, ToggleButtonModule, ButtonModule, InputTextModule],
  template: `
    <div
      class="p-6 bg-surface-0 dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700"
    >
      <h2 class="text-2xl font-bold mb-6 text-surface-900 dark:text-surface-0">Ustawienia Konta</h2>

      <form
        [formGroup]="settingsForm"
        (ngSubmit)="saveSettings()"
        class="flex flex-col gap-4"
      >
        <div class="flex flex-col gap-2">
          <label
            for="username"
            class="font-medium"
            >Nazwa użytkownika</label
          >
          <input
            pInputText
            id="username"
            formControlName="username"
            class="w-full md:w-80"
          />
        </div>

        <div class="flex items-center gap-4 py-4 border-t border-surface-200">
          <p-toggleButton
            formControlName="darkMode"
            onLabel="Dark Mode"
            offLabel="Light Mode"
            onIcon="pi pi-moon"
            offIcon="pi pi-sun"
          />
          <span class="text-sm text-muted-color">Zmień motyw aplikacji</span>
        </div>

        <p-button
          label="Zapisz zmiany"
          type="submit"
          [loading]="isSaving()"
          class="w-fit"
          icon="pi pi-check"
        />
      </form>
    </div>
  `,
})
export class SettingsComponent {
  public isSaving = signal(false);

  private _fb = inject(FormBuilder);

  public settingsForm = this._fb.group({
    username: ['Amy Elsner', [Validators.required]],
    darkMode: [true],
  });

  public saveSettings(): void {
    this.isSaving.set(true);
    // Logika zapisu przez Backend API (.NET 10)
    setTimeout(() => this.isSaving.set(false), 1000);
  }
}
