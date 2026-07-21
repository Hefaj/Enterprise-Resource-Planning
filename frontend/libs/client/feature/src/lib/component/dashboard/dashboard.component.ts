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
  ErpInputNumberComponent,
  ErpInputNumberBuilder,
  ErpSelectComponent,
  ErpSelectBuilder,
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
    ErpInputNumberComponent,
    ErpSelectComponent,
  ],
  templateUrl: './dashboard.component.html',
  styles: `
    :host {
      width: 100%;
      height: 100%;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  `
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

  // Kontrolki ErpInputNumber
  public readonly integerControl = new FormControl<number | null>(5, [Validators.required, Validators.min(0), Validators.max(50)]);
  public readonly integerConfig = ErpInputNumberBuilder.create((b) =>
    b
      .setLabel('Liczba całkowita (dodatnia, 0-50)')
      .setPlaceholder('Wpisz liczbę całkowitą')
      .setMode('integer')
      .setSign('positive')
      .setStepper(true)
      .setMin(0)
      .setMax(50)
      .setStep(1)
      .setHint('Wymagane, zakres 0-50, krok 1')
      .setTooltip('Podpowiedź dla liczby całkowitej')
      .setErrorMessages({ required: 'Wartość jest wymagana!', min: 'Minimum 0!', max: 'Maksimum 50!' })
  );

  public readonly decimalControl = new FormControl<number | null>(1.234, [Validators.required]);
  public readonly decimalConfig = ErpInputNumberBuilder.create((b) =>
    b
      .setLabel('Liczba zmiennoprzecinkowa (3 miejsca, -10 do 10)')
      .setPlaceholder('Wpisz liczbę ułamkową')
      .setMode('decimal')
      .setDecimals(3)
      .setSign('any')
      .setStepper(true)
      .setMin(-10)
      .setMax(10)
      .setStep(0.005)
      .setHint('Wymagane, zakres -10 do 10, krok 0.005')
      .setTooltip('Podpowiedź dla liczby ułamkowej')
      .setErrorMessages({ required: 'Wartość jest wymagana!' })
  );

  public readonly negativeControl = new FormControl<number | null>(-20);
  public readonly negativeConfig = ErpInputNumberBuilder.create((b) =>
    b
      .setLabel('Tylko ujemne (bez steppera)')
      .setPlaceholder('Wpisz liczbę ujemną')
      .setMode('integer')
      .setSign('negative')
      .setStepper(false)
      .setHint('Ograniczenie do wartości ujemnych')
  );

  // Kontrolki ErpSelect
  public readonly singleSelectControl = new FormControl<string | null>('Polska', [Validators.required]);
  public readonly singleSelectConfig = ErpSelectBuilder.create((b) =>
    b
      .setLabel('Pojedynczy wybór (Polska, Niemcy...)')
      .setPlaceholder('Wybierz kraj')
      .setItems(['Polska', 'Niemcy', 'Francja', 'Hiszpania', 'Włochy'])
      .setStrategy('single')
      .setSearchable(true)
      .setHint('Wybór pojedynczy z wyszukiwarką')
      .setTooltip('Podpowiedź dla pola select')
      .setErrorMessages({ required: 'Wybór kraju jest wymagany!' })
  );

  public readonly multiSelectControl = new FormControl<string[]>(['Administrator', 'Deweloper']);
  public readonly multiSelectConfig = ErpSelectBuilder.create((b) =>
    b
      .setLabel('Wielokrotny wybór w chipach (max 5)')
      .setPlaceholder('Wybierz role')
      .setItems(['Administrator', 'Deweloper', 'Analityk', 'Tester', 'Manager', 'Szef'])
      .setStrategy('multi')
      .setMaxChipsCount(5)
      .setHint('Wszystkie wybrane role widoczne jako chipy')
  );

  public readonly summaryMultiSelectControl = new FormControl<string[]>([
    'Odczyt', 'Zapis', 'Edycja', 'Usuwanie'
  ]);
  public readonly summaryMultiSelectConfig = ErpSelectBuilder.create((b) =>
    b
      .setLabel('Wielokrotny wybór z podsumowaniem (Wariant A)')
      .setPlaceholder('Wybierz uprawnienia')
      .setItems(['Odczyt', 'Zapis', 'Edycja', 'Usuwanie', 'Eksport', 'Import'])
      .setStrategy('multi')
      .setMaxChipsCount(2)
      .setHint('Przekroczono max 2 chipy -> wyświetla "Wybranych elementów (4)"')
  );

  public readonly virtualSelectControl = new FormControl<string | null>(null);
  public readonly virtualSelectConfig = ErpSelectBuilder.create((b) =>
    b
      .setLabel('Select z wirtualizacją (1,000 opcji)')
      .setPlaceholder('Szukaj magazynu...')
      .setItems(Array.from({ length: 1000 }, (_, i) => `Magazyn #${i + 1}`))
      .setStrategy('single')
      .setVirtualScroll(true)
      .setItemSize(40)
      .setSearchable(true)
      .setHeaderContent('Lista dostępnych magazynów ERP')
      .setHint('CDK Virtual Scroll przy 1,000 pozycjach')
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
    integer: this.integerControl,
    decimal: this.decimalControl,
    negative: this.negativeControl,
    singleSelect: this.singleSelectControl,
    multiSelect: this.multiSelectControl,
    summaryMultiSelect: this.summaryMultiSelectControl,
    virtualSelect: this.virtualSelectControl,
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
