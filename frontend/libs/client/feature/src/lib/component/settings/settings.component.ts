import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { AppSettingsService } from '@erp/client/util';
// import { ErpSelectComponent, ErpSelectBuilder } from '@erp/shared/ui';

@Component({
  standalone: true,
  selector: 'erp-user-settings',
  imports: [ReactiveFormsModule, ToggleButtonModule, ButtonModule, InputTextModule],
  template: `
    <!-- <div class="p-6 bg-surface-0 dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700">
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

        <div class="flex flex-col gap-2">
          <label
            for="language"
            class="font-medium"
            >Język aplikacji</label
          >
          <erp-select
            id="language"
            [config]="langSelectConfig"
            [control]="settingsForm.controls.language"
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
    </div> -->
  `,
})
export class SettingsComponent {
  // public isSaving = signal(false);

  // private _fb = inject(FormBuilder);
  // private _settingsService = inject(AppSettingsService);

  // public langSelectConfig = new ErpSelectBuilder()
  //   .setPlaceholder('Wybierz język')
  //   .setOptions([
  //     { label: 'Polski', value: 'pl' },
  //     { label: 'English', value: 'en' },
  //   ])
  //   .setOptionLabel('label')
  //   .setOptionValue('value')
  //   .setFluid(true)
  //   .build();

  // public settingsForm = this._fb.group({
  //   username: ['Amy Elsner', [Validators.required]],
  //   darkMode: [this._settingsService.isDarkMode()],
  //   language: [this._settingsService.language(), [Validators.required]],
  // });

  // public constructor() {
  //   // Reaktywne przełączanie motywu i języka przy zmianie w formularzu
  //   this.settingsForm.controls.darkMode.valueChanges.subscribe((isDark) => {
  //     if (isDark !== null) {
  //       this._settingsService.setDarkMode(isDark);
  //     }
  //   });

  //   this.settingsForm.controls.language.valueChanges.subscribe((lang) => {
  //     if (lang !== null) {
  //       this._settingsService.setLanguage(lang);
  //     }
  //   });
  // }

  // public saveSettings(): void {
  //   this.isSaving.set(true);
  //   const isDark = this.settingsForm.value.darkMode ?? false;
  //   const lang = this.settingsForm.value.language ?? 'pl';
    
  //   // Zastosowanie ustawień
  //   this._settingsService.setDarkMode(isDark);
  //   this._settingsService.setLanguage(lang);

  //   // Logika zapisu przez Backend API (.NET 10)
  //   setTimeout(() => {
  //     this.isSaving.set(false);
  //   }, 1000);
  // }
}

