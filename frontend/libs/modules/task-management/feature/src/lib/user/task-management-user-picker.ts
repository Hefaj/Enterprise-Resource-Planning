import { ErpInputPickerBuilder, ErpInputPickerConfig, ErpInputPickerSearchQuery, SHARED_KEYS, Translatable } from '@erp/shared/ui';
import { ErpUserDirectory, ErpUserRef } from '@erp/shared/util';

/** Katalog firmy może mieć tysiące pozycji, dlatego picker ładuje strony, nie całą listę. */
const PAGE_SIZE = 25;
const ROW_HEIGHT = 36;

export interface TaskManagementUserPickerOptions {
  readonly label?: Translatable;
  readonly placeholder?: Translatable;
  readonly strategy?: 'single' | 'multi';
  readonly includeInactive?: boolean;
}

/**
 * Konfiguracja wyboru osoby w formularzu Task Management.
 *
 * To celowo nie jest komponent w `shared/ui`: Task Management jest właścicielem swojego
 * formularza, a katalog użytkowników dostaje przez port. Kolejny moduł składa analogiczną
 * konfigurację we własnym `feature`, używając nadal tego samego cache'u i `erp-input-picker`.
 */
export function taskManagementUserPickerConfig(directory: ErpUserDirectory | null, options: TaskManagementUserPickerOptions = {}): ErpInputPickerConfig<ErpUserRef, string> {
  const builder = new ErpInputPickerBuilder<ErpUserRef, string>();
  configureTaskManagementUserPicker(directory, options)(builder);
  return builder.build();
}

/** Ta sama konfiguracja dla pól budowanych przez `ErpStepContentBuilder` lub `ErpFilterBuilder`. */
export function configureTaskManagementUserPicker(directory: ErpUserDirectory | null, options: TaskManagementUserPickerOptions = {}): (builder: ErpInputPickerBuilder<ErpUserRef, string>) => void {
  return (builder) => {
    builder
      .setLabel(options.label)
      .setPlaceholder(options.placeholder ?? SHARED_KEYS.inputPicker.search)
      .setSearchPlaceholder(SHARED_KEYS.inputPicker.search)
      .setEmptyContent(SHARED_KEYS.inputPicker.empty)
      .setStrategy(options.strategy ?? 'single')
      .setLabelKey('displayName')
      .setValueKey('uuid')
      .setPageSize(PAGE_SIZE)
      .setVirtualScroll(ROW_HEIGHT)
      .setSearchFn((query: ErpInputPickerSearchQuery) => _searchAsync(directory, query, options.includeInactive ?? false))
      .setGetFn((uuids: string[]) => _resolveAsync(directory, uuids));
  };
}

/** `pageIndex` pickera liczy od zera, endpoint katalogowy od jedynki. */
async function _searchAsync(directory: ErpUserDirectory | null, query: ErpInputPickerSearchQuery, includeInactive: boolean): Promise<{ uuids: string[]; totalCount: number }> {
  if (!directory) {
    return { uuids: [], totalCount: 0 };
  }

  const page = await directory.searchAsync({
    text: query.search.trim() || undefined,
    page: query.pageIndex + 1,
    pageSize: query.pageSize,
    includeInactive,
  });

  return { uuids: [...page.uuids], totalCount: page.totalCount };
}

/** Wybrane wcześniej konto może być nieaktywne — po UUID nadal musi pokazać nazwę. */
async function _resolveAsync(directory: ErpUserDirectory | null, uuids: string[]): Promise<ErpUserRef[]> {
  if (!directory || uuids.length === 0) {
    return [];
  }

  const users = await directory.getManyAsync(uuids);
  const byUuid = new Map(users.map((user) => [user.uuid, user]));

  return uuids.map((uuid) => byUuid.get(uuid)).filter((user): user is ErpUserRef => user !== undefined);
}
