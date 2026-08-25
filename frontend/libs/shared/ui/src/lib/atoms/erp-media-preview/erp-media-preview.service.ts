import { Injectable, Injector, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ErpMediaPreviewComponent } from './erp-media-preview.component';
import { ErpMediaPreviewConfig } from './erp-media-preview.types';

/**
 * Jedno wspólne okno podglądu pliku dla wszystkich modułów.
 *
 * <b>Dlaczego w `shared/ui`, a nie w `catalog/ui`.</b> Oglądanie zdjęcia to element języka UI,
 * nie domeny katalogu — DMS z fakturami i każdy kolejny moduł trzymający pliki potrzebuje
 * dokładnie tego samego okna. Ta sama droga, którą przeszedł
 * [`ErpConfirmDialogService`](../erp-confirm-dialog/erp-confirm-dialog.service.ts), zanim
 * zebrano jego dwie modułowe kopie w jedną.
 *
 * Atom pozostaje przy tym niemy: <b>sam niczego nie pobiera</b>. Adresy przyjeżdżają
 * w konfiguracji jako sygnały, a kto je wypełni — wariant `preview` z magazynu, adres
 * zewnętrzny czy `blob:` — jest sprawą modułu. Inaczej `shared/ui` musiałoby znać
 * `catalog/data-access`, czyli dokładnie tę zależność, której zakazuje
 * `@nx/enforce-module-boundaries`.
 */
@Injectable({ providedIn: 'root' })
export class ErpMediaPreviewService {
  private readonly _dialogs = inject(TuiDialogService);
  private readonly _injector = inject(Injector);

  /**
   * Otwiera podgląd. Strumień kończy się przy zamknięciu okna — przyciskiem, klawiszem Esc
   * albo kliknięciem w tło; podgląd niczego nie zwraca, bo niczego nie rozstrzyga.
   */
  public open(config: ErpMediaPreviewConfig): Observable<void> {
    return this._dialogs.open<void>(
      new PolymorpheusComponent(ErpMediaPreviewComponent, this._injector),
      {
        size: 'l',
        // Nagłówek z nazwą pliku i własnym zamknięciem rysuje komponent — pasek Taigi
        // przyjmuje gotowy tekst, a my chcemy tam nazwę pliku obok licznika i pobierania.
        closable: false,
        dismissible: true,
        data: config,
      },
    );
  }
}
