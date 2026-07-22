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
  ErpInputPickerComponent,
  ErpInputPickerBuilder,
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
    ErpInputPickerComponent,
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

  // Dane i kontrolki dla ErpInputPicker
  public readonly warehouses = [
    { id: 101, name: 'Magazyn Centralny (Warszawa)', code: 'WAW-01' },
    { id: 102, name: 'Magazyn Południowy (Kraków)', code: 'KRK-02' },
    { id: 103, name: 'Magazyn Zachodni (Poznań)', code: 'POZ-03' },
    { id: 104, name: 'Magazyn Północny (Gdańsk)', code: 'GDA-04' },
  ];

  public readonly singlePickerControl = new FormControl<number | null>(101, [Validators.required]);
  public readonly singlePickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel('Wybór magazynu (Single Value Picker)')
      .setPlaceholder('Wpisz nazwę magazynu lub wybierz z listy...')
      .setItems(this.warehouses)
      .setStrategy('single')
      .setLabelKey('name')
      .setValueKey('id')
      .setHint('Filtrowanie wpisywanym tekstem. Po wybraniu zwraca ID (nr 101, 102...)')
      .setTooltip('Wybierz pojedynczy magazyn')
      .setErrorMessages({ required: 'Wybór magazynu jest wymagany!' })
  );

  public readonly categories = [
    { id: 'cat-1', name: 'Elektronika' },
    { id: 'cat-2', name: 'Odzież i obuwie' },
    { id: 'cat-3', name: 'Dom i ogród' },
    { id: 'cat-4', name: 'Sport i rekreacja' },
    { id: 'cat-5', name: 'Motoryzacja' },
  ];

  public readonly multiPickerControl = new FormControl<string[]>(['cat-1', 'cat-4'], [Validators.required]);
  public readonly multiPickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel('Wybór kategorii (Multi Value Picker)')
      .setPlaceholder('Wyszukaj i zaznacz kategorie...')
      .setItems(this.categories)
      .setStrategy('multi')
      .setDisplayExtractor((item: any) => `${item.name} (${item.id})`)
      .setValueExtractor((item: any) => item.id)
      .setMaxCollapseCount(2)
      .setHint('Lista opcji posiada checkboxy. Po przekroczeniu 2 zaznaczonych pozycji wyświetla się "Zaznaczone (X)".')
      .setTooltip('Zaznacz odpowiednie kategorie')
      .setStrict(false)
      .setErrorMessages({ required: 'Wybierz przynajmniej jedną kategorię!' })
  );

  // Wirtualizacja (10 000 elementów)
  public readonly virtualItems = Array.from({ length: 10000 }, (_, i) => ({
    id: i + 1,
    name: `Produkt wirtualny #${i + 1}`,
    sku: `SKU-${100000 + i}`,
  }));

  public readonly virtualSinglePickerControl = new FormControl<number | null>(100, [Validators.required]);
  public readonly virtualSinglePickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel('Wybór produktu z 10 000 pozycji (Virtual Scroll - Single)')
      .setPlaceholder('Wpisz nazwę lub SKU lub wybierz z listy...')
      .setItems(this.virtualItems)
      .setStrategy('single')
      .setLabelKey('name')
      .setValueKey('id')
      .setDisplayExtractor((item: any) => `${item.name} (${item.sku})`)
      .setVirtualScroll(36)
      .setHint('Wirtualizacja Angular CDK ze wsparciem dla 10 000 pozycji.')
      .setTooltip('Przesuwaj płynnie listę 10 tys. elementów')
  );

  public readonly virtualMultiPickerControl = new FormControl<number[]>([1, 5, 100], [Validators.required]);
  public readonly virtualMultiPickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel('Wybór wielu produktów z 10 000 pozycji (Virtual Scroll - Multi)')
      .setPlaceholder('Zaznacz produkty...')
      .setItems(this.virtualItems)
      .setStrategy('multi')
      .setLabelKey('name')
      .setValueKey('id')
      .setDisplayExtractor((item: any) => `${item.name} (${item.sku})`)
      .setVirtualScroll(36)
      .setStrict(false)
      .setMaxCollapseCount(2)
      .setHint('Wirtualne ładowanie multiselect z checkboxami. Domyślnie zaznaczone 3 pozycje powodują zwinięcie do "Zaznaczone (3)".')
      .setTooltip('Zaznacz wiele z 10 tys. elementów')
  );

  // Symulacja bazy danych na backendzie z 5000 pozycji po UUID
  public readonly serverDatabase = Array.from({ length: 5000 }, (_, i) => ({
    uuid: `3fa85f64-5717-4562-b3fc-${String(100000 + i).padStart(12, '0')}`,
    name: `Asynchroniczny Produkt #${i + 1}`,
    sku: `SKU-ASYNC-${i + 1}`,
  }));

  public async mockSearchEndpoint(query: { search: string; pageIndex: number; pageSize: number }): Promise<string[]> {
    await new Promise(r => setTimeout(r, 400));
    const filtered = this.serverDatabase.filter(item =>
      !query.search ||
      item.name.toLowerCase().includes(query.search.toLowerCase()) ||
      item.sku.toLowerCase().includes(query.search.toLowerCase())
    );
    const start = query.pageIndex * query.pageSize;
    return filtered.slice(start, start + query.pageSize).map(i => i.uuid);
  }

  public async mockGetEndpoint(uuids: string[]): Promise<any[]> {
    await new Promise(r => setTimeout(r, 200));
    const idSet = new Set(uuids);
    return this.serverDatabase.filter(item => idSet.has(item.uuid));
  }

  public readonly asyncSinglePickerControl = new FormControl<string | null>(this.serverDatabase[10]?.uuid ?? null, [Validators.required]);
  public readonly asyncSinglePickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel('Wybór asynchroniczny po UUID (Pagination Search + Get - Single)')
      .setPlaceholder('Wpisz frazę lub wybierz z listy...')
      .setStrategy('single')
      .setLabelKey('name')
      .setValueKey('uuid')
      .setDisplayExtractor((item: any) => `${item.name} (${item.sku})`)
      .setPageSize(30)
      .setSearchFn((query) => this.mockSearchEndpoint(query))
      .setGetFn((uuids) => this.mockGetEndpoint(uuids))
      .setVirtualScroll(36)
      .setHint('Asynchroniczna paginacja: search(filters, page, size) zwraca UUID-y, get(uuids) pobiera obiekty.')
      .setTooltip('Wyszukiwanie paginowane z API')
  );

  public readonly asyncMultiPickerControl = new FormControl<string[]>([
    this.serverDatabase[0]?.uuid ?? '',
    this.serverDatabase[5]?.uuid ?? '',
    this.serverDatabase[25]?.uuid ?? '',
  ], [Validators.required]);
  public readonly asyncMultiPickerConfig = ErpInputPickerBuilder.create((b) =>
    b
      .setLabel('Wybór wielokrotny asynchroniczny po UUID (Pagination Search + Get - Multi)')
      .setPlaceholder('Wyszukaj i zaznacz produkty na serwerze...')
      .setStrategy('multi')
      .setLabelKey('name')
      .setValueKey('uuid')
      .setDisplayExtractor((item: any) => `${item.name} (${item.sku})`)
      .setPageSize(30)
      .setSearchFn((query) => this.mockSearchEndpoint(query))
      .setGetFn((uuids) => this.mockGetEndpoint(uuids))
      .setVirtualScroll(36)
      .setErrorMessages({required: 'Pole jest wymagane!!!'})
      .setMaxCollapseCount(2)
      .setHint('Początkowe lub wyszukane UUID-y rozwiązują się automatycznie przez get(uuids).')
      .setTooltip('Zaznacz z paginowanego API')
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
    singlePicker: this.singlePickerControl,
    multiPicker: this.multiPickerControl,
    virtualSinglePicker: this.virtualSinglePickerControl,
    virtualMultiPicker: this.virtualMultiPickerControl,
    asyncSinglePicker: this.asyncSinglePickerControl,
    asyncMultiPicker: this.asyncMultiPickerControl,
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
