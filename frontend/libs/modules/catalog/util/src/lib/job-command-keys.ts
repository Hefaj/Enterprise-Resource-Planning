/**
 * Klucze tłumaczeń opisujące operacje masowe tego modułu w feedzie powiadomień.
 *
 * Leżą w scope'ie `shared`, a nie w `product`, i to jest tu sedno: wiersz powiadomienia
 * renderuje komponent z modułu `notification`, który nie ma (i nie powinien mieć) załadowanego
 * scope'u tłumaczeń Catalogu. Scope `shared` jest jedynym, który widzą oba moduły naraz.
 *
 * Stałe mieszkają w `util`, bo używa ich `data-access` (orkiestrator, przy zlecaniu operacji),
 * a ten nie może zależeć od `type:ui`, gdzie żyje wygenerowany rejestr `SHARED_KEYS`.
 */
export const CATALOG_JOB_COMMAND_KEYS = {
  setPrice: 'shared.jobs.commands.catalogProductSetPrice',
  setName: 'shared.jobs.commands.catalogProductSetName',
  addMultimedia: 'shared.jobs.commands.catalogProductAddMultimedia',
  removeMultimedia: 'shared.jobs.commands.catalogProductRemoveMultimedia',
  setMultimedia: 'shared.jobs.commands.catalogProductSetMultimedia',
  // Operacje na samej bibliotece mediów, nie na galerii produktu — stąd inny agregat w nazwie.
  removeAsset: 'shared.jobs.commands.catalogMultimediaRemove',
  generateDerivatives: 'shared.jobs.commands.catalogMultimediaGenerateDerivatives',
} as const;
