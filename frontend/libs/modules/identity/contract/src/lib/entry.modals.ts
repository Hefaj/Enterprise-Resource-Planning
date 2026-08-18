/** Identyfikatory modali tego modułu — na razie brak (moduł ma dopiero placeholder). */
export const remoteModalIds: string[] = [];

/** Ładuje i zwraca definicje modali tego modułu. Wywoływane przez ErpModalService przy lazy loadingu. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function registerModals(): Promise<any[]> {
  return [];
}

/** Ładuje providery tłumaczeń dla modali z tego remota — ErpModalService wstrzykuje je automatycznie. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getModalProviders(): Promise<any[]> {
  const { provideIdentityTranslations } = await import('@erp/identity/feature');
  return provideIdentityTranslations();
}
