import { SET_PRICE_MODAL_ID } from '@erp/catalog/util';

/**
 * Identyfikatory modali tego modułu.
 *
 * Lekka tablica stringów (zero importów z feature) ładowana przy STARTUP
 * razem z menu. Służy do budowy globalnej mapy `modalId → modulePrefix`
 * w ErpModalService, aby wiedzieć skąd załadować modal na żądanie.
 */
export const remoteModalIds: string[] = [
  SET_PRICE_MODAL_ID,
];

/**
 * Asynchronicznie ładuje i zwraca tokeny DI definicji modali tego modułu.
 *
 * Używa dynamic import() aby NIE ściągać ciężkich zależności z feature
 * przy starcie aplikacji (contract jest ładowany przy STARTUP dla menu).
 *
 * Wywoływana lazy przez ErpModalService.open() gdy użytkownik
 * kliknie np. w notyfikację o nieudanym jobie.
 *
 * @returns Tablica tokenów DI (klas ModalDefinition) do zarejestrowania przez inject()
 */
export async function registerModals(): Promise<any[]> {
  const { SetPriceModalDefinition } = await import('@erp/catalog/feature');
  return [SetPriceModalDefinition];
}
