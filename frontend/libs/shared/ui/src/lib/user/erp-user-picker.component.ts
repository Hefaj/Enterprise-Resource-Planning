import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl } from '@angular/forms';

import { ERP_USER_DIRECTORY, ErpUserRef } from '@erp/shared/util';

import { ErpInputPickerComponent } from '../form/erp-input-picker/erp-input-picker.component';
import {
  ErpInputPickerConfig,
  ErpInputPickerSearchQuery,
  ErpInputPickerSearchResult,
} from '../form/erp-input-picker/erp-input-picker.types';
import { SHARED_KEYS } from '../translation';

/** Rozmiar strony doładowywanej przy przewijaniu listy. */
const PAGE_SIZE = 25;

/** Wysokość wiersza listy (px) — katalog firmy potrafi mieć tysiące pozycji. */
const ROW_HEIGHT = 36;

/**
 * Konfiguracja wystawiana na zewnątrz — bez pól wiązanych z katalogiem (`items`/`searchFn`/
 * `getFn`) i bez `valueKey`: picker keszuje pozycje pod wartością oddawaną do modelu, więc musi
 * nią zostać `uuid`. Inaczej kolejne `getFn` dostawałoby identyfikatory, których katalog
 * nie rozumie.
 */
export type ErpUserPickerConfig = Omit<
  ErpInputPickerConfig<ErpUserRef, string>,
  'items' | 'searchFn' | 'getFn' | 'valueKey'
> & {
  /** Czy dopuścić konta wyłączone. Domyślnie nie — picker wskazuje osobę, która ma coś zrobić. */
  includeInactive?: boolean;
};

/**
 * Wybór użytkownika — <b>jeden picker dla całego systemu</b>.
 *
 * <p>Mieszka w <c>shared/ui</c>, a nie w module Identity, bo wybiera się tu ludzi w każdej
 * domenie: przypisany w Task Management, akceptujący w DMS, odbiorca powiadomienia. Kopia
 * per moduł oznaczałaby cztery pickery z czterema cache’ami tych samych osób — a scope’y NX
 * i tak nie pozwalają modułom sięgnąć do <c>@erp/identity/data-access</c>.</p>
 *
 * <p><b>Dane bierze przez port <c>ERP_USER_DIRECTORY</c>, nie przez serwis HTTP.</b> Reguła
 * <c>@nx/enforce-module-boundaries</c> zabrania <c>type:ui</c> zależeć od <c>type:data-access</c>,
 * więc kontrakt leży w <c>@erp/shared/util</c>, a implementację wstrzykuje
 * <c>provideErpUserDirectory()</c> w konfiguracji aplikacji.</p>
 *
 * <p>Model formularza to <c>uuid</c> (single) albo <c>string[]</c> (multi) — wartości początkowe
 * z kontrolki picker rozwiązuje sam, wołając <c>getFn</c> dla nieznanych identyfikatorów.</p>
 */
@Component({
  selector: 'erp-user-picker',
  standalone: true,
  imports: [ErpInputPickerComponent],
  template: ` <erp-input-picker [config]="pickerConfig()" [control]="control()" /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpUserPickerComponent {
  public readonly config = input<ErpUserPickerConfig>({});
  public readonly control = input<FormControl<string | string[] | null> | null>(null);

  /** Opcjonalnie: bez katalogu picker po prostu nic nie znajduje, zamiast wywracać ekran. */
  private readonly _directory = inject(ERP_USER_DIRECTORY, { optional: true });

  protected readonly pickerConfig = computed<ErpInputPickerConfig<ErpUserRef, string>>(() => {
    const cfg = this.config();

    return {
      ...cfg,
      valueKey: 'uuid',
      labelKey: cfg.labelKey ?? 'displayName',
      strategy: cfg.strategy ?? 'single',
      label: cfg.label ?? SHARED_KEYS.userPicker.label,
      placeholder: cfg.placeholder ?? SHARED_KEYS.userPicker.placeholder,
      searchPlaceholder: cfg.searchPlaceholder ?? SHARED_KEYS.userPicker.searchPlaceholder,
      emptyContent: cfg.emptyContent ?? SHARED_KEYS.userPicker.empty,
      pageSize: cfg.pageSize ?? PAGE_SIZE,
      virtualScroll: cfg.virtualScroll ?? ROW_HEIGHT,
      searchFn: (query) => this._search(query, cfg.includeInactive ?? false),
      getFn: (uuids) => this._resolve(uuids),
    };
  });

  /**
   * `pageIndex` pickera liczy od zera, `page` w kontrakcie HTTP od jedynki — bez tego
   * przesunięcia backend klampuje 0 do 1 i pierwsza doładowana strona powtarza pierwszą.
   */
  private async _search(
    query: ErpInputPickerSearchQuery,
    includeInactive: boolean,
  ): Promise<ErpInputPickerSearchResult> {
    if (!this._directory) {
      return { uuids: [], totalCount: 0 };
    }

    const page = await this._directory.searchAsync({
      text: query.search?.trim() || undefined,
      page: query.pageIndex + 1,
      pageSize: query.pageSize,
      includeInactive,
    });

    return { uuids: [...page.uuids], totalCount: page.totalCount };
  }

  /**
   * Dobiera pozycje dla identyfikatorów, których picker nie ma jeszcze u siebie.
   *
   * <b>Bez filtra aktywności</b>, świadomie: wartość już wybrana (przypisany sprzed roku)
   * musi wyświetlić się nazwiskiem także wtedy, gdy konto zostało w międzyczasie wyłączone.
   * Filtr obowiązuje przy szukaniu nowej osoby, nie przy pokazywaniu starego wyboru.
   */
  private async _resolve(uuids: string[]): Promise<ErpUserRef[]> {
    if (!this._directory || uuids.length === 0) {
      return [];
    }

    const users = await this._directory.getManyAsync(uuids);
    const byUuid = new Map(users.map((user) => [user.uuid, user]));

    return uuids
      .map((uuid) => byUuid.get(uuid))
      .filter((user): user is ErpUserRef => user !== undefined);
  }
}
