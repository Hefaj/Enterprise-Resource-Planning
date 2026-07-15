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
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  public readonly inputControl = new FormControl('', [Validators.required]);
  public readonly inputConfig = ErpInputBuilder.create(b => b
    .setLabel('Test Input')
    .setPlaceholder('Wpisz coś...')
    .setHint('To jest tekst pomocniczy')
    .setTooltip('Podpowiedź dla inputa')
    .setIconStart('@tui.pencil')
    .setErrorMessages({ required: 'To pole jest wymagane!' })
  );

  public readonly switchControl = new FormControl(false);
  public readonly switchConfig = ErpSwitchBuilder.create(b => b
    .setLabel('Test Switch')
    .setHint('Zaznacz przełącznik')
    .setTooltip('Podpowiedź dla switcha')
  );

  public readonly colorControl = new FormControl('#3f51b5');
  public readonly colorConfig = ErpInputColorBuilder.create(b => b
    .setLabel('Test Kolor')
    .setTooltip('Wybierz kolor')
  );

  public readonly checkboxControl = new FormControl(false, [Validators.requiredTrue]);
  public readonly checkboxConfig = ErpCheckboxBuilder.create(b => b
    .setLabel('Test Checkbox')
    .setHint('Musisz zaznaczyć checkbox')
    .setTooltip('Podpowiedź dla checkboxa')
    .setErrorMessages({ required: 'Zaznaczenie jest wymagane!' })
  );

  public readonly additionalControl = new FormControl('', [Validators.required]);
  public readonly additionalConfig = ErpInputBuilder.create(b => b
    .setLabel('Dodatkowe Pole')
    .setPlaceholder('Wypełnij mnie...')
    .setErrorMessages({ required: 'To pole dodatkowe jest wymagane!' })
  );

  public readonly testForm = new FormGroup({
    input: this.inputControl,
    switch: this.switchControl,
    color: this.colorControl,
    checkbox: this.checkboxControl,
    additional: this.additionalControl,
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
