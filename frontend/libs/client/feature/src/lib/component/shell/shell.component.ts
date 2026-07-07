import { Component, signal, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ErpInputComponent, ErpInputBuilder, ErpInputConfig } from '@erp/shared/ui/erp-input';
import { ERP_ICONS } from '@erp/shared/ui';
import { form, required, email } from '@angular/forms/signals';
import { TUI_DARK_MODE } from '@taiga-ui/core';

@Component({
  selector: 'erp-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ErpInputComponent,
  ],
  templateUrl: './shell.component.html',
})
export class ShellLayoutComponent {
  readonly isDarkMode = inject(TUI_DARK_MODE);

  toggleTheme(): void {
    const nextTheme = !this.isDarkMode();
    this.isDarkMode.set(nextTheme);
    localStorage.setItem('erp-theme', nextTheme ? 'dark' : 'light');
    if (nextTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Wartość z buildera
  readonly inputWithValueBuilder = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wartość z buildera')
     .setValue('Inicjalna wartość z buildera!')
  );

  readonly basicInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wpisz tekst...').setType('password')
  );

  readonly inputWithLabel = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wpisz tekst...')
     .setLabel('Etykieta (Floating Label)')
  );

  readonly inputWithIcons = ErpInputBuilder.create(b =>
    b.setPlaceholder('Szukaj...')
     .setIconStart(ERP_ICONS.search)
     .setSize('l')
  );

  readonly disabledInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Pole wyłączone')
     .setDisabled(true)
  );

  readonly clearableInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wyczyść przyciskiem X')
  );

  readonly inputWithTooltip = ErpInputBuilder.create(b =>
    b.setPlaceholder('Pole z tooltipem')
     .setTooltip('To jest podpowiedź kontekstowa')
  );

  readonly smallInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Mały (s)')
     .setSize('s')
  );

  readonly mediumInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Średni (m)')
     .setSize('m')
  );

  readonly largeInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Duży (l)')
     .setSize('l')
  );

  readonly fullInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Pełny zestaw')
     .setIconStart(ERP_ICONS.user)
     .setTooltip('To pole wymaga pełnego imienia i nazwiska')
     .setSize('l')
  );

  readonly demoValue = signal('Wartość testowa');

  // --- SEKCJA SIGNAL FORMS ---
  readonly userModel = signal({
    email: '',
    username: '',
  });

  readonly userForm = form(this.userModel, (f) => {
    required(f.email);
    email(f.email);
    required(f.username);
  });

  readonly signalEmailConfig: ErpInputConfig;
  readonly signalUsernameConfig: ErpInputConfig;

  constructor() {
    this.signalEmailConfig = ErpInputBuilder.create(b =>
      b.setPlaceholder('Podaj email...')
       .setErrorMessages({
         required: 'Adres e-mail jest wymagany.',
         email: 'Wprowadzony e-mail ma niepoprawny format.'
       })
       .setFormField(this.userForm.email)
    );

    this.signalUsernameConfig = ErpInputBuilder.create(b =>
      b.setPlaceholder('Nazwa użytkownika...')
       .setErrorMessages({
         required: 'Nazwa użytkownika jest wymagana.'
       })
       .setFormField(this.userForm.username)
    );
  }
}
