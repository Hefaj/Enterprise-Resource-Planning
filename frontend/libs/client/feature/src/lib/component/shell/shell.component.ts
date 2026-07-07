import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ErpInputComponent, ErpInputBuilder } from '@erp/shared/ui/erp-input';
import { ERP_ICONS } from '@erp/shared/ui';
import { form, required, email, FormField } from '@angular/forms/signals';

@Component({
  selector: 'erp-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ErpInputComponent,
    FormField,
  ],
  templateUrl: './shell.component.html',
})
export class ShellLayoutComponent {
  // Wartość z buildera
  readonly inputWithValueBuilder = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wartość z buildera')
     .setValue('Inicjalna wartość z buildera!')
     .setClearable(true)
  );

  readonly basicInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wpisz tekst...')
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

  readonly inputWithError = ErpInputBuilder.create(b =>
    b.setPlaceholder('Email')
     .setError('Nieprawidłowy format adresu email')
     .setType('email')
  );

  readonly clearableInput = ErpInputBuilder.create(b =>
    b.setPlaceholder('Wyczyść przyciskiem X')
     .setClearable(true)
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
     .setClearable(true)
     .setTooltip('To pole wymaga pełnego imienia i nazwiska')
     .setSize('l')
  );

  readonly demoValue = signal('Wartość testowa');

  // --- SEKCJA SIGNAL FORMS ---
  readonly userModel = signal({
    email: '',
    username: 'john_doe',
  });

  readonly userForm = form(this.userModel, (f) => {
    required(f.email);
    email(f.email);
    required(f.username);
  });

  readonly signalEmailConfig = ErpInputBuilder.create(b =>
    b.setPlaceholder('Podaj email...')
  );

  readonly signalUsernameConfig = ErpInputBuilder.create(b =>
    b.setPlaceholder('Nazwa użytkownika...')
  );
}
