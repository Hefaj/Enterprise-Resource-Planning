import { InjectionToken } from '@angular/core';

/**
 * Adres bazowy mikroserwisu Identity (domyślnie `http://localhost:5280` w dev — patrz
 * `remote-api.providers.ts` hosta). Osobny plik, nie część wygenerowanego klienta NSwag —
 * token musi istnieć niezależnie od tego, czy klient już został wygenerowany, bo
 * `app.config.ts` (tryb samodzielny) i `remote-api.providers.ts` (tryb osadzony w hoście)
 * potrzebują go od pierwszego commita modułu.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');
