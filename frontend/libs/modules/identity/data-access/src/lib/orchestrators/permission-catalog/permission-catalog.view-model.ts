import { PermissionCatalogEntryDto } from '../../api-client';

/**
 * `PermissionCatalogEntryDto` nie ma własnego `uuid` — kluczem naturalnym jest `code`
 * (`{moduł}.{zasób}.{akcja}`, patrz `docs/backend/identity-authz.md` §3). `uuid` tutaj to
 * syntetyczny klucz identity-mapy (= `code`), nigdy nie wysyłany do API.
 */
export interface PermissionCatalogItemDto extends PermissionCatalogEntryDto {
  readonly uuid: string;
}

/** Brak wzbogaceń — katalog jest już kompletny w jednej odpowiedzi. */
export type PermissionCatalogVM = PermissionCatalogItemDto;
