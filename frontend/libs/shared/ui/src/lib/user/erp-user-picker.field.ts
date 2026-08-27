import { ErpUserDirectory, ErpUserRef } from '@erp/shared/util';

import { ErpInputPickerBuilder } from '../form/erp-input-picker/erp-input-picker.builder';
import { ErpInputPickerSearchQuery } from '../form/erp-input-picker/erp-input-picker.types';
import { Translatable } from '../base/erp-signal-utils';
import { SHARED_KEYS } from '../translation';

/** Rozmiar strony i wysokość wiersza — te same, co w `erp-user-picker`. */
const PAGE_SIZE = 25;
const ROW_HEIGHT = 36;

export interface ErpUserPickerFieldOptions {
  label?: Translatable;
  placeholder?: Translatable;
  strategy?: 'single' | 'multi';

  /** Czy dopuścić konta wyłączone. Domyślnie nie. */
  includeInactive?: boolean;
}

/**
 * Wybór użytkownika jako <b>pole formularza</b> — dla modali i kroków operacji masowych,
 * które składają formularz builderem (`ErpStepContentBuilder.addFormField`), a nie z komponentów.
 *
 * <p>Odpowiednik <c>erp-user-picker</c> dla tej drugiej drogi. Dzięki temu wybór osoby wygląda
 * i zachowuje się tak samo w modalu „Przypisz zgłoszenia” i w polu na karcie, a wiedza o tym,
 * skąd biorą się użytkownicy, zostaje w jednym pliku.</p>
 *
 * ```ts
 * .addFormField('assigneeUuid', 'inputPicker', erpUserPickerField(directory), { … })
 * ```
 *
 * @param directory katalog z <c>ERP_USER_DIRECTORY</c>; <c>null</c> daje pole, które niczego
 *   nie znajduje, zamiast wywracać modal (test, aplikacja bez Identity).
 */
export function erpUserPickerField(
  directory: ErpUserDirectory | null,
  options: ErpUserPickerFieldOptions = {},
): (builder: ErpInputPickerBuilder) => void {
  return (builder) => {
    builder
      .setLabel(options.label ?? SHARED_KEYS.userPicker.label)
      .setPlaceholder(options.placeholder ?? SHARED_KEYS.userPicker.placeholder)
      .setSearchPlaceholder(SHARED_KEYS.userPicker.searchPlaceholder)
      .setEmptyContent(SHARED_KEYS.userPicker.empty)
      .setStrategy(options.strategy ?? 'single')
      .setLabelKey('displayName')
      .setValueKey('uuid')
      .setPageSize(PAGE_SIZE)
      .setVirtualScroll(ROW_HEIGHT)
      .setSearchFn(async (query: ErpInputPickerSearchQuery) => {
        if (!directory) {
          return { uuids: [], totalCount: 0 };
        }

        // `pageIndex` liczy od zera, `page` w kontrakcie HTTP od jedynki.
        const page = await directory.searchAsync({
          text: query.search?.trim() || undefined,
          page: query.pageIndex + 1,
          pageSize: query.pageSize,
          includeInactive: options.includeInactive ?? false,
        });

        return { uuids: [...page.uuids], totalCount: page.totalCount };
      })
      .setGetFn(async (uuids: string[]) => {
        if (!directory || uuids.length === 0) {
          return [];
        }

        const users = await directory.getManyAsync(uuids);
        const byUuid = new Map(users.map((user) => [user.uuid, user]));

        // Wartość już wybrana wraca bez filtra aktywności — przypisany sprzed roku musi
        // pokazać się nazwiskiem także po wyłączeniu konta.
        return uuids.map((uuid) => byUuid.get(uuid)).filter((user): user is ErpUserRef => user !== undefined);
      });
  };
}
