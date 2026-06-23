/**
 * Identyfikatory modali modułu Catalog.
 *
 * Każdy ID to hash MD5 gwarantujący unikalność i niezależność od konwencji nazewnictwa.
 * Definiowane w warstwie `util` (lekka, zero zależności od komponentów)
 * aby mogły być importowane zarówno przez `feature` (definicje modali)
 * jak i `contract` (lekki `remoteModalIds` ładowany przy STARTUP).
 *
 * ─── Generowanie nowego ID ───
 *   node -e "console.log(require('crypto').createHash('md5').update('scope.entity.action').digest('hex'))"
 */

/** Modal: Seryjna edycja ceny produktów */
export const SET_PRICE_MODAL_ID = '2cff8772bd344f1faa99b31e8c1bfccd';
