import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import {
  ErpButtonComponent,
  ErpButtonBuilder,
  ErpButtonConfig,
  ErpInputComponent,
  ErpInputBuilder,
  ErpSwitchComponent,
  ErpSwitchBuilder,
  ErpInputColorComponent,
  ErpInputColorBuilder,
  ErpCheckboxComponent,
  ErpCheckboxBuilder,
  ErpDatePickerComponent,
  ErpDatePickerBuilder,
} from '@erp/shared/ui';

@Component({
  selector: 'erp-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ErpButtonComponent,
    ErpInputComponent,
    ErpSwitchComponent,
    ErpInputColorComponent,
    ErpCheckboxComponent,
    ErpDatePickerComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  public readonly inputControl = new FormControl('', [Validators.required]);
  public readonly inputConfig = ErpInputBuilder.create(b => b
    .setLabel('Test Input')
    .setPlaceholder('Wpisz coś...')
    .setHint('hint')
    .setTooltip('(tooltip)')
    .setIconStart('@tui.pencil')
    .setErrorMessages({ required: 'To pole jest wymagane!' })
  );

  public readonly switchControl = new FormControl(false);
  public readonly switchConfig = ErpSwitchBuilder.create(b => b
    .setLabel('Test Switch')
    .setHint('hint')
    .setTooltip('(tooltip)')
  );

  public readonly colorControl = new FormControl('#3f51b5');
  public readonly colorConfig = ErpInputColorBuilder.create(b => b
    .setLabel('Test Kolor')
    .setHint('hint')
    .setTooltip('(tooltip)')
  );

  public readonly checkboxControl = new FormControl(false, [Validators.requiredTrue]);
  public readonly checkboxConfig = ErpCheckboxBuilder.create(b => b
    .setLabel('Test Checkbox')
    .setHint('hint')
    .setTooltip('(tooltip)')
    .setErrorMessages({ required: 'Zaznaczenie jest wymagane!' })
  );

  public readonly additionalControl = new FormControl('', [Validators.required]);
  public readonly additionalConfig = ErpInputBuilder.create(b => b
    .setLabel('Dodatkowe Pole')
    .setPlaceholder('Wypełnij mnie...')
    .setHint('hint')
    .setTooltip('(tooltip)')
    .setErrorMessages({ required: 'To pole dodatkowe jest wymagane!' })
  );

  // Kontrolki ErpDatePicker
  public readonly singleDateControl = new FormControl<any>(null);
  public readonly singleDatePickerConfig = ErpDatePickerBuilder.create((b) =>
    b
      .setLabel('Pojedyncza data')
      .setPlaceholder('Wybierz datę')
      .setStrategy('single')
      .setTooltip('(tooltip)')
      .setHint('hint')
  );

  public readonly rangeDateControl = new FormControl<any>(null);
  public readonly rangeDatePickerConfig = ErpDatePickerBuilder.create((b) =>
    b
      .setLabel('Zakres dat')
      .setTooltip('(tooltip)')
      .setHint('hint')
      .setPlaceholder('Wybierz zakres')
      .setStrategy('range')
  );

  public readonly multipleDateControl = new FormControl<any>([]);
  public readonly multipleDatePickerConfig = ErpDatePickerBuilder.create((b) =>
    b
      .setLabel('Wielokrotny wybór dat')
      .setTooltip('(tooltip)')
      .setHint('hint')
      .setPlaceholder('Dodaj datę')
      .setStrategy('multiple')
  );

  public readonly dateTimeDateControl = new FormControl<any>(null, [Validators.required]);
  public readonly dateTimeDatePickerConfig = ErpDatePickerBuilder.create((b) =>
    b
      .setLabel('Data i czas')
      .setPlaceholder('Wybierz datę i czas')
      .setTooltip('(tooltip)')
      .setHint('hint')
      .setStrategy('single')
      .setMode('datetime')
  );

  public readonly testForm = new FormGroup({
    input: this.inputControl,
    switch: this.switchControl,
    color: this.colorControl,
    checkbox: this.checkboxControl,
    additional: this.additionalControl,
    singleDate: this.singleDateControl,
    rangeDate: this.rangeDateControl,
    multipleDate: this.multipleDateControl,
    dateTimeDate: this.dateTimeDateControl,
  });

  public readonly submitBtnConfig: ErpButtonConfig = ErpButtonBuilder.create(b => b
    .setLabel('Wyślij formularz')
    .setAppearance('primary')
    .setFn(() => this.onSubmit())
  );

  public constructor() {
    this.switchControl.valueChanges.subscribe(val => {
      if (val) {
        this.additionalControl.enable();
      } else {
        this.additionalControl.disable();
        this.additionalControl.setValue('');
      }
    });
    this.additionalControl.disable();
  }

  public onSubmit(): void {
    if (this.testForm.invalid) {
      this.testForm.markAllAsTouched();
      Object.keys(this.testForm.controls).forEach(key => {
        this.testForm.get(key)?.updateValueAndValidity({ emitEvent: true });
      });
      return;
    }
    console.log('Form submitted:', this.testForm.value);
  }
}
