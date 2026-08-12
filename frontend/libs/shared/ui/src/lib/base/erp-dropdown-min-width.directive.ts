import { Directive, inject } from '@angular/core';
import { TUI_DROPDOWN_OPTIONS } from '@taiga-ui/core';

/**
 * `tui-textfield` narzuca domyślnie `TuiDropdownFixed` (szerokość dropdownu = dokładnie
 * szerokość inputu), przez co treść panelu (drzewo, lista, textarea) w wąskim kontenerze
 * (np. panel filtrów) ucina się niezależnie od dostępnego miejsca. Ta dyrektywa nadpisuje
 * `limitWidth` na `'min'` — panel nie będzie węższy niż input, ale może się poszerzyć
 * (docelowy `min-width`/`max-width` panelu ustawia już komponent, który z niej korzysta).
 *
 * Wzorem `TuiDropdownAuto` z taiga-ui: nadpisanie przez ponowne dostarczenie tokenu nie
 * działa niezawodnie nad hostDirective `tui-textfield`, więc mutujemy współdzieloną
 * instancję opcji. Dyrektywę nakładamy bezpośrednio na `<tui-textfield>`.
 */
@Directive({
  selector: '[erpDropdownMinWidth]',
  standalone: true,
})
export class ErpDropdownMinWidthDirective {
  constructor() {
    // `limitWidth` jest typowane jako `readonly` w publicznym `TuiDropdownOptions`, ale to
    // ta sama, konkretna instancja opcji co mutuje `TuiDropdownAuto` z taiga-ui —
    // rzutowanie tylko zdejmuje `readonly` na potrzeby przypisania.
    (inject(TUI_DROPDOWN_OPTIONS) as { limitWidth: string }).limitWidth = 'min';
  }
}
