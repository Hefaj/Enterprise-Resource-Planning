import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, ReactiveFormsModule, NG_VALUE_ACCESSOR, FormControl } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { CoreInputBase } from '../../_base/core-input-base';
import { noop } from 'rxjs';
import { EInputTextBuilder } from './core-input-text.builder';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { AutoFocusModule } from 'primeng/autofocus';

export { EInputTextBuilder };

export interface CoreInputText extends CoreInputBase {
  icon?: string;
}

@Component({
  selector: 'core-input-text',
  imports: [InputTextModule, ReactiveFormsModule, FloatLabelModule, MessageModule, AutoFocusModule],
  templateUrl: './core-input-text.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CoreInputTextComponent),
      multi: true,
    },
  ],
})
export class CoreInputTextComponent implements ControlValueAccessor {
  public config = input.required<CoreInputText>();

  // Opcjonalna kontrolka wstrzykiwana z zewnątrz (dla dynamicznych widoków)
  public control = input<FormControl | null>(null);

  // Nasz wewnętrzny "zapasowy" kontroler, jeśli ktoś używa podejścia statycznego z CVA
  public internalControl = new FormControl();

  public get activeControl(): FormControl {
    return this.control() || this.internalControl;
  }

  public getErrorMessage(): string | null {
    console.log('err');
    const ctrl = this.activeControl;
    const errorMessages = this.config().errorMessages || {};

    // Jeśli pole jest poprawne, albo użytkownik go jeszcze nie dotknął - nie pokazuj błędu
    if (ctrl.valid || (ctrl.pristine && !ctrl.touched)) {
      return null;
    }

    // Jeśli są błędy, weź pierwszy z brzegu
    if (ctrl.errors) {
      const firstErrorKey = Object.keys(ctrl.errors)[0]; // np. 'required'

      // Zwróć tekst z configa LUB domyślny tekst
      return errorMessages[firstErrorKey] || `Błąd walidacji: ${firstErrorKey}`;
    }

    return null;
  }

  // Puste funkcje callback, które Angular nadpisze swoimi
  public onTouched: () => void = noop;
  private _onChange: (value: string) => void = noop;

  // --- IMPLEMENTACJA INTERFEJSU CONTROL VALUE ACCESSOR ---

  // Angular mówi: "Zaktualizuj widok, bo w kodzie TS zmieniłem wartość formularza"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public writeValue(val: any): void {
    this.internalControl.setValue(val, { emitEvent: false });
  }

  // Angular podrzuca nam funkcję: "Zawołaj ją, jak użytkownik coś wpisze"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  // Angular podrzuca nam funkcję: "Zawołaj ją, jak użytkownik wyjdzie z pola (blur)"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // Angular mówi: "Zablokuj/odblokuj to pole (np. formularz.disable())"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setDisabledState(isDisabled: boolean): void {
    // this.isDisabled = isDisabled;
  }

  // --- WEWNĘTRZNE METODY DLA HTML ---

  public onValueChange(newValue: string): void {
    this.internalControl.setValue(newValue, { emitEvent: false });
    this._onChange(newValue); // Informujemy Angulara o nowej wartości!
  }
}
